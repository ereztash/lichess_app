import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));
const target = process.env.AUDIT_TARGET || 'broad-public';

const layerNames = [
  'product-evidence',
  'ux-accessibility',
  'correctness',
  'release-integrity',
  'operations',
  'security-privacy',
  'maintainability',
  'research-validity',
];
const criticalityPenalty = { P0: 45, P1: 25, P2: 10, P3: 4 };
const evidenceMultiplier = {
  'verified-now': 1,
  'repo-verified': 0.85,
  'field-required': 0.9,
  'external-unverified': 0.45,
  asserted: 0.55,
};

function normalizeLayer(type = '', id = '') {
  const overrides = {
    'R-13': 'maintainability',
    'R-22': 'release-integrity',
    'R-25': 'security-privacy',
    'R-26': 'release-integrity',
  };
  if (overrides[id]) return overrides[id];
  const t = type.toLowerCase();
  if (t.includes('ux')) return 'ux-accessibility';
  if (t.includes('correct')) return 'correctness';
  if (t.includes('ops')) return 'operations';
  if (t.includes('security') || t.includes('privacy')) return 'security-privacy';
  if (t.includes('research') || t.includes('evidence')) return 'research-validity';
  if (t.includes('product')) return 'product-evidence';
  if (t.includes('maintain') || t.includes('architecture')) return 'maintainability';
  return 'operations';
}

function classifyDebtState(state = '') {
  const s = state.toLowerCase();
  if (/refuted|fixed|closed/.test(s) && !/half fixed/.test(s)) return 'historical';
  if (/measured and deferred|\bdeferred\b|deliberately governed/.test(s)) return 'watch';
  if (/open|blocked|half fixed|partial|field required|field-required/.test(s)) return 'active';
  return 'watch';
}

function disposition(g) {
  if (g.evidence_status === 'external-unverified') return 'VERIFY_EXTERNAL_AUTHORITY';
  if (g.evidence_status === 'field-required') {
    return ['P0', 'P1'].includes(g.criticality)
      ? 'FIELD_REQUIRED_BEFORE_BROAD_DISTRIBUTION'
      : 'FIELD_REQUIRED_OR_ACCEPT_FOR_CONTROLLED_TRIAL';
  }
  if (g.criticality === 'P0') return 'BLOCK_RELEASE';
  if (g.criticality === 'P1') return 'FIX_BEFORE_BROAD_DISTRIBUTION';
  if (g.criticality === 'P2') return 'ACCEPT_FOR_CONTROLLED_TRIAL_OR_FIX';
  return 'DEFER';
}

function isBlocking(g) {
  if (target !== 'broad-public') return g.criticality === 'P0' && g.evidence_status !== 'external-unverified';
  if (!['P0', 'P1'].includes(g.criticality)) return false;
  return g.evidence_status !== 'external-unverified';
}

function firstParagraph(block) {
  return block
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .find((p) => p && !p.startsWith('#') && !p.startsWith('|') && !p.startsWith('---')) || '';
}

function gateText(block) {
  const gate = block.match(/\*\*Gate:\*\*\s*([\s\S]*?)(?=\n\s*\n|$)/i)?.[1];
  return gate ? gate.replace(/\s+/g, ' ').trim() : null;
}

function parseDebt(md) {
  const gaps = [];
  const watchItems = [];
  const excluded = [];
  const sectionRe = /^###\s+(R-\d+)\s+·\s+(.+)$/gm;
  const matches = [...md.matchAll(sectionRe)];

  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const block = md.slice(m.index, i + 1 < matches.length ? matches[i + 1].index : md.length);
    const state = (block.match(/\| state \| \*\*([^*]+)\*\*/i)?.[1] || '').trim();
    if (!state) continue;
    if (m[1] === 'R-21') continue; // current authority is GitHub Rulesets, checked live below.

    const stateClass = classifyDebtState(state);
    const type = /\| type \| ([^|]+) \|/i.exec(block)?.[1]?.trim() || 'ops';
    const criticality = /\| severity \| (P\d)/i.exec(block)?.[1] || 'P3';
    const basis = (block.match(/\| basis \| \*\*([^*]+)\*\*/i)?.[1] || '').trim();
    const external = /EXTERNAL_CONFIGURATION_REQUIRED|Vercel Hobby|outside the tree|GitHub reports/i.test(block);
    const field = /FIELD-REQUIRED|FIELD_REQUIRED|owner's to do|human/i.test(block);
    const evidence_status = external ? 'external-unverified' : field ? 'field-required' : /verified/i.test(basis) ? 'repo-verified' : 'asserted';
    const item = {
      id: m[1],
      title: m[2].trim(),
      layer: normalizeLayer(type, m[1]),
      state,
      criticality,
      evidence_status,
      problem_definition: m[2].trim(),
      mechanism_or_context: firstParagraph(block),
      closure_condition: gateText(block),
      evidence: basis ? [basis, `docs/MASTER_PRODUCT_DEBT.md#${m[1].toLowerCase()}`] : [`docs/MASTER_PRODUCT_DEBT.md#${m[1].toLowerCase()}`],
      source: 'registered-debt',
    };

    if (stateClass === 'historical') {
      excluded.push({ id: item.id, title: item.title, state: item.state, reason: 'historical/refuted evidence is not a current release gap' });
      continue;
    }
    if (stateClass === 'watch') {
      watchItems.push({ ...item, score_effect: 0, disposition: 'WATCH_ONLY' });
      continue;
    }
    gaps.push(item);
  }
  return { gaps, watchItems, excluded };
}

function commandGap(id, layer, criticality, title, command, args = []) {
  try {
    execFileSync(command, args, { cwd: root, stdio: 'pipe', timeout: 12 * 60 * 1000, env: process.env });
    return null;
  } catch (err) {
    const detail = String(err.stderr || err.stdout || `exit=${err.status ?? 'unknown'}`).slice(-5000);
    return {
      id, title, layer, state: 'open', criticality,
      evidence_status: 'verified-now',
      problem_definition: `${title}: ${[command, ...args].join(' ')} fails on the exact candidate revision audited by this Action.`,
      mechanism_or_context: 'A release invariant fails under the same dependency tree and source revision being considered for distribution.',
      closure_condition: `${[command, ...args].join(' ')} exits 0 in this Action.`,
      evidence: [detail],
      source: 'live-action-check',
    };
  }
}

async function githubRulesetGaps() {
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!repo || !token) return [];
  const headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' };
  try {
    const listRes = await fetch(`https://api.github.com/repos/${repo}/rulesets`, { headers });
    if (!listRes.ok) throw new Error(`rulesets HTTP ${listRes.status}`);
    const list = await listRes.json();
    const details = [];
    for (const item of list.filter((x) => x.enforcement === 'active')) {
      const r = await fetch(`https://api.github.com/repos/${repo}/rulesets/${item.id}`, { headers });
      if (r.ok) details.push(await r.json());
    }
    const rules = details.flatMap((d) => d.rules || []);
    const prRequired = rules.some((r) => r.type === 'pull_request');
    const noForce = rules.some((r) => r.type === 'non_fast_forward');
    const statusRules = rules.filter((r) => r.type === 'required_status_checks');
    const verifyRequired = statusRules.some((r) => (r.parameters?.required_status_checks || []).some((c) => c.context === 'verify'));
    const strict = statusRules.some((r) => r.parameters?.strict_required_status_checks_policy === true);
    const gaps = [];

    if (!(prRequired && noForce && verifyRequired)) {
      gaps.push({
        id: 'A-RELEASE-PROTECTION', title: 'Main is not fully protected by the expected merge controls', layer: 'release-integrity', state: 'open', criticality: 'P1', evidence_status: 'verified-now',
        problem_definition: 'A candidate can reach main without all expected PR / non-fast-forward / verify protections being enforced by the live GitHub authority.',
        mechanism_or_context: `Observed live rules: pull_request=${prRequired}, non_fast_forward=${noForce}, verify_required=${verifyRequired}.`,
        closure_condition: 'Live ruleset reports pull_request=true, non_fast_forward=true, and required status check verify.',
        evidence: ['GitHub Rulesets API queried by this Action'], source: 'live-external-authority',
      });
    }
    if (verifyRequired && !strict) {
      gaps.push({
        id: 'A-RELEASE-STALE-PR', title: 'A PR can retain a green verify after main changed underneath it', layer: 'release-integrity', state: 'open', criticality: 'P1', evidence_status: 'verified-now',
        problem_definition: 'Required status checks are not strict/up-to-date, so a PR verified against an older main can merge after another PR changes main without re-verifying the integrated candidate.',
        mechanism_or_context: 'The live ruleset requires verify but strict_required_status_checks_policy is false.',
        closure_condition: 'Live required_status_checks has strict_required_status_checks_policy=true, or production deploy is otherwise bound to a verified merge SHA.',
        evidence: ['GitHub Rulesets API queried by this Action'], source: 'live-external-authority',
      });
    }
    return gaps;
  } catch (err) {
    return [{
      id: 'A-RELEASE-AUTHORITY', title: 'Release protection could not be verified from the external authority', layer: 'release-integrity', state: 'unknown', criticality: 'P1', evidence_status: 'external-unverified',
      problem_definition: 'The repository contains release claims whose current truth lives in GitHub settings, but this Action could not read that authority.',
      mechanism_or_context: String(err), closure_condition: 'The Action can read the live ruleset and evaluate the release controls.',
      evidence: [String(err)], source: 'authority-gap',
    }];
  }
}

function explicitFieldGaps() {
  if (!exists('README.md')) return [];
  const r = read('README.md');
  const gaps = [];
  if (/עדיין לא נמדד על אף אדם/.test(r)) gaps.push({
    id: 'F-HUMAN-CORE', title: 'The live decision record has not been measured on a real human', layer: 'product-evidence', state: 'field required', criticality: 'P1', evidence_status: 'field-required',
    problem_definition: 'The product can prove the mechanism works in code, but not yet that a real player can use the live decision-record loop and produce the core calibration evidence.',
    mechanism_or_context: 'README explicitly states that the live record has not met a real player and the calibration gap has not been measured on any person.',
    closure_condition: 'Prospective human sessions produce the pre-engine decision record and the planned comprehension/continuation evidence.',
    evidence: ['README.md current-state statement'], source: 'current-claim-boundary',
  });
  if (/קורא מסך/.test(r) && /לא נמדד/.test(r)) gaps.push({
    id: 'F-SCREEN-READER', title: 'Screen-reader usability has not been measured', layer: 'ux-accessibility', state: 'field required', criticality: 'P2', evidence_status: 'field-required',
    problem_definition: 'Automated accessibility checks are green, but no NVDA, JAWS, or VoiceOver run has established that the labels and interaction model are usable through a screen reader.',
    mechanism_or_context: 'axe validates machine-checkable rules, not whether the authored labels and chess interaction are understandable.',
    closure_condition: 'A documented screen-reader walkthrough completes the core decision → reveal → next-decision path with named defects or a clean result.',
    evidence: ['README.md current-state statement'], source: 'current-claim-boundary',
  });
  return gaps;
}

const parsedDebt = exists('docs/MASTER_PRODUCT_DEBT.md')
  ? parseDebt(read('docs/MASTER_PRODUCT_DEBT.md'))
  : { gaps: [], watchItems: [], excluded: [] };
const gaps = [...parsedDebt.gaps, ...explicitFieldGaps(), ...await githubRulesetGaps()];

for (const g of [
  commandGap('A-TYPECHECK', 'correctness', 'P1', 'Typecheck fails', 'npm', ['run', 'check']),
  commandGap('A-BUILD', 'release-integrity', 'P1', 'Production build fails', 'npm', ['run', 'build']),
  commandGap('A-TEST', 'correctness', 'P1', 'Test suite fails', 'npm', ['test']),
  commandGap('A-GATES', 'correctness', 'P1', 'Invariant gates fail', 'npm', ['run', 'gates']),
  commandGap('A-GATE-CONTROLS', 'correctness', 'P1', 'Gate positive controls fail', 'npm', ['run', 'gates:controls']),
  commandGap('A-BUNDLE', 'maintainability', 'P2', 'Bundle budget fails', 'npm', ['run', 'bundle:budget']),
]) if (g) gaps.push(g);

for (const g of gaps) {
  g.disposition = disposition(g);
  g.blocking = isBlocking(g);
  g.priority_score = Math.min(100, Math.round((criticalityPenalty[g.criticality] || 4) * 2.2 * (evidenceMultiplier[g.evidence_status] || 0.5)));
}

const layerScores = layerNames.map((layer) => {
  const items = gaps.filter((g) => g.layer === layer);
  const pressure = items.reduce((sum, g) => sum + (criticalityPenalty[g.criticality] || 4) * (evidenceMultiplier[g.evidence_status] || 0.5), 0);
  return {
    layer,
    gap_pressure_score: Math.min(100, Math.round(pressure)),
    known_gap_count: items.length,
    blockers: items.filter((g) => g.blocking).length,
    interpretation: items.length ? 'KNOWN_GAPS_PRESENT' : 'NO_GAP_DETECTED_UNDER_CURRENT_EVIDENCE',
  };
});

const blockers = gaps.filter((g) => g.blocking);
const report = {
  schema: 'pre-release-gap-audit/v3', generated_at: new Date().toISOString(), git_sha: process.env.GITHUB_SHA || null, target,
  purpose: 'Identify decision-relevant gaps before distribution. Scores express identified gap pressure; criticality and evidence authority remain separate.',
  release_verdict: blockers.length ? 'NOT_READY_FOR_TARGET_DISTRIBUTION' : 'NO_VERIFIED_P0_P1_BLOCKERS_FOR_TARGET',
  score_rule: 'Layer gap-pressure starts at 0 and rises with evidence-weighted open gaps: P0 45, P1 25, P2 10, P3 4. Zero means no gap was detected under current evidence; it does NOT mean perfect readiness. No global composite is produced.',
  criticality_rule: 'P0 release-stopper; P1 broad-distribution blocker/core-evidence invalidator; P2 bounded risk acceptable for controlled trial; P3 hygiene.',
  layer_scores: layerScores,
  gaps: gaps.sort((a, b) => b.priority_score - a.priority_score),
  watch_items: parsedDebt.watchItems,
  historical_excluded: parsedDebt.excluded,
};

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/pre-release-audit.json'), JSON.stringify(report, null, 2));
const md = ['# Pre-release gap audit', '', `**Target:** ${target}`, `**Verdict:** ${report.release_verdict}`, `**SHA:** ${report.git_sha || 'local'}`, '', '> Layer score = identified gap pressure (higher is worse). 0 means no gap was detected under current evidence, not perfect readiness.', '', '## Layer gap pressure', '', '| Layer | Gap pressure | Known gaps | Blocking |', '|---|---:|---:|---:|'];
for (const l of layerScores) md.push(`| ${l.layer} | ${l.gap_pressure_score}/100 | ${l.known_gap_count} | ${l.blockers} |`);
md.push('', '## Decision-relevant gaps', '');
for (const g of report.gaps) {
  md.push(`### ${g.id} · ${g.title}`, '', `- **Priority score:** ${g.priority_score}/100`, `- **Criticality:** ${g.criticality}`, `- **Layer:** ${g.layer}`, `- **Evidence:** ${g.evidence_status}`, `- **Blocking:** ${g.blocking ? 'yes' : 'no'}`, `- **Disposition:** ${g.disposition}`, `- **Problem:** ${g.problem_definition}`, `- **Mechanism / context:** ${g.mechanism_or_context || 'not yet isolated'}`, `- **Closure:** ${g.closure_condition || 'not yet specified'}`, `- **Evidence refs:** ${(g.evidence || []).join('; ')}`, '');
}
if (report.watch_items.length) {
  md.push('## Watch items — visible, zero score effect', '');
  for (const w of report.watch_items) md.push(`- **${w.id} · ${w.title}** — ${w.state} — ${w.layer}`);
  md.push('');
}
if (report.historical_excluded.length) {
  md.push('## Historical/refuted items excluded from gap scoring', '');
  for (const h of report.historical_excluded) md.push(`- ${h.id} · ${h.title} — ${h.state}`);
  md.push('');
}
fs.writeFileSync(path.join(root, 'artifacts/pre-release-audit.md'), md.join('\n'));
console.log(md.join('\n'));
if (blockers.length) process.exitCode = 2;

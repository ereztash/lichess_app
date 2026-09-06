import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const exists = (p) => fs.existsSync(path.join(root, p));

const criticalityWeight = { P0: 4, P1: 3, P2: 2, P3: 1 };
const statePenalty = { open: 1, blocked: 1, 'half fixed': 0.75, partial: 0.75 };

function parseDebt(md) {
  const rows = [];
  const sectionRe = /^###\s+(R-\d+)\s+·\s+(.+)$/gm;
  const matches = [...md.matchAll(sectionRe)];
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const start = m.index;
    const end = i + 1 < matches.length ? matches[i + 1].index : md.length;
    const block = md.slice(start, end);
    const state = (block.match(/\| state \| \*\*([^*]+)\*\*/i)?.[1] || '').trim();
    const severity = (block.match(/\| severity \| (P\d)/i)?.[1] || '').trim();
    const basis = (block.match(/\| basis \| \*\*([^*]+)\*\*/i)?.[1] || '').trim();
    if (!state || /fixed|closed/i.test(state) && !/half/i.test(state)) continue;
    const problem = block
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
      .find((s) => !s.startsWith('#') && !s.startsWith('|') && !s.startsWith('**') && !s.startsWith('---')) || m[2].trim();
    rows.push({
      id: m[1],
      title: m[2].trim(),
      layer: /\| type \| ([^|]+) \|/i.exec(block)?.[1]?.trim() || 'unknown',
      state,
      criticality: severity || 'P3',
      basis: basis || 'unspecified',
      problem_definition: problem,
      evidence: [`docs/MASTER_PRODUCT_DEBT.md#${m[1].toLowerCase()}`],
      source: 'registered-debt',
    });
  }
  return rows;
}

function commandGap(id, layer, criticality, title, command, args = []) {
  try {
    execFileSync(command, args, { cwd: root, stdio: 'pipe', timeout: 15 * 60 * 1000 });
    return null;
  } catch (err) {
    const stderr = String(err.stderr || '').slice(-4000);
    const stdout = String(err.stdout || '').slice(-4000);
    return {
      id,
      title,
      layer,
      state: 'open',
      criticality,
      basis: 'verified by GitHub Action execution',
      problem_definition: `The pre-release command ${[command, ...args].join(' ')} fails on the candidate revision, so the release cannot claim this invariant currently holds.`,
      evidence: [stderr || stdout || `exit=${err.status ?? 'unknown'}`],
      source: 'live-action-check',
    };
  }
}

const debt = exists('docs/MASTER_PRODUCT_DEBT.md') ? parseDebt(read('docs/MASTER_PRODUCT_DEBT.md')) : [];
const live = [];
for (const g of [
  commandGap('A-TYPECHECK', 'correctness', 'P1', 'Typecheck fails', 'npm', ['run', 'check']),
  commandGap('A-BUILD', 'release', 'P1', 'Production build fails', 'npm', ['run', 'build']),
  commandGap('A-TEST', 'correctness', 'P1', 'Test suite fails', 'npm', ['test', '--', '--runInBand']),
]) if (g) live.push(g);

const gaps = [...live, ...debt];

for (const g of gaps) {
  const weight = criticalityWeight[g.criticality] || 1;
  const penalty = statePenalty[g.state.toLowerCase()] ?? 1;
  const base = Math.max(0, 100 - Math.round(weight * 18 * penalty));
  g.score = base;
  g.release_disposition = g.criticality === 'P0' || g.criticality === 'P1'
    ? 'FIX_BEFORE_BROAD_DISTRIBUTION'
    : g.criticality === 'P2'
      ? 'ACCEPT_FOR_CONTROLLED_TRIAL_OR_FIX'
      : 'DEFER';
}

const grouped = new Map();
for (const g of gaps) {
  const arr = grouped.get(g.layer) || [];
  arr.push(g);
  grouped.set(g.layer, arr);
}

const layers = [...grouped.entries()].map(([layer, items]) => ({
  layer,
  score: Math.round(items.reduce((s, x) => s + x.score, 0) / items.length),
  highest_criticality: items.sort((a, b) => (criticalityWeight[b.criticality] || 0) - (criticalityWeight[a.criticality] || 0))[0]?.criticality || 'P3',
  gap_count: items.length,
})).sort((a, b) => a.score - b.score);

const blockerCount = gaps.filter((g) => ['P0', 'P1'].includes(g.criticality)).length;
const report = {
  schema: 'pre-release-gap-audit/v1',
  generated_at: new Date().toISOString(),
  git_sha: process.env.GITHUB_SHA || null,
  purpose: 'Identify decision-relevant gaps before distribution, score them, assign criticality, and state each problem precisely.',
  release_verdict: blockerCount ? 'NOT_READY_FOR_BROAD_DISTRIBUTION' : 'NO_P0_P1_BLOCKERS_FOUND',
  scoring_note: 'Scores are readiness indicators, not product-value scores. Criticality outranks score.',
  layer_scores: layers,
  gaps,
};

fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true });
fs.writeFileSync(path.join(root, 'artifacts/pre-release-audit.json'), JSON.stringify(report, null, 2));

const md = [];
md.push('# Pre-release gap audit');
md.push('');
md.push(`**Verdict:** ${report.release_verdict}`);
md.push(`**SHA:** ${report.git_sha || 'local'}`);
md.push('');
md.push('## Layer scores');
md.push('');
md.push('| Layer | Score | Highest criticality | Gaps |');
md.push('|---|---:|---|---:|');
for (const l of layers) md.push(`| ${l.layer} | ${l.score}/100 | ${l.highest_criticality} | ${l.gap_count} |`);
md.push('');
md.push('## Gaps');
md.push('');
for (const g of gaps.sort((a,b) => (criticalityWeight[b.criticality]||0)-(criticalityWeight[a.criticality]||0))) {
  md.push(`### ${g.id} · ${g.title}`);
  md.push('');
  md.push(`- **Score:** ${g.score}/100`);
  md.push(`- **Criticality:** ${g.criticality}`);
  md.push(`- **Layer:** ${g.layer}`);
  md.push(`- **State:** ${g.state}`);
  md.push(`- **Disposition:** ${g.release_disposition}`);
  md.push(`- **Basis:** ${g.basis}`);
  md.push(`- **Problem:** ${g.problem_definition}`);
  md.push(`- **Evidence:** ${g.evidence.join('; ')}`);
  md.push('');
}
fs.writeFileSync(path.join(root, 'artifacts/pre-release-audit.md'), md.join('\n'));
console.log(md.join('\n'));

if (blockerCount) process.exitCode = 2;

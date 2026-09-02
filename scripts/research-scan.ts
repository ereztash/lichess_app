/**
 * The research reconciliation scanner: what a research artefact SAYS about the tree, held against
 * the tree.
 *
 * WHY IT EXISTS. `register-scan.ts` does exactly this for four product and governance registers,
 * and it works: it caught four live drifts in its first wave and its control fixture proves it can
 * fail. It reaches nothing under `research/`. The process-mining study ranked that the highest-value
 * gap in the repository (`G-04`) because two independent failures of the same shape were already
 * sitting in the tree, verified, both found by hand:
 *
 *   X-02  `results/PREREGISTRATION_FREEZE.json` records the sha256 of five frozen documents. Its
 *         CURRENT block says `DATA_PROTOCOL.md` is `cf263394...`; the file is `6560f3d7...`. The
 *         document was legitimately edited at Gate 2 -- the diff is labelled "Fixed at Gate 2" and
 *         says "it changes no verdict" -- and the hash was taken before the edit, in the same
 *         working tree, and committed beside it. A frozen-document record that no longer matches
 *         the document is the one thing a freeze is for.
 *
 *   X-16  `research/discovery-oracle/results/selftest.json` records plant `one-game-only` at
 *         `delta 0.45`, and `oracle/worlds.py` at the same commit declares `0.22`. A generated
 *         artefact disagreeing with its own generator.
 *
 * THEY ARE THE SAME DETECTION CLASS AND NOT THE SAME CAUSE, and the study was explicit about
 * keeping that distinction. One is a hand-written provenance record that stopped matching its
 * subject; the other is a stale machine output. The detector is shared. The repairs are not: X-02
 * is amended, X-16 is regenerated.
 *
 * WHAT IS SCANNED AND WHAT DELIBERATELY IS NOT. Every relation below is a claim an artefact makes
 * about something OUTSIDE itself. Prose is not scanned, for `register-scan.ts`'s reason: pinning an
 * argument to a string asserts that a sentence equals itself and teaches the next editor to edit the
 * scanner with the sentence.
 *
 * THE RELATION TYPES ARE THE POINT, not the file list. Forty-four sha256 sites across thirty
 * artefacts reduce to six kinds, and only two of them are checkable here. Writing that down is what
 * stops the next register being silently unchecked: `findUnregisteredClaims` reddens on a hash site
 * this file does not classify, so a new artefact must declare what kind of claim it is making.
 *
 * EVERY PREDICATE RUNS OVER TWO ROOTS: the real tree, and `tests/fixtures/research`, which holds
 * X-02 and X-16 as the repository actually carried them. Same predicate, different input.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import type { Finding } from "./gate-scan";

/**
 * What kind of claim an artefact is making about the world outside it.
 *
 * `EXTERNAL_ARTEFACT` is not a checkable relation and that is the point of naming it. Twenty-four
 * of the forty-four hash sites are hashes of a Lichess database dump, an engine binary, or an
 * evidence bundle that was never committed. None of them can be verified from inside this
 * repository, and a scanner that quietly skipped them would leave a reader unable to tell "checked
 * and correct" from "not checkable" -- the distinction `NOT-MEASURED` exists for.
 */
export type RelationKind =
  | "HASH_OF_TREE_FILE"
  | "GENERATED_VALUE"
  | "PATH_IN_TREE"
  | "EXTERNAL_ARTEFACT"
  | "INTERNAL_DIGEST";

/**
 * Whether the claim is live.
 *
 * `SUPERSEDED` is load-bearing. `PREREGISTRATION_FREEZE.json` carries both `sha256` (at the freeze)
 * and `amended_sha256` (after Gate 2's amendments), and two of the five documents legitimately
 * differ between them. Treating the original block as a live claim would redden on the amendment
 * itself -- which is to say, on the repository doing the right thing. History is provenance; only
 * the current block is a claim about now.
 */
export type RelationStatus = "CURRENT" | "SUPERSEDED";

export interface HashRelation {
  artefact: string;
  /** The JSON key path, with `<doc>` standing for a document name. */
  keyPath: string;
  kind: RelationKind;
  status: RelationStatus;
  /** For a `HASH_OF_TREE_FILE`, the tree path the hash is claimed of. */
  subject?: (artefact: string, leaf: string) => string;
  supersededBy?: string;
  why: string;
}

/** The document a `<doc>` key names lives one directory above the `results/` that records it. */
const siblingDoc = (artefact: string, leaf: string) => join(dirname(dirname(artefact)), leaf);

/**
 * Every sha256 site in `research/**` and `docs/**`, classified. Forty-four sites, thirty artefacts,
 * six kinds. Derived by enumerating them rather than by guessing: `findUnregisteredClaims` fails if
 * this table stops covering the tree.
 */
export const RESEARCH_RELATIONS: HashRelation[] = [
  {
    artefact: "research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json",
    keyPath: "sha256.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "SUPERSEDED",
    supersededBy: "research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json document_sha256",
    subject: siblingDoc,
    why: "the hashes AT the freeze, before Gate 2's amendments. Kept because an amendment is only auditable beside what it amended",
  },
  {
    artefact: "research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json",
    keyPath: "amended_sha256.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "SUPERSEDED",
    supersededBy: "research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json document_sha256",
    subject: siblingDoc,
    why: "X-02. A snapshot at 2026-09-02T00:46:57Z; Gate 2 then required an edit to DATA_PROTOCOL.md at 02:07:45Z, and the seal written at 02:08:13Z recorded the post-edit hash of all five documents. The later record is the current one. Not a whitelist: findOrphanedSupersessions requires the successor to exist and to cover the same documents, and the successor is checked on every run",
  },
  {
    artefact: "research/b3_population_expertise/results/FINAL_HOLDOUT_SEALED.json",
    keyPath: "document_sha256.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "CURRENT",
    subject: siblingDoc,
    why: "what the seal was taken over; the holdout may not be opened against a different text",
  },
  {
    artefact: "research/learning-v3/corpus/MANIFEST.json",
    keyPath: "committed_sha256.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "CURRENT",
    subject: (artefact, leaf) => join(dirname(artefact), leaf),
    why: "the preserved engine corpus, 54,959 Stockfish searches at 200,000 nodes. It is committed rather than reproduced because a download is cheap and an hour of four-way CPU is not, and a corpus nothing checks is a corpus that can rot into a different corpus without anybody noticing",
  },
  {
    artefact: "research/learning-v3/corpus/MANIFEST.json",
    keyPath: "uncompressed_sha256.<doc>",
    kind: "INTERNAL_DIGEST",
    status: "CURRENT",
    why: "what was compressed. The uncompressed files are deliberately NOT in the tree, so nothing here can check these; they exist so a reader who decompresses can verify they got the same bytes. Classified rather than removed because a digest with no checker is still a claim somebody made",
  },
  {
    artefact: "docs/learning-v3/FREEZE.json",
    keyPath: "files.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "CURRENT",
    subject: (_artefact, leaf) => leaf,
    why: "the external prior E1-E5 and its falsifiers, hashed before the repository's learning architecture was read. The ordering is the whole claim, so the hash has to be checked by something that runs on its own -- `verify_freeze.py` is a command somebody has to remember, this gate is not. The `<doc>` key IS the tree path, which is why `subject` is the identity",
  },
  {
    artefact: "docs/system-invariant/FREEZE.json",
    keyPath: "files.<doc>",
    kind: "HASH_OF_TREE_FILE",
    status: "CURRENT",
    subject: (_artefact, leaf) => leaf,
    why: "the OwnExposure research question, its construct and its falsifiers, hashed before any natural-play outcome was computed. Same idiom and same reason as the learning-v3 freeze above: the ordering is the whole claim, so it is checked by the gate rather than by a command somebody has to remember. The `<doc>` key IS the tree path, hence the identity `subject`",
  },
  {
    artefact: "docs/measurement/STRONGEST_PERMITTED_CLAIM.json",
    keyPath: "board_predicate_sha256",
    kind: "HASH_OF_TREE_FILE",
    status: "CURRENT",
    subject: () => "research/measurement/predicates.py",
    why: "the claim is licensed for one predicate definition; a changed definition is a different claim",
  },
  {
    artefact: "research/b3_population_expertise/results/PREREGISTRATION_FREEZE.json",
    keyPath: "engine.sha256",
    kind: "EXTERNAL_ARTEFACT",
    status: "CURRENT",
    why: "stockfish-17.1-avx2, not in this tree. Checkable only where the binary is, which is where the determinism test already refuses rather than skips",
  },
  {
    artefact: "research/b3_population_expertise/data/**/manifest.json",
    keyPath: "prefix_sha256",
    kind: "EXTERNAL_ARTEFACT",
    status: "CURRENT",
    why: "the prefix of a Lichess monthly dump. The bytes are deliberately not committed; for FINAL they are deliberately not even downloaded",
  },
  {
    artefact: "research/**/corpus_manifest.json",
    keyPath: "corpusSha256",
    kind: "EXTERNAL_ARTEFACT",
    status: "CURRENT",
    why: "the corpus a harness read, derived from a dump that is not in the tree",
  },
  {
    artefact: "research/**/*report*.json",
    keyPath: "evidenceSha256",
    kind: "EXTERNAL_ARTEFACT",
    status: "CURRENT",
    why: "the evidence bundle a report summarises; the bundle itself was not committed",
  },
  {
    artefact: "research/blitz/data/**.json",
    keyPath: "sha256|datasetSha256|provenance.datasetSha256",
    kind: "EXTERNAL_ARTEFACT",
    status: "CURRENT",
    why: "generated blitz datasets, derived from dumps that are not in the tree",
  },
  {
    artefact: "research/b3_population_expertise/results/period_*.json",
    keyPath: "_cache_key",
    kind: "INTERNAL_DIGEST",
    status: "CURRENT",
    why: "a digest over the analysis's own inputs, used to invalidate a cache. It claims nothing about any file",
  },
  {
    artefact: "research/b3_population_expertise/results/analysis_repaired.json",
    keyPath: "_repair.everything_else_sha256",
    kind: "INTERNAL_DIGEST",
    status: "CURRENT",
    why: "the repair's own proof that it changed only the C3 block; a digest over the rest of the same file",
  },
];

/**
 * The one `GENERATED_VALUE` relation, and the reason it is not a generic mechanism.
 *
 * A committed output that records an input its generator declares is checkable without running the
 * generator, and that is the whole trick: `selftest.py` takes about ten minutes and needs a browser
 * bridge, so a gate that re-ran it would never be a gate. The nominal `delta` of each plant is a
 * LITERAL in `worlds.py` and a FIELD in `selftest.json`. Comparing two literals is cheap, and it is
 * exactly the drift X-16 was.
 *
 * The extension path is a second row in this table, not a parser: any generated artefact recording a
 * declared constant can be added by naming where each side lives.
 */
export interface GeneratedValueRelation {
  output: string;
  source: string;
  what: string;
  /** Reads `name -> value` from the source of truth. */
  declared: (source: string) => Map<string, number>;
  /** Reads `name -> value` from the generated artefact. */
  recorded: (output: string) => Map<string, number>;
  why: string;
}

export const GENERATED_VALUE_RELATIONS: GeneratedValueRelation[] = [
  {
    output: "research/discovery-oracle/results/selftest.json",
    source: "research/discovery-oracle/oracle/worlds.py",
    what: "each plant's nominal delta",
    declared: (source) => {
      const out = new Map<string, number>();
      for (const m of source.matchAll(/Plant\(\s*"([^"]+)"\s*,\s*([0-9.]+)/g)) {
        out.set(m[1], Number(m[2]));
      }
      return out;
    },
    recorded: (output) => {
      const out = new Map<string, number>();
      const doc = JSON.parse(output) as { plants?: { plant: string; delta: number }[] };
      for (const p of doc.plants ?? []) out.set(p.plant, p.delta);
      return out;
    },
    why: "the self-test grades the oracle against plants whose size worlds.py declares. A recorded delta that the generator no longer declares means the committed verdict was reached against a world that no longer exists",
  },
];

const read = (root: string, file: string) => readFileSync(join(root, file), "utf8");
const has = (root: string, file: string) => existsSync(join(root, file));
const sha256 = (root: string, file: string) =>
  createHash("sha256").update(readFileSync(join(root, file))).digest("hex");

/**
 * `research/*​/corpus_manifest.json` and friends, as a regex.
 *
 * Dots are escaped BEFORE the wildcards are substituted, because doing it the other way round
 * escapes the dot inside the character class the wildcard just introduced and quietly narrows it.
 * `**` crosses directory separators; `*` does not.
 */
function globToRegex(glob: string): string {
  return glob
    .split("**")
    .map((segment) => segment.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, "[^/]*"))
    .join(".*");
}

/**
 * `amended_sha256.<doc>` as a regex over a JSON key path.
 *
 * `<doc>` matches a document NAME, and a document name contains a dot: `DATA_PROTOCOL.md`. An
 * earlier version used `[^.]+` here, which matched nothing at all and reported all five live freeze
 * records as unclassified while `findStaleFrozenHashes` was checking them. `|` stays alive so one
 * row can cover a set of sibling key names.
 */
function keyPathToRegex(keyPath: string): string {
  return keyPath
    .split("|")
    .map((part) => part.replace(/[.]/g, "\\.").replace("<doc>", ".+"))
    .join("|");
}

/** The line a substring falls on, 1-indexed, so a finding points somewhere a reader can go. */
function lineOf(source: string, needle: string): number {
  const at = source.indexOf(needle);
  return at < 0 ? 1 : source.slice(0, at).split("\n").length;
}

/**
 * A CURRENT hash record that no longer matches the file it names.
 *
 * SUPERSEDED records are read and deliberately not asserted. That is not leniency: a superseded
 * block that still matched would mean the amendment never happened.
 */
export function findStaleFrozenHashes(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const relation of RESEARCH_RELATIONS) {
    if (relation.kind !== "HASH_OF_TREE_FILE" || relation.status !== "CURRENT") continue;
    if (relation.artefact.includes("*") || !has(root, relation.artefact)) continue;
    const raw = read(root, relation.artefact);
    const doc = JSON.parse(raw) as Record<string, unknown>;
    const [head, tail] = relation.keyPath.split(".");
    const entries: [string, unknown][] = tail
      ? Object.entries((doc[head] ?? {}) as Record<string, unknown>)
      : [[head, doc[head]]];
    for (const [leaf, claimed] of entries) {
      if (typeof claimed !== "string") continue;
      const subject = relation.subject!(relation.artefact, leaf);
      if (!has(root, subject)) {
        findings.push({
          file: relation.artefact,
          line: lineOf(raw, claimed),
          text: `${relation.keyPath.replace("<doc>", leaf)} names ${subject}, which is not in the tree`,
        });
        continue;
      }
      const actual = sha256(root, subject);
      if (actual !== claimed) {
        findings.push({
          file: relation.artefact,
          line: lineOf(raw, claimed),
          text:
            `${relation.keyPath.replace("<doc>", leaf)} says ${subject} is ${claimed.slice(0, 12)}…, ` +
            `the file is ${actual.slice(0, 12)}…`,
        });
      }
    }
  }
  return findings;
}

/** A committed generated artefact recording an input its generator no longer declares. */
export function findGeneratedValueDrift(root: string): Finding[] {
  const findings: Finding[] = [];
  for (const relation of GENERATED_VALUE_RELATIONS) {
    if (!has(root, relation.output) || !has(root, relation.source)) continue;
    const rawOutput = read(root, relation.output);
    const declared = relation.declared(read(root, relation.source));
    const recorded = relation.recorded(rawOutput);
    for (const [name, value] of recorded) {
      if (!declared.has(name)) {
        findings.push({
          file: relation.output,
          line: lineOf(rawOutput, name),
          text: `records ${relation.what} for "${name}", which ${relation.source} no longer declares`,
        });
        continue;
      }
      const want = declared.get(name)!;
      if (Math.abs(want - value) > 1e-9) {
        findings.push({
          file: relation.output,
          line: lineOf(rawOutput, `"${name}"`),
          text: `"${name}" ${relation.what} recorded as ${value}; ${relation.source} declares ${want}`,
        });
      }
    }
  }
  return findings;
}

function everyJson(root: string, dir: string, out: string[] = []): string[] {
  const full = join(root, dir);
  if (!existsSync(full)) return out;
  for (const entry of readdirSync(full)) {
    if (entry === "node_modules" || entry === ".git" || entry === "dist") continue;
    const rel = join(dir, entry);
    if (statSync(join(root, rel)).isDirectory()) everyJson(root, rel, out);
    else if (entry.endsWith(".json")) out.push(rel);
  }
  return out;
}

/** `docs/consolidation-research/` is a study OF this repository and is scanned by its own selfcheck.py. */
const NOT_A_RESEARCH_REGISTER = ["docs/consolidation-research/"];

function hashSites(source: string): { key: string; hash: string }[] {
  const out: { key: string; hash: string }[] = [];
  const walk = (node: unknown, path: string[]) => {
    if (Array.isArray(node)) node.forEach((v, i) => walk(v, [...path, `[${i}]`]));
    else if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) walk(v, [...path, k]);
    } else if (typeof node === "string" && /^[0-9a-f]{64}$/.test(node)) {
      out.push({ key: path.join("."), hash: node });
    }
  };
  walk(JSON.parse(source), []);
  return out;
}

/**
 * A sha256 in a research artefact that this file does not classify.
 *
 * THIS IS THE EXTENSION PATH, and it is the predicate that makes the model worth more than the two
 * checks above it. A new register carrying hashes is caught the day it lands, and its author has to
 * say which of the five kinds it is -- checkable against the tree, or a hash of something outside
 * it. Without this, "the research corpus is reconciled" would decay into "the research corpus that
 * existed when somebody last looked is reconciled", which is the exact shape of the debt this
 * scanner was written to pay off.
 */
export function findUnregisteredClaims(root: string): Finding[] {
  const registered = RESEARCH_RELATIONS.map((r) => ({
    artefact: new RegExp(`^${globToRegex(r.artefact)}$`),
    key: new RegExp(`^(?:${keyPathToRegex(r.keyPath)})$`),
  }));
  const findings: Finding[] = [];
  for (const dir of ["research", "docs"]) {
    for (const file of everyJson(root, dir)) {
      if (NOT_A_RESEARCH_REGISTER.some((skip) => file.startsWith(skip))) continue;
      let source: string;
      try {
        source = read(root, file);
      } catch {
        continue;
      }
      let sites: { key: string; hash: string }[];
      try {
        sites = hashSites(source);
      } catch {
        continue;
      }
      for (const site of sites) {
        const shape = site.key.replace(/\[\d+\]/g, "[]");
        const covered = registered.some((r) => r.artefact.test(file) && r.key.test(shape));
        if (!covered) {
          findings.push({
            file,
            line: lineOf(source, site.hash),
            text: `sha256 at \`${shape}\` is not classified in RESEARCH_RELATIONS; say which kind of claim it is`,
          });
        }
      }
    }
  }
  return findings;
}

/**
 * A SUPERSEDED claim whose successor does not exist, or does not cover what it covered.
 *
 * WITHOUT THIS PREDICATE, `status: "SUPERSEDED"` IS A WHITELIST. Any drift could be retired by
 * declaring the block historical, which is the move this whole scanner exists to make impossible:
 * a register that can retire its own claims answers "does this still hold?" with "I no longer say".
 * A superseded block must hand its subjects to a CURRENT block that is itself checked, and the
 * artefact must name the successor in its own text so a reader following the record by hand lands
 * in the same place the scanner does.
 */
export function findOrphanedSupersessions(root: string): Finding[] {
  const findings: Finding[] = [];
  const current = RESEARCH_RELATIONS.filter(
    (r) => r.kind === "HASH_OF_TREE_FILE" && r.status === "CURRENT",
  );
  for (const relation of RESEARCH_RELATIONS) {
    if (relation.status !== "SUPERSEDED") continue;
    if (relation.artefact.includes("*") || !has(root, relation.artefact)) continue;
    const raw = read(root, relation.artefact);
    if (!relation.supersededBy) {
      findings.push({
        file: relation.artefact,
        line: 1,
        text: `${relation.keyPath} is marked SUPERSEDED and names no successor`,
      });
      continue;
    }
    if (!raw.includes(relation.supersededBy.split(" ")[0].split("/").pop()!)) {
      findings.push({
        file: relation.artefact,
        line: 1,
        text: `${relation.keyPath} is superseded by ${relation.supersededBy}, and the artefact never says so`,
      });
    }
    const [successorFile] = relation.supersededBy.split(" ");
    const covering = current.filter((c) => c.artefact === successorFile);
    if (!covering.length || !has(root, successorFile)) {
      findings.push({
        file: relation.artefact,
        line: 1,
        text: `${relation.keyPath} is superseded by ${relation.supersededBy}, which is not a CURRENT checked relation`,
      });
      continue;
    }
    // the successor must cover every document the superseded block covers
    const doc = JSON.parse(raw) as Record<string, Record<string, unknown>>;
    const head = relation.keyPath.split(".")[0];
    const subjects = Object.keys(doc[head] ?? {});
    const successorDoc = JSON.parse(read(root, successorFile)) as Record<string, Record<string, unknown>>;
    const successorHead = relation.supersededBy.split(" ")[1];
    const covered = new Set(Object.keys(successorDoc[successorHead] ?? {}));
    const missing = subjects.filter((s) => !covered.has(s));
    if (missing.length) {
      findings.push({
        file: relation.artefact,
        line: 1,
        text: `${relation.keyPath} is superseded by ${relation.supersededBy}, which does not cover ${missing.join(", ")}`,
      });
    }
  }
  return findings;
}

/** Every predicate, over one root. The gate is one call; the control is the same call, elsewhere. */
export function findResearchDrift(root: string): Finding[] {
  const at = resolve(root);
  return [
    ...findStaleFrozenHashes(at),
    ...findGeneratedValueDrift(at),
    ...findOrphanedSupersessions(at),
    ...findUnregisteredClaims(at),
  ];
}

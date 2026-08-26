/**
 * The reference class for metacognitive sensitivity, from the Confidence Database.
 *
 * WHY THIS EXISTS. The specification's first admission is that no reference class exists: a
 * player is handed an AUROC2 of 0.71 and has nothing to call it relative to. For the CALIBRATION
 * gap that is still true and there is no corpus anywhere that could fix it. For SENSITIVITY it is
 * not true, and has not been since 2020 -- the Confidence Database (Rahnev et al., *Nature Human
 * Behaviour* 4, 317-325) collects raw trial-level confidence and accuracy from ~180 datasets, and
 * AUROC2 is computable from exactly the two columns every one of them carries.
 *
 * THE REFERENCE CLASS IS PEOPLE, NOT STUDIES. A player is one person, so the unit here is the
 * SUBJECT: each subject's own AUROC2, computed over their own trials, pooled across every study.
 * Averaging studies first would weight a twelve-subject experiment the same as a four-hundred
 * subject one and answer a question nobody asked.
 *
 * IT USES THE PRODUCT'S OWN ESTIMATOR, which is the discipline that decides whether the number is
 * worth having. `metacognitiveSensitivity` from `shared/sensitivity.ts`, unmodified -- same
 * threshold sweep, same trapezoid rule, same treatment of ties -- and the product's own
 * `MIN_BUCKET_N` floor on each outcome. A reference class computed with its own AUROC2 would look
 * identical in the output and be a distribution of a different statistic.
 *
 * THE BAND IS CONDITIONED ON FIRST-ORDER ACCURACY, and that is not a refinement -- it is the
 * finding. AUROC2's standard criticism is that it is not independent of how good you are at the
 * task, and `shared/sensitivity.ts` has always admitted it. Measured here on 6,570 people it is
 * not a caveat, it is the dominant term: Spearman rho = +0.49, and mean AUROC2 climbs 0.55 ->
 * 0.60 -> 0.66 -> 0.70 -> 0.78 across accuracy bands from below 60% to above 90%. An
 * unconditioned band would tell a strong player they are metacognitively gifted for being good at
 * chess. So the reference class a reading is shown against is people who were ABOUT AS ACCURATE
 * as the reader -- the same move Track A made for the buckets, for the same reason.
 *
 * WHAT IT STILL CANNOT SAY, and this is the sentence that has to survive every future tidy-up:
 * THE TASK IS NOT THE SAME. Nearly every dataset here is a binary or near-binary perceptual or
 * memory judgement -- which grating was tilted, was this word on the list. Choosing a move from
 * thirty legal options is not that, and conditioning on accuracy narrows the mismatch without
 * closing it. This yields a BAND to read a number against, and never a percentile rank for a
 * person: a rank would assert that a chess player and a psychophysics subject are draws from one
 * population, which is exactly the claim the data cannot support.
 *
 * Corpus: the Confidence Database (osf.io/s46pr), CC0 1.0 Universal, `data_*.csv`. The standard
 * schema is `Subj_idx`, `Confidence`, and either `Accuracy` or `Stimulus` + `Response`; matched
 * case-insensitively, since a handful of contributors capitalised differently. Datasets that do
 * not carry it -- dual-task designs with `Response_1`/`Response_2`, multi-task files with one
 * column per task -- are EXCLUDED AND COUNTED, never hand-parsed. A per-study parser is where a
 * reference class quietly turns into a curated one.
 *
 * Run: npx tsx scripts/build_sensitivity_reference.ts <dir of data_*.csv>
 */
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { MIN_BUCKET_N, type ScoredDecision } from "../shared/detector.js";
import { metacognitiveSensitivity } from "../shared/sensitivity.js";

/**
 * The fewest subjects a study must contribute before it counts toward the band.
 *
 * Not a quality judgement on the study -- it is about what a single subject's AUROC2 costs to
 * estimate. A study contributing one readable subject contributes one point, which is fine; this
 * floor is 1 deliberately, and exists as a named constant so that raising it later is a visible
 * decision rather than a silent filter.
 */
const MIN_SUBJECTS_PER_STUDY = 1;

/** Percentiles the band is published at. The middle 80% plus the quartiles and the median. */
const PERCENTILES = [5, 10, 25, 50, 75, 90, 95] as const;

/**
 * The most distinct confidence values a scale can offer and still be the product's KIND of scale.
 *
 * AUROC2 reads only the ORDER of the confidence values, so it is invariant to how a study labelled
 * its scale -- but not to how many rungs the scale has. A two-point scale gives the curve two
 * points and pushes the area toward 0.5 for reasons that are about the instrument rather than the
 * person. The product runs seven levels, so the band is reported both over everything and over
 * the subjects whose scales are in the same regime, and the two are printed side by side rather
 * than one being chosen here.
 */
const DISCRETE_MAX_LEVELS = 12;
const DISCRETE_MIN_LEVELS = 4;

/**
 * The first-order accuracy strata a band is published for.
 *
 * Chosen to bracket where a chess player's accuracy actually lands under this product's rule --
 * the population baseline puts the corpus at 64.9% overall -- and not so fine that a stratum
 * stops holding enough people to be a population.
 */
const STRATA: readonly { from: number; to: number }[] = [
  { from: 0, to: 0.6 },
  { from: 0.6, to: 0.7 },
  { from: 0.7, to: 0.8 },
  { from: 0.8, to: 0.9 },
  { from: 0.9, to: 1.0001 },
];

/**
 * The fewest people a stratum must hold before a band is published for it.
 *
 * The same discipline as the population baseline's 500-move floor: below this the stratum is
 * ABSENT, `sensitivityBand` returns null for it, and the caller renders "no reference class"
 * rather than a band computed from forty people.
 */
const MIN_STRATUM_SUBJECTS = 200;

interface SubjectReading {
  study: string;
  subject: string;
  auroc2: number;
  /** The subject's own first-order accuracy. The band is conditioned on it. */
  accuracy: number;
  levels: number;
  n: number;
}

/** Reasons a dataset contributes nothing, counted so the output can report its own coverage. */
const skipped: Record<string, string[]> = { schema: [], subjects: [] };

function columnIndex(header: string[], ...names: string[]): number {
  for (const name of names) {
    const at = header.findIndex((column) => column.toLowerCase() === name.toLowerCase());
    if (at !== -1) return at;
  }
  return -1;
}

/**
 * Split one CSV line. Deliberately not a full CSV parser: every column this reads is numeric or a
 * short identifier, and no file in the corpus quotes one. A quoted comma inside an unused column
 * would shift the fields, so the caller checks the field count against the header and drops any
 * row that does not match rather than reading a shifted value as data.
 */
function fields(line: string): string[] {
  return line.split(",");
}

function readStudy(path: string, name: string, out: SubjectReading[]): void {
  const text = readFileSync(path, "utf8").replace(/^﻿/, "");
  const lines = text.split(/\r?\n/);
  const header = fields(lines[0]).map((column) => column.trim());

  const subjectAt = columnIndex(header, "Subj_idx", "subject_id", "subject", "Subject");
  const confidenceAt = columnIndex(header, "Confidence");
  const accuracyAt = columnIndex(header, "Accuracy", "correct", "Correct");
  const stimulusAt = columnIndex(header, "Stimulus");
  const responseAt = columnIndex(header, "Response");

  if (subjectAt === -1 || confidenceAt === -1 || (accuracyAt === -1 && (stimulusAt === -1 || responseAt === -1))) {
    skipped.schema.push(name);
    return;
  }

  /*
   * Accuracy from the study's own column where it has one, and from stimulus-equals-response
   * where it does not. Never from a rule of this script's own: the two are the study's statement
   * about what counted as correct, and a third definition invented here would be a different
   * measurement wearing the study's name.
   */
  const bySubject = new Map<string, ScoredDecision[]>();
  for (let i = 1; i < lines.length; i += 1) {
    const row = fields(lines[i]);
    if (row.length !== header.length) continue;

    const confidence = Number(row[confidenceAt]);
    if (!Number.isFinite(confidence)) continue;

    let accurate: boolean;
    if (accuracyAt !== -1) {
      const value = Number(row[accuracyAt]);
      if (!Number.isFinite(value)) continue;
      accurate = value === 1;
      if (value !== 0 && value !== 1) continue;
    } else {
      const stimulus = row[stimulusAt].trim();
      const response = row[responseAt].trim();
      if (stimulus === "" || response === "" || stimulus === "NaN" || response === "NaN") continue;
      accurate = stimulus === response;
    }

    const subject = row[subjectAt].trim();
    if (subject === "") continue;
    const decisions = bySubject.get(subject) ?? [];
    /*
     * Only the two fields the estimator reads. The rest of `ScoredDecision` describes a chess
     * decision and there is nothing here to fill it with -- inventing a phase or a clock would put
     * fabricated values into a module whose entire purpose is that it does not fabricate.
     */
    decisions.push({ confidence, accurate } as ScoredDecision);
    bySubject.set(subject, decisions);
  }

  const readings: SubjectReading[] = [];
  for (const [subject, decisions] of bySubject) {
    const sensitivity = metacognitiveSensitivity(decisions);
    // The product's own floor, applied unchanged: enough of BOTH outcomes, not enough trials.
    if (!sensitivity.readable || sensitivity.auroc2 === null) continue;
    readings.push({
      study: name,
      subject,
      auroc2: sensitivity.auroc2,
      accuracy: sensitivity.split[0] / sensitivity.n,
      levels: new Set(decisions.map((d) => d.confidence)).size,
      n: decisions.length,
    });
  }

  if (readings.length < MIN_SUBJECTS_PER_STUDY) {
    skipped.subjects.push(name);
    return;
  }
  out.push(...readings);
}

function percentile(sorted: readonly number[], p: number): number {
  // Nearest-rank, so every published figure is a value some real subject actually produced.
  const rank = Math.ceil((p / 100) * sorted.length);
  return sorted[Math.min(sorted.length - 1, Math.max(0, rank - 1))];
}

function describe(values: readonly number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((sum, v) => sum + v, 0) / sorted.length;
  const variance = sorted.reduce((sum, v) => sum + (v - mean) ** 2, 0) / (sorted.length - 1);
  return {
    n: sorted.length,
    mean,
    sd: Math.sqrt(variance),
    percentiles: Object.fromEntries(PERCENTILES.map((p) => [p, percentile(sorted, p)])),
    aboveChance: sorted.filter((v) => v > 0.5).length / sorted.length,
  };
}

const dir = process.argv[2];
if (!dir) throw new Error("usage: build_sensitivity_reference.ts <dir of data_*.csv>");

const all: SubjectReading[] = [];
const studies = readdirSync(dir).filter((f) => f.startsWith("data_") && f.endsWith(".csv")).sort();
for (const file of studies) {
  readStudy(join(dir, file), file.replace(/^data_|\.csv$/g, ""), all);
}

/*
 * The published bands are measured on the product's OWN SCALE REGIME. AUROC2 reads only the order
 * of the confidence values, so it does not care what a study called its scale -- but it does care
 * how many rungs the scale has: a two-point scale gives the curve two points and pushes the area
 * toward 0.5 for reasons that are about the instrument rather than the person.
 */
const regime = all.filter((r) => r.levels >= DISCRETE_MIN_LEVELS && r.levels <= DISCRETE_MAX_LEVELS);
const overall = describe(all.map((r) => r.auroc2));
const sameRegime = describe(regime.map((r) => r.auroc2));
const studiesUsed = new Set(all.map((r) => r.study)).size;

/*
 * How strongly AUROC2 depends on being good at the task, measured rather than asserted. This is
 * the number that decides whether conditioning on accuracy is a refinement or the whole point.
 */
function spearman(xs: readonly number[], ys: readonly number[]): number {
  const rank = (values: readonly number[]) => {
    const order = values.map((v, i) => [v, i] as const).sort((a, b) => a[0] - b[0]);
    const out = new Array<number>(values.length);
    let i = 0;
    while (i < order.length) {
      let j = i;
      while (j + 1 < order.length && order[j + 1][0] === order[i][0]) j += 1;
      const shared = (i + j) / 2 + 1;
      for (let k = i; k <= j; k += 1) out[order[k][1]] = shared;
      i = j + 1;
    }
    return out;
  };
  const a = rank(xs);
  const b = rank(ys);
  const mean = (v: readonly number[]) => v.reduce((s, x) => s + x, 0) / v.length;
  const ma = mean(a);
  const mb = mean(b);
  const cov = a.reduce((s, x, i) => s + (x - ma) * (b[i] - mb), 0);
  const va = a.reduce((s, x) => s + (x - ma) ** 2, 0);
  const vb = b.reduce((s, x) => s + (x - mb) ** 2, 0);
  return cov / Math.sqrt(va * vb);
}
const accuracyCoupling = spearman(regime.map((r) => r.accuracy), regime.map((r) => r.auroc2));

const strata = STRATA.map((stratum) => {
  const inside = regime.filter((r) => r.accuracy >= stratum.from && r.accuracy < stratum.to);
  return { stratum, inside, band: inside.length >= MIN_STRATUM_SUBJECTS ? describe(inside.map((r) => r.auroc2)) : null };
}).filter((s) => s.band !== null) as { stratum: { from: number; to: number }; inside: SubjectReading[]; band: ReturnType<typeof describe> }[];

const grid = (d: ReturnType<typeof describe>, indent: string) =>
  PERCENTILES.map((p) => `${indent}{ p: ${p}, auroc2: ${d.percentiles[p].toFixed(5)} },`).join("\n");

const bandLiteral = (d: ReturnType<typeof describe>, subjects: readonly SubjectReading[], indent: string) =>
  `{
${indent}  n: ${d.n},
${indent}  studies: ${new Set(subjects.map((r) => r.study)).size},
${indent}  mean: ${d.mean.toFixed(5)},
${indent}  sd: ${d.sd.toFixed(5)},
${indent}  aboveChance: ${d.aboveChance.toFixed(5)},
${indent}  percentiles: [
${grid(d, `${indent}    `)}
${indent}  ],
${indent}}`;

writeFileSync(
  "shared/sensitivity-reference.ts",
  `/**
 * What metacognitive sensitivity looks like in the research literature. GENERATED by
 * scripts/build_sensitivity_reference.ts.
 *
 * WHAT IT IS FOR. An AUROC2 of 0.71 is uninterpretable on its own: nobody knows whether that is
 * good. Measured here on ${overall.n.toLocaleString("en-US")} individual people across ${studiesUsed} datasets of the
 * Confidence Database (Rahnev et al., *Nature Human Behaviour* 4, 317-325, 2020; osf.io/s46pr,
 * CC0), each person's AUROC2 computed by THIS PRODUCT'S OWN \\\`metacognitiveSensitivity\\\` under its
 * own \\\`MIN_BUCKET_N\\\` floor on both outcomes.
 *
 * CONDITIONED ON FIRST-ORDER ACCURACY, because that turned out to be the dominant term rather
 * than a caveat. Spearman rho between a person's accuracy and their AUROC2 is
 * ${accuracyCoupling.toFixed(2)} across ${sameRegime.n.toLocaleString("en-US")} people. An unconditioned band would tell a strong
 * player they are metacognitively gifted for being good at chess, which is the same confound the
 * population baseline exists to remove from the buckets.
 *
 * A BAND, NEVER A PERCENTILE RANK. The literature's task is not this instrument's task: nearly
 * every dataset is a binary or near-binary perceptual or memory judgement, and choosing a move
 * from thirty legal options is not one. Conditioning on accuracy narrows that mismatch and does
 * not close it, so what this supports is one honest sentence -- "among people about this accurate,
 * in the research literature, this number runs from X to Y" -- and nothing stronger. A percentile
 * rank would assert that a chess player and a psychophysics subject are draws from one
 * population, which is exactly the claim the data cannot support.
 *
 * SCALE REGIME. AUROC2 reads only the ORDER of confidence values, so it does not care what a
 * study called its scale -- but it does care how many rungs the scale has, because a two-point
 * scale gives the curve two points and pushes the area toward 0.5 for reasons that are about the
 * instrument rather than the person. Every published band is measured on subjects whose scales
 * carried ${DISCRETE_MIN_LEVELS}-${DISCRETE_MAX_LEVELS} distinct levels, which is where this product's seven-level scale sits.
 */

/** Bump when the corpus or the estimator changes. Readings across versions are not comparable. */
export const SENSITIVITY_REFERENCE_VERSION = 1;

/**
 * How strongly AUROC2 tracks being good at the first-order task, in this corpus.
 *
 * Published because it is the reason the bands are stratified at all, and because a future
 * corpus that does not reproduce it would mean the stratification is costing resolution for
 * nothing.
 */
export const ACCURACY_COUPLING = ${accuracyCoupling.toFixed(4)};

export interface SensitivityBand {
  /** How many individual people the band was measured on. */
  n: number;
  /** How many datasets they came from. */
  studies: number;
  mean: number;
  sd: number;
  /** Share of people whose confidence carried ANY information about their own correctness. */
  aboveChance: number;
  /** Nearest-rank, so every figure here is a value some real person actually produced. */
  percentiles: readonly { p: number; auroc2: number }[];
}

export interface SensitivityStratum {
  /** First-order accuracy this band was measured on: [from, to). */
  from: number;
  to: number;
  band: SensitivityBand;
}

/** Every readable subject on a ${DISCRETE_MIN_LEVELS}-${DISCRETE_MAX_LEVELS} level scale, whatever they scored. */
export const SENSITIVITY_REFERENCE: SensitivityBand = ${bandLiteral(sameRegime, regime, "")};

/**
 * The same people, split by how accurate they were.
 *
 * A stratum the corpus cannot support is ABSENT, not interpolated: the floor is
 * ${MIN_STRATUM_SUBJECTS} people, and \\\`sensitivityBand\\\` returns null below it so a caller renders "no
 * reference class" rather than a band computed from a handful.
 */
export const SENSITIVITY_STRATA: readonly SensitivityStratum[] = [
${strata.map((s) => `  { from: ${s.stratum.from}, to: ${s.stratum.to === 1.0001 ? "1" : s.stratum.to}, band: ${bandLiteral(s.band, s.inside, "  ")} },`).join("\n")}
];

/**
 * The band a reading should be shown against: people who were about as accurate as this reader.
 *
 * Null where the corpus has no stratum for that accuracy, which is a real answer -- falling back
 * to the unconditioned band would hand the reader the confound this function exists to remove,
 * and would do it silently.
 *
 * NO FINITENESS GUARD, deliberately. One was written here first and was dead code: every
 * comparison against NaN is false, and an infinity clears no half-open interval, so the search
 * already returns null for all of them. A positive control found it by deleting the guard and
 * watching nothing fail -- the same way the closing guard in \`sensitivity.ts\` was found.
 */
export function sensitivityBand(accuracy: number): SensitivityBand | null {
  const stratum = SENSITIVITY_STRATA.find((s) => accuracy >= s.from && accuracy < s.to);
  return stratum?.band ?? null;
}
`,
);

console.log(`subjects: ${all.length} from ${studiesUsed}/${studies.length} datasets`);
console.log(`skipped -- schema: ${skipped.schema.length}, no readable subject: ${skipped.subjects.length}`);
const show = (label: string, d: ReturnType<typeof describe>) => {
  console.log(`${label.padEnd(22)} n=${String(d.n).padStart(5)} mean=${d.mean.toFixed(4)} sd=${d.sd.toFixed(4)} above chance=${(d.aboveChance * 100).toFixed(1)}%  ` +
    PERCENTILES.map((p) => `p${p}=${d.percentiles[p].toFixed(3)}`).join(" "));
};
console.log("");
show("all scales", overall);
show(`${DISCRETE_MIN_LEVELS}-${DISCRETE_MAX_LEVELS} levels`, sameRegime);
console.log(`\nspearman(accuracy, auroc2) = ${accuracyCoupling.toFixed(4)}\n`);
for (const s of strata) show(`accuracy ${s.stratum.from}-${s.stratum.to === 1.0001 ? 1 : s.stratum.to}`, s.band);
for (const s of STRATA) {
  const inside = regime.filter((r) => r.accuracy >= s.from && r.accuracy < s.to);
  if (inside.length < MIN_STRATUM_SUBJECTS) console.log(`ABSENT accuracy ${s.from}-${s.to}: only ${inside.length} people (floor ${MIN_STRATUM_SUBJECTS})`);
}

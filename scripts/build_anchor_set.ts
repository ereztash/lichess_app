/**
 * Build the anchor set -- the positions every player answers, so the headline is comparable.
 *
 * WHY A FIXED SET AT ALL. A calibration gap computed over whatever positions a player happened to
 * reach is not comparable to anyone else's, because it moves with the difficulty of the item bank
 * as readily as with the player's judgement. Measured in the repo's own audit, roughly two thirds
 * of the signal was position difficulty rather than self-knowledge. Statistical correction after
 * the fact cannot fix that: regressing difficulty out removes the very between-person variance
 * the number is supposed to carry. The only repair that works is to hold the positions FIXED, so
 * difficulty variance across players is zero BY CONSTRUCTION rather than by adjustment.
 *
 * WHY THIS IS A SCRIPT AND NOT A HAND-WRITTEN LIST. Gigerenzer, Hoffrage & Kleinbölting (1991) and
 * Juslin (1994) found substantial overconfidence on SELECTED items and close to none on
 * REPRESENTATIVE ones -- the same subjects, the same scale, the difference being entirely how the
 * items were chosen. A curated bank of "instructive" positions would manufacture the finding it
 * was built to measure. So positions here are taken by a stated rule from a stream of real games
 * and nothing is chosen for being interesting.
 *
 * THE RULE, in full, so the bank can be regenerated and disagreed with:
 *   corpus     -- the Lichess open database (CC0, commercial use explicit), one monthly file, read
 *                 as a bounded byte range because zstd is partially decompressible.
 *   games      -- must carry `[%eval]`, terminate normally, and have a base time of 180s or more,
 *                 so the position had real thought behind it rather than a bullet reflex.
 *   positions  -- past the opening (`ply > OPENING_MAX_PLY`, where accuracy approaches 100% for
 *                 everyone because book moves are book moves), not the final ply (often forced),
 *                 and NOT ALREADY DECIDED: |eval| <= 300cp. That last one is Regan's exclusion and
 *                 it is not cosmetic -- in a +9 position every legal move "loses" almost nothing,
 *                 so an accuracy measurement there is measuring the position, not the player.
 *   sampling   -- a fixed stride through the eligible stream in order, at most ONE position per
 *                 source game. Not random, so the bank is reproducible; not scored, so nothing is
 *                 selected for; one per game, because two positions from one game share an
 *                 opening, an opponent and a player and are not independent items.
 *
 * WHAT THE BANK MAY NOT CARRY. The engine evaluation is used to EXCLUDE decided positions here,
 * at build time, and is then thrown away. R3 forbids engine output reaching the client before a
 * decision is recorded, and a position that arrived with its own centipawn score attached would
 * be exactly that. The shipped entry is a FEN and its provenance.
 *
 * Run: npx tsx scripts/build_anchor_set.ts <slice.pgn>
 *
 * Writes TWO files, and the split is a bundle decision rather than a taxonomy. `isAnchorFen` needs
 * only the positions and is reached from shared code that every arrival loads; the move lists are
 * needed only when a position is actually served, and shipping 15kB of them to every visitor for a
 * membership test is 15kB nobody asked for. They are generated together so they cannot drift, and
 * a test holds them in lockstep.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { Chess } from "chess.js";
import { OPENING_MAX_PLY } from "../shared/phase.js";

/** Positions in the bank. 60 is the smallest n at which a player's gap can be said to differ from zero. */
const TARGET = 60;
/** Regan's exclusion: past this, the position is decided and a move choice measures nothing. */
const DECIDED_CP = 300;
/** Blitz and slower. A bullet reflex is not a decision. */
const MIN_BASE_SECONDS = 180;

interface Candidate {
  fen: string;
  /** The moves leading here, so the board can be handed the game as it was actually played. */
  sans: string[];
  game: string;
  ply: number;
  cp: number;
}

function candidates(pgn: string): Candidate[] {
  const found: Candidate[] = [];
  for (const chunk of pgn.split(/\n(?=\[Event )/)) {
    if (!chunk.includes("%eval")) continue;
    const tag = (name: string) => chunk.match(new RegExp(`\\[${name} "(.*?)"\\]`))?.[1] ?? "";
    if (tag("Termination") !== "Normal") continue;
    const base = Number(tag("TimeControl").split("+")[0]);
    if (!Number.isFinite(base) || base < MIN_BASE_SECONDS) continue;
    const site = tag("Site");
    if (!site) continue;

    /*
     * The movetext starts after the blank line that ends the tag block -- NOT after the last `]`
     * in the chunk, which was the first attempt and silently found nothing: `{[%eval 0.17]}` and
     * `{[%clk 0:03:00]}` are full of closing brackets, so that cut the whole body away.
     */
    const blank = chunk.indexOf("\n\n");
    if (blank < 0) continue;
    const body = chunk.slice(blank + 2);
    const board = new Chess();
    /*
     * SAN plus the comment that follows it. Read in order and replayed, rather than trusting the
     * move numbers -- a stream sliced mid-file can start anywhere and a truncated tail is normal.
     */
    const step = /([A-Za-z][\w+#=-]{1,6})\s*\{([^}]*)\}/g;
    const plies: { fen: string; cp: number | null; san: string }[] = [];
    let match: RegExpExecArray | null;
    while ((match = step.exec(body))) {
      const before = board.fen();
      try {
        if (!board.move(match[1])) break;
      } catch {
        break;
      }
      const evaluation = match[2].match(/%eval (-?[\d.]+|#-?\d+)/)?.[1];
      const cp =
        evaluation === undefined
          ? null
          : evaluation.startsWith("#")
            ? Number(evaluation.slice(1)) >= 0
              ? 10_000
              : -10_000
            : Math.round(Number(evaluation) * 100);
      plies.push({ fen: before, cp, san: match[1] });
    }

    for (let index = 0; index < plies.length - 1; index += 1) {
      const ply = index;
      if (ply <= OPENING_MAX_PLY) continue;
      const { fen, cp } = plies[index];
      if (cp === null || Math.abs(cp) > DECIDED_CP) continue;
      /*
       * Trimmed to BEFORE the move under decision. The board renders every move it is given, so
       * one ply too many puts the answer on screen beside the question -- the same rule the
       * first-decision picker follows, for the same reason.
       */
      const sans = plies.slice(0, index).map((entry) => entry.san);
      found.push({ fen, sans, game: site.split("/").pop() ?? site, ply, cp });
    }
  }
  return found;
}

const pool = candidates(readFileSync(process.argv[2], "utf8"));

/*
 * ONE POSITION PER GAME, and the first version did not do this. A fixed stride through the
 * eligible stream took 60 positions from 45 games -- so a quarter of the bank was pairs sharing
 * an opening, an opponent and a player, which are not independent items whatever the sampling
 * rule says. The stride still spreads the draw across the whole stream; the game filter is what
 * makes each draw its own.
 */
const stride = Math.max(1, Math.floor(pool.length / TARGET));
const chosen: Candidate[] = [];
const seenGames = new Set<string>();
for (let offset = 0; offset < stride && chosen.length < TARGET; offset += 1) {
  for (let i = offset; i < pool.length && chosen.length < TARGET; i += stride) {
    const candidate = pool[i];
    if (seenGames.has(candidate.game)) continue;
    seenGames.add(candidate.game);
    chosen.push(candidate);
  }
}

const identity = chosen
  .map(
    (c) =>
      `  { id: ${JSON.stringify(`${c.game}-${c.ply}`)}, fen: ${JSON.stringify(c.fen)} },`,
  )
  .join("\n");

const payload = chosen
  .map((c) => {
    const sans = c.sans.map((san) => JSON.stringify(san)).join(", ");
    return `  { id: ${JSON.stringify(`${c.game}-${c.ply}`)}, ply: ${c.ply - 1}, sans: [${sans}] },`;
  })
  .join("\n");

const absolute = chosen.map((c) => Math.abs(c.cp)).sort((a, b) => a - b);
const median = absolute[Math.floor(absolute.length / 2)] ?? 0;
const balanced = chosen.filter((c) => Math.abs(c.cp) <= 50).length;

writeFileSync("shared/anchor-set.ts", `/**
 * The anchor set -- the positions every player answers.
 *
 * GENERATED by scripts/build_anchor_set.ts, which carries the sampling rule and the reasoning.
 * Do not edit by hand: a bank that drifts from its generator is a bank whose provenance is a
 * story rather than a record.
 *
 * WHAT IT IS FOR. The calibration gap over a player's own games is not comparable to anyone
 * else's, because it moves with the difficulty of the positions they happened to reach. Held
 * fixed, difficulty variance across players is zero by construction, and what is left is the
 * thing the product claims to measure.
 *
 * PROVENANCE: the Lichess open database (CC0 -- "use them for research, commercial purpose,
 * publication, anything you like"), standard rated games, blitz and slower, terminating normally,
 * carrying engine evaluations. Positions past the opening, not the last ply, and not already
 * decided (|eval| <= ${DECIDED_CP}cp, which is Regan's exclusion). Taken by a fixed stride through
 * the eligible stream rather than chosen, because overconfidence is substantial on SELECTED items
 * and near zero on REPRESENTATIVE ones (Gigerenzer et al. 1991; Juslin 1994) -- a curated bank
 * would manufacture the finding it exists to measure.
 *
 * DIFFICULTY OF THIS BANK, in aggregate only: median |eval| ${median}cp, and ${balanced} of
 * ${chosen.length} positions within 50cp of level. Per-position evaluations are NOT here and must
 * never be: R3 forbids engine output reaching the client before a decision is recorded, and a
 * position arriving with its own score attached is exactly that. They were used to exclude
 * decided positions at build time and then discarded.
 *
 * VERSIONED, because changing the bank changes what the number means. A reading taken on one
 * version is not comparable to a reading taken on another, and nothing may silently pool them.
 */

/** Bump whenever the positions change. Readings across versions are not comparable. */
export const ANCHOR_SET_VERSION = 1;

export interface AnchorPosition {
  /** Stable across regenerations: the source game and the half-move within it. */
  id: string;
  fen: string;
}

export const ANCHOR_POSITIONS: readonly AnchorPosition[] = [
${identity}
];

const BY_FEN = new Set(ANCHOR_POSITIONS.map((position) => position.fen));

/**
 * Whether a decision was taken on a bank position.
 *
 * By FEN rather than by a stored flag, on purpose: it is retroactive, it needs no column, and it
 * cannot go stale against the bank. A position is in the set or it is not, and the FEN is the
 * whole of what makes that true.
 */
export function isAnchorFen(fen: string): boolean {
  return BY_FEN.has(fen);
}

const ID_BY_FEN = new Map(ANCHOR_POSITIONS.map((position) => [position.fen, position.id]));

/**
 * Which bank positions a set of decisions covers, in the bank's own order.
 *
 * Deduplicated, because a position answered twice is still one position covered -- counting it
 * twice would report progress through a set that had not been made.
 */
export function anchorIdsIn(decisions: readonly { fen: string }[]): string[] {
  const seen = new Set<string>();
  for (const decision of decisions) {
    const id = ID_BY_FEN.get(decision.fen);
    if (id) seen.add(id);
  }
  return ANCHOR_POSITIONS.filter((position) => seen.has(position.id)).map((p) => p.id);
}
`);

writeFileSync(
  "shared/anchor-moves.ts",
  `/**
 * The moves that lead to each anchor position.
 *
 * GENERATED by scripts/build_anchor_set.ts alongside shared/anchor-set.ts. Separate from it for
 * one reason: \`isAnchorFen\` is reached from code every arrival loads, and these move lists are
 * needed only when a position is actually SERVED. Fifteen kilobytes of movetext in the entry
 * bundle to answer a membership test is fifteen kilobytes nobody asked for.
 *
 * Import this lazily. The two files are generated together and tests/shared/anchor-set.test.ts
 * holds them in lockstep, so the split cannot become a drift.
 */

export interface AnchorMoves {
  id: string;
  /**
   * The half-move the board shows -- the position BEFORE the decision.
   *
   * The board renders currentPly as "the last move played", so the decision is taken on the
   * position that follows it.
   */
  ply: number;
  /**
   * The moves leading to it, in SAN, so the position arrives with the game that produced it
   * rather than as a bare diagram. Trimmed to before the move under decision: one ply more and
   * the answer would be on screen beside the question.
   */
  sans: readonly string[];
}

export const ANCHOR_MOVES: readonly AnchorMoves[] = [
${payload}
];
`,
);

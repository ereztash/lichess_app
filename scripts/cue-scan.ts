/**
 * NO CUE MAY REQUIRE ENGINE-ONLY KNOWLEDGE AT DECISION TIME.
 *
 * THE PROPOSITION, AND WHY IT IS WORTH A GATE. A behavioural packet says `WHEN X -> DO Y`, and the
 * whole construct depends on the player being able to notice `X` **during a game, with no engine
 * and nobody telling them it is there**. `docs/learning-v2/KNOWLEDGE_MAP.md` states the mechanism --
 * Einstein and McDaniel's focal cues retrieve spontaneously, nonfocal ones need strategic
 * monitoring -- and then states the repository's own failure: *"`mechanism_class` labels are
 * nonfocal by construction"*. A cue defined by a centipawn number is worse than nonfocal; it is
 * unobservable, and a packet built on one is untestable rather than merely weak.
 *
 * WHAT IS CHECKED, AND WHAT IS DELIBERATELY NOT. This checks that every `trigger` in the rule-class
 * register, and every function it reaches inside that module, computes from the BOARD and the RULES
 * OF CHESS alone -- no evaluation, no search result, no engine. It does NOT check that a human
 * would actually notice the cue. That is `E2`, it needs people, and a gate that claimed it would be
 * a gate asserting a psychological fact from a static read.
 *
 * A SEARCH IS NOT AN ENGINE. `RC-00`'s trigger enumerates legal moves looking for mate in one, which
 * is a search and is also something a player does. The line this draws is at the EVALUATION
 * FUNCTION: a quantity that exists only because a program scored a position. `mate` is a rule of
 * chess; `+0.34` is not.
 *
 * THE CALL GRAPH IS FOLLOWED, because the first version of this check read only the trigger body
 * and `_promote_trigger` is four lines that call `_promotions`. A check that stopped at the
 * declaration would pass a register whose helpers did the forbidden thing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

export interface Finding {
  file: string;
  line: number;
  text: string;
}

const REGISTER = "research/measurement/rule_classes.py";

/**
 * Tokens that only appear where an evaluation does.
 *
 * `score` IS ON THE LIST AND `mate` IS NOT, and that pair is the whole judgement. A position's
 * score is a program's opinion; a mate is a rule. Everything here names a thing that cannot be
 * computed from the board without something that evaluates it.
 */
const ENGINE_TOKENS = [
  "chess.engine",
  "SimpleEngine",
  "popen_uci",
  "analyse(",
  "Limit(",
  "stockfish",
  "Stockfish",
  "centipawn",
  "cp_loss",
  "wdl",
  "expected_score",
  "MATE_SCORE",
  "_value(",
  "engine",
];

/** Every `name=` value in the register's `trigger=` slots. */
function triggerNames(source: string): string[] {
  return [...source.matchAll(/trigger=(\w+)/g)].map((m) => m[1]);
}

/**
 * Comments and docstrings removed, because the first version of this scanner fired on both.
 *
 * `rule_classes.py` is a file whose prose is largely ABOUT not using an engine -- *"pure
 * attacker/defender geometry -- no SEE, no engine"*, *"No engine outcome is required to define
 * B"* -- so a token scan over raw source reddens on the sentences that assert the property it is
 * checking. Two findings, both of them a docstring saying the right thing.
 *
 * `RNL-04`'s companion rule applies here: a gate that can only fail through an irrelevant detail is
 * worse than no gate, because somebody will delete the sentence rather than the defect.
 */
function code(source: string): string {
  // LINE COUNT IS PRESERVED, so a finding's line number still points at the real file. A docstring
  // is replaced by as many blank lines as it occupied, not by one.
  const blanks = (m: string) => "\n".repeat((m.match(/\n/g) ?? []).length);
  return source
    .replace(/'''[\s\S]*?'''/g, blanks)
    .replace(/"""[\s\S]*?"""/g, blanks)
    .split("\n")
    .map((l) => l.replace(/#.*$/, ""))
    .join("\n");
}

/** `def name(...)` bodies, keyed by name, by indentation rather than by a parser. */
function functionBodies(source: string): Map<string, { body: string; line: number }> {
  const out = new Map<string, { body: string; line: number }>();
  const lines = source.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const m = /^def (\w+)\s*\(/.exec(lines[i]);
    if (!m) continue;
    const body: string[] = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^\S/.test(lines[j]) && lines[j].trim() !== "") break;
      body.push(lines[j]);
    }
    out.set(m[1], { body: body.join("\n"), line: i + 1 });
  }
  return out;
}

/** Everything a body calls that this module also defines. */
function callees(body: string, known: Set<string>): string[] {
  return [...new Set([...body.matchAll(/(\w+)\s*\(/g)].map((m) => m[1]))].filter((n) =>
    known.has(n),
  );
}

/**
 * Every cue that could not be evaluated by a player at the board.
 *
 * Returns findings rather than throwing: the gate runner counts them, and a finding names the
 * trigger, the helper it reached through, and the token.
 */
export function findUnobservableCues(root: string): Finding[] {
  let source: string;
  try {
    source = readFileSync(join(root, REGISTER), "utf8");
  } catch {
    return [
      {
        file: REGISTER,
        line: 1,
        text: "the rule-class register is missing; no cue can be checked",
      },
    ];
  }

  const stripped = code(source);
  const bodies = functionBodies(stripped);
  const known = new Set(bodies.keys());
  const findings: Finding[] = [];
  const triggers = triggerNames(stripped);

  if (triggers.length === 0) {
    return [{ file: REGISTER, line: 1, text: "no `trigger=` found; the register shape changed" }];
  }

  for (const trigger of triggers) {
    const seen = new Set<string>();
    const queue = [trigger];
    while (queue.length) {
      const name = queue.shift()!;
      if (seen.has(name)) continue;
      seen.add(name);
      const fn = bodies.get(name);
      if (!fn) continue;
      for (const token of ENGINE_TOKENS) {
        if (!fn.body.includes(token)) continue;
        const offset = fn.body.indexOf(token);
        const line = fn.line + fn.body.slice(0, offset).split("\n").length;
        findings.push({
          file: REGISTER,
          line,
          text:
            `cue \`${trigger}\`${name === trigger ? "" : ` reaches \`${name}\` which`} ` +
            `uses \`${token}\`. A cue a player cannot evaluate at the board is not a cue; ` +
            `it is a label for something only the system can see`,
        });
      }
      queue.push(...callees(fn.body, known));
    }
  }
  return findings;
}

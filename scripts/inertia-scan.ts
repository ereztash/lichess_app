/**
 * Static scanners for the inertial gates.
 *
 * WHAT THESE PROTECT, AND WHY IT IS A DIFFERENT KIND OF CLAIM FROM THE GATES BESIDE THEM. Every
 * scanner in `gate-scan.ts` reads code for a claim about a MEASUREMENT: a placeholder standing in
 * for an evaluation, a percentage with no denominator, an engine imported into the render path.
 * These read code for a claim about a STATE: which surfaces may exist while the player is in one.
 *
 * They are the same kind of rule underneath. `docs/INERTIAL_UX_LAWS.md` LAW 1 is a validity rule
 * wearing a layout question -- a confidence stated in front of a panel describing that player's
 * calibration is not a measurement of what they believed -- and the reason it needs a gate rather
 * than a test is that it is violated by ADDING something, anywhere, at any time. A test asserts
 * that a screen is right today. A gate asserts that no screen has become wrong.
 *
 * EVERY PREDICATE HERE IS RUN OVER TWO ROOTS: the real tree and `tests/fixtures/inertia`, which
 * contains the violation each one is for. Same predicate, different input -- a control with its
 * own weaker predicate proves nothing.
 */
import { readFileSync } from "node:fs";
import { relative } from "node:path";
import { sourceFiles, stripComments, type Finding } from "./gate-scan";

const read = (file: string) => stripComments(readFileSync(file, "utf8"));
const posix = (file: string) => file.replaceAll("\\", "/");

/** Every occurrence of `<Name` as a JSX opening tag, with its line. */
function renders(source: string, component: string): number[] {
  const lines = source.split("\n");
  const tag = new RegExp(`<${component}(?![A-Za-z0-9_])`);
  return lines.flatMap((line, i) => (tag.test(line) ? [i + 1] : []));
}

/**
 * A READING OF THE RECORD, and the files allowed to render one.
 *
 * THE LIST IS THE LAW'S OWN LIST. LAW 1 names them: the claim panel, the learning queue, a pattern
 * already found, a recommendation about their weakness, game review, or any engine insight outside
 * the protocol. What is NOT here is as deliberate: `RevealPanel` is the verdict on the decision
 * just committed, which is the reveal's own subject rather than prior evidence, and `EvaluationBar`
 * is engine output about the position on the board, permitted in the one stage the engine may
 * speak in.
 *
 * PERMISSION IS PER COMPONENT AND NOT PER FILE. `Record.tsx` is `REFLECT` and may show the
 * dashboard; it may not show the claim panel, and a single allowlist of files would have let it.
 */
export const RECORD_READINGS: Readonly<Record<string, readonly string[]>> = {
  ClaimPanel: ["client/src/components/RecordExplorer.tsx"],
  LearningQueue: ["client/src/components/RecordExplorer.tsx"],
  LichessLayersPanel: ["client/src/components/RecordExplorer.tsx"],
  AnalysisPanel: ["client/src/components/RecordExplorer.tsx"],
  GameReview: ["client/src/components/RecordExplorer.tsx"],
  GameReviewProgress: ["client/src/components/RecordExplorer.tsx"],
  /* The front door is `REFLECT`: reading the record is the whole of what a player is there for. */
  RecordDashboard: ["client/src/components/RecordExplorer.tsx", "client/src/pages/Record.tsx"],
};

/**
 * A reading of the record rendered from a file that is not allowed to render one.
 *
 * `definedIn` IS EXCLUDED BY NAME rather than by heuristic: a component's own file mentions its own
 * tag in ways that are not a render (a re-export, a doc example), and a scanner that flagged those
 * would be one people learn to work around.
 */
export function findReadingsOutsideTheirSurface(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const path = posix(relative(process.cwd(), file));
      const source = read(file);
      for (const [component, allowed] of Object.entries(RECORD_READINGS)) {
        if (path.endsWith(`/components/${component}.tsx`)) continue;
        if (allowed.some((permitted) => path.endsWith(permitted))) continue;
        for (const line of renders(source, component)) {
          out.push({ file: path, line, text: `<${component}> outside ${allowed.join(" or ")}` });
        }
      }
    }
  }
  return out;
}

/**
 * More than one board in one file (LAW 11).
 *
 * ONE BOARD, ONE STORY. `Blitz.tsx` rendered a second `<ChessBoard>` inside its post-game review,
 * so a player looking at a position from the game they had just played was looking at a different
 * element in a different place from the one they had played it on. Two boards on a screen is two
 * answers to "where am I", and the player has to work out which is which every time either changes.
 */
export function findScreensWithTwoBoards(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const lines = renders(read(file), "ChessBoard");
      if (lines.length > 1) {
        out.push({
          file: posix(relative(process.cwd(), file)),
          line: lines[1],
          text: `${lines.length} boards in one screen (lines ${lines.join(", ")})`,
        });
      }
    }
  }
  return out;
}

/**
 * A BOARD RENDERED WITHOUT SAYING WHOSE HAND IT IS, or saying it the same way in every state.
 *
 * WHAT THIS IS A GATE OVER. `shared/board-authority.ts` names what a gesture on the board may
 * reach and as what, and `ChessBoard` refuses the gesture when the answer is `none`. The prop is
 * required, so a board with no authority at all is already a compile error -- this scanner exists
 * for the OTHER direction, which a type cannot see: a board whose authority is a constant. A
 * screen that passes `authority="propose"` unconditionally has re-created exactly the defect the
 * module was written for, and it typechecks.
 *
 * `"none"` IS THE ONE CONSTANT ALLOWED, because it is the safe direction: a board that never
 * accepts anything cannot leak authority to anybody. Everything else has to be derived from state,
 * which is the whole of `docs/INERTIAL_UX_LAWS.md` LAW 3 -- state decides, screen renders.
 *
 * IT CANNOT BE SATISFIED BY DELETION. Removing the prop does not silence this scanner; it stops
 * the build.
 *
 * A CONSTANT HAS FIVE SPELLINGS AND THE FIRST VERSION OF THIS SAW ONE. It tested `^"(.*)"$` against
 * the raw attribute value, so `authority={"propose"}` -- one pair of braces -- and
 * `authority={ALWAYS}` beside `const ALWAYS = "play"` were both read as derived. An adversarial pass
 * put two such boards in `client/src`, ran `npm run gates`, and got `34 gates: 34 pass`. A gate that
 * a different spelling walks past is not a gate; it is a suggestion with a red control attached.
 * So the value is NORMALISED first -- braces stripped, quotes of all three kinds, a template with
 * no substitution, and an identifier resolved against a `const` in the same file -- and only what
 * survives that is called derived.
 *
 * WHAT IS DELIBERATELY NOT REJECTED: a member expression, a call, a conditional, a prop. Those are
 * where the answer comes from state, which is the thing being asked for.
 */
export function findBoardsWithUncheckedAuthority(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const path = posix(relative(process.cwd(), file));
      if (path.endsWith("/components/ChessBoard.tsx")) continue;
      const source = read(file);
      for (const tag of boardTagNames(source)) {
        for (const props of openingTags(source, tag)) {
          const declared = /\bauthority\s*=\s*(\{[\s\S]*?\}|"[^"]*"|'[^']*')/.exec(props.text);
          if (!declared) {
            out.push({ file: path, line: props.line, text: `<${tag}> with no declared authority` });
            continue;
          }
          const constant = constantValue(declared[1], source);
          if (constant !== null && constant !== "none") {
            out.push({
              file: path,
              line: props.line,
              text: `<${tag} authority=${declared[1]}> is the same in every state`,
            });
          }
        }
      }
    }
  }
  return out;
}

/**
 * Every local name `ChessBoard` is rendered under in one file.
 *
 * AN ALIAS IS A RENAME, NOT A DIFFERENT COMPONENT. `import { ChessBoard as Board }` and then
 * `<Board authority="play" />` is the same board with the same defect, and a scanner that greps
 * for one string walks past it. `RNL-06`: identity follows semantics, not labels.
 */
function boardTagNames(source: string): string[] {
  const names = new Set<string>();
  if (/\bChessBoard\b/.test(source)) names.add("ChessBoard");
  for (const m of source.matchAll(/\bChessBoard\s+as\s+([A-Za-z_$][\w$]*)/g)) names.add(m[1]);
  return [...names];
}

/**
 * The constant an authority expression is, or null when it is genuinely derived.
 *
 * ONE LAYER OF BRACES IS STRIPPED and no more: `authority={cond ? "none" : "play"}` keeps its
 * conditional and is derived, which is right. A template literal carrying `${` is derived for the
 * same reason -- something is substituted into it.
 *
 * AN IDENTIFIER IS RESOLVED IN ITS OWN FILE ONLY. Following it across modules would need a
 * resolver, and a scanner that half-followed imports would report differently depending on how a
 * file happened to be split. In-file is the case that was demonstrated and the case a screen
 * actually writes.
 */
function constantValue(raw: string, source: string): string | null {
  const inner = /^\{([\s\S]*)\}$/.exec(raw.trim());
  const value = (inner ? inner[1] : raw).trim();
  const quoted = /^(["'`])([\s\S]*)\1$/.exec(value);
  if (quoted) return quoted[1] === "`" && quoted[2].includes("${") ? null : quoted[2];
  if (!/^[A-Za-z_$][\w$]*$/.test(value)) return null;
  const declared = new RegExp(
    `\\bconst\\s+${value}\\s*(?::[^=]*)?=\\s*(["'\`])([^"'\`]*)\\1`,
  ).exec(source);
  return declared ? declared[2] : null;
}

/**
 * Every opening tag of one component, with its whole prop list and the line it starts on.
 *
 * BRACE DEPTH AND QUOTES, not the first `/>`. A prop's value is an expression, and the two things
 * that end a tag early if you ignore them are a `>` inside a brace and a `>` inside a STRING --
 * `aria-label="a > b"` truncated the tag text and made the board after it report "no declared
 * authority", which is a finding for the wrong reason. It failed safe and it was still wrong, and
 * an adversarial pass demonstrated it.
 */
function openingTags(source: string, component: string): Array<{ text: string; line: number }> {
  const out: Array<{ text: string; line: number }> = [];
  const tag = new RegExp(`<${component}(?![A-Za-z0-9_])`, "g");
  let match: RegExpExecArray | null;
  while ((match = tag.exec(source)) !== null) {
    let depth = 0;
    let quote: string | null = null;
    let end = source.length - 1;
    for (let i = match.index; i < source.length; i += 1) {
      const c = source[i];
      if (quote) {
        if (c === quote && source[i - 1] !== "\\") quote = null;
        continue;
      }
      if (c === '"' || c === "'" || c === "`") quote = c;
      else if (c === "{") depth += 1;
      else if (c === "}") depth -= 1;
      else if (depth === 0 && c === ">") {
        end = i;
        break;
      }
    }
    out.push({
      text: source.slice(match.index, end + 1),
      line: source.slice(0, match.index).split("\n").length,
    });
  }
  return out;
}

/**
 * A setup control that asks again rather than reading what the player already chose.
 *
 * THE PREDICATE IS "DOES THIS FILE CONSULT THE MEMORY", not "does it have a default". A default is
 * fine and necessary -- a first visit has nothing to remember -- and the violation is a surface
 * that STARTS a run from a value it made up while a stored answer exists.
 */
export const CONFIGURED_SURFACES = [
  { file: "client/src/pages/Blitz.tsx", reads: "rememberedTimeControl", writes: "rememberTimeControl" },
  { file: "client/src/lib/use-new-game-setup.ts", reads: "rememberedGameSetup", writes: "rememberGameSetup" },
] as const;

export function findSurfacesThatAskAgain(roots: string[]): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const path = posix(relative(process.cwd(), file));
      const surface = CONFIGURED_SURFACES.find((s) => path.endsWith(s.file.split("/").pop()!));
      if (!surface) continue;
      const source = read(file);
      if (!source.includes(surface.reads)) {
        out.push({ file: path, line: 1, text: `starts a run without reading ${surface.reads}` });
      }
      if (!source.includes(surface.writes)) {
        out.push({ file: path, line: 1, text: `never keeps the answer via ${surface.writes}` });
      }
    }
  }
  return out;
}

/**
 * WORK A SCREEN CAN CANCEL BY UNMOUNTING, AND A ROOT THAT WOULD NEVER FINISH IT (LAW 4).
 *
 * WHAT THIS IS FOR. `Blitz.tsx` ran the post-game analysis in a `useEffect` with a `cancelled`
 * flag, so leaving the screen abandoned the search -- and the screen offering the navigation was
 * `PostGame`, saying "play another game". What followed was a game stored `pending` that nothing
 * would ever finish: not lost, permanently half-recorded, which is the same failure wearing a
 * different face.
 *
 * IT LOOKS FOR `analyseFinishedGame` AND NOT FOR `.analyze(`, AND THE NARROWNESS IS THE POINT. A
 * single-position search IS correctly cancellable: the opponent's reply to a game nobody is
 * playing any more should stop, and both screens cancel one for that reason. What may not be
 * cancellable is a pass over a STORED RECORD, because abandoning that leaves a row nothing will
 * ever complete. A predicate that flagged every engine call would flag two correct effects, and a
 * gate that cries wolf twice is a gate people route around.
 *
 * AND IT CHECKS THE POSITIVE HALF, because a rule that only forbids is satisfied by deleting the
 * feature. Something at the root has to pick pending work up -- that is what makes a later page
 * load, a second tab, or a screen that never saw the game finish it.
 */
export function findPendingWorkLeaks(roots: string[], rootFile: string): Finding[] {
  const out: Finding[] = [];
  for (const root of roots) {
    for (const file of sourceFiles(root)) {
      const source = read(file);
      const lines = source.split("\n");
      const passes = lines.flatMap((line, i) => (/analyseFinishedGame\(/.test(line) ? [i + 1] : []));
      if (passes.length === 0) continue;
      if (!/\bcancelled\b/.test(source)) continue;
      out.push({
        file: posix(relative(process.cwd(), file)),
        line: passes[0],
        text: "a whole-game analysis a screen can cancel by unmounting",
      });
    }
  }

  /*
   * THE ROOT MOUNTS THE QUEUE, or nothing finishes what a screen left behind. Named by the symbol
   * rather than by a class or a comment: the hook is what does the work, and a component that
   * rendered the right element while calling nothing would satisfy any check on the markup.
   */
  const root = read(rootFile);
  if (!/useBlitzAnalysis\(\)/.test(root)) {
    out.push({
      file: posix(relative(process.cwd(), rootFile)),
      line: 1,
      text: "the root does not run the pending-analysis queue, so nothing resumes abandoned work",
    });
  }
  return out;
}

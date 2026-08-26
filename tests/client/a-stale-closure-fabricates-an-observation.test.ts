/**
 * The dependency list is part of the measurement, and one entry was missing from it.
 *
 * `onCommit` reads `learningTransferApplied` twice -- once to refuse a commit whose application
 * question is unanswered, once to write that answer into the observation -- and listed
 * `learningTransferRecall` beside it while omitting it. React then holds whichever value the
 * callback closed over.
 *
 * WHY IT NEVER SHOWED. `useDecisionCount()` returns a fresh object literal every render, so
 * `decisionCount` differs by identity each time and the callback was rebuilt on every render
 * regardless. The bug is real and invisible, and the thing that hides it is the exact thing a
 * performance pass removes: memoize that hook -- the obvious optimisation, and correct on its own
 * terms -- and `onCommit` starts closing over a stale answer.
 *
 * WHAT WOULD REACH THE RECORD. `applied_rule` is the player's report of whether they used their
 * own rule. It is half of `successes`, which is what the preregistered refutation condition is
 * tested against. A stale `null` refuses a commit the player did answer; a stale `false` writes
 * "did not apply the rule" about a player who said they did, into an append-only record, with
 * every screen showing the right thing. The product would then report a rule refuted on an
 * observation nobody made.
 *
 * THIS TEST IS A PARSE, NOT A GREP. The assertion it replaces was a regex over Home.tsx looking
 * for two identifiers within 1200 characters of each other, which is satisfied by source that
 * happens to mention them and says nothing about what the file does. This walks the syntax tree
 * and compares what each callback READS against what it DECLARES -- so it holds for the callbacks
 * added after it, not only for the one that was broken.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";

const root = resolve(__dirname, "../..");

/** Every hook whose second argument React treats as a dependency list. */
const HOOKS = new Set(["useCallback", "useMemo", "useEffect", "useLayoutEffect"]);

type HookCall = {
  hook: string;
  /** The `const NAME = useCallback(...)` this belongs to, for a readable failure. */
  name: string;
  line: number;
  declared: Set<string>;
  read: Set<string>;
};

/**
 * Component-scope bindings a hook body reads, against the ones it declares.
 *
 * Only bindings introduced by the component function itself count: imports, module constants and
 * globals are stable by construction, and React does not want them listed. Names bound INSIDE the
 * callback -- parameters, its own locals, destructured pieces -- are not dependencies either, so
 * they are collected and subtracted.
 */
function hookCalls(source: ts.SourceFile): HookCall[] {
  const out: HookCall[] = [];

  const componentScope = (node: ts.Node): Set<string> => {
    /*
     * Walk outward to the enclosing function and take every `const`/`let` it declares plus its
     * parameters -- that is the set whose values can differ between renders -- MINUS the two
     * kinds React guarantees are stable and does not want listed:
     *
     *   `const [x, setX] = useState(...)`  -- setX has the same identity for the component's life
     *   `const r = useRef(...)`            -- the ref OBJECT never changes; r.current is not a dep
     *
     * Counting those as dependencies would flag 40-odd correct hooks and drown the one real
     * finding, which is how a check like this stops being read.
     */
    const names = new Set<string>();
    let fn: ts.Node | undefined = node;
    while (fn && !ts.isFunctionDeclaration(fn) && !ts.isFunctionExpression(fn)) fn = fn.parent;
    if (!fn) return names;
    const collect = (n: ts.Node) => {
      if (ts.isVariableDeclaration(n)) {
        for (const name of bindingNames(n.name)) if (!isStable(n, name)) names.add(name);
      }
      if (ts.isParameter(n) && n.parent === fn) bindingNames(n.name).forEach((x) => names.add(x));
      // Do not descend into nested functions: their locals are not component scope.
      if (n !== fn && (ts.isFunctionExpression(n) || ts.isArrowFunction(n))) return;
      ts.forEachChild(n, collect);
    };
    ts.forEachChild(fn, collect);
    return names;
  };

  const visit = (node: ts.Node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      HOOKS.has(node.expression.text) &&
      node.arguments.length === 2 &&
      ts.isArrayLiteralExpression(node.arguments[1])
    ) {
      const [body, deps] = node.arguments;
      const declared = new Set(
        deps.elements.filter(ts.isIdentifier).map((element) => element.text),
      );
      // `a.b.c` depends on `a`; React compares the root binding.
      for (const element of deps.elements) {
        if (ts.isPropertyAccessExpression(element)) declared.add(rootOf(element));
      }
      const scope = componentScope(node);
      const bound = new Set<string>();
      const read = new Set<string>();
      const walk = (n: ts.Node) => {
        if (ts.isVariableDeclaration(n) || ts.isParameter(n))
          bindingNames(n.name).forEach((x) => bound.add(x));
        if (ts.isIdentifier(n) && !isPropertyName(n) && scope.has(n.text)) read.add(n.text);
        ts.forEachChild(n, walk);
      };
      walk(body);
      for (const name of bound) read.delete(name);
      out.push({
        hook: node.expression.text,
        name: declarationName(node),
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        declared,
        read,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** React's own stability contract: `useRef` objects, and the setter half of a `useState` pair. */
function isStable(declaration: ts.VariableDeclaration, name: string): boolean {
  const init = declaration.initializer;
  if (!init || !ts.isCallExpression(init) || !ts.isIdentifier(init.expression)) return false;
  if (init.expression.text === "useRef") return true;
  if (init.expression.text !== "useState") return false;
  // The setter is the second element, and only the second: `x` in `[x, setX]` is a dependency.
  const pattern = declaration.name;
  return (
    ts.isArrayBindingPattern(pattern) &&
    pattern.elements.length === 2 &&
    ts.isBindingElement(pattern.elements[1]) &&
    bindingNames(pattern.elements[1].name).includes(name)
  );
}

function bindingNames(name: ts.BindingName): string[] {
  if (ts.isIdentifier(name)) return [name.text];
  return name.elements.flatMap((element) =>
    ts.isBindingElement(element) ? bindingNames(element.name) : [],
  );
}

function rootOf(node: ts.Expression): string {
  let current: ts.Expression = node;
  while (ts.isPropertyAccessExpression(current)) current = current.expression;
  return ts.isIdentifier(current) ? current.text : "";
}

/** `x` in `{ x: 1 }` and in `a.x` is not a read of the binding `x`. */
function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isJsxAttribute(parent) && parent.name === node) return true;
  return false;
}

function declarationName(node: ts.Node): string {
  let current: ts.Node | undefined = node;
  while (current && !ts.isVariableDeclaration(current)) current = current.parent;
  return current && ts.isIdentifier(current.name) ? current.name.text : "(anonymous)";
}

const FILES = ["client/src/pages/Home.tsx"];

describe("no callback in the decision path closes over a value it does not depend on", () => {
  const parsed = FILES.map((file) => {
    const text = readFileSync(resolve(root, file), "utf8");
    return {
      file,
      calls: hookCalls(
        ts.createSourceFile(file, text, ts.ScriptTarget.ESNext, true, ts.ScriptKind.TSX),
      ),
    };
  });

  it("found the hooks it claims to be checking", () => {
    // A parse that silently matched nothing would make every assertion below vacuous, and this
    // whole file is a replacement for an assertion that was vacuous in exactly that way.
    const calls = parsed.flatMap((p) => p.calls);
    expect(calls.length, "the parse found no dependency lists at all").toBeGreaterThan(10);
    expect(
      calls.some((c) => c.name === "onCommit"),
      "onCommit was not parsed",
    ).toBe(true);
  });

  it("lists every component-scope value each hook body reads", () => {
    const missing = parsed.flatMap(({ file, calls }) =>
      calls
        .map((call) => ({
          where: `${file}:${call.line} ${call.hook} ${call.name}`,
          absent: [...call.read].filter((name) => !call.declared.has(name)).sort(),
        }))
        .filter((entry) => entry.absent.length > 0),
    );
    expect(missing, "a hook holds a value React will not refresh").toEqual([]);
  });

  it("names the answer half of the transfer observation among onCommit's dependencies", () => {
    /*
     * The specific one, pinned by name. The check above is general and would go quiet the day
     * somebody deletes the read; this says the value that decides `applied_rule` is depended on.
     */
    const onCommit = parsed[0].calls.find((call) => call.name === "onCommit")!;
    expect(onCommit.read.has("learningTransferApplied")).toBe(true);
    expect(onCommit.declared.has("learningTransferApplied")).toBe(true);
  });
});

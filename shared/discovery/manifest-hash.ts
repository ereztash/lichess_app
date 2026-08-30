/**
 * CANONICAL JSON, so that a hypothesis has ONE identity and a changed hypothesis has a new one.
 *
 * `JSON.stringify` is not canonical. Key order follows insertion order, so two manifests built by
 * two code paths from the same facts serialise differently and hash differently -- and a freeze
 * whose id depends on the order somebody happened to assign fields is not a freeze. Everything
 * here exists to remove a degree of freedom that is not part of the meaning.
 *
 * WHAT IS NORMALISED, and each of these is a decision:
 *
 *   object keys        sorted, recursively. Order is not meaning.
 *   arrays             NOT sorted. Order IS meaning in an array -- a list of atoms already has a
 *                      canonical order of its own (`canonicalPredicate`), and sorting here would
 *                      silently reorder a list where order mattered.
 *   undefined          refused. `JSON.stringify` DROPS an undefined property, so a manifest with
 *                      a field explicitly set to undefined hashes identically to one without the
 *                      field -- two different statements, one id.
 *   null               kept, and distinct from absent. A stopping rule of null is a stopping rule
 *                      that was recorded as absent; a missing key is one nobody recorded.
 *   non-finite numbers refused. `JSON.stringify(NaN)` is `null`, so NaN and null would collide,
 *                      and a manifest carrying a NaN effect estimate is broken anyway.
 *   -0                 refused. It serialises as `0`, so it would collide with 0, and nothing in a
 *                      manifest means negative zero.
 *
 * A REFUSAL IS A THROW, not a coercion. The alternative -- quietly dropping or defaulting -- is how
 * two different hypotheses come to share an id, and an id collision in this system means a claim
 * accumulating evidence collected against a different claim.
 */

/** Serialise a value so that equal meanings produce equal bytes. Throws on anything unhashable. */
export function canonicalJson(value: unknown, path = "$"): string {
  if (value === null) return "null";
  if (value === undefined) {
    throw new Error(`canonicalJson: undefined at ${path} -- omit the key or write null`);
  }
  const type = typeof value;
  if (type === "boolean") return value ? "true" : "false";
  if (type === "number") {
    const number = value as number;
    if (!Number.isFinite(number)) {
      throw new Error(`canonicalJson: non-finite number at ${path}`);
    }
    if (Object.is(number, -0)) {
      throw new Error(`canonicalJson: negative zero at ${path} -- it is indistinguishable from 0`);
    }
    return JSON.stringify(number);
  }
  if (type === "string") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((item, index) => canonicalJson(item, `${path}[${index}]`)).join(",")}]`;
  }
  if (type === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item, `${path}.${key}`)}`)
      .join(",")}}`;
  }
  throw new Error(`canonicalJson: ${type} at ${path} cannot be part of an identity`);
}

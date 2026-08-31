/**
 * THE PROFILE PANEL AS IT SHIPPED, reduced to its markup.
 *
 * A SECOND ONE, AND THE REASON IS THE CONTROL'S THRESHOLD RATHER THAN ITS SUBJECT. The gate is a
 * RATCHET at one, because the tree holds one occurrence that is not a defect -- so a fixture with a
 * single repeating list would sit exactly at the ceiling and the control would pass, which is a
 * control that proves the predicate can count to one. Two puts the fixture over the same bar the
 * gate uses, so the control runs the gate's predicate against the gate's own threshold.
 */
export function AnotherRepeatingList({ findings }: { findings: { key: string; label: string }[] }) {
  return (
    <ul>
      {findings.map((finding) => (
        <li key={finding.key}>
          <span>{finding.label}</span>
          <span>שאר הרמות של המשתנה הזה נראות טוב יותר כתוצאה מזה, וזו אותה מדידה מהצד השני</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * THE POST-GAME DISCLOSURE AS IT SHIPPED, reduced to its markup.
 *
 * Not a contrived screen: this is the shape a person found on a screenshot -- one sentence about
 * the protocol repeated once per row, with a per-row datum beside it doing all the distinguishing.
 * The gate's own predicate is run over it, so a control with a weaker predicate proves nothing.
 */
export function ARepeatingList({ rules }: { rules: { id: string; trigger: string }[] }) {
  return (
    <ul>
      {rules.map((rule) => (
        <li key={rule.id}>
          <p>{rule.trigger}</p>
          <small>הכלל עצמו מוסתר — הבדיקה היא על שליפה מהזיכרון</small>
        </li>
      ))}
    </ul>
  );
}

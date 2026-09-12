/**
 * THE POSITIVE CONTROL: a third surface inventing the stronger verb for the fourth time.
 *
 * Written the way the two shipped versions were written -- a hand-rolled singular branch, a count
 * the file received as a prop, and a sentence that sounds like an acknowledgement. Nothing about
 * it looks like a claim, which is exactly why the same defect reached production twice.
 */
export function ElsewhereStrip({ readElsewhere }: { readElsewhere: number }) {
  const elsewhere =
    readElsewhere === 1
      ? "החלטה אחת נמדדה ונקראת בחלק אחר של ההיסטוריה."
      : `${readElsewhere} החלטות נמדדו ונקראות בחלק אחר של ההיסטוריה.`;
  return <p className="elsewhere-strip">{elsewhere}</p>;
}

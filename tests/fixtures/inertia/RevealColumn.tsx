/**
 * CONTROL for GATE-TOOLBOX-OUTSIDE-FOCUS. Not shipped, not imported by anything.
 *
 * The reveal column as it was before P1.7: the toolbox rendered unconditionally, statically
 * imported, with no control between the player and every reading the product holds.
 */
import { RecordExplorer } from "@/components/RecordExplorer";

export function RevealColumn(props: Parameters<typeof RecordExplorer>[0]) {
  return (
    <aside>
      <RecordExplorer {...props} />
    </aside>
  );
}

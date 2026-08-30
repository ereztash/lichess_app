/**
 * The board exactly as it shipped at `71c848a`, reduced to the property that was wrong.
 *
 * `role="grid"` with `role="row"` and `role="gridcell"` beneath it, sixty-four buttons, and not one
 * key handled. This is the state `GATE-KEYBOARD` exists to refuse, kept as a fixture so the gate's
 * control is the real defect rather than an invention that resembles it.
 */
export function GridWithNoKeys() {
  return (
    <div className="board-grid" role="grid" aria-label="לוח שחמט">
      <div className="board-row" role="row">
        <button role="gridcell" aria-label="a1" onClick={() => undefined}>
          a1
        </button>
      </div>
    </div>
  );
}

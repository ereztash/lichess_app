/**
 * `Overlay` as it shipped: a modal that says the rest of the document is not there, and lets Tab
 * walk into it anyway.
 */
export function ModalWithNoTrap({ label }: { label: string }) {
  return (
    <div className="panel-backdrop">
      <div className="panel-shell" role="dialog" aria-modal="true" aria-label={label}>
        <button>סגור</button>
      </div>
    </div>
  );
}

// @vitest-environment jsdom
/**
 * The reading survives the overlay, and the one kind of reading that must not.
 *
 * A scan costs 971 positions and 43 seconds on the one machine it was measured on, and until now
 * its result lived in a `useState` inside the import overlay: closing it discarded the whole
 * thing and the only way back was to pay again. That is the defect these tests hold shut.
 *
 * The second half is the harder one. Keeping a reading is only honest if what comes back can be
 * told apart from what a fresh scan would produce -- so a reading carries the scan date it was
 * taken on (4.4), and a scan the player STOPPED is shown but never kept (R2), because reopened
 * next week it would be indistinguishable from a complete reading of the same games.
 */
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ImportDiagnosticPanel } from "@/components/ImportDiagnostic";
import { LocalRecordStore } from "@/lib/local-record-store";
import * as service from "@shared/record-service";
import type { ImportDiagnostic, StoredImportDiagnostic } from "@shared/import-diagnostic";

const DIAGNOSTIC = {
  buckets: [
    { key: "fast", scope: "החלטות תחת פחות מ-45 שניות", n: 548, accurateRate: 0.57, measurable: true, unmeasurableReason: null },
  ],
  scored: 554,
  forced: 3,
  missingClockData: false,
  timeBucketSpeed: "blitz",
  excludedForSpeed: 0,
  speedMix: [{ speed: "blitz", n: 554 }],
} as unknown as ImportDiagnostic;

const reading = (over: Partial<StoredImportDiagnostic> = {}): StoredImportDiagnostic => ({
  diagnostic: DIAGNOSTIC,
  username: "erez281",
  games: 20,
  scanned_at: "2026-08-24T16:00:00.000Z",
  ...over,
});

beforeEach(() => localStorage.clear());

describe("a finished reading outlives the overlay that produced it", () => {
  it("comes back after the store is reconstructed, which is what closing the tab does", async () => {
    /*
     * The whole point. `new LocalRecordStore()` a second time is the closest this test can get to
     * "the player closed the overlay, and then the tab"; if the reading were still in a component's
     * state it would be gone here.
     */
    await new LocalRecordStore().saveImportDiagnostic(reading());
    const back = await new LocalRecordStore().getImportDiagnostic();
    expect(back, "the reading did not survive a fresh store").not.toBeNull();
    expect(back!.diagnostic.scored).toBe(554);
    expect(back!.username).toBe("erez281");
    expect(back!.games).toBe(20);
  });

  it("returns null before any scan, rather than an empty reading", async () => {
    // Section 4.5: "no scan has ever run" and "a scan that found nothing" are different states,
    // and the rail decides whether to offer an entry at all from this.
    expect(await new LocalRecordStore().getImportDiagnostic()).toBeNull();
  });

  it("keeps the newest of several, and does not lose the older ones", async () => {
    // Append-only, same rule as the pre-registered hypothesis: which rates were on screen when a
    // hypothesis was registered has to stay recoverable after the next scan.
    const store = new LocalRecordStore();
    await store.saveImportDiagnostic(reading({ games: 20, scanned_at: "2026-08-01T00:00:00.000Z" }));
    await store.saveImportDiagnostic(reading({ games: 60, scanned_at: "2026-08-24T00:00:00.000Z" }));
    expect((await store.getImportDiagnostic())!.games).toBe(60);
    const raw = JSON.parse(localStorage.getItem("decision-lab.record.v1") ?? "{}");
    expect(raw.importReadings, "the older reading was overwritten rather than appended").toHaveLength(2);
  });

  it("reads a record written before this field existed", async () => {
    /*
     * Erez already has a record in localStorage, written by a build with no `importReadings` key.
     * `read()` spreads over `empty()` so the field defaults, but that is a property of one line
     * that a refactor could drop -- and the failure would be a crash on someone's existing record,
     * which is the worst place to find out.
     */
    localStorage.setItem("decision-lab.record.v1", JSON.stringify({ decisions: [], preregs: [] }));
    const store = new LocalRecordStore();
    expect(await store.getImportDiagnostic()).toBeNull();
    await store.saveImportDiagnostic(reading());
    expect((await store.getImportDiagnostic())!.username).toBe("erez281");
  });
});

describe("the scan date belongs to the service, not the caller", () => {
  it("stamps scanned_at itself", async () => {
    /*
     * Same rule as `decisions_before` on a hypothesis, for the same reason. The scan date is what
     * separates "your accuracy is 57%" from "57% across 20 games read on 24 August" -- a caller
     * that could choose it could keep a months-old reading looking like this morning's.
     */
    const store = new LocalRecordStore();
    const at = new Date("2026-08-24T16:30:00.000Z");
    const out = await service.saveImportReading(
      store,
      { diagnostic: DIAGNOSTIC, username: "erez281", games: 20 },
      () => at,
    );
    expect(out.scanned_at).toBe(at.toISOString());
    expect((await store.getImportDiagnostic())!.scanned_at).toBe(at.toISOString());
  });

  it("discards a scanned_at the caller tried to supply", async () => {
    const store = new LocalRecordStore();
    const at = new Date("2026-08-24T16:30:00.000Z");
    const out = await service.saveImportReading(
      store,
      // A caller reaching past the type to backdate the reading.
      { diagnostic: DIAGNOSTIC, username: "erez281", games: 20, scanned_at: "1999-01-01T00:00:00.000Z" } as never,
      () => at,
    );
    expect(out.scanned_at, "the caller's scan date was kept").toBe(at.toISOString());
  });
});

describe("a reading reopened later carries where it came from", () => {
  it("names the account, the game count and the date", async () => {
    // 4.4: a rate with no source is a claim about a person. At the moment of the scan the origin
    // is on screen; a week later it is only here.
    render(
      <ImportDiagnosticPanel
        diagnostic={DIAGNOSTIC}
        provenance={{ username: "erez281", games: 20, scannedAt: "2026-08-24T16:00:00.000Z" }}
      />,
    );
    const line = document.querySelector(".import-provenance")!;
    expect(line, "a stored reading rendered with no provenance").not.toBeNull();
    expect(line.textContent).toMatch(/erez281/);
    expect(line.textContent).toMatch(/20/);
    expect(line.querySelector("time")?.getAttribute("dateTime")).toBe("2026-08-24T16:00:00.000Z");
  });

  it("shows no provenance line at the moment of the scan, where it would only restate the screen", () => {
    render(<ImportDiagnosticPanel diagnostic={DIAGNOSTIC} />);
    expect(document.querySelector(".import-provenance")).toBeNull();
  });
});

describe("a scan the player stopped is shown and NOT kept", () => {
  it("says so on the screen, not only by being absent from the rail", () => {
    /*
     * R2. A partial reading is honest right now -- the stop just happened and the reader knows why
     * the numbers are thin -- and dishonest tomorrow, because nothing in the object would mark it
     * as a sample of whatever the scan reached before the click. A reader who is not told will
     * assume it will be there later.
     */
    render(<ImportDiagnosticPanel diagnostic={DIAGNOSTIC} kept={false} />);
    const note = document.querySelector(".import-not-kept")!;
    expect(note, "a partial reading claims nothing about its own durability").not.toBeNull();
    expect(note.textContent).toMatch(/נעצרה/);
    expect(note.textContent).toMatch(/לא נשמרת/);
  });

  it("says nothing of the kind about a reading that was kept", () => {
    // Section 4.5 again: "kept" and "not kept" are different states and must not render alike.
    render(<ImportDiagnosticPanel diagnostic={DIAGNOSTIC} kept />);
    expect(document.querySelector(".import-not-kept")).toBeNull();
  });
});

describe("the import screen keeps a reading only through the slot it was given", () => {
  it("does not reach the record itself, so it still mounts with no providers", async () => {
    /*
     * This is a regression test with a scar. The first version of this work called
     * `useSaveImportReading()` inside `ImportGames`, and `import-cost.test.tsx` -- which mounts
     * that component with NO providers, deliberately -- went red on six assertions about text
     * that has nothing to do with storage. The dependency is injected for the same reason
     * `analyze` is, and for the same reason the panel takes `bridge` as a slot.
     */
    const source = await import("node:fs/promises").then((fs) =>
      fs.readFile("client/src/components/ImportGames.tsx", "utf8"),
    );
    expect(
      source,
      "ImportGames reaches the record directly again; every test of this screen now needs a provider",
    ).not.toMatch(/useSaveImportReading|useRecordMode|useStore\(/);
    expect(source, "the injected slot is gone").toMatch(/keepReading/);
  });
});

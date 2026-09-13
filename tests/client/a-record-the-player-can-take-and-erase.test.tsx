// @vitest-environment jsdom
/**
 * "The record stays in your browser" now has a door in it: the person can take the record out as
 * the stored JSON, and can erase it. And every key this application writes is on one list.
 *
 * WHY THE LIST IS A TEST. Nine keys across eight modules and no inventory meant the retention
 * document could only be written by reading the source, and would rot the first time a module
 * added a key. `client/src/lib/storage-keys.ts` is the inventory; this walks `client/src` for any
 * `decision-lab` literal outside it, so a tenth key has to be registered to compile past this file.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { SelfCheck } from "../../client/src/components/SelfCheck";
import {
  LocalRecordStore,
  deleteLocalRecord,
  exportLocalRecord,
  importLocalRecord,
  localRecordHealth,
  LOCAL_RECORD_VERSION,
  resetSessionFallbackForTests,
  setLocalRecordIdentity,
} from "../../client/src/lib/local-record-store";
import { STORAGE_KEYS, STORAGE_KEY_NOTES, registeredKeys } from "../../client/src/lib/storage-keys";
import { CONFIDENCE_LEVELS } from "../../shared/confidence";

function* walk(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* walk(path);
    else if (/\.(ts|tsx)$/.test(name)) yield path;
  }
}

describe("every key this browser is asked to hold is registered", () => {
  it("has no `decision-lab` storage literal outside the registry", () => {
    const offenders: string[] = [];
    for (const file of walk("client/src")) {
      if (file.endsWith("storage-keys.ts")) continue;
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/["'`](decision-lab[^"'`]*)["'`]/g)) {
        /* Not storage keys: the lock name derives from one, and a download's file name is a file name. */
        if (m[1].endsWith(".write") || m[1].endsWith(".json")) continue;
        offenders.push(`${file}: ${m[1]}`);
      }
      /* And any storage call handed a literal of any name, `theme` included. */
      for (const m of text.matchAll(/(?:localStorage|sessionStorage)\.(?:setItem|getItem|removeItem)\(\s*["'`]([^"'`]+)["'`]/g)) {
        offenders.push(`${file}: literal key ${m[1]}`);
      }
    }
    expect(offenders, "register these in client/src/lib/storage-keys.ts").toEqual([]);
  });

  it("registers a distinct key for every entry, and says which area and what it holds", () => {
    const keys = registeredKeys();
    expect(new Set(keys).size).toBe(keys.length);
    for (const [name, entry] of Object.entries(STORAGE_KEYS)) {
      expect(STORAGE_KEY_NOTES[name as keyof typeof STORAGE_KEYS].length, name).toBeGreaterThan(10);
      expect(["localStorage", "sessionStorage"]).toContain(entry.area);
    }
  });

  it("does not put a tRPC query's input into the URL, where the platform's request log would keep it", () => {
    const main = readFileSync("client/src/main.tsx", "utf8");
    expect(main, "httpBatchLink must carry methodOverride: \"POST\"").toMatch(/methodOverride:\s*"POST"/);
  });
});

const decision = {
  decisionId: "d-erase-1",
  gameId: "g-1",
  fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
  ply: 1,
  phase: "opening" as const,
  clockMsRemaining: null,
  purpose: "play" as const,
  drillId: null,
  transferId: null,
  secondsTaken: 12,
  chosenMove: "e2e4",
  candidateMovesConsidered: ["e2e4"],
  statedRead: "המרכז שלי",
  statedUnknown: "לא יודע",
  confidence: 3,
  confidenceScale: CONFIDENCE_LEVELS,
  probeAssignment: "not-probed" as const,
  legalMoves: 20,
  revealTiming: "per-decision" as const,
  measurementProtocol: null,
  protocolVersion: null,
  analysisTiming: null,
  quietWindowExposure: null,
};

describe("the record can be taken out and erased", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setLocalRecordIdentity(null);
    resetSessionFallbackForTests();
  });
  afterEach(cleanup);

  it("exports exactly the stored JSON, under the key it was stored at", async () => {
    await new LocalRecordStore().commitDecision(decision);
    const exported = exportLocalRecord();
    expect(exported?.key).toBe(STORAGE_KEYS.record.key);
    expect(exported?.json).toBe(localStorage.getItem(STORAGE_KEYS.record.key));
    expect(exported?.json).toContain("d-erase-1");
    expect(exported?.json).toContain("המרכז שלי");
  });

  it("erases the record and nothing else, and the health then says absent", async () => {
    await new LocalRecordStore().commitDecision(decision);
    localStorage.setItem(STORAGE_KEYS.theme.key, "dark");
    localStorage.setItem(STORAGE_KEYS.progress.key, "{}");
    setLocalRecordIdentity("someone-else");
    await new LocalRecordStore().commitDecision({ ...decision, decisionId: "theirs" });
    setLocalRecordIdentity(null);

    await deleteLocalRecord();

    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toBeNull();
    expect(localRecordHealth()).toEqual({ kind: "absent" });
    expect(await new LocalRecordStore().countDecisions()).toBe(0);
    expect(localStorage.getItem(STORAGE_KEYS.theme.key)).toBe("dark");
    expect(localStorage.getItem(STORAGE_KEYS.progress.key)).toBe("{}");
    expect(localStorage.getItem(`${STORAGE_KEYS.record.key}:someone-else`), "another account's record went with it").toContain("theirs");
  });

  it("cannot be resurrected by a write that was already in flight when the erase ran", async () => {
    const store = new LocalRecordStore();
    await store.commitDecision(decision);
    /* Both queue on the same lock, in order: the write lands, then the erase removes it. */
    const write = store.commitDecision({ ...decision, decisionId: "late" });
    const erase = deleteLocalRecord();
    await Promise.all([write, erase]);
    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toBeNull();
    expect(await store.countDecisions()).toBe(0);
  });

  it("offers both from the self-check drawer: a download of the stored JSON, and a two-press erase", async () => {
    await new LocalRecordStore().commitDecision(decision);
    render(<SelfCheck onClose={() => {}} />);

    const download = screen.getByRole("link", { name: "הורידו את ההיסטוריה" });
    expect(download).toHaveAttribute("download", "decision-lab-record.json");
    /* The file is built on the press (jsdom has no createObjectURL, so the data: fallback is taken). */
    download.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(download);
    expect(decodeURIComponent(download.getAttribute("href") ?? "")).toContain("d-erase-1");

    const erase = screen.getByRole("button", { name: "מחקו את ההיסטוריה מהדפדפן הזה" });
    fireEvent.click(erase);
    /* One press arms; the record is still there. */
    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toContain("d-erase-1");
    fireEvent.click(screen.getByRole("button", { name: /לחצו שוב כדי למחוק/ }));
    await waitFor(() => expect(screen.getByRole("status")).toHaveTextContent("ההיסטוריה נמחקה מהדפדפן הזה"));
    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toBeNull();
  });

  it("says so when there is nothing to erase, rather than reporting an erase that erased nothing", () => {
    render(<SelfCheck onClose={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "מחקו את ההיסטוריה מהדפדפן הזה" }));
    expect(screen.getByRole("status")).toHaveTextContent("אין היסטוריה בדפדפן הזה");
  });
});

/*
 * THE DOWNLOAD USED TO BE AN ENDING. `exportLocalRecord` has shipped since the retention work and
 * nothing in the product could read what it produced, so "הורידו את ההיסטוריה" handed the player a
 * file with nowhere to go -- while the same drawer told them a private window would erase
 * everything on refresh and the board told them the loop "לא תעבור בין מכשירים".
 */
describe("a downloaded record can come back", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setLocalRecordIdentity(null);
    resetSessionFallbackForTests();
  });
  afterEach(cleanup);

  /** Write a decision, take the file, and leave the browser as empty as a new one. */
  async function takeTheFile(): Promise<string> {
    await new LocalRecordStore().commitDecision(decision);
    const exported = exportLocalRecord();
    await deleteLocalRecord();
    return exported!.json;
  }

  it("puts back exactly what was taken, into a browser that has none", async () => {
    const json = await takeTheFile();
    expect(await new LocalRecordStore().countDecisions()).toBe(0);

    expect(await importLocalRecord(json)).toEqual({ kind: "imported", decisions: 1 });

    expect(await new LocalRecordStore().countDecisions()).toBe(1);
    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toContain("d-erase-1");
    expect(localStorage.getItem(STORAGE_KEYS.record.key), "the read the player wrote").toContain(
      "המרכז שלי",
    );
    expect(localRecordHealth()).toMatchObject({ kind: "loaded", version: LOCAL_RECORD_VERSION });
  });

  it("refuses a browser that already holds a record, rather than merging or overwriting", async () => {
    /*
     * THE REFUSAL IS THE DESIGN. Two append-only records of the same player, each with its own
     * decision ids and drill membership, cannot be joined without deciding what a collision means
     * -- and there is no second stream in this product to justify asking. What must never happen
     * is the quiet version: a player who presses this with decisions here losing them.
     */
    const json = await takeTheFile();
    await new LocalRecordStore().commitDecision({ ...decision, decisionId: "already-here" });

    expect(await importLocalRecord(json)).toEqual({
      kind: "refused",
      because: "already-holds-a-record",
    });
    expect(localStorage.getItem(STORAGE_KEYS.record.key)).toContain("already-here");
    expect(localStorage.getItem(STORAGE_KEYS.record.key), "the file went in anyway").not.toContain(
      "d-erase-1",
    );
    expect(await new LocalRecordStore().countDecisions()).toBe(1);
  });

  it("refuses the same files the record's own reader refuses, and names which", async () => {
    expect(await importLocalRecord("{oops")).toEqual({ kind: "refused", because: "not-json" });
    expect(await importLocalRecord("[]")).toEqual({ kind: "refused", because: "not-an-object" });
    expect(await importLocalRecord(JSON.stringify({ version: "1" }))).toEqual({
      kind: "refused",
      because: "not-an-object",
    });
    /* A save from a build that knows more than this one: refused there, refused here. */
    expect(
      await importLocalRecord(JSON.stringify({ version: LOCAL_RECORD_VERSION + 1, decisions: [] })),
    ).toEqual({ kind: "refused", because: "written-by-a-newer-build" });
    expect(localStorage.getItem(STORAGE_KEYS.record.key), "a refused file still wrote").toBeNull();
  });

  it("takes a version 0 file, which is every save written before the stamp existed", async () => {
    /*
     * `read()` upgrades an unstamped blob by reading it key by key, and the import goes through
     * the same `interpret`. A player's oldest download is the one most likely to be the only copy
     * left, so this is the case that would hurt most to refuse.
     */
    const legacy = JSON.stringify({ decisions: [{ decision_id: "old-1" }], reveals: {} });
    expect(await importLocalRecord(legacy)).toEqual({ kind: "imported", decisions: 1 });
    expect(localStorage.getItem(STORAGE_KEYS.record.key), "restamped as this build's shape").toContain(
      `"version":${LOCAL_RECORD_VERSION}`,
    );
  });

  it("offers it from the drawer, beside the download that produces the file", async () => {
    const json = await takeTheFile();
    render(<SelfCheck onClose={() => {}} />);
    const take = screen.getByLabelText("העלו היסטוריה מקובץ");
    fireEvent.change(take, { target: { files: [new File([json], "record.json", { type: "application/json" })] } });
    await waitFor(() =>
      expect(screen.getByText(/ההיסטוריה נטענה/), "the drawer said nothing about the file").toBeTruthy(),
    );
    expect(await new LocalRecordStore().countDecisions()).toBe(1);
  });

  it("tells the player why a file was not taken, in the words of the cause", async () => {
    await new LocalRecordStore().commitDecision(decision);
    render(<SelfCheck onClose={() => {}} />);
    fireEvent.change(screen.getByLabelText("העלו היסטוריה מקובץ"), {
      target: { files: [new File(["{}"], "record.json", { type: "application/json" })] },
    });
    // Not "something went wrong": the reason decides what the player does next, and here it is
    // "erase first", which is a different act from "find another file".
    await waitFor(() => expect(screen.getByText(/כבר יש היסטוריה/)).toBeTruthy());
  });
});

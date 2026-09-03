/**
 * The entry graph, against a written-down ceiling.
 *
 * WHY A BUDGET AND NOT A WARNING. Vite already prints "some chunks are larger than 500 kB" on
 * every build, and it has printed it on every build for a long time, which is what a warning
 * nobody can fail becomes. A budget is the same measurement with a consequence: growth past the
 * line is a decision somebody makes on purpose, in a diff, rather than a drift nobody notices.
 *
 * WHAT IT PROTECTS. The engine is 7.3 MB of WebAssembly. `GATE-COMMIT` already proves the engine
 * module is absent from the initial graph -- R3 requires it, because the machine must not be able
 * to answer before the player's decision is recorded. This checks the other half: that the graph
 * R3 keeps small STAYS small, and that the engine and the chart library are still reached by a
 * dynamic import rather than pulled back into the entry by an innocuous-looking static one.
 *
 * THE NUMBERS ARE A RATCHET, NOT A TARGET. They sit just above what the build currently produces.
 * That is deliberate: a budget with generous headroom is a budget that never fires, and the point
 * is to make the next 100 kB visible on the day it arrives rather than a year later.
 *
 * Run: npx tsx scripts/check_bundle_budget.ts   (after `npm run build`)
 */
import { gzipSync } from "node:zlib";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

/**
 * The build to measure. `dist/public` in every ordinary run.
 *
 * `BUNDLE_ROOT` EXISTS FOR THE POSITIVE CONTROL AND FOR NOTHING ELSE. This was the one enforced,
 * blocking check in the repository with no way to demonstrate its own failure -- `G-02` in
 * `LOCAL_SOLUTION_GAPS.md`, and the study's note on it says a fixture with a deliberately oversized
 * entry graph is buildable. It is: `tests/fixtures/bundle`, and `npm run bundle:budget:control`
 * runs THIS FILE over it and requires a non-zero exit. Same predicate, different input, which is
 * what every other gate here already gets.
 */
const ROOT = process.env.BUNDLE_ROOT ?? "dist/public";
const ASSETS = `${ROOT}/assets`;
const INDEX = `${ROOT}/index.html`;

/**
 * Raw bytes of the entry chunk. What the browser must download and parse before anything runs.
 *
 * RAISED FROM 640 TO 648 FOR `shared/evidence-policy.ts`, and the ratchet firing is the mechanism
 * working rather than an obstacle to route around. What this budget protects is stated above: that
 * the engine and the chart library stay behind a dynamic import. Neither moved. What crossed the
 * line is ~4 kB of the evidence policy -- the table deciding which observations each analysis may
 * read -- and it has to be in the entry graph because the browser-record deployment runs the same
 * `commitDecision` and `currentClaim` the server does. A policy that shipped only to the server
 * would leave the local record with no filter at all, which is the hole it was written to close.
 *
 * MEASURED, NOT ESTIMATED. 639.4 kB before, 643.0 kB after, of which 0.9 kB was recovered by
 * deduplicating reasons that were repeated verbatim across cells. The remaining weight is the
 * table's structure, and trimming that further would mean deleting cells rather than bytes.
 *
 * STILL JUST ABOVE THE BUILD, which is the property that makes this a ratchet: 648 leaves 5 kB, so
 * the next hundred is visible on the day it arrives.
 *
 *
 * RAISED AGAIN, 652 -> 656 / 202 -> 204 / 724 -> 728, FOR THE DENOMINATOR LEDGER AND THE BOOK.
 * The property this budget protects is unchanged and was checked rather than assumed: the engine
 * is still reached by a dynamic import, the chart library is still its own chunk, and the opening
 * book's 833 keys -- 9.0 kB, the largest single thing this change adds -- are in a chunk of their
 * own (`opening-book-keys-*.js`) fetched when a player asks for a scan, exactly as the wasm is.
 *
 * MEASURED, NOT ESTIMATED. Entry raw 649.6 kB before, 651.9 kB after; gzipped 201.3 kB before,
 * 202.0 kB after. The 2.3 kB is the import panel's exclusion ledger -- the arithmetic that says
 * what the accuracy rate's denominator actually is -- plus the sentence that says what is still
 * counted, and the book plumbing in `import-diagnostic.ts`. Those bytes are the correction to a
 * number the ledger in docs/MEASUREMENTS.md called a known defect on screen, so trimming them
 * further would mean deleting the disclosure rather than deleting bytes.
 * RAISED AGAIN, 648 -> 652, FOR THE ACQUISITION EVIDENCE LEDGER, and all three ceilings moved this
 * time because all three were crossed. Measured: 645.0 kB before, 650.8 kB after, 649.2 kB once
 * the value-reconstruction prompt was moved behind a dynamic import -- it renders on the second
 * reveal of a browser's whole history and never again, so in almost every visit it was code
 * downloaded and not run.
 *
 * WHAT IS LEFT CANNOT BE DEFERRED, and that is the argument for the raise rather than for another
 * split. The remaining ~4 kB is the event vocabulary and the emitters, and the funnel's first
 * stage is `acquisition_entry` -- written on mount, before anything else, as the denominator every
 * later rate is computed against. Instrumentation that arrives after the first paint has already
 * missed the arrivals that leave before it.
 *
 * WHAT WAS CONSIDERED AND REFUSED. `SelfCheck` is statically imported and carries the report
 * generator with it; making it lazy would recover more than this costs. It stays eager on purpose:
 * it is the diagnostic for a browser where something is broken, and a diagnostic that has to fetch
 * a chunk before it can tell you the network is failing is not one.
 *
 * The gzip ceiling went 200 -> 202 (201.2 measured) and the initial-download ceiling 720 -> 724
 * (720.6 measured), for the same code and the same reason.
 *
 * RAISED A THIRD TIME, 652 -> 653, FOR THE VALUE-CLARITY SENTENCES. Measured 652.2 kB, so this is
 * the smallest raise that clears it and the ratchet keeps its property of sitting just above the
 * build. All three ceilings moved again because all three were crossed by the same 0.2 kB.
 *
 * IT IS TEXT AND IT CANNOT BE DEFERRED, which is the whole argument. The added weight is
 * `shared/promise.ts`, one evidence label per reveal branch, the continuation proposition and the
 * commitment screen's reason -- every one of them a sentence that has to be on screen at the
 * moment the player is deciding whether this product is worth their attention. A lazy chunk that
 * arrives after the first paint would be the front door's promise showing up late, which is the
 * one place in this app where late is the same as absent.
 *
 * WHAT WAS CONSIDERED. `shared/promise.ts` is imported by `Record.tsx`, which is the entry route:
 * there is nothing to split it away from. The evidence labels ride in `shared/reveal.ts`, already
 * in the entry chunk for the reveal path.
 *
 *
 * RAISED A FOURTH TIME, 656 -> 661 AND 728 -> 734, BY A MERGE RATHER THAN BY A COMMIT. Two
 * branches were in flight at once and each raised this ceiling for its own reason: the denominator
 * ledger and the opening book took it to 656, the value-clarity sentences to 653. Neither was over
 * its own ceiling. Their sum is, because the bytes are disjoint -- ledger arithmetic and promise
 * copy have nothing to share -- and 653 + 656 is not how two ratchets compose.
 *
 * MEASURED ON THE MERGED TREE, not inferred from the two numbers: entry raw 657.2 kB, initial
 * download 729.9 kB. The ceilings sit ~4 kB above, which is the headroom every previous raise in
 * this file used.
 *
 * THE GZIP CEILING DID NOT MOVE. It measures 203.6 kB against 204 and is the one that did not
 * fire, so it keeps its number and 0.4 kB of headroom. Raising a ceiling that has not been crossed
 * is loosening a budget for free, which is the drift this file exists to catch.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The property the budget protects is unchanged across the
 * merge: the 7.1 MB of WebAssembly is still held out of the entry, and the chart library, the
 * opening book's keys, the game review and the value-reconstruction prompt are each still in a
 * chunk of their own.
 *
 *
 * THE GZIP CEILING, 204 -> 206, FOR A BOARD A SCREEN READER CAN READ. It was left at 204 with
 * 0.4 kB of headroom one commit ago, on the stated ground that raising a ceiling that had not
 * fired is loosening a budget for free. It has now fired, on the next change, which is the
 * ratchet behaving exactly as designed rather than a ceiling set too tight.
 *
 * MEASURED: entry raw 657.2 -> 659.0 kB, gzipped 203.6 -> 204.3, initial download 729.9 -> 731.7.
 * The raw ceilings were NOT crossed and do not move; 206 leaves 1.7 kB, the same headroom the
 * 202 -> 204 raise took.
 *
 * WHAT THE 0.7 kB BUYS. Every gridcell used to carry `aria-label={square}`, and an `aria-label`
 * beats the element's contents in the accessible-name computation -- so a screen reader announced
 * "e4" and never "e4, white knight", on all sixty-four squares. The added weight is the piece
 * vocabulary, an arrow-key handler for the `role="grid"` this board had already declared, and one
 * `aria-live` region.
 *
 * IT CANNOT BE DEFERRED, which is the argument for the raise rather than for another split. The
 * board is on the entry route and the accessible name is computed at render: a name that arrives
 * after the first paint is a name a reader has already read past. Same shape as the promise copy
 * two raises above -- the bytes are on screen at the moment they matter or they are useless.
 *
 *
 * THE RAW CEILINGS, 661 -> 662 AND 734 -> 735, FOR THE BLITZ MEASUREMENT RECORD. Four commits of
 * the blitz integration crossed them by 0.3 kB and 0.1 kB, and the growth was ATTRIBUTED PER
 * COMMIT rather than accepted as a lump, by building each one and measuring the entry chunk:
 *
 *     before any of it   675,455 B
 *     time control       675,836 B   +381   a nullable base/increment pair, and the two adapters
 *                                           that finally read what both sites were already sending
 *     both clocks        676,019 B   +183   one derivation, and the time control on each decision
 *     protocol           676,585 B   +566   three schema fields and two enums, which zod needs as
 *                                           runtime arrays to validate against
 *     strata             677,206 B   +621   grouping the discovery population so two regimes
 *                                           cannot pool
 *     feature layer      677,206 B     +0
 *
 * THE LAST ROW IS THE INTERESTING ONE. `shared/blitz-features.ts` is nine features and about two
 * hundred lines, and it costs the entry chunk NOTHING, because nothing imports it yet and it
 * shakes out whole. It is the check that the other four numbers are the real cost of shipped
 * behaviour rather than of code that merely exists: if dead modules were riding along, that row
 * would not be zero.
 *
 * WHY IT CANNOT BE DEFERRED. It is not a screen and it is not copy -- it is the SHAPE OF EVERY
 * DECISION THE PRODUCT WRITES. `decisionAtomSchema` validates at commit, on the entry route, and a
 * validator that arrives after the first decision would let through exactly the rows it exists to
 * refuse. The enum arrays are the same fact: zod checks a value against them at runtime, so they
 * are data the entry chunk has to hold, not code a later chunk could bring.
 *
 * THE GZIP CEILING DID NOT MOVE. It measures 205.1 kB against 206 and did not fire, so it keeps
 * its number and 0.9 kB of headroom -- the rule two raises above, applied to my own change:
 * raising a ceiling that has not been crossed is loosening a budget for free. Gzipped is also
 * what a person on a slow link actually waits for, and this whole 1.75 kB of source compresses
 * into well under a kilobyte of it.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The property the budget protects is unchanged: the 7.1 MB
 * of WebAssembly is still held out of the entry, and no new chunk was created or merged away.
 *
 * ---
 *
 * 662 -> 663, and 735 -> 736 below: ADR-003, a grade naming the protocol that produced it.
 *
 * SPLIT BY MEASUREMENT RATHER THAN BY GUESS, by building twice -- once with the card's change and
 * once with the card reverted and nothing else:
 *
 *     entry raw, before the change        661.6 kB
 *     entry raw, card reverted            662.1 kB     +0.5
 *     entry raw, card included            662.8 kB     +0.7
 *
 * THE FIRST 0.5 kB IS NOT THE SCREEN. `shared/claim.ts` gained `gradeIsSettled`, `awaitingProtocol`
 * and `testedUnder` plus two branches in the grading fold, and it now imports
 * `claim-grade-protocol.ts` -- and the client already imports `claim.ts`, so that arrives whether
 * or not anything renders it. It cannot be deferred for the same reason `decisionAtomSchema`
 * cannot: it is the rule that decides whether a verdict is settled, and a rule that arrives after
 * the claim it governs has already been shown is a rule that did not run.
 *
 * THE OTHER 0.7 kB IS THE SCREEN, and it is the part a player sees: the protocol words and the
 * sentence that names which test would close the question. `PROTOCOL_WORD` and `validation-protocol`
 * reach the entry chunk here for the first time -- until this change PR-13's module was pure and
 * unreferenced, and shook out whole.
 *
 * THE GZIP CEILING DID NOT MOVE, again. 205.6 kB against 206, so it did not fire and it keeps its
 * number: raising a ceiling that has not been crossed is loosening a budget for free.
 *
 * ---
 *
 * 663 -> 664: PR-11, the blitz route keeping what it measured.
 *
 *     entry raw, after ADR-003     662.8 kB
 *     entry raw, with the store    663.2 kB     +0.4
 *
 * ALL OF IT IS `LocalRecordStore`. `shared/blitz-record.ts` is types and one pure function, and the
 * function has no caller in the entry path yet -- what arrives is the client store's three new
 * methods and its two new state keys. It cannot be deferred because the store is constructed on the
 * entry route: a record store that arrives late is a record store that was not there when the first
 * thing needed writing.
 *
 * THE OTHER TWO CEILINGS DID NOT FIRE. Initial download measured 735.9 kB against 736 and gzip
 * 205.7 against 206, so both keep their numbers -- the same rule as the two raises above, applied
 * when it is inconvenient: 0.1 kB of headroom is still headroom, and widening it "while I am here"
 * is how a budget stops being one.
 *
 * ---
 *
 * 664 -> 670, and this time the GZIP ceiling moves too, which none of the four raises above did.
 *
 * PR-11's wiring: the route now keeps the game it just played. Split by building twice, once with
 * the shared wire schema in `record-service` and once with it only on the tRPC route:
 *
 *                         entry raw    gzipped
 *     before this step      664.0        205.7
 *     wiring, no schema     666.4        206.5     +2.4 / +0.8
 *     wiring, with schema   669.5        207.5     +5.5 / +1.9
 *
 * SO THE SCHEMA IS ABOUT HALF OF IT, AND IT IS KEPT ON PURPOSE. Validating only on the server would
 * have saved 3.1 kB and given the local path a weaker guarantee than the server path -- which is
 * precisely the divergence class this repository keeps paying for: the two stores disagreeing about
 * a null was a real defect twice in one day. One schema, both paths, one guarantee.
 *
 * The remaining 2.4 kB is the hook, the service function, and the save effect with its written
 * refusal notices. None of it defers: a record store and its writer that arrive after the game has
 * ended are a record store that was not there when the thing needed writing.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED: the 7.1 MB of WebAssembly is still held out of the entry,
 * and no chunk was created or merged away.
 *
 * ---
 *
 * 670 -> 674, 208 -> 209, 743 -> 747: R-02, the blitz record written BEFORE the engine runs.
 *
 * All three fired, which is unusual and is the honest reading of a change that touches the record's
 * shape rather than one screen: the previous raise left 0.0 / 0.3 / 0.3 kB of headroom, so anything
 * at all would have crossed them. Split by building four times, adding one layer each time:
 *
 *                                          entry raw   gzipped   initial raw
 *     before this change                     670.0      207.7       742.7
 *     + the record's two-phase shape         671.3      208.0       744.1   +1.3 / +0.3 / +1.4
 *     + the client store and the hook        671.7      208.1       744.4   +0.4 / +0.1 / +0.3
 *     + the screen's two writes              672.3      208.2       745.1   +0.6 / +0.1 / +0.7
 *
 * ROW ONE IS THE WIRE SCHEMA, AND IT CANNOT BE DEFERRED. `BLITZ_ANALYSIS_STATES` is a runtime array
 * -- zod checks values against it, so it is data the chunk has to hold rather than code a later one
 * could bring -- plus two provenance objects and four refinements that say a scored game names what
 * scored it and when, and an unscored one carries no cp-loss. Same argument `decisionAtomSchema`
 * made two raises above: the local record path runs the same validator the server does, and a
 * validator that arrives after the first write is a validator that did not run.
 *
 * ROW TWO IS `LocalRecordStore.attachBlitzAnalysis` and its hook. The store is constructed on the
 * entry route; one that arrives late was not there when the thing needed writing.
 *
 * ROW THREE IS NOT THE SCREEN, AND THAT IS WORTH SAYING BECAUSE IT LOOKS LIKE IT. `/blitz` is a
 * lazy route, and its own additions did land in its own chunk -- checked, not assumed: the refusal
 * copy and `engine-identity` are in `Blitz-*.js` and absent from the entry. What crossed into the
 * entry is `toPendingRecord` and `attachAnalysis` becoming REACHABLE: `shared/blitz-record.ts` is
 * shared between the entry (through `record-service`) and the lazy route, so Rollup keeps the
 * module in the common ancestor and the two new functions ride into the entry with it.
 * `analysisState:"pending"` appears in the entry chunk and in no other. That is the same mechanism
 * `shared/blitz-features.ts` demonstrated from the other side, where an unreferenced module cost
 * zero: what is measured here is the cost of shipped behaviour, not of code that merely exists.
 *
 * WHAT THE 2.3 kB BUYS, and it is the only reason to raise rather than trim: a game used to be
 * analysed and only then written, so a player who closed the tab during the search lost the moves,
 * both clocks and the think times -- which are frozen at commit and reconstructible from nothing.
 * The loss was invisible from the data, because a game never written leaves nothing to count, and
 * it was not random: the games most likely to be dropped are long ones on slow devices.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED. The chunk set is byte-for-byte the same list before and
 * after -- nothing created, nothing merged away -- and the 7.1 MB of WebAssembly is still held out
 * of the entry. `engine-identity.ts` exists to keep it that way: `Blitz.tsx` needs the engine's
 * identity statically, at the moment it writes a record, and importing it from `stockfish.ts`
 * would have pulled the wasm into the module graph to read one string.
 *
 * ---
 *
 * 674 -> 676 and 209 -> 210: R-03's engine build, and R-05's versioned local record.
 *
 * Two changes, measured separately by building after each:
 *
 *                                       entry raw   gzipped   initial raw
 *     before both                         672.3      208.2       745.1
 *     + the engine build on the verdict   673.3      208.6       746.0   +1.0 / +0.4 / +0.9
 *     + the versioned local record        674.2      209.1       746.9   +0.9 / +0.5 / +0.9
 *
 * THE FIRST ROW IS NOT THE FIELD. One optional string on a zod object is nothing; what costs is
 * the wall it lets the product build -- `readableInstrument`, the third component of the stratum
 * key with its encoder, the `withoutInstrument` branch in `scoreDecisions`, and the sentence the
 * ribbon renders when the count is not zero. All of it is on the entry route by construction:
 * `commitDecision` and `currentClaim` run in the browser on the local-record deployment, so a
 * refusal that arrived in a later chunk would let through exactly the rows it exists to refuse.
 *
 * THE SECOND ROW IS THE PARSER. `read()` was a spread and a `catch` that returned an empty record;
 * it is now a version check, fifteen typed container reads and four named failure states. It
 * cannot be deferred because the store is constructed on the entry route -- and more to the point,
 * the thing it prevents happens on the FIRST read of a damaged record, before anything else could
 * have loaded.
 *
 * THE INITIAL-DOWNLOAD CEILING DID NOT MOVE. It measures 746.9 kB against 747 and did not fire, so
 * it keeps its number and 0.1 kB of headroom -- the rule three raises above, applied when it is
 * inconvenient: widening a ceiling that has not been crossed is loosening a budget for free.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED: the chunk set is unchanged again, and the wasm is still
 * held out of the entry.
 *
 * ---
 *
 * 676 -> 678 and 750 -> 754: R-17's confidence columns, then the evidence language and the
 * post-game screen.
 *
 * MEASURED IN THREE LAYERS, by building the client at each:
 *
 *                                       entry raw   initial raw
 *     the client as the previous commit
 *     left it                             676.4        749.1
 *     + the evidence and post-game CSS     676.4        752.0   +0.0 / +2.9
 *     + the PostGame component tree        676.8        752.4   +0.4 / +0.4
 *
 * THE FIRST ROW IS A CONFESSION. 676.4 is the tree WITHOUT any of this commit's client changes,
 * and 676 is the ceiling -- so the previous commit crossed the entry budget and shipped, because
 * `bundle:budget` was not run before committing it. The same process error that produced the CI
 * failure on d312107, where the failing line was below a `sed` window. It is 0.4 kB of
 * `shared/blitz-record.ts`: two zod refines, `blitzConfidenceOf`, and the two legacy constants --
 * all of it on the entry route because `Blitz.tsx` assembles the record it validates.
 *
 * THE CSS IS THE REAL COST AND IT IS THE COST OF §11. Five evidence levels each need a visibly
 * different treatment, or the distinction they exist to make is not made -- a hypothesis rendered
 * with the weight of a tested finding has been promoted by layout. That is 2.9 kB of selectors and
 * the comments that say why each one is there, and it is not compressible into fewer rules without
 * giving two levels the same appearance.
 *
 * THE COMPONENT TREE IS 0.4 kB FOR SIX MODULES, which is the part worth noting because it looks
 * wrong. `blitz-reading`, `blitz-words`, `plain-reading`, `evidence-authority`, `FindingCard` and
 * `EvidenceMark` together add 0.4 kB to the entry, because almost all of what they contain is
 * comment and type -- both of which minify to nothing -- and because they reuse `detector.ts`,
 * `confidence.ts` and `reveal.ts` rather than restating a single threshold.
 *
 * 678 AND 754 LEAVE 1.2 kB AND 1.6 kB. Both are within the headroom every raise in this file has
 * taken, and neither ceiling is widened past what was actually measured.
 *
 * ---
 *
 * 678 -> 686, 210 -> 213 and 754 -> 764: §25's two new sections on the front door.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              677.3      209.9       753.9
 *     + the two sections and their CSS     684.2      211.8       761.8   +6.9 / +1.9 / +7.9
 *
 * WHAT WAS CHECKED FIRST, because the last three raises in this file all turned out to be a module
 * dragging something in rather than the feature's own weight: `record-order.ts` imports
 * `MIN_BUCKET_N` and `MIN_STABILITY_HALF` as VALUES, which looked like it might pull `detector.ts`
 * and `stability.ts` into the entry. Building with both replaced by literals moved the entry by
 * 0.0 kB -- they were already there. This growth is the feature.
 *
 * AND MOST OF IT IS HEBREW. 1.6 kB of it is CSS; the rest is `UNCLEAR_SENTENCE`, seven sentences
 * explaining why seven different things cannot be read, at two bytes a character. That is the
 * section's entire content: the page already knew all seven facts and rendered them as cells
 * reading "not enough data", and what is new is saying which of them a player can do something
 * about.
 *
 * 686, 213 AND 764 LEAVE 1.8 kB, 1.2 kB AND 2.2 kB, the same headroom as every raise above.
 *
 * ---
 *
 * 686 -> 689 and 764 -> 767: LAW 4's analysis queue, run from the root.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              684.7      212.0       762.3
 *     + everything but the root keeper     685.2      212.2       762.8   +0.5 / +0.2 / +0.5
 *     + <BlitzAnalysisKeeper /> in App     687.6      212.8       765.2   +2.4 / +0.6 / +2.4
 *
 * MEASURED BY BUILDING BOTH LAYERS, because 2.4 of the 2.9 kB is one component and it was worth
 * knowing that before raising anything. `BlitzAnalysisKeeper` renders nothing; what it costs is
 * `use-blitz-analysis.ts` and the query wiring for the stored blitz GAMES, now on the entry route.
 *
 * AND IT IS THE FEATURE, not a module dragging something in. A pending analysis is finished by
 * whichever page load finds it, and the screen that starts one is exactly the screen a player
 * leaves -- so the resume has to live somewhere every route already is. What deliberately did NOT
 * come with it: `blitz-analysis-runner.ts`, `blitz-analysis-queue.ts` and the engine are behind a
 * dynamic import that only fires once a game is actually pending, so a record with no blitz games
 * pays for the check and nothing else. The hook asks the cheap question first for the same reason
 * -- the games, not the decisions.
 *
 * THE REMAINING 0.5 kB is `record-api.ts`: `BLITZ_KEYS` and the `invalidateBlitz` helper the two
 * blitz mutations now share, so a write always marks both sides' caches stale.
 *
 * 689 AND 767 LEAVE 1.4 kB AND 1.8 kB. The gzip ceiling did not fire and keeps its number, which
 * is the rule this file has followed every time: a ratchet nobody widened is a ratchet.
 *
 * ---
 *
 * 213 -> 215: LAW 1's decision focus, which cost 0.6 kB gzipped and ZERO raw.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              687.6      212.8       765.2
 *     + the focus branch and the rail      687.6      213.4       765.2   +0.0 / +0.6 / +0.0
 *     + two components out of Home.tsx     687.8      213.4       765.4   +0.2 / +0.0 / +0.2
 *
 * MEASURED THE SAME WAY AS THE RAISE ABOVE, and the split is the whole point: the ceiling that
 * fired is the one the change did not add a single raw byte to.
 *
 * WHY THAT IS NOT A MEASUREMENT ERROR. Almost everything LAW 1 added is comment, and comments do
 * not ship -- hence +0.0 raw. What the change does to the code is MOVE it: `<ClaimPanel>` and
 * `<LearningQueue>` went from the `deciding` branch to the reveal branch, about two hundred lines
 * away, and the control rail picked up a conditional. gzip back-references reach 32 kB; code that
 * used to sit near its own near-duplicate now sits outside that window, so the same bytes compress
 * worse. It is a real cost and it is worth exactly what it says: 0.6 kB to stop the product from
 * showing a player their own calibration while it records how sure they are.
 *
 * The two extractions -- `PgnDrawer` to `PositionSource.tsx`, `SavedReadingOverlay` to
 * `ImportDiagnostic.tsx` -- are `Home.tsx` going back under its 2,400-line ratchet. They cost
 * 0.2 kB raw of props plumbing and nothing gzipped, and both files were already in the entry, so
 * nothing moved between chunks.
 *
 * 215 LEAVES 1.6 kB, the headroom every raise above has taken. The other two did not fire.
 *
 * ---
 *
 * 689 -> 691 and 767 -> 769: the configuration a player already chose (P1.10, P1.11).
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              688.0      213.6       765.9
 *     + the resume wait and the cold door  688.2      213.6       766.1   +0.2 / +0.0 / +0.2
 *     + remembered setup, both surfaces    689.1      213.9       767.0   +0.9 / +0.3 / +0.9
 *
 * SPLIT THE SAME WAY AS THE TWO RAISES ABOVE, by building each half. The first row is P1.5 and
 * P1.6 -- a blocker that stopped being answered with a button, and a control that stops being
 * offered on a record where the route behind it can say nothing -- and both are conditions rather
 * than code, so they cost almost nothing.
 *
 * THE 0.9 kB IS VALIDATION, NOT STORAGE. `remembered-setup.ts` reads two values and checks every
 * field of each before returning one: a colour that is one of two, a depth that is a positive
 * integer, a timing that is one of two, a clock that is a positive integer. The alternative is a
 * cast, and a cast would put a `NaN` clock on a board from a value an older build of this app left
 * in somebody's browser. That is what the bytes buy.
 *
 * 691 AND 769 LEAVE 1.9 kB AND 2.0 kB. The gzip ceiling did not fire and keeps its number.
 *
 * ---
 *
 * 691 -> 673, 215 -> 211 AND 769 -> 751: THE FIRST TIME THIS FILE HAS EVER GONE DOWN.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              690.3      214.4       768.5
 *     RecordExplorer behind a lazy chunk   671.1      208.9       749.3   -19.2 / -5.5 / -19.2
 *
 * P1.7 put the reveal's toolbox -- the engine's panel, the claim panel, the learning queue, the
 * Lichess layers, the dashboard and the whole-game review -- behind one control the player presses.
 * A surface that renders only on a press has no business in the chunk every arrival downloads,
 * which is the argument this file already made about `RecordDashboard` and `recharts`, applied to
 * the four panels that were sitting beside it.
 *
 * THE CEILINGS COME DOWN WITH IT, and that is the whole point of the exercise. A ratchet that only
 * ever moves one way is a ratchet that records defeats; leaving 19 kB of slack in it would mean the
 * next twenty accidental kilobytes cost nothing to ship. The same headroom as every raise above --
 * 1.9 kB, 2.1 kB and 1.7 kB -- measured from where the build actually is.
 *
 * ---
 *
 * 751 -> 753: a stylesheet for a route that never had one.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              671.1      208.9       749.3
 *     + the blitz route's CSS              671.1      208.9       751.5   +0.0 / +0.0 / +2.2
 *
 * ENTRY RAW AND GZIP DID NOT MOVE, WHICH IS THE WHOLE SHAPE OF THIS ONE: it is 2.2 kB of
 * stylesheet and no JavaScript at all. `/blitz` had exactly one rule in `index.css` and shipped as
 * unstyled flow content -- four time-control buttons with no box and no spacing, which under the
 * document's RTL direction merged into one numeric run and rendered as `5+55+03+23+0`, and a board
 * that came out 120px wide because `.board-stage` pins itself to a column blitz does not have.
 *
 * IT IS THE ONLY RAISE IN THIS FILE THAT BUYS A SCREEN RATHER THAN A FEATURE. Everything above
 * bought something the product can now do; this bought a route that a player could already reach
 * and could not read.
 *
 * 753 LEAVES 1.5 kB. The other two ceilings did not move and keep their numbers.
 *
 * ---
 *
 * 673 -> 675: the other half of R-07, which is the same boundary check for the other label.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              671.9      209.2       752.6
 *     + `transfer_id` and its binding      673.0      209.4       753.8   +1.1 / +0.2 / +1.2
 *
 * MEASURED BY BUILDING BOTH SIDES, not attributed by argument: the six changed client and shared
 * files were reverted to `HEAD`, built, and measured, then restored and measured again. Nothing
 * else in the commit reaches the entry route.
 *
 * IT IS ON THE ENTRY ROUTE FOR THE REASON `drill_id` IS, above, and the reason has not weakened:
 * the browser-record deployment runs the same boundary the server does, so a check that arrived in
 * a later chunk would let through exactly the rows it exists to refuse. `transfer` was the last
 * atom label a client could assert unchecked, and `EVIDENCE_POLICY` reads it to decide whether a
 * decision may enter discovery at all.
 *
 * 675 LEAVES 2.0 kB, the headroom every raise here takes. The gzip ceiling did not fire.
 *
 * ---
 *
 * 675 -> 678: nine codes instead of one sentence.
 *
 *                                       entry raw   gzipped   initial raw
 *     before                              673.0      209.4       753.8
 *     + `engine-failure` and its wiring    676.1      210.0       756.8   +3.1 / +0.6 / +3.0
 *
 * R-09 was blocked on a screen that said one thing for six causes with nothing in common: two are
 * the deployment's to fix, two the browser's, one the network's, one a game. This is the closed
 * vocabulary, its nine remedies, the worker probe that waits for a worker to SPEAK rather than
 * assuming construction succeeded, and the content-type checks on both engine assets.
 *
 * IT IS ON THE ENTRY ROUTE BECAUSE THE FAILURE IS. A code that arrived in a later chunk would be
 * absent from exactly the case it exists for -- a browser that could not load a chunk. The probe's
 * own worker is NOT here: `?worker&url` emits it as its own asset, fetched only when the
 * self-check runs.
 *
 * 678 LEAVES 1.9 kB. The gzip ceiling still did not fire, with 1.0 kB to spare.
 *
 * ---
 *
 * 678 -> 683, 211 -> 215 and 761 -> 771: the customer-readiness branch, attributed per commit.
 *
 * All three fired, and two of them fired on the FIRST commit of the branch and were not noticed
 * until the pull request's `verify` run, because the test step failed first and the budget step
 * never ran. Measured by building each commit in its own worktree against the same node_modules:
 *
 *                                       entry raw   gzipped   initial raw
 *     c848f244, before the branch         670.9      209.4       758.8
 *     + observability (fa41edb)           676.9      211.9       764.7   +6.0 / +2.5 / +5.9
 *     + journey (3f342c1)                 677.7      212.3       765.5   +0.8 / +0.4 / +0.8
 *     + privacy (1ea2332)                 681.0      213.4       768.9   +3.3 / +1.1 / +3.4
 *     + adversarial fixes (this commit)   681.0      213.3       768.9   +0.0 / -0.1 / +0.0
 *
 * OBSERVABILITY IS SIX OF THE TEN KILOBYTES, and it is on the entry route because the failures
 * are. `shared/failure-class.ts` is two runtime arrays (the client codes and the classes) and the
 * two maps that fold every code onto a class -- data zod checks against, so a later chunk cannot
 * bring it. `error-sink.ts` is the beacon and the trial-ledger write, wired into `main.tsx`'s two
 * cache subscribers and the window's error events: a reporter that arrives in a lazy chunk is
 * absent from exactly the case it exists for, a browser that could not load a chunk. The rest is
 * `AuthFailureNotice` (five Hebrew sentences at two bytes a character, on the front door because
 * that is where a failed sign-in lands) and `build-identity.ts`, which the self-check needs before
 * anything else it says can be tied to a build.
 *
 * PRIVACY IS THREE. `storage-keys.ts` is ten keys and their areas (the sentences describing each
 * were moved out of the shipped object into `STORAGE_KEY_NOTES` before this was measured, and the
 * move cost nothing measurable, which says the strings were already compressing to almost nothing);
 * `exportLocalRecord` and `deleteLocalRecord` on a store constructed on the entry route; and one
 * more sentence on `WhatThisIs`. `SelfCheck` is behind a lazy chunk, and its new controls are there
 * -- checked, not assumed: `decision-lab-record.json` appears in `SelfCheck-*.js` and nowhere else.
 *
 * JOURNEY IS UNDER ONE. The opponent's candidate picker and the commit guard.
 *
 * WHAT WAS CHECKED RATHER THAN ASSUMED: the 7.1 MB of WebAssembly is still held out of the entry,
 * and the chunk list is the same set before and after -- nothing created, nothing merged away.
 *
 * 683, 215 AND 771 LEAVE 2.0, 1.7 AND 2.1 kB, the headroom every raise in this file has taken.
 */
const ENTRY_RAW_KB = 684;
/** Transferred bytes of the entry chunk, which is what a person on a slow link actually waits for. */
const ENTRY_GZIP_KB = 215;
/**
 * Everything the browser fetches before the first paint, entry chunk and CSS together.
 *
 * Separate from the entry ceiling because a stylesheet growing past a megabyte would be invisible
 * to a JavaScript-only budget, and `index.css` is already 3,693 lines.
 *
 * 735 -> 736 with the entry ceiling above, and for the same 1.2 kB: no stylesheet grew. Measured
 * at 734.9 kB with the card reverted, which is why this one fires only with the screen included.
 *
 * 743 -> 747 with the two ceilings above, and for the same 2.4 kB: no stylesheet grew here either.
 *
 * ---
 *
 * 747 -> 750, AND THIS IS A RAISE THAT SHOULD HAVE HAPPENED TWO COMMITS EARLIER.
 *
 * The 743 -> 747 raise left 0.1 kB of headroom, on the stated ground that widening a ceiling that
 * has not been crossed is loosening a budget for free. That reasoning is still right and the number
 * was still wrong: 0.1 kB is not headroom, it is the next commit's problem, and the next commit
 * duly crossed it.
 *
 *                            entry raw   gzipped   initial raw
 *     after R-05 (747)         674.2      209.1       746.9    ok, by 0.1 kB
 *     + R-07, drill_id         675.2      209.3       747.9    OVER
 *     + R-09, the engine       675.4      209.3       748.1    OVER
 *
 * R-07 is `drill_id` on the atom and the boundary check that resolves it: a field on
 * `decisionAtomSchema` and on the wire schema, the three-part verification in `commitDecision` with
 * its three refusals, and the column read back through both stores. It is on the entry route for
 * the same reason the rest of `commitDecision` is -- the browser-record deployment runs the same
 * boundary the server does, and a check that arrived in a later chunk would let through exactly the
 * rows it exists to refuse.
 *
 * R-09 is the engine's readiness constants and the `<details>` the scan's failure now renders.
 *
 * 750 LEAVES 1.9 kB, which is the headroom every raise in this file before the last one took. The
 * other two ceilings did not fire and keep their numbers.
 *
 * WHAT ACTUALLY WENT WRONG IS NOT THE NUMBER. Both crossings were measured on this machine before
 * the push and neither was seen, because the check's output was piped through `sed` to its first
 * few lines -- the failing line was below the window, and a pipe discards the exit code that would
 * have said so anyway. CI reported it correctly on the first try. The tool worked; reading it
 * through a keyhole did not.
 *
 * ---
 *
 * 753 -> 756: the same 1.2 kB as the entry raise above, plus the headroom this file always takes.
 * The stylesheet did not move; this is all JavaScript, on the entry chunk, and the attribution is
 * the measurement recorded beside `ENTRY_RAW_KB`.
 *
 * ---
 *
 * 756 -> 759: the same 3.0 kB as the entry raise above, plus this file's usual headroom. All
 * JavaScript, on the entry chunk; the stylesheet did not move.
 *
 * ---
 *
 * 759 -> 761: THE STYLESHEET, AND FOR ONCE THE JAVASCRIPT DID NOT MOVE AT ALL.
 *
 * Measured: index.css 83,271 -> 84,638 bytes, +1,367. Every byte of it is one change --
 * 142 `gap` declarations that were literals became `var(--sN)`, and `gap: var(--s3)` is six
 * characters longer than `gap: 8px`. Minification strips the comments that came with them, so the
 * growth is the token references and the six declarations that define them.
 *
 * WHAT IT BOUGHT, and this is the trade this file exists to make explicit: the product had ZERO
 * spacing tokens and THIRTY-ONE distinct gap values across two units, so `5px`, `0.35rem` and
 * `6px` all existed and all read the same. Proximity is the one thing that groups without drawing
 * anything, and it cannot group if the distances are not ranked. See
 * `docs/VISUAL_ARCHITECTURE_AUDIT.md`.
 *
 * THE NUMBER THAT MATTERS MOST DID NOT MOVE: gzipped went 210.8 -> 210.9 kB, because 142
 * references to six strings is exactly what a compressor is for. This ceiling is the raw one, and
 * the raise is 2 kB rather than 1.4 so the next stylesheet change is not forced to come with a
 * budget commit of its own.
 */
/*
 * 683 -> 684 and 771 -> 772: the board saying whose hand it is, and two controls that stopped lying.
 *
 *     entry raw, before            682.6 kB
 *     entry raw, after             683.2 kB     +0.6
 *     initial download, before     770.7 kB
 *     initial download, after      771.3 kB     +0.6
 *
 * WHAT THE BYTES ARE, and none of it is a panel. `ChessBoard` gained a required `sideToMove` and
 * one refusal, which is what stopped every piece of the side not to move taking `.selected-square`
 * with no target behind it -- 14 of 14 measured, and 0 of 14 after. `boardAuthorityFor` binds the
 * counterfactual probe's gesture to the position the probe asked about, which is the difference
 * between refusing an illegal alternative and storing it with `cpLoss: null` for
 * `readCounterfactuals` to drop. And `RevealFailure`'s way out now carries its own label and act
 * instead of a constant, because the caller learned to route to the record while the button went
 * on saying "to the next decision".
 *
 * IT CANNOT BE DEFERRED. All three are on the decision screen at the moment the gesture lands. A
 * refusal that arrives in a later chunk is a refusal that did not happen, and the two that are
 * about a control's honesty are useless the instant after it is pressed.
 *
 * THE GZIP CEILING DID NOT FIRE -- 214.1 against 215 -- and keeps its number: raising a ceiling
 * that has not been crossed is loosening a budget for free. Both raw ceilings were crossed by the
 * same 0.6 kB, which is the whole of the change: it is all in the entry chunk, none of it deferred.
 *
 * THE SMALLEST RAISE THAT CLEARS EACH. 683.2 -> 684 and 771.3 -> 772, leaving 0.8 and 0.7 kB --
 * the ratchet keeps its property of sitting just above the build.
 */

const INITIAL_RAW_KB = 772;

interface Asset {
  name: string;
  raw: number;
  gzip: number;
}

function asset(name: string): Asset {
  const bytes = readFileSync(join(ASSETS, name));
  return { name, raw: bytes.length, gzip: gzipSync(bytes).length };
}

const kb = (bytes: number) => bytes / 1024;
const fmt = (bytes: number) => `${kb(bytes).toFixed(1)} kB`;

try {
  statSync(INDEX);
} catch {
  // Louder than a skip. A budget that silently passes when there is nothing to measure is worse
  // than no budget, because it reports a ceiling was respected that was never tested.
  console.error(`no build found at ${INDEX} -- run \`npm run build\` first`);
  process.exit(1);
}

const html = readFileSync(INDEX, "utf8");
/*
 * The entry is read from the HTML rather than guessed from a filename. Vite hashes every chunk,
 * and `index-*.js` is a naming convention rather than a guarantee -- matching on it would silently
 * measure the wrong file the day the convention changes, and report a pass.
 */
const entryName = html.match(/src="\/assets\/([^"]+\.js)"/)?.[1];
if (!entryName) {
  console.error(`could not find the entry script in ${INDEX}`);
  process.exit(1);
}

const entry = asset(entryName);
const styles = readdirSync(ASSETS)
  .filter((name) => name.endsWith(".css") && html.includes(name))
  .map(asset);
const initialRaw = entry.raw + styles.reduce((sum, sheet) => sum + sheet.raw, 0);

const failures: string[] = [];
const check = (label: string, actual: number, ceilingKb: number) => {
  const over = kb(actual) > ceilingKb;
  console.log(
    `${over ? "OVER " : "ok   "} ${label.padEnd(28)} ${fmt(actual).padStart(10)} / ${ceilingKb} kB`,
  );
  if (over) failures.push(`${label}: ${fmt(actual)} exceeds ${ceilingKb} kB`);
};

console.log(`\nBundle budget -- entry chunk ${entry.name}\n`);
check("entry, raw", entry.raw, ENTRY_RAW_KB);
check("entry, gzipped", entry.gzip, ENTRY_GZIP_KB);
check("initial download, raw", initialRaw, INITIAL_RAW_KB);

/*
 * NOTHING THE PAGE FETCHES EAGERLY MAY BE THE ENGINE, and the check is on the HTML rather than on
 * the chunk.
 *
 * The first version of this searched the entry chunk for the word "stockfish" and failed the
 * build. It was wrong: what it found was `await import("./stockfish-...")`, which is EXACTLY what
 * correct lazy loading looks like -- a dynamic import necessarily leaves the chunk's name in the
 * importer. The check was flagging the evidence that R3 is respected.
 *
 * What a build artifact CAN show is whether the browser is told to fetch the engine before
 * anything asks for it. `<script>` and `<link rel="modulepreload">` in index.html are eager;
 * a chunk named only inside an `import()` call is not. GATE-COMMIT already proves the module is
 * absent from the initial import graph, and this is the complementary claim: absent from the
 * graph, and also not preloaded around it.
 */
const eager = [...html.matchAll(/(?:src|href)="\/assets\/([^"]+)"/g)].map((match) => match[1]);
const eagerEngine = eager.filter((name) => /stockfish|\.wasm$/i.test(name));
if (eagerEngine.length > 0) {
  failures.push(
    `index.html eagerly fetches the engine (${eagerEngine.join(", ")}): R3 requires it to be ` +
      "reached only when a reveal asks for it",
  );
}
console.log(`\neagerly fetched: ${eager.join(", ")}`);

const wasm = readdirSync(ASSETS).filter((name) => name.endsWith(".wasm"));
console.log(`\nheld out of the entry: ${wasm.length} wasm file(s), ${wasm.map((n) => fmt(statSync(join(ASSETS, n)).size)).join(", ")}`);

if (failures.length > 0) {
  console.error(`\nBUDGET EXCEEDED\n${failures.map((f) => `  - ${f}`).join("\n")}`);
  console.error(
    "\nIf the growth is intended, raise the constant in scripts/check_bundle_budget.ts in the same" +
      " commit that causes it, so the decision is on the record.",
  );
  process.exit(1);
}
console.log("\nwithin budget\n");

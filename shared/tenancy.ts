/**
 * One deployment holds one person's record. That is a decision, not an omission.
 *
 * WHAT WAS DECIDED AND WHY IT IS WRITTEN DOWN. Every record procedure sits behind
 * `ownerProcedure`, which admits exactly the account `OWNER_OPEN_ID` names and refuses every other
 * with a written sentence. No record table carries an owner column, and every query in
 * `server/record.ts` selects without an owner predicate. The product is single-tenant by GATE and
 * by SCHEMA at once, and those are different guarantees that happen to agree here.
 *
 * WHAT WOULD GO WRONG IF THEY STOPPED AGREEING. A record table that gained a `user_id` would make
 * the deployment one that STORES several people's records while still admitting one -- and with no
 * owner predicate on any query, the second person's rows would be served to the first. That is not
 * a missing feature; it is the cross-account leak this project has already closed twice, let back
 * in through the schema instead of the router.
 *
 * So `tests/server/one-record-one-person.test.ts` enforces the pair. Going multi-tenant remains
 * entirely possible -- it just has to break that file first, which makes it a decision somebody
 * takes rather than a property that accumulates.
 *
 * FOR THE PERSON USING IT, this is the reason the browser-local record exists at all, and the
 * reason a refused account is told it was refused rather than told the database is missing
 * (`client/src/components/RecordModeNotice.tsx`).
 */
export const TENANCY = "single" as const;

/**
 * Every table holding part of a record.
 *
 * `users` is deliberately absent: it is the OAuth identity table, not a record table, and its
 * `openId` is what the gate compares against. The list is checked against the schema itself, so
 * it cannot quietly fall behind a migration.
 */
export const RECORD_TABLES = [
  "decisions",
  "decision_reveals",
  "decision_feedback",
  "claims",
  "drills",
  "drill_results",
  "learning_rules",
  "learning_transfers",
  "learning_transfer_observations",
  "learning_transfer_results",
  "import_readings",
  "preregistered_hypotheses",
] as const;

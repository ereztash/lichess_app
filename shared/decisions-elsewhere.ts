/**
 * ONE CLAUSE, ONE FILE, AND THE FILE IS THE POINT.
 *
 * This lived in `plain-reading.ts` with the note that "the clause is one string in one place, because
 * what THIS screen measures differs but the acknowledgement itself may not drift between them". Two
 * surfaces then grew their own copy anyway -- the strip at the top of every reveal and the journey
 * ledger -- each with its own hand-rolled singular branch and each claiming a measurement this count
 * does not carry. `GATE-ELSEWHERE-NOT-MEASURED` refuses a fourth.
 *
 * MOVING IT HERE MADE THE RULE ENFORCEABLE AT NO COST, AND THE COST IS WHY IT MOVED. Importing it
 * from `plain-reading.ts` into `loop-position.ts` pulled that whole module -- quartiles, time shapes,
 * the usual-range floor -- into the entry chunk, and put all three bundle ceilings over at once
 * (678.8/678 raw, 212.5/212 gzipped, 771.7/771 initial). A module whose only export is the sentence
 * costs the surfaces that say it nothing more than the sentence.
 */

/**
 * WHAT A PLAYER'S DECISIONS ARE DOING WHEN THEY ARE NOT IN THE POPULATION THIS SCREEN READS.
 *
 * TWO SURFACES SAID THIS AND ONLY ONE OF THEM HAD BEEN WRITTEN. `elsewhereSentence` in
 * `blitz-words.ts` says it on the front door, from the `N-3` owner decision: bank, drill,
 * transfer and imported decisions are counted under their own headings with their own
 * denominators, so a screen that reads only free play must say where the others went rather than
 * report zero. `RecordDashboard` is a record surface with the same populations and the same
 * problem, and it said "עוד לא נחשפה אף החלטה" to a player holding three revealed ones.
 *
 * SO THE CLAUSE IS ONE STRING IN ONE PLACE. Each caller supplies its own second sentence, because
 * what THIS screen measures differs -- the front door measures games played, the dashboard
 * measures a calibration gap -- but the acknowledgement itself may not drift between them.
 *
 * `נרשמו` AND NOT `נמדדו`, carried from `blitz-words.ts` where the choice was made and reasoned:
 * the count is every decision outside this screen's population, and some of those are still
 * waiting for the engine. Recorded is what all of them are; measured is what only some are. The
 * same file also documents why the two registers must not share a bare verb -- `1 נמדדו ונקראות
 * בחלק אחר` above `0 נמדדו מתוך 1 שנרשמו` read as a broken record when both lines were true.
 *
 * NOT A DENOMINATOR. Nothing here counts toward any floor, bucket or eligibility rule. It reports
 * a number that already exists to a reader who would otherwise be told it is zero.
 */
export function decisionsHeldElsewhere(n: number): string {
  return n === 1
    ? "החלטה אחת שלך נרשמה ונקראת בחלק אחר של ההיסטוריה"
    : `${n} החלטות שלך נרשמו ונקראות בחלק אחר של ההיסטוריה`;
}

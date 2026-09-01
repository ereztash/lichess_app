/**
 * `speedOf`, and the reason a display name is the wrong place to keep a value.
 *
 * The function has been wrong twice, for two different PGN formats, and both times the cost was the
 * same and invisible: a game with no time class does not fail loudly, it quietly switches the
 * product's clock buckets from "the dominant class" to "every class at once" -- the exact averaging
 * `timeBucketSpeed` exists to prevent, produced by the corpus builder rather than by the product.
 * The first fix was for the open database's "Rated Blitz tournament". The second is for the API's
 * "Hourly SuperBlitz Arena", which cost half of one real account's corpus its class.
 *
 * Neither fix had a test, which is why there was a second one. This is that test, and the case it
 * cares most about is the last group: what the function CANNOT do, so that the next person to reach
 * for a regex here can see the floor before they hit it.
 */
import { describe, expect, it } from "vitest";
import { speedOf } from "../../scripts/build_import_corpus";

/** Only the Event tag is read, so a whole PGN would be noise around the one line under test. */
const withEvent = (event: string) =>
  `[Event "${event}"]\n[Site "https://lichess.org/abcd1234"]\n\n1. e4 *`;

describe("the open database's own vocabulary, which the first fix was for", () => {
  it("reads a plain rated game", () => {
    expect(speedOf(withEvent("Rated Blitz game"))).toBe("blitz");
    expect(speedOf(withEvent("rated bullet game"))).toBe("bullet");
  });

  it("reads a tournament and a swiss, which an anchor on 'game' missed", () => {
    expect(speedOf(withEvent("Rated Blitz tournament https://lichess.org/tournament/xyz"))).toBe(
      "blitz",
    );
    expect(speedOf(withEvent("Rated Rapid swiss https://lichess.org/swiss/xyz"))).toBe("rapid");
  });
});

describe("the API's arena vocabulary, which the second fix is for", () => {
  it("reads an arena named after its class", () => {
    expect(speedOf(withEvent("Hourly Blitz Arena"))).toBe("blitz");
    expect(speedOf(withEvent("Hourly Rapid Arena"))).toBe("rapid");
    expect(speedOf(withEvent("Eastern Blitz Arena"))).toBe("blitz");
    expect(speedOf(withEvent("Hourly Bullet Arena"))).toBe("bullet");
  });

  /*
   * THE ONE THAT MAKES THE ORDER LOAD-BEARING. "SuperBlitz" contains "Blitz" and "HyperBullet"
   * contains "Bullet", so a scan that checks the short name first files every one of these under a
   * class its own name only ends with. Lichess's SuperBlitz arena is 3+0, which IS blitz, and its
   * HyperBullet arena is 30-second, which IS bullet -- so the right answers here happen to be the
   * containing word for one and not the other, and only the longest-first scan gets both.
   */
  it("does not let a prefix decide the class", () => {
    expect(speedOf(withEvent("Hourly SuperBlitz Arena"))).toBe("blitz");
    expect(speedOf(withEvent("Hourly HyperBullet Arena"))).toBe("bullet");
    expect(speedOf(withEvent("Hourly UltraBullet Arena"))).toBe("ultrabullet");
  });
});

describe("what reading a class off a display name cannot do", () => {
  /*
   * MEASURED, NOT IMAGINED. These are real Event tags from one account's 2,209 admissible games,
   * and 65 of them look like this: an arena title chosen by whoever created the arena, carrying no
   * class word for any pattern to find. There is no regex that fixes this, which is the whole
   * argument for `build_account_corpus.ts` taking `speed` off the API's JSON field and running this
   * function beside it only as a check.
   */
  it("returns undefined for a custom arena title, in any language", () => {
    expect(speedOf(withEvent("Lichess Liga 12B Team Battle"))).toBeUndefined();
    expect(speedOf(withEvent("2024 Spring Marathon"))).toBeUndefined();
    expect(speedOf(withEvent("טורניר שישי בשתיים Arena"))).toBeUndefined();
  });

  it("returns undefined rather than guessing at a variant game", () => {
    // The colon defeats `\w+`, and that is the right outcome: a variant game has no standard-chess
    // time class this corpus should be filing it under.
    expect(speedOf(withEvent("rated variant:atomic game"))).toBeUndefined();
  });
});

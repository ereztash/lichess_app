/**
 * What the record says about the product's own words. `npm run read:vocabulary`
 *
 * A SCRIPT AND NOT A SCREEN, deliberately. This is the trial's instrument, not the player's: it
 * answers "which of our words are wrong", which is a question for whoever is running the trial and
 * has no business on a page a player is deciding on. It also prints what people TYPED, which is
 * the one thing the self-check drawer promises it never hands over -- so it does not go there.
 *
 * Everything it prints is a count beside its denominator. `shared/vocabulary-reading.ts` computes
 * no rates for exactly this reason: the division happens here, where the n can be printed with it.
 */
import { decisions } from "../drizzle/schema.js";
import { KNOWN_OPTIONS, UNKNOWN_OPTIONS } from "../client/src/lib/read-options.js";
import { readVocabulary, type FieldReading } from "../shared/vocabulary-reading.js";

const bar = (n: number, of: number, width = 24) =>
  "#".repeat(of > 0 ? Math.round((n / of) * width) : 0).padEnd(width, ".");

function report(name: string, reading: FieldReading): void {
  console.log(`\n=== ${name} ===`);
  console.log(`decisions with parts recorded: ${reading.recorded}`);
  if (reading.unrecorded > 0) {
    // Said, not omitted: the size of what cannot be read is part of the reading.
    console.log(`decisions from before the parts existed, not counted: ${reading.unrecorded}`);
  }
  if (reading.recorded === 0) {
    console.log("nothing to read yet.");
    return;
  }

  console.log(
    `\nescaped to free text: ${reading.escaped} of ${reading.recorded}` +
      `  (typed with nothing tapped: ${reading.typedOnly})`,
  );

  console.log("\noptions, by how many decisions tapped them:");
  for (const option of reading.options) {
    const flag = option.chosen === 0 ? "   <- never picked" : "";
    console.log(
      `  ${String(option.chosen).padStart(4)} / ${reading.recorded}  ${bar(option.chosen, reading.recorded)}  ${option.label}${flag}`,
    );
  }

  if (reading.unrecognised.length) {
    console.log("\ntapped, but not on the list any more (a rewording, or an older record):");
    for (const option of reading.unrecognised)
      console.log(`  ${String(option.chosen).padStart(4)}  ${option.label}`);
  }

  const shared = reading.pairs.filter((pair) => pair.either >= 3 && pair.together / pair.either >= 0.6);
  if (shared.length) {
    console.log("\npicked together in most decisions that had either -- two words for one thing?");
    for (const pair of shared)
      console.log(`  ${pair.together} of ${pair.either}   ${pair.a}  +  ${pair.b}`);
  }

  if (reading.typed.length) {
    console.log(`\nwhat was typed instead (${reading.typed.length}), verbatim:`);
    for (const line of reading.typed) console.log(`  ${line}`);
  }
}

async function main(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error(
      "DATABASE_URL is not set. This reads the server-side record; a player who is not signed in\n" +
        "keeps theirs in their own browser and it never leaves it.",
    );
    process.exitCode = 1;
    return;
  }
  const { drizzle } = await import("drizzle-orm/mysql2");
  const db = drizzle(process.env.DATABASE_URL);

  /*
   * Every decision, with no owner filter, because there is no owner column to filter on: the
   * deployment is single-tenant by design and every endpoint is gated to one OWNER_OPEN_ID. A
   * `where` here would be inventing a distinction the schema does not make.
   */
  const rows = await db
    .select({
      knownParts: decisions.statedReadParts,
      unknownParts: decisions.statedUnknownParts,
    })
    .from(decisions);

  console.log(`${rows.length} decisions.`);
  const reading = readVocabulary(
    rows,
    {
      known: KNOWN_OPTIONS.map((option) => option.label),
      unknown: UNKNOWN_OPTIONS.map((option) => option.label),
    },
  );
  report("what you can read here", reading.known);
  report("what you cannot evaluate", reading.unknown);
}

void main();

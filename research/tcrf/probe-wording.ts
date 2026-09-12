/**
 * THE THREE QUESTIONS, IN THREE LANGUAGES, WITH THEIR PROVENANCE ATTACHED.
 *
 * §7.3 freezes what may be asked and §6 freezes how a wording is allowed to come to exist. The two
 * together are a single constraint: the participant's own ontology has to be elicited BEFORE it is
 * classified, so the question may not contain the answer.
 *
 * WHAT IS FORBIDDEN IN THE WORDING, and `forbiddenLexiconHits` checks it rather than trusting it:
 * no examples, no piece names, no relation or motif words, no strategic vocabulary, no
 * multiple-choice resource menu, no explanation of what the study is about. This is §11's control
 * C5 -- "prompts contain no target relation/motif words and no examples" -- moved from a table in a
 * document into something a test can run.
 *
 * LANGUAGE IS A MEASUREMENT CONTEXT, NOT A CULTURE. §6 is explicit and this module is built to make
 * the mistake hard: there is no field here for a country, a culture or a cognitive style, the three
 * wordings are peers rather than two translations of an English original, and each carries its own
 * back-translation and cognitive-interview record. `docs/research/TELOS_CONDITIONED_RESOURCE_FIELD_SPEC.md`
 * §9.1 forbids mean claims of the form "culture X is more holistic"; nothing here can produce one
 * because nothing here records a culture.
 *
 * THE SOURCE STRING IS AUTHORITATIVE. There is no machine translation in this file and no field to
 * put one in. §6: a convenience copy may exist for display and is not the coding source.
 */
import { RESEARCH_LANGUAGES, type ResearchLanguage } from "./trial.js";

/** Bumped whenever any wording changes. Stored on every trial as `language_version`. */
export const LANGUAGE_VERSION = 1;

export const PROBE_SLOTS = ["resource_primary", "resource_secondary", "telos"] as const;
export type ProbeSlot = (typeof PROBE_SLOTS)[number];

/** How far a wording has got through §6's five steps. A wording is not usable until it is through. */
export const WORDING_STATES = [
  "DRAFTED",
  "FORWARD_TRANSLATED",
  "BACK_TRANSLATED",
  "COGNITIVE_INTERVIEWED",
  "FROZEN",
] as const;
export type WordingState = (typeof WORDING_STATES)[number];

export interface Wording {
  slot: ProbeSlot;
  language: ResearchLanguage;
  text: string;
  state: WordingState;
  /**
   * §6.2's discrepancy detector, kept as the back-translated ENGLISH rather than as a verdict.
   *
   * A BOOLEAN `back_translation_ok` WOULD HAVE BEEN SMALLER AND USELESS. The point of a back
   * translation is that a later reader can see what the wording came back as and disagree; a flag
   * records that somebody once agreed and destroys the evidence they agreed about.
   */
  back_translation: string | null;
  /** §6.3. What participants said the question meant to them, in the discovery cohort. */
  cognitive_interview_note: string | null;
  /** Set when the wording changed in response to the interviews, so the revision is visible. */
  revised_from: string | null;
}

/**
 * The frozen set.
 *
 * HEBREW AND SPANISH ARE MARKED `DRAFTED`, NOT `FROZEN`, AND THAT IS THE HONEST STATE. §7.3 says
 * "equivalent adapted wording is frozen for Hebrew and Spanish AFTER discovery", and discovery has
 * not run. Marking them frozen here would be a claim that a bilingual forward translation, an
 * independent back translation and cognitive interviews have happened. `unfrozenWordings()` is what
 * a runbook step checks before the confirmatory cohort opens.
 *
 * ENGLISH IS THE SOURCE ONLY IN THE SENSE THAT IT WAS WRITTEN FIRST. §6 asks for conceptual
 * adaptation rather than word-for-word translation, so the other two are not required to mirror its
 * syntax, and the back-translation field is where a divergence has to be argued rather than hidden.
 */
export const WORDINGS: readonly Wording[] = [
  {
    slot: "resource_primary",
    language: "en",
    text: "What in this position mattered most to your decision?",
    state: "FROZEN",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "resource_secondary",
    language: "en",
    text: "What mattered next, if anything?",
    state: "FROZEN",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "telos",
    language: "en",
    text: "What were you trying to make happen?",
    state: "FROZEN",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "resource_primary",
    language: "he",
    text: "מה בעמדה הזו היה הכי משמעותי להחלטה שלך?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "resource_secondary",
    language: "he",
    text: "ומה אחר כך, אם בכלל?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "telos",
    language: "he",
    text: "מה ניסית לגרום שיקרה?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "resource_primary",
    language: "es",
    text: "¿Qué fue lo que más pesó en tu decisión en esta posición?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "resource_secondary",
    language: "es",
    text: "¿Y después, si hubo algo más?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
  {
    slot: "telos",
    language: "es",
    text: "¿Qué estabas intentando conseguir?",
    state: "DRAFTED",
    back_translation: null,
    cognitive_interview_note: null,
    revised_from: null,
  },
];

/**
 * Words a probe may not contain, in every language it is asked in.
 *
 * NOT A SPELLCHECKER AND NOT CLAIMED TO BE COMPLETE. It covers the two categories C5 names -- the
 * target relation and motif vocabulary, and anything that reads as an example -- and it is a lower
 * bound on the check a bilingual reviewer performs. A term that gets past this list and into a
 * wording is a reviewer's finding; a term that gets past the reviewer and is on this list is a
 * defect this catches for free on every commit.
 */
export const FORBIDDEN_LEXICON: Readonly<Record<ResearchLanguage, readonly string[]>> = {
  en: [
    "attack", "defend", "defence", "defense", "support", "pin", "fork", "battery",
    "overload", "coalition", "relation", "structure", "motif", "resource", "piece",
    "pawn", "knight", "bishop", "rook", "queen", "king", "file", "rank", "diagonal",
    "tactic", "plan", "threat", "for example", "such as", "e.g.",
  ],
  he: [
    "התקפה", "הגנה", "תמיכה", "ריתוק", "מזלג", "סוללה", "העמסה", "קואליציה",
    "יחס", "מבנה", "מוטיב", "משאב", "כלי", "רגלי", "פרש", "רץ", "צריח", "מלכה",
    "מלך", "טור", "שורה", "אלכסון", "טקטיקה", "תוכנית", "איום", "לדוגמה", "כגון",
  ],
  es: [
    "ataque", "defensa", "apoyo", "clavada", "horquilla", "batería", "sobrecarga",
    "coalición", "relación", "estructura", "motivo", "recurso", "pieza", "peón",
    "caballo", "alfil", "torre", "dama", "rey", "columna", "fila", "diagonal",
    "táctica", "plan", "amenaza", "por ejemplo",
  ],
};

/** Every forbidden term a wording actually contains. Empty is the only admissible answer. */
export function forbiddenLexiconHits(wording: Wording): string[] {
  const haystack = wording.text.toLowerCase();
  return FORBIDDEN_LEXICON[wording.language].filter((term) => haystack.includes(term));
}

/** Which wordings are not yet usable in a confirmatory session. §6, §7.3. */
export const unfrozenWordings = (): Wording[] => WORDINGS.filter((w) => w.state !== "FROZEN");

/** Every (slot, language) the design requires. A missing pair is a language that cannot run. */
export function missingWordings(): string[] {
  const have = new Set(WORDINGS.map((w) => `${w.language}:${w.slot}`));
  const want: string[] = [];
  for (const language of RESEARCH_LANGUAGES) {
    for (const slot of PROBE_SLOTS) {
      if (!have.has(`${language}:${slot}`)) want.push(`${language}:${slot}`);
    }
  }
  return want;
}

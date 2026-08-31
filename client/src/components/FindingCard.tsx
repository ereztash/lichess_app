/**
 * ONE IMPORTANT THING · ONE EXAMPLE · ONE EVIDENCE LEVEL · ONE NEXT ACTION.
 *
 * The 1-1-1-1 law from the end of the master plan, as a component, so that it is a shape a screen
 * has rather than a rule a screen is asked to follow. §14 says one screen answers one question;
 * this is the same law one level down, where it can actually be enforced: a card that wanted to say
 * two things would need two cards, and a card that wanted two actions has nowhere to put the
 * second.
 *
 * THE ORDER IS THE ARGUMENT, and it is §7's: the example comes BEFORE any aggregate. A reader
 * understands an event -- this move, this clock, this word they pressed -- long before they
 * understand a rate over a population, and once they have the event the population is a small
 * addition to something they already believe. The other order asks them to accept a number and
 * then offers evidence for it, which is how a product ends up needing the reader to do statistics
 * to decide whether to care.
 *
 * WHAT IS BEHIND THE DISCLOSURE IS NOT LESS TRUE, IT IS LESS URGENT. §15: complexity is not
 * deleted, it stops compelling everyone to read it. `why` holds the counts, the denominators, the
 * engine, the protocol -- everything R1 requires a figure to arrive with -- and it is one click
 * away rather than absent.
 *
 * IT CHOOSES NO WORDS. Every string is a prop. A card that phrased its own headline would be a
 * second vocabulary beside the modules entitled to speak, which is the drift `OutcomeSummary`
 * documents at length about itself.
 */
import type { ReactNode } from "react";
import { AUTHORITY, type EvidenceAuthority } from "@shared/evidence-authority";
import { EvidenceMark } from "./EvidenceMark";

export interface FindingAction {
  label: string;
  onClick: () => void;
  /**
   * Why taking it is worth anything, in one sentence.
   *
   * REQUIRED, not optional. A button with no stated purpose is a button whose purpose the reader
   * infers, and the inference they reach for is "the product wants me to click this". Every action
   * in this product is a request for a measurement and can say so.
   */
  because: string;
}

export function FindingCard({
  headline,
  example,
  authority,
  action,
  why,
  explainAuthority = false,
}: {
  /** The one thing. A sentence about what happened, never a figure standing on its own. */
  headline: string;
  /**
   * The concrete case, rendered before anything aggregate.
   *
   * NULLABLE, because some readings genuinely have no single case to show -- "nothing separated"
   * is a statement about a whole record. A card with no example says so by having none rather
   * than by rendering an empty frame.
   */
  example: ReactNode | null;
  authority: EvidenceAuthority;
  /**
   * ONE action, or none.
   *
   * NOT AN ARRAY. §14's rule survives exactly as long as the type refuses a second one: a card
   * offering two next steps has asked the reader to choose, which is a decision the product was
   * supposed to have made.
   */
  action: FindingAction | null;
  /** Everything R1 wants beside a figure: counts, denominators, instrument, protocol. */
  why: ReactNode | null;
  explainAuthority?: boolean;
}) {
  return (
    <section className="finding" data-authority={authority} dir="rtl">
      <h3 className="finding__headline">{headline}</h3>

      {example && <div className="finding__example">{example}</div>}

      <div className="finding__authority">
        <EvidenceMark authority={authority} explain={explainAuthority} />
      </div>

      {action && (
        <div className="finding__action">
          <button type="button" className="finding__button" onClick={action.onClick}>
            {action.label}
          </button>
          <p className="finding__because">{action.because}</p>
        </div>
      )}

      {why && (
        /*
         * CLOSED, AND THE SUMMARY IS A QUESTION. "פרטים" names a drawer; this names what opening it
         * answers, which is the only reason anybody opens one. `<details>` rather than component
         * state for the reason `RevealPanel` gives about its own: it survives without JavaScript,
         * it is keyboard-reachable for free, and its open state is not something to keep in sync.
         */
        <details className="finding__why">
          <summary>למה אנחנו אומרים את זה?</summary>
          <div className="finding__why-body">{why}</div>
        </details>
      )}

      {/*
        * THE ONE SENTENCE THE CARD ITSELF OWNS, and it is about the card rather than about the
        * player: what this level of evidence does NOT let the product do. It is here rather than in
        * `EvidenceMark` because it is a statement about the whole card -- a card whose authority
        * cannot prescribe must not carry a "try this next time", and saying so out loud is what
        * stops the next screen from adding one.
        */}
      {!AUTHORITY[authority].mayPrescribe && (
        <p className="finding__restraint">
          זו עדיין לא סיבה לשנות משהו במשחק. לשם כך צריך בדיקה קדימה.
        </p>
      )}
    </section>
  );
}

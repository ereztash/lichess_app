/**
 * Where an imported reading sits on the path to something that could be a finding.
 *
 * THE FAILURE THIS EXISTS TO PREVENT is not a wrong number, it is a right number read as the wrong
 * kind of thing. The panel above measures accuracy over games that are already over. It cannot
 * measure a calibration gap, because nobody was asked how sure they were during a game they have
 * already played -- so it can never say anything about the player. It can name a place to look.
 *
 * Everything that would turn that into a finding happens after this screen and mostly elsewhere:
 * registering the bucket BEFORE the data exist, collecting decisions that carry a stated
 * confidence, and testing the bucket on those rather than on the ones that suggested it. A screen
 * that shows the reading and stops invites the reading to be the answer.
 *
 * SO THE STAGES THIS SCREEN CANNOT REACH ARE ON IT ANYWAY, greyed rather than hidden. Hiding them
 * would make the reading look like the end of the process instead of the first step of one.
 */
import { IMPORT_PIPELINE, type ImportProgress } from "@shared/prereg";

export function ImportPipeline({ progress }: { progress: ImportProgress }) {
  const reachedIndex = IMPORT_PIPELINE.findIndex((stage) => stage.key === progress.reached);
  return (
    <section className="import-pipeline" aria-label="מה עוד צריך לקרות כדי שתהיה כאן מסקנה">
      <ol>
        {IMPORT_PIPELINE.map((stage, index) => (
          <li
            key={stage.key}
            className={index <= reachedIndex ? "reached" : "ahead"}
            aria-current={index === reachedIndex ? "step" : undefined}
          >
            <span className="import-pipeline-mark" aria-hidden="true">
              {index <= reachedIndex ? "●" : "○"}
            </span>
            <span>{stage.label}</span>
          </li>
        ))}
      </ol>
      <p className="pv-note">
        {progress.blockedReason
          ? `${progress.blockedReason} הקריאה שלמעלה נשארת תצפית על משחקים שכבר שוחקו.`
          : "הקריאה שלמעלה היא תצפית על משחקים שכבר שוחקו. היא מצביעה על מקום לבדוק, והבדיקה עצמה קורית על החלטות חדשות בלבד."}
      </p>
    </section>
  );
}

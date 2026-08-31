/**
 * THE TWO PANELS THAT EXPLAIN THE PRODUCT, as opposed to the ones that do something.
 *
 * `WhatThisIs` answers "what is measured here" and `SelfCheck` answers "is my install working".
 * Neither takes a position, starts a game, or writes to the record -- which is what separates them
 * from every other overlay this page opens, and why they belong together and away from it.
 *
 * MOVED OUT OF `Home.tsx` UNDER ITS LINE RATCHET, which is a ceiling that may only come down. Its
 * own note says why the number is the one pinned: "line count is a symptom; fifty-five pieces of
 * state in one scope is the cause." Shaving a comment to get under it trades an explanation for a
 * number; moving a boundary out is what the ratchet is asking for.
 */
import { Overlay } from "./Overlay";
import { SelfCheck } from "./SelfCheck";
import { WhatThisIs } from "./WhatThisIs";

export function ExplainerOverlays({
  help,
  selfCheck,
  onCloseHelp,
  onCloseSelfCheck,
}: {
  help: boolean;
  selfCheck: boolean;
  onCloseHelp: () => void;
  onCloseSelfCheck: () => void;
}) {
  return (
    <>
      {help && (
        <Overlay label="מה נמדד כאן" onClose={onCloseHelp}>
          <WhatThisIs onClose={onCloseHelp} />
        </Overlay>
      )}
      {selfCheck && (
        <Overlay label="בדיקה עצמית" onClose={onCloseSelfCheck}>
          <SelfCheck onClose={onCloseSelfCheck} />
        </Overlay>
      )}
    </>
  );
}

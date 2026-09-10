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
import { Suspense } from "react";
import { lazyChunk } from "@/lib/lazy-chunk";
import { Overlay } from "./Overlay";
import { WhatThisIs } from "./WhatThisIs";

/*
 * A DRAWER THAT IS NOT ON THE PATH IS NOT IN THE BUNDLE EITHER (P1.7), which is the rule
 * `Home.tsx` already applies to the explorer, the dashboard and the game review, in those words.
 * The self-check answers "is my install working" -- it renders when somebody presses a control in
 * the header and never otherwise -- and it drags `lib/self-check.ts` and `lib/worker-probe.ts`
 * behind it, which the entry chunk was shipping to every arrival who never opened it.
 *
 * `WhatThisIs` STAYS EAGER, and the difference is what it costs: it is one document with no
 * library behind it, and it is the panel a first arrival is most likely to open.
 */
const SelfCheck = lazyChunk(() =>
  import("./SelfCheck").then((m) => ({ default: m.SelfCheck })),
);

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
          <Suspense fallback={<p role="status">טוען…</p>}>
            <SelfCheck onClose={onCloseSelfCheck} />
          </Suspense>
        </Overlay>
      )}
    </>
  );
}

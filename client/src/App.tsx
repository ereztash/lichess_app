import NotFound from "@/pages/NotFound";
import { lazy, Suspense, useEffect } from "react";
import { Route, Switch } from "wouter";
import {
  beginVisit,
  previousVisitStartedAt,
  recordTrialEvent,
  visitsOnRecord,
} from "@/lib/progress-record";
import { readAcquisitionContext } from "@/lib/acquisition-evidence";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Record from "./pages/Record";
/*
 * LAZY, AND FOR A MEASURED REASON. The blitz screen pulls in the game core, the instrument and the
 * post-game analyser, and none of it is on the path of somebody arriving at the record. The entry
 * chunk is under a ratchet that was crossed once already in this work; a route that nobody has
 * opened has no business in the bytes everybody downloads.
 */
const Blitz = lazy(() => import("./pages/Blitz"));
/*
 * THE RECORD IS THE FRONT DOOR; the board is a room in the house.
 *
 * `/` opened straight onto a live game, which was the right call while the app was only a board:
 * the demo game used to BE the opening screen and that is what made it unplayable. What changed
 * is that there is now something to arrive AT -- a record with its own state, its own silence,
 * and a first decision to set up. A board is where a decision is taken; it is not where a player
 * finds out what is being measured about them.
 */
function Router() {
  return (
    <Switch>
      <Route path="/" component={Record} />
      <Route path="/play" component={Home} />
      <Route path="/blitz">
        <Suspense fallback={<p role="status">טוען…</p>}>
          <Blitz />
        </Suspense>
      </Route>
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}
export default function App() {
  /*
   * ONE VISIT PER PAGE LOAD, so a trial can tell a tester who came back from one who never left.
   *
   * Written and never read: nothing in the running app branches on it, and no measurement is
   * scoped by it. It is here rather than in a page because a visit is a page LOAD, and both
   * routes are reached without one.
   */
  useEffect(() => {
    beginVisit();
    /*
     * THE FIRST STAGE OF THE ACQUISITION FUNNEL, AND ITS DENOMINATOR.
     *
     * Written here, once, immediately after the visit is opened, because everything downstream is
     * a rate against it: how many arrivals reached a position, committed, saw a reveal, started
     * another decision. An entry event emitted from a page would count one of the two routes.
     *
     * NOTHING BRANCHES ON THE CONTEXT. The angle is recorded and never read by the running app --
     * `tests/client/a-record-of-the-trial-not-of-the-player.test.tsx` holds that as an assertion
     * over the import graph. A build that served a different reveal, a different position or a
     * different sentence to one angle would be measuring the interaction between the product and
     * its own telemetry, and no result from that trial would mean anything.
     */
    const context = readAcquisitionContext(window.location.search);
    const previous = previousVisitStartedAt();
    const returning = visitsOnRecord() > 1;
    recordTrialEvent({
      name: "acquisition_entry",
      at: new Date().toISOString(),
      context,
      returning,
    });
    if (returning && previous) {
      /*
       * A SESSION BOUNDARY IS A PAGE LOAD, stated plainly and with its limits: two tabs are two
       * sessions, and a cleared browser is a first arrival. Neither is worked around.
       *
       * The gap is a duration between two timestamps. It is not "they lapsed" and it is not "they
       * came back keen" -- an interpretation of a number is an analysis, and it is done later by
       * somebody who has to say what window they chose.
       */
      const hours = (Date.now() - new Date(previous).getTime()) / 3_600_000;
      if (Number.isFinite(hours)) {
        recordTrialEvent({
          name: "return_session_started",
          at: new Date().toISOString(),
          hoursSincePrevious: Math.round(hours * 10) / 10,
        });
      }
    }
  }, []);
  return (
    <ErrorBoundary>
      {/*
        * LIGHT IS THE DEFAULT, because the palette was designed for it.
        *
        * Every colour token in index.css and every measurement recorded beside it -- the paper
        * ground, the ink, the 1.30:1 chip against the surface, the wooden board -- was written
        * for a paper-and-ink lab notebook. The app shipped defaulting to dark, where the board
        * is the only saturated object on a near-black page and reads as pasted in from another
        * application. The dark palette stays and the toggle stays; what changes is which one a
        * player meets first.
        */}
      <ThemeProvider defaultTheme="light" switchable>
        <Router />
      </ThemeProvider>
    </ErrorBoundary>
  );
}

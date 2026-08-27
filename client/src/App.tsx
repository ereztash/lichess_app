import NotFound from "@/pages/NotFound";
import { useEffect } from "react";
import { Route, Switch } from "wouter";
import { beginVisit } from "@/lib/progress-record";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
import Record from "./pages/Record";
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
  useEffect(() => beginVisit(), []);
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

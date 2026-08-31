/**
 * CONTROL for GATE-PENDING-WORK-LIVENESS, second half. Not shipped.
 *
 * The root as it was before the queue: it mounts the router and nothing else, so an analysis a
 * screen abandoned is one nothing will ever pick up. Paired with the fixture `Blitz.tsx` beside
 * it, this is a faithful reproduction of the state LAW 4 was written against -- work that a screen
 * owns and a root that would never finish.
 */
export default function App() {
  return <main>router</main>;
}

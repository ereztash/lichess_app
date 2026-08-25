import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import Home from "./pages/Home";
function Router() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/404" component={NotFound} />
      <Route component={NotFound} />
    </Switch>
  );
}
export default function App() {
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

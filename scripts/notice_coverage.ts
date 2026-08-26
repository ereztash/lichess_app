/**
 * Does every third-party component this build CONVEYS have a notice that travels with it?
 *
 * The distinction this file turns on: `node_modules` is what you install to build the repository,
 * `dist/public` is what a person receives when they load the page. Only the second carries
 * obligations to that person, and only the second is checked here.
 *
 * Written as a pure predicate over a described tree rather than as a script that walks one, so the
 * gate and its positive control run the SAME comparison -- the control feeds it a conveyed
 * component with no notice behind it and must go red. A coverage check that can only be pointed at
 * a passing tree has not been shown to be a check.
 */

export interface ConveyedComponent {
  /** How the notices file must name it. */
  id: string;
  /** Exact installed version, or null for components that carry no version (fonts). */
  version: string | null;
  /** Repository path of the licence text this build serves. */
  licenceFile: string;
}

export interface NoticeGap {
  component: string;
  reason: "not named" | "version stale" | "licence text missing";
  detail: string;
}

export function noticeGaps(
  conveyed: ConveyedComponent[],
  notices: string,
  fileExists: (path: string) => boolean,
): NoticeGap[] {
  const gaps: NoticeGap[] = [];
  for (const component of conveyed) {
    if (!notices.includes(component.id)) {
      gaps.push({
        component: component.id,
        reason: "not named",
        detail: `${component.id} is conveyed by the build and THIRD_PARTY_NOTICES.md never names it`,
      });
      continue;
    }
    /*
     * The version is checked because a stale one is worse than none: a notice naming 18.0.7 while
     * the build ships 18.0.8 points the reader at corresponding source that is not the source of
     * what they received, which is the one thing GPL-3.0 s6 is for.
     */
    if (component.version !== null && !notices.includes(component.version)) {
      gaps.push({
        component: component.id,
        reason: "version stale",
        detail: `the build conveys ${component.id} ${component.version}; the notices file does not say so`,
      });
    }
    if (!fileExists(component.licenceFile)) {
      gaps.push({
        component: component.id,
        reason: "licence text missing",
        detail: `${component.licenceFile} does not exist, so nothing is served with ${component.id}`,
      });
    }
  }
  return gaps;
}

/**
 * The font families a directory of woff2 files conveys, read from the filenames.
 *
 * The naming is `<family>-<weight>-<subset>.woff2`, so the family is everything before the first
 * numeric part. Derived from the tree rather than listed, because a hardcoded list is exactly what
 * stops noticing when somebody adds a tenth file.
 */
export function fontFamiliesIn(files: string[]): string[] {
  const families = new Set<string>();
  for (const file of files) {
    if (!file.endsWith(".woff2")) continue;
    const family = file.replace(/\.woff2$/, "").replace(/-\d+-[a-z]+$/, "");
    if (family) families.add(family);
  }
  return [...families].sort();
}

// @vitest-environment jsdom
/**
 * Sign-in must never fail silently.
 *
 * The button used to console.warn and return, so "this deployment is not configured" and
 * "nothing happened" rendered identically on screen. A user cannot act on that, and it is the
 * precise failure mode this product exists to name.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { signInConfig, startLogin } from "../../client/src/const";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("sign-in configuration", () => {
  it("names every missing build-time variable rather than reporting a bare failure", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "");
    const config = signInConfig();
    expect(config.ready).toBe(false);
    expect(config.missing).toEqual(["VITE_OAUTH_PORTAL_URL", "VITE_APP_ID"]);
  });

  it("names only the one that is actually missing", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.example");
    vi.stubEnv("VITE_APP_ID", "");
    expect(signInConfig().missing).toEqual(["VITE_APP_ID"]);
  });

  it("reports the failure to its caller instead of swallowing it", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
    vi.stubEnv("VITE_APP_ID", "");
    const result = startLogin();
    expect(result.started).toBe(false);
    // The caller gets the names, so the screen can show them.
    if (result.started) throw new Error("unreachable");
    expect(result.missing).toContain("VITE_OAUTH_PORTAL_URL");
  });

  /**
   * Asserting on window.location.href would pass for the wrong reason: jsdom ignores the write
   * rather than performing it, so the value is unchanged whether or not the code navigated.
   * The setter is captured instead, and the test runs in both directions so that the negative
   * case is known to be capable of failing.
   */
  it("navigates only when it can start, and not otherwise", () => {
    const navigations: string[] = [];
    const original = Object.getOwnPropertyDescriptor(window, "location");
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        origin: "https://app.example",
        set href(url: string) {
          navigations.push(url);
        },
        get href() {
          return navigations[navigations.length - 1] ?? "https://app.example/";
        },
      },
    });
    try {
      vi.stubEnv("VITE_OAUTH_PORTAL_URL", "");
      vi.stubEnv("VITE_APP_ID", "");
      startLogin();
      expect(navigations).toEqual([]);

      // Positive control: the same capture does record a navigation once the build is configured.
      vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.example");
      vi.stubEnv("VITE_APP_ID", "app-123");
      startLogin();
      expect(navigations).toHaveLength(1);
      expect(navigations[0]).toContain("https://portal.example/app-auth");
    } finally {
      if (original) Object.defineProperty(window, "location", original);
    }
  });

  it("starts when the build carries both variables", () => {
    vi.stubEnv("VITE_OAUTH_PORTAL_URL", "https://portal.example");
    vi.stubEnv("VITE_APP_ID", "app-123");
    expect(signInConfig()).toEqual({ ready: true, missing: [] });
  });
});

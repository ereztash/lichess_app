import { describe, expect, it } from "vitest";
import config from "../../vite.config";

describe("the production preview server", () => {
  it("mounts the same Express API as the development server", async () => {
    const configured = config as unknown as { plugins?: unknown[] };
    const plugins = (configured.plugins ?? []).flat(4) as Array<{
      name?: string;
      configurePreviewServer?: unknown;
    }>;
    const apiPlugin = plugins.find((plugin) => plugin?.name === "api-dev-server");
    expect(apiPlugin).toBeDefined();
    expect(apiPlugin?.configurePreviewServer).toEqual(expect.any(Function));

    const mounted: unknown[] = [];
    const hook = apiPlugin!.configurePreviewServer as (server: unknown) => Promise<void>;
    await hook({ middlewares: { use: (handler: unknown) => mounted.push(handler) } });
    expect(mounted).toHaveLength(1);
    expect(mounted[0]).toEqual(expect.any(Function));
  });
});

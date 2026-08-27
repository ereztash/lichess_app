/**
 * The retry behind the reveal's second write.
 *
 * Three properties, and the third is the one that makes the server's replay branch safe: the
 * second attempt must be the SAME call. `reveal` compares the incoming verdict field by field
 * against the stored one and only lets an identical one complete a missing price, so a retry that
 * rebuilt its payload from a fresh engine search would be refused as a second, different reveal --
 * which is exactly what it would be.
 */
import { describe, expect, it, vi } from "vitest";
import { retryOnce } from "../../client/src/lib/retry-once";

describe("one retry, with the same call", () => {
  it("does not run twice when the first attempt succeeds", async () => {
    const run = vi.fn().mockResolvedValue("written");
    await expect(retryOnce(run)).resolves.toBe("written");
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("runs again when the first attempt fails, and returns what the second one gives", async () => {
    const run = vi.fn().mockRejectedValueOnce(new Error("connection reset")).mockResolvedValue("written");
    await expect(retryOnce(run)).resolves.toBe("written");
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("stops at two, and raises the SECOND error rather than the first", async () => {
    /*
     * Not a loop: a loop against a server that is refusing turns one failed decision into a stuck
     * screen. And the second error is the one that describes the state the caller is now in --
     * after the first failure the record may already have changed.
     */
    const run = vi
      .fn()
      .mockRejectedValueOnce(new Error("connection reset"))
      .mockRejectedValueOnce(new Error("ההחלטה כבר נחשפה"));
    await expect(retryOnce(run)).rejects.toThrow("ההחלטה כבר נחשפה");
    expect(run).toHaveBeenCalledTimes(2);
  });
});

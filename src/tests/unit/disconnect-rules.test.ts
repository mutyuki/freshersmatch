import { describe, expect, it } from "vitest";

import { isDisconnected } from "@/lib/domain/disconnect-rules";

describe("isDisconnected", () => {
  it("returns false when the elapsed time is below the disconnect threshold", () => {
    expect(
      isDisconnected({
        lastSeenAt: "2026-04-12T10:00:00.001Z",
        now: new Date("2026-04-12T10:00:30.000Z"),
        disconnectThresholdSeconds: 30,
      }),
    ).toBe(false);
  });

  it("returns true when the elapsed time reaches the 30 second disconnect threshold", () => {
    expect(
      isDisconnected({
        lastSeenAt: "2026-04-12T10:00:00.000Z",
        now: new Date("2026-04-12T10:00:30.000Z"),
        disconnectThresholdSeconds: 30,
      }),
    ).toBe(true);
  });

  it("returns true when the elapsed time exceeds the disconnect threshold", () => {
    expect(
      isDisconnected({
        lastSeenAt: "2026-04-12T10:00:00.000Z",
        now: new Date("2026-04-12T10:00:30.001Z"),
        disconnectThresholdSeconds: 30,
      }),
    ).toBe(true);
  });

  it("uses the provided threshold instead of assuming 30 seconds", () => {
    expect(
      isDisconnected({
        lastSeenAt: "2026-04-12T10:00:00.000Z",
        now: new Date("2026-04-12T10:00:45.000Z"),
        disconnectThresholdSeconds: 60,
      }),
    ).toBe(false);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  clearParticipantSessionToken,
  getParticipantSessionToken,
  saveParticipantSessionToken,
} from "@/lib/session/participant-client-session";

describe("participant client session", () => {
  beforeEach(() => {
    const store = new Map<string, string>();

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: vi.fn((key: string) => store.get(key) ?? null),
          setItem: vi.fn((key: string, value: string) => {
            store.set(key, value);
          }),
          removeItem: vi.fn((key: string) => {
            store.delete(key);
          }),
        },
      },
    });
  });

  it("saves, reads, and clears the participant session token", () => {
    saveParticipantSessionToken("session-token");
    expect(getParticipantSessionToken()).toBe("session-token");

    clearParticipantSessionToken();
    expect(getParticipantSessionToken()).toBeNull();
  });

  it("safely no-ops when window is unavailable", () => {
    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: undefined,
    });

    expect(() => saveParticipantSessionToken("session-token")).not.toThrow();
    expect(getParticipantSessionToken()).toBeNull();
    expect(() => clearParticipantSessionToken()).not.toThrow();
  });
});

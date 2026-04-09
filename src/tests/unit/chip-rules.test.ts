import { describe, expect, it } from "vitest";

import {
  calculateHeadToHeadBet,
  calculateHeadToHeadPayout,
  calculateStaffMatchBet,
  calculateStaffMatchPayout,
} from "@/lib/domain/chip-rules";

describe("calculateHeadToHeadBet", () => {
  it("returns the fixed bet when both players can cover it", () => {
    expect(
      calculateHeadToHeadBet({
        player1Balance: 150,
        player2Balance: 120,
        fixedBetAmount: 100,
      }),
    ).toBe(100);
  });

  it("returns the shorter stack when one player is below the fixed bet", () => {
    expect(
      calculateHeadToHeadBet({
        player1Balance: 80,
        player2Balance: 150,
        fixedBetAmount: 100,
      }),
    ).toBe(80);
  });

  it("returns the shared stack when both players have the same all-in amount", () => {
    expect(
      calculateHeadToHeadBet({
        player1Balance: 60,
        player2Balance: 60,
        fixedBetAmount: 100,
      }),
    ).toBe(60);
  });

  it("returns zero when either player has zero chips", () => {
    expect(
      calculateHeadToHeadBet({
        player1Balance: 0,
        player2Balance: 100,
        fixedBetAmount: 100,
      }),
    ).toBe(0);
  });

  it("returns the fixed bet when it is smaller than both balances", () => {
    expect(
      calculateHeadToHeadBet({
        player1Balance: 30,
        player2Balance: 40,
        fixedBetAmount: 20,
      }),
    ).toBe(20);
  });
});

describe("calculateStaffMatchBet", () => {
  it("returns the fixed bet when the participant can cover it", () => {
    expect(
      calculateStaffMatchBet({
        playerBalance: 100,
        fixedBetAmount: 40,
      }),
    ).toBe(40);
  });

  it("returns the participant balance when they are all-in", () => {
    expect(
      calculateStaffMatchBet({
        playerBalance: 25,
        fixedBetAmount: 40,
      }),
    ).toBe(25);
  });

  it("returns zero when the participant has zero chips", () => {
    expect(
      calculateStaffMatchBet({
        playerBalance: 0,
        fixedBetAmount: 40,
      }),
    ).toBe(0);
  });
});

describe("calculateHeadToHeadPayout", () => {
  it("returns zero deltas when the agreed bet is zero", () => {
    expect(
      calculateHeadToHeadPayout({
        actualBetAmount: 0,
      }),
    ).toEqual({
      winnerDelta: 0,
      loserDelta: 0,
    });
  });

  it("awards double the actual bet to the winner with no loser payout", () => {
    expect(
      calculateHeadToHeadPayout({
        actualBetAmount: 35,
      }),
    ).toEqual({
      winnerDelta: 70,
      loserDelta: 0,
    });
  });
});

describe("calculateStaffMatchPayout", () => {
  it("returns the actual bet when the participant wins", () => {
    expect(
      calculateStaffMatchPayout({
        actualBetAmount: 40,
        playerWon: true,
      }),
    ).toBe(40);
  });

  it("returns zero when the participant loses", () => {
    expect(
      calculateStaffMatchPayout({
        actualBetAmount: 40,
        playerWon: false,
      }),
    ).toBe(0);
  });

  it("returns zero for a zero bet regardless of match outcome", () => {
    expect(
      calculateStaffMatchPayout({
        actualBetAmount: 0,
        playerWon: true,
      }),
    ).toBe(0);

    expect(
      calculateStaffMatchPayout({
        actualBetAmount: 0,
        playerWon: false,
      }),
    ).toBe(0);
  });
});

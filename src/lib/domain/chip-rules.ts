type HeadToHeadBetParams = {
  player1Balance: number;
  player2Balance: number;
  fixedBetAmount: number;
};

type StaffMatchBetParams = {
  playerBalance: number;
  fixedBetAmount: number;
};

type HeadToHeadPayoutParams = {
  actualBetAmount: number;
};

type StaffMatchPayoutParams = {
  actualBetAmount: number;
  playerWon: boolean;
};

export function calculateHeadToHeadBet({
  player1Balance,
  player2Balance,
  fixedBetAmount,
}: HeadToHeadBetParams): number {
  return Math.min(player1Balance, player2Balance, fixedBetAmount);
}

export function calculateStaffMatchBet({
  playerBalance,
  fixedBetAmount,
}: StaffMatchBetParams): number {
  return Math.min(playerBalance, fixedBetAmount);
}

export function calculateHeadToHeadPayout({ actualBetAmount }: HeadToHeadPayoutParams): {
  winnerDelta: number;
  loserDelta: number;
} {
  return {
    winnerDelta: actualBetAmount * 2,
    loserDelta: 0,
  };
}

export function calculateStaffMatchPayout({
  actualBetAmount,
  playerWon,
}: StaffMatchPayoutParams): number {
  return playerWon ? actualBetAmount : 0;
}

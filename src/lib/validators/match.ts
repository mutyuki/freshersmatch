import { z } from "zod";

const matchIdBodySchema = z
  .object({
    matchId: z.string(),
  })
  .strict();

export const readyMatchSchema = matchIdBodySchema;

export type ReadyMatchInput = z.infer<typeof readyMatchSchema>;

export const cancelMatchBeforeStartSchema = matchIdBodySchema;

export type CancelMatchBeforeStartInput = z.infer<typeof cancelMatchBeforeStartSchema>;

export const claimMatchWinSchema = matchIdBodySchema;

export type ClaimMatchWinInput = z.infer<typeof claimMatchWinSchema>;

export const cancelClaimMatchWinSchema = matchIdBodySchema;

export type CancelClaimMatchWinInput = z.infer<typeof cancelClaimMatchWinSchema>;

export const approveMatchResultSchema = z
  .object({
    matchId: z.string(),
    approve: z.boolean(),
  })
  .strict();

export type ApproveMatchResultInput = z.infer<typeof approveMatchResultSchema>;

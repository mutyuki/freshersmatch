import { z } from "zod";

const emptyBodySchema = z.object({}).strict();

export const registerParticipantSchema = z
  .object({
    venueCode: z.string(),
    nickname: z.string(),
  })
  .strict();

export type RegisterParticipantInput = z.infer<typeof registerParticipantSchema>;

export const restoreParticipantSessionSchema = z
  .object({
    sessionToken: z.string(),
  })
  .strict();

export type RestoreParticipantSessionInput = z.infer<typeof restoreParticipantSessionSchema>;

export const startMatchingSchema = emptyBodySchema;

export type StartMatchingInput = z.infer<typeof startMatchingSchema>;

export const cancelMatchingSchema = emptyBodySchema;

export type CancelMatchingInput = z.infer<typeof cancelMatchingSchema>;

export const acknowledgeResultSchema = emptyBodySchema;

export type AcknowledgeResultInput = z.infer<typeof acknowledgeResultSchema>;

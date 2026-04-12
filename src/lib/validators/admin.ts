import { z } from "zod";

const emptyBodySchema = z.object({}).strict();

const confirmTableActionSchema = z
  .object({
    tableId: z.string().trim().min(1),
    confirm: z.boolean(),
  })
  .strict();

const confirmParticipantActionSchema = z
  .object({
    participantId: z.string().trim().min(1),
    confirm: z.boolean(),
  })
  .strict();

export const adminLoginSchema = z
  .object({
    passcode: z.string(),
  })
  .strict();

export type AdminLoginInput = z.infer<typeof adminLoginSchema>;

export const adminForceReleaseTableSchema = confirmTableActionSchema;

export type AdminForceReleaseTableInput = z.infer<typeof adminForceReleaseTableSchema>;

export const adminHoldTableSchema = confirmTableActionSchema;

export type AdminHoldTableInput = z.infer<typeof adminHoldTableSchema>;

export const adminReleaseTableHoldSchema = confirmTableActionSchema;

export type AdminReleaseTableHoldInput = z.infer<typeof adminReleaseTableHoldSchema>;

export const adminResolveMatchSchema = z.discriminatedUnion("resolutionType", [
  z
    .object({
      matchId: z.string(),
      resolutionType: z.literal("void"),
      confirm: z.boolean(),
    })
    .strict(),
  z
    .object({
      matchId: z.string(),
      resolutionType: z.literal("winner"),
      winnerParticipantId: z.string(),
      confirm: z.boolean(),
    })
    .strict(),
]);

export type AdminResolveMatchInput = z.infer<typeof adminResolveMatchSchema>;

export const adminAdjustParticipantChipSchema = z
  .object({
    participantId: z.string().trim().min(1),
    delta: z.number().int(),
    reason: z.string().trim().min(1),
    confirm: z.boolean(),
  })
  .strict();

export type AdminAdjustParticipantChipInput = z.infer<typeof adminAdjustParticipantChipSchema>;

export const adminPauseParticipantSchema = confirmParticipantActionSchema;

export type AdminPauseParticipantInput = z.infer<typeof adminPauseParticipantSchema>;

export const adminUnpauseParticipantSchema = confirmParticipantActionSchema;

export type AdminUnpauseParticipantInput = z.infer<typeof adminUnpauseParticipantSchema>;

export const adminDisqualifyParticipantSchema = z
  .object({
    participantId: z.string().trim().min(1),
    mode: z.enum(["void_current_match", "lose_current_match"]),
    reason: z.string().trim().min(1),
    confirm: z.boolean(),
  })
  .strict();

export type AdminDisqualifyParticipantInput = z.infer<typeof adminDisqualifyParticipantSchema>;

export const adminStartStaffMatchSchema = z
  .object({
    participantId: z.string(),
    tableId: z.string().optional(),
    confirm: z.boolean(),
  })
  .strict();

export type AdminStartStaffMatchInput = z.infer<typeof adminStartStaffMatchSchema>;

export const adminResolveStaffMatchSchema = z
  .object({
    matchId: z.string(),
    participantWon: z.boolean(),
    confirm: z.boolean(),
  })
  .strict();

export type AdminResolveStaffMatchInput = z.infer<typeof adminResolveStaffMatchSchema>;

export const adminLogoutSchema = emptyBodySchema;

export type AdminLogoutInput = z.infer<typeof adminLogoutSchema>;

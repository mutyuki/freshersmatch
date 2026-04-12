import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

export const PARTICIPANT_RUNTIME_UPDATED_EVENT = "freshers-match:participant-runtime-updated";

export function dispatchParticipantRuntimeUpdated(runtime: ParticipantRuntimeState): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<ParticipantRuntimeState>(PARTICIPANT_RUNTIME_UPDATED_EVENT, {
      detail: runtime,
    }),
  );
}

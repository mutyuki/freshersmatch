import type { ParticipantRuntimeState } from "@/lib/contracts/participant-runtime";

const MATCH_ROUTE_STATUSES = new Set<ParticipantRuntimeState["status"]>([
  "queueing",
  "match_reserved",
  "ready",
  "playing",
  "claiming_win",
  "awaiting_result_approval",
  "result_confirmed",
]);

export function getPreferredParticipantRoute(
  status: ParticipantRuntimeState["status"],
  lastNonDisconnectStatus: ParticipantRuntimeState["lastNonDisconnectStatus"],
): "/home" | "/match" {
  const resolvedStatus =
    status === "disconnected" ? (lastNonDisconnectStatus ?? "registered") : status;

  if (MATCH_ROUTE_STATUSES.has(resolvedStatus)) {
    return "/match";
  }

  return "/home";
}

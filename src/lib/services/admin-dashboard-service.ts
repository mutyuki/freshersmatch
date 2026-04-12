import type { AdminDashboardData } from "@/lib/contracts/admin-dashboard";
import { getSupabaseAdminClient } from "@/lib/db/server";
import type { Database } from "@/lib/db/types";
import { AppError } from "@/lib/domain/errors";
import { normalizeParticipantConnectionState } from "@/lib/services/connection-state-service";

type EventRow = Database["public"]["Tables"]["events"]["Row"];
type ParticipantRow = Database["public"]["Tables"]["participants"]["Row"];
type TableRow = Database["public"]["Tables"]["tables"]["Row"];
type MatchRow = Database["public"]["Tables"]["matches"]["Row"];
type AdminUserRow = Database["public"]["Tables"]["admin_users"]["Row"];

type QueryResult<TData> = Promise<{
  data: TData;
  error: { message: string } | null;
}>;

type TableSelectQuery<TRow> = {
  eq(column: string, value: string): TableSelectQuery<TRow>;
  in(column: string, values: string[]): TableSelectQuery<TRow>;
  order(
    column: string,
    options?: {
      ascending?: boolean;
      nullsFirst?: boolean;
    },
  ): TableSelectQuery<TRow>;
  maybeSingle(): QueryResult<TRow | null>;
  limit(count: number): QueryResult<TRow[] | null>;
};

type TableQuery<TRow> = {
  select(columns: string): TableSelectQuery<TRow>;
};

type AdminDashboardSupabaseClient = {
  from(table: "events"): TableQuery<EventRow>;
  from(table: "participants"): TableQuery<ParticipantRow>;
  from(table: "tables"): TableQuery<TableRow>;
  from(table: "matches"): TableQuery<MatchRow>;
  from(table: "admin_users"): TableQuery<AdminUserRow>;
};

const IN_PROGRESS_MATCH_STATUSES = new Set<MatchRow["status"]>([
  "reserved",
  "awaiting_ready",
  "in_progress",
  "winner_claimed",
]);

function getAdminDashboardSupabaseClient(): AdminDashboardSupabaseClient {
  return getSupabaseAdminClient() as unknown as AdminDashboardSupabaseClient;
}

export async function getActiveEventId(): Promise<string> {
  const events = getAdminDashboardSupabaseClient().from("events");
  const { data, error } = await events.select("*").eq("status", "active").maybeSingle();

  if (error) {
    throw new AppError("active_event_lookup_failed", "Failed to load active event.", 500);
  }

  if (!data) {
    throw new AppError("active_event_not_found", "Active event was not found.", 404);
  }

  return data.id;
}

async function fetchParticipants(eventId: string): Promise<ParticipantRow[]> {
  const participants = getAdminDashboardSupabaseClient().from("participants");
  const { data, error } = await participants
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true })
    .limit(1000);

  if (error) {
    throw new AppError("participant_lookup_failed", "Failed to load participants.", 500);
  }

  return data ?? [];
}

async function fetchEventById(eventId: string): Promise<EventRow> {
  const events = getAdminDashboardSupabaseClient().from("events");
  const { data, error } = await events.select("*").eq("id", eventId).maybeSingle();

  if (error) {
    throw new AppError("event_lookup_failed", "Failed to load event.", 500);
  }

  if (!data) {
    throw new AppError("event_not_found", "Event was not found.", 404);
  }

  return data;
}

async function fetchTables(eventId: string): Promise<TableRow[]> {
  const tables = getAdminDashboardSupabaseClient().from("tables");
  const { data, error } = await tables
    .select("*")
    .eq("event_id", eventId)
    .order("table_number", { ascending: true })
    .limit(100);

  if (error) {
    throw new AppError("table_lookup_failed", "Failed to load tables.", 500);
  }

  return data ?? [];
}

async function fetchMatches(eventId: string): Promise<MatchRow[]> {
  const matches = getAdminDashboardSupabaseClient().from("matches");
  const { data, error } = await matches
    .select("*")
    .eq("event_id", eventId)
    .order("created_at", { ascending: false })
    .limit(1000);

  if (error) {
    throw new AppError("match_lookup_failed", "Failed to load matches.", 500);
  }

  return data ?? [];
}

async function fetchAdminUsers(adminUserIds: string[]): Promise<Map<string, AdminUserRow>> {
  if (adminUserIds.length === 0) {
    return new Map();
  }

  const adminUsers = getAdminDashboardSupabaseClient().from("admin_users");
  const { data, error } = await adminUsers.select("*").in("id", adminUserIds).limit(1000);

  if (error) {
    throw new AppError("admin_user_lookup_failed", "Failed to load admin users.", 500);
  }

  return new Map((data ?? []).map((user) => [user.id, user]));
}

function getMatchParticipantNickname(
  participantsById: Map<string, ParticipantRow>,
  participantId: string | null,
): string | null {
  if (!participantId) {
    return null;
  }

  return participantsById.get(participantId)?.nickname ?? null;
}

export async function getAdminDashboardData(eventId: string): Promise<AdminDashboardData> {
  const event = await fetchEventById(eventId);
  const initialParticipants = await fetchParticipants(eventId);

  for (const participant of initialParticipants) {
    await normalizeParticipantConnectionState({
      participantId: participant.id,
      now: new Date(),
    });
  }

  const [participants, tables, matches] = await Promise.all([
    fetchParticipants(eventId),
    fetchTables(eventId),
    fetchMatches(eventId),
  ]);

  const participantsById = new Map(
    participants.map((participant) => [participant.id, participant]),
  );
  const matchesById = new Map(matches.map((match) => [match.id, match]));
  const adminUsersById = await fetchAdminUsers(
    tables
      .map((table) => table.held_by_admin_user_id)
      .filter((adminUserId): adminUserId is string => typeof adminUserId === "string"),
  );
  const stalledThreshold = new Date(Date.now() - 120_000).toISOString();
  const staffCandidateThreshold = Date.now() - event.staff_match_wait_seconds * 1000;

  return {
    eventId,
    tables: tables.map((table) => {
      const match = table.current_match_id
        ? (matchesById.get(table.current_match_id) ?? null)
        : null;
      const occupantNicknames =
        match === null
          ? []
          : [match.player1_participant_id, match.player2_participant_id]
              .map((participantId) => getMatchParticipantNickname(participantsById, participantId))
              .filter((nickname): nickname is string => typeof nickname === "string");

      return {
        tableId: table.id,
        tableNumber: table.table_number,
        gameTitle: table.game_title,
        status: table.status,
        currentMatchId: table.current_match_id,
        occupantNicknames,
        heldByAdminDisplayName: table.held_by_admin_user_id
          ? (adminUsersById.get(table.held_by_admin_user_id)?.display_name ?? null)
          : null,
      };
    }),
    queueingParticipants: participants
      .filter((participant) => participant.status === "queueing")
      .sort((left, right) => (left.queued_at ?? "").localeCompare(right.queued_at ?? ""))
      .map((participant) => {
        const queuedAt = participant.queued_at ?? participant.created_at;

        return {
          participantId: participant.id,
          nickname: participant.nickname,
          queuedAt,
          chipBalance: participant.chip_balance,
          isStaffMatchCandidate: new Date(queuedAt).getTime() <= staffCandidateThreshold,
        };
      }),
    inProgressMatches: matches
      .filter((match) => IN_PROGRESS_MATCH_STATUSES.has(match.status))
      .map((match) => ({
        matchId: match.id,
        tableId: match.table_id,
        tableNumber: tables.find((table) => table.id === match.table_id)?.table_number ?? null,
        displayStatus: match.status,
        participant1Id: match.player1_participant_id,
        participant1Nickname:
          getMatchParticipantNickname(participantsById, match.player1_participant_id) ?? "Unknown",
        participant2Nickname: getMatchParticipantNickname(
          participantsById,
          match.player2_participant_id,
        ),
        isStaffMatch: match.is_staff_match,
        startedAt: match.started_at,
      })),
    disconnectedParticipants: participants
      .filter((participant) => participant.status === "disconnected")
      .map((participant) => ({
        participantId: participant.id,
        nickname: participant.nickname,
        lastNonDisconnectStatus: participant.last_non_disconnect_status,
        lastSeenAt: participant.last_seen_at,
      })),
    disputedMatches: matches
      .filter((match) => match.dispute_count > 0)
      .map((match) => ({
        matchId: match.id,
        tableNumber: tables.find((table) => table.id === match.table_id)?.table_number ?? null,
        disputeCount: match.dispute_count,
        lastDisputedAt: match.last_disputed_at,
      })),
    stalledMatches: matches
      .filter((match) => match.status === "winner_claimed" && !!match.winner_claimed_at)
      .filter((match) => (match.winner_claimed_at ?? "") <= stalledThreshold)
      .map((match) => ({
        matchId: match.id,
        tableNumber: tables.find((table) => table.id === match.table_id)?.table_number ?? null,
        status: match.status,
        winnerClaimedAt: match.winner_claimed_at,
        startedAt: match.started_at,
        participant1Nickname:
          getMatchParticipantNickname(participantsById, match.player1_participant_id) ?? "Unknown",
        participant2Nickname: getMatchParticipantNickname(
          participantsById,
          match.player2_participant_id,
        ),
      })),
  };
}

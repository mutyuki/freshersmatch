export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type EventStatus = "draft" | "active" | "closed";
export type ParticipantStatus =
  | "unregistered"
  | "registered"
  | "queueing"
  | "match_reserved"
  | "ready"
  | "playing"
  | "claiming_win"
  | "awaiting_result_approval"
  | "result_confirmed"
  | "paused"
  | "disqualified"
  | "disconnected";
export type TableStatus = "available" | "reserved" | "in_use" | "admin_hold";
export type MatchStatus =
  | "reserved"
  | "awaiting_ready"
  | "in_progress"
  | "winner_claimed"
  | "completed"
  | "cancelled_before_start"
  | "voided_by_admin"
  | "force_finished_by_admin";
export type ChipLedgerReason = "match_bet" | "match_payout" | "admin_adjustment" | "rollback";
export type AdminRole = "staff" | "admin";

export interface Database {
  public: {
    Tables: {
      events: {
        Row: {
          id: string;
          name: string;
          venue_code: string;
          fixed_bet_amount: number;
          staff_match_wait_seconds: number;
          disconnect_threshold_seconds: number;
          status: EventStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          venue_code: string;
          fixed_bet_amount: number;
          staff_match_wait_seconds?: number;
          disconnect_threshold_seconds?: number;
          status?: EventStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["events"]["Insert"]>;
      };
      participants: {
        Row: {
          id: string;
          event_id: string;
          nickname: string;
          status: ParticipantStatus;
          last_non_disconnect_status: ParticipantStatus | null;
          chip_balance: number;
          current_match_id: string | null;
          last_opponent_participant_id: string | null;
          queued_at: string | null;
          last_seen_at: string;
          is_paused: boolean;
          is_disqualified: boolean;
          disqualified_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          nickname: string;
          status?: ParticipantStatus;
          last_non_disconnect_status?: ParticipantStatus | null;
          chip_balance?: number;
          current_match_id?: string | null;
          last_opponent_participant_id?: string | null;
          queued_at?: string | null;
          last_seen_at?: string;
          is_paused?: boolean;
          is_disqualified?: boolean;
          disqualified_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["participants"]["Insert"]>;
      };
      participant_sessions: {
        Row: {
          id: string;
          participant_id: string;
          session_token_hash: string;
          is_active: boolean;
          issued_at: string;
          invalidated_at: string | null;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          participant_id: string;
          session_token_hash: string;
          is_active?: boolean;
          issued_at?: string;
          invalidated_at?: string | null;
          last_seen_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["participant_sessions"]["Insert"]>;
      };
      tables: {
        Row: {
          id: string;
          event_id: string;
          table_number: number;
          game_title: string;
          status: TableStatus;
          current_match_id: string | null;
          held_by_admin_user_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          table_number: number;
          game_title: string;
          status?: TableStatus;
          current_match_id?: string | null;
          held_by_admin_user_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["tables"]["Insert"]>;
      };
      matches: {
        Row: {
          id: string;
          event_id: string;
          table_id: string;
          player1_participant_id: string;
          player2_participant_id: string | null;
          status: MatchStatus;
          is_staff_match: boolean;
          staff_operator_id: string | null;
          player1_ready_at: string | null;
          player2_ready_at: string | null;
          agreed_bet_amount: number | null;
          winner_participant_id: string | null;
          winner_claimed_by_participant_id: string | null;
          winner_claimed_at: string | null;
          completed_at: string | null;
          cancelled_by_participant_id: string | null;
          void_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          table_id: string;
          player1_participant_id: string;
          player2_participant_id?: string | null;
          status?: MatchStatus;
          is_staff_match?: boolean;
          staff_operator_id?: string | null;
          player1_ready_at?: string | null;
          player2_ready_at?: string | null;
          agreed_bet_amount?: number | null;
          winner_participant_id?: string | null;
          winner_claimed_by_participant_id?: string | null;
          winner_claimed_at?: string | null;
          completed_at?: string | null;
          cancelled_by_participant_id?: string | null;
          void_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["matches"]["Insert"]>;
      };
      chip_ledger: {
        Row: {
          id: string;
          event_id: string;
          participant_id: string;
          match_id: string | null;
          delta: number;
          reason: ChipLedgerReason;
          balance_after: number;
          created_by_admin_user_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          event_id: string;
          participant_id: string;
          match_id?: string | null;
          delta: number;
          reason: ChipLedgerReason;
          balance_after: number;
          created_by_admin_user_id?: string | null;
          created_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["chip_ledger"]["Insert"]>;
      };
      admin_users: {
        Row: {
          id: string;
          display_name: string;
          passcode_hash: string;
          role: AdminRole;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          display_name: string;
          passcode_hash: string;
          role?: AdminRole;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database["public"]["Tables"]["admin_users"]["Insert"]>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

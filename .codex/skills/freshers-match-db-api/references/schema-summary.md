# Schema Summary

## Core tables

- `events`
- `participants`
- `participant_sessions`
- `tables`
- `matches`
- `chip_ledger`
- `admin_users`

## Important columns

### participants

- `status`
- `chip_balance`
- `current_match_id`
- `last_opponent_participant_id`
- `queued_at`
- `last_seen_at`

### tables

- `table_number`
- `game_title`
- `status`
- `current_match_id`

### matches

- `table_id`
- `player1_participant_id`
- `player2_participant_id`
- `status`
- `is_staff_match`
- `agreed_bet_amount`
- `winner_participant_id`
- `winner_claimed_by_participant_id`

### chip_ledger

- `participant_id`
- `match_id`
- `delta`
- `reason`
- `balance_after`

## Key invariants

- participant nickname is unique per event
- one active participant session per participant
- one current match per participant
- one current match per table
- chip ledger is append-only

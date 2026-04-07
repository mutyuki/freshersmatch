---
name: freshers-match-match-flow
description: Use when implementing participant status transitions, table transitions, match lifecycle, chip deduction and payout rules, matching logic, or realtime updates for the freshman welcome 1v1 matching app.
---

# Freshers Match Match Flow

Use this for core game-room coordination logic.

## Read First

- `/Users/kitamurareiki/develop/match/docs/design/01-state-and-realtime.md`
- `/Users/kitamurareiki/develop/match/docs/design/02-data-model-and-api.md`
- `/Users/kitamurareiki/develop/match/docs/design/03-admin-ops-and-failures.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/03-match-flow-tasks.md`

## Canonical State Machines

You must preserve the defined participant, table, and match states.

Never invent alternate lifecycle states in the UI or DB unless the user asks.

## Matching Rules

1. human-vs-human first
2. random opponent selection
3. avoid only the immediate last opponent when possible
4. if candidates are too few, ignore that avoidance rule
5. only 5 fixed tables
6. if no table is free, keep queueing
7. staff match is allowed only after waiting past threshold
8. once staff match is fixed, do not replace it

## Bet Rules

- fixed bet configured on event
- compute on the server only
- all-in when balance is below fixed bet
- use the smaller stack
- no side pots

## Result Rules

- winner claim moves to `winner_claimed`
- approval completes the match
- rejection returns to `in_progress`
- chip ledger updates happen only on completion or admin-forced resolution

## Realtime Rules

Use realtime only to refresh server-backed state.

Do not design custom multiplayer event protocols if DB-change subscriptions are enough.

Realtime should cover:

- match fixed
- ready state changes
- result claim arrival
- result completion
- ranking updates
- admin-repaired state changes

## Race Condition Checklist

Before finishing a match-flow change, check:

1. double-ready race
2. cancel vs ready race
3. simultaneous winner-claim attempts
4. approval vs admin repair race
5. table release consistency

## Definition of Done

A match-flow task is not done until:

1. state transition rules are explicit
2. server-side recomputation is used for chips
3. a regression test exists for the critical path
4. race-sensitive paths return deterministic errors

---
name: freshers-match-testing
description: Use when writing or updating tests for the freshman welcome matching app. Covers TDD order, unit vs integration vs E2E boundaries, and the critical regressions that must stay locked down.
---

# Freshers Match Testing

Use this when adding or changing tests.

## Read First

- `/Users/kitamurareiki/develop/match/docs/design/03-admin-ops-and-failures.md`
- `/Users/kitamurareiki/develop/match/docs/design/04-implementation-plan.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/04-admin-and-quality-tasks.md`

## Testing Order

1. unit tests for pure rules
2. integration tests for service and API behavior
3. E2E only for thin high-value flows

## Unit Test Targets

- bet calculation
- staff match bet calculation
- payout calculation
- disconnect threshold logic
- state transition guards
- opponent selection heuristics

## Integration Test Targets

- participant registration
- single-session replacement
- queue start and cancel
- match creation with table reservation
- ready flow leading to chip deduction
- result approval leading to chip payout
- rejection returning to in-progress
- admin repair actions
- staff match creation and completion
- disqualified participant rejection
- paused participant rejection
- table shortage with no accidental match creation
- reconnect restore behavior
- winner-claim double-submit handling
- approve-after-resolution rejection

## E2E Targets

- two participants complete a match
- admin resolves a stuck match
- reconnect returns the user to the correct screen
- result rejection returns the user to live play

## Regression Cases That Matter Most

1. duplicate nickname rejected
2. old session invalid after new login
3. ready/cancel race does not corrupt state
4. simultaneous winner claims do not double-complete
5. chip ledger is append-only and final balances match
6. disqualified users cannot re-enter matching

## Test Writing Rules

- prefer deterministic fixtures
- assert status fields explicitly
- assert chip balances explicitly
- assert table occupancy explicitly
- include one unhappy path per major feature
- assert ledger side effects for every chip-changing flow
- assert no ledger side effects for cancel / reject / void paths where chips must not move
- assert both HTTP response and persisted state for API tests
- treat race-sensitive flows as first-class tests, not optional polish

## Finish Checklist

After a testing-related task, run:

1. `pnpm format`
2. `pnpm lint`
3. `pnpm typecheck`
4. `pnpm test`

If browser flows changed, also run:

1. `pnpm test:e2e`

## Definition of Done

A testing task is not done until:

1. the test would have failed before the change
2. the assertion names explain the business behavior
3. critical status and chip outcomes are asserted directly
4. no major requirement is left without an assigned verification layer

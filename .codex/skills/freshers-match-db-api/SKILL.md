---
name: freshers-match-db-api
description: Use when creating or changing the database schema, Supabase queries, service layer, route handlers, validators, or transaction logic for the freshman welcome matching app. Covers exact table ownership, service boundaries, and API conventions.
---

# Freshers Match DB / API

Use this skill for schema, service, and route work.

## Read First

- `/Users/kitamurareiki/develop/match/docs/design/02-data-model-and-api.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/01-foundation-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/02-participant-flow-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/03-match-flow-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/04-admin-and-quality-tasks.md`

## File Ownership

- `src/lib/db/*`: Supabase clients and generated DB types
- `src/lib/validators/*`: zod schemas only
- `src/lib/services/*`: all DB reads and writes
- `src/app/api/**/route.ts`: validate -> auth -> call service -> return JSON

## Route Rules

Every route should:

1. Parse request body or query
2. Validate with zod
3. Resolve session
4. Call one service function
5. Return structured JSON

Do not put business logic directly in route handlers.

## Transaction Rules

Keep these transactional:

1. participant register + old session invalidation
2. queue start leading to match creation
3. ready flow leading to bet deduction
4. result approval leading to ledger updates
5. admin repair operations

## Data Rules

- `participants.current_match_id` must remain single-valued
- `tables.current_match_id` must match actual occupancy
- `matches.agreed_bet_amount` is computed server-side
- `chip_ledger` is append-only
- never trust a client-provided chip amount

## API Naming Rules

- use `executeXxx` for service entry points that mutate state
- use `getXxx` or `listXxx` for reads
- keep one endpoint per use case

## Error Rules

Use domain/application errors, not raw strings.

Prefer:

- `400` invalid input
- `401` invalid session
- `403` admin-only or forbidden
- `404` missing entity
- `409` invalid state transition or race

## Done Criteria

A DB/API task is not done until:

1. service logic exists
2. route is thin
3. happy path test exists
4. at least one important failure case is covered

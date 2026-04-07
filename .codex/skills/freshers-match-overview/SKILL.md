---
name: freshers-match-overview
description: Use when working on the freshman welcome 1v1 card-game matching web app in this repository. Applies the fixed product constraints, document map, architecture boundaries, implementation order, and no-scope-creep rules before coding or planning.
---

# Freshers Match Overview

Use this skill first when the task is broad, ambiguous, or spans multiple layers.

## Goal

Keep implementation aligned with the fixed MVP described in:

- `/Users/kitamurareiki/develop/match/docs/design/00-requirements-and-mvp.md`
- `/Users/kitamurareiki/develop/match/docs/design/01-state-and-realtime.md`
- `/Users/kitamurareiki/develop/match/docs/design/02-data-model-and-api.md`
- `/Users/kitamurareiki/develop/match/docs/design/03-admin-ops-and-failures.md`
- `/Users/kitamurareiki/develop/match/docs/design/04-implementation-plan.md`

For implementation slicing, load:

- `/Users/kitamurareiki/develop/match/docs/tasks/01-foundation-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/02-participant-flow-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/03-match-flow-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/04-admin-and-quality-tasks.md`

## Hard Rules

1. Do not change product requirements unless the user explicitly changes them.
2. Treat the server state as the source of truth.
3. Keep participant UI mobile-first.
4. Keep admin UI desktop-first.
5. Prefer simple, explicit state transitions over clever abstractions.
6. Keep MVP scope narrow. Push optional ideas out unless asked.

## Canonical Product Shape

- Participants join by QR -> venue code -> unique nickname.
- Matching is random, human-first, with only the last opponent avoided when possible.
- Tables are fixed at 5.
- Bet is fixed and computed on the server.
- The game itself is physical; the app only manages coordination and official chip records.
- Result flow is winner claim -> loser approve or reject.
- Reject returns the match to in-progress.
- Admin can always manually recover stuck states.

## Architecture Defaults

- Next.js App Router
- TypeScript strict mode
- Supabase + PostgreSQL
- Supabase Realtime for live updates
- Thin API routes
- Service layer owns mutations
- Domain layer owns pure rules

## UI Reference

Use `/Users/kitamurareiki/develop/match/layout.pen` as the baseline visual direction.

Do not copy it blindly. During implementation:

- preserve its screen intent and information hierarchy
- improve spacing, readability, and responsiveness
- keep participant screens touch-friendly
- keep admin screens information-dense but clean

## Before You Start Coding

Answer these quickly:

1. Which task ID from `docs/tasks` am I implementing?
2. Which files should change?
3. Which service owns the state mutation?
4. Which tests should be added first?

If any answer is unclear, read the relevant task doc before editing.

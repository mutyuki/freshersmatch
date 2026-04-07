---
name: freshers-match-participant-ui
description: Use when building or refining participant-facing screens for the freshman welcome matching app. Optimized for smartphone-first web UI, based on layout.pen, with clear action hierarchy for join, queue, match, result, ranking, and reconnect states.
---

# Freshers Match Participant UI

Use this for participant pages and components.

## Read First

- `/Users/kitamurareiki/develop/match/layout.pen`
- `/Users/kitamurareiki/develop/match/docs/design/00-requirements-and-mvp.md`
- `/Users/kitamurareiki/develop/match/docs/design/01-state-and-realtime.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/02-participant-flow-tasks.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/03-match-flow-tasks.md`

## Screen Set

Participant UI includes:

1. Join
2. Home
3. Queue
4. Match Reserved
5. In Progress
6. Claim Waiting
7. Result Approval
8. Result Confirmed
9. Ranking
10. Reconnect

## Layout Rules

- mobile-first only
- optimize for 320px to 430px widths
- use a single dominant column
- show only the information needed for the current state
- primary action must be obvious without hunting
- prefer large stacked cards over dense mini-panels

## Style Rules

Use `layout.pen` as the starting direction:

- warm neutral background
- editorial heading feel
- clean touch-friendly cards
- no generic SaaS blue/purple defaults

But improve during implementation:

- tighten spacing where text feels loose
- increase contrast if readability slips
- standardize button heights and card rhythm
- simplify copy where scanning is slow

## Component Rules

Put participant-specific components in:

- `src/components/participant/*`

Likely pieces:

- shell
- status badge
- join form
- home panel
- queue panel
- match reserved panel
- in progress panel
- result approval panel
- result confirmed panel

## State-to-UI Rule

UI must be driven by `participant.status`.

Do not infer UI mode from URL alone. The restored runtime state decides what to render.

## Interaction Rules

- disable buttons while requests are in flight
- show clear pending text for asynchronous actions
- do not allow client-side state to outrun server-confirmed state
- result approval and rejection must be visually distinct

## Definition of Done

A participant UI task is not done until:

1. it works on narrow mobile widths
2. the primary action is obvious
3. the server state can refresh into the same screen
4. copy matches the current state exactly

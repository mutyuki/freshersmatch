---
name: freshers-match-admin-ui
description: Use when building the operator-facing admin and monitor interfaces for the freshman welcome matching app. Covers desktop-first dashboard layout, recovery actions, participant control, table control, and ranking monitor views.
---

# Freshers Match Admin UI

Use this for admin and monitor surfaces.

## Read First

- `/Users/kitamurareiki/develop/match/layout.pen`
- `/Users/kitamurareiki/develop/match/docs/design/03-admin-ops-and-failures.md`
- `/Users/kitamurareiki/develop/match/docs/design/04-implementation-plan.md`
- `/Users/kitamurareiki/develop/match/docs/tasks/04-admin-and-quality-tasks.md`

## Screen Set

1. Admin Login
2. Admin Dashboard
3. Participants
4. Matches
5. Tables
6. Monitor Ranking

## Layout Rules

- desktop-first
- design for 1280px and above
- prioritize simultaneous visibility over minimalism
- use panels, tables, and dialogs
- keep key recovery actions one click away from the relevant entity

## Style Rules

Follow `layout.pen` for the baseline tone, then improve:

- stronger hierarchy in the dashboard header
- clearer separation between summary cards and operational tables
- more obvious destructive vs non-destructive actions
- denser but still readable table-like layouts

## Operator Goals

Admin UI exists to recover the room fast.

It must make these actions easy:

- force release a table
- repair a match outcome
- adjust chips
- pause a participant
- disqualify a participant
- start a staff match

## Interaction Rules

- every destructive action requires confirmation
- show affected entity name, table number, and current state before confirming
- after mutation, refresh the relevant panels immediately
- never hide the current system state before an action runs

## Monitor Screen Rule

The monitor ranking page is not an admin tool. It is a display surface.

- no editing controls
- large typography
- readable from a distance

## Definition of Done

An admin UI task is not done until:

1. it works at desktop width cleanly
2. the affected entity is obvious before action
3. destructive actions are confirmed
4. post-action state refresh is clear

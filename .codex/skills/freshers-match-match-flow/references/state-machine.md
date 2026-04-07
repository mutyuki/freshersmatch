# State Machine Summary

## Participant states

- `registered`
- `queueing`
- `match_reserved`
- `ready`
- `playing`
- `claiming_win`
- `awaiting_result_approval`
- `result_confirmed`
- `paused`
- `disqualified`
- `disconnected`

## Table states

- `available`
- `reserved`
- `in_use`
- `admin_hold`

## Match states

- `reserved`
- `awaiting_ready`
- `in_progress`
- `winner_claimed`
- `completed`
- `cancelled_before_start`
- `voided_by_admin`
- `force_finished_by_admin`

## Critical rules

- bet deduction happens only on start completion
- payout happens only on completion
- reject resets winner claim and returns to in-progress
- cancel before start does not touch chips

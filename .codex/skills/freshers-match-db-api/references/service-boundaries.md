# Service Boundaries

## participant-service

Owns:

- registration
- session restore
- participant runtime state lookup
- heartbeat updates

## matching-service

Owns:

- queue start
- queue cancel
- opponent selection
- table reservation
- match creation

## match-service

Owns:

- ready/start flow
- before-start cancel
- winner claim
- result approval/rejection
- ledger updates on completion

## ranking-service

Owns:

- participant ranking reads

## admin services

Own:

- admin auth
- dashboard queries
- participant admin operations
- match/table repair
- staff match start

## Route rule

Route handlers should never duplicate business rules that belong in services.

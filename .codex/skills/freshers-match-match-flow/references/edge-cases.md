# Edge Cases

Test and think about these whenever changing match flow:

1. new login invalidates old session
2. queue start while already queueing
3. no free tables
4. ready pressed twice
5. cancel and ready racing each other
6. simultaneous win claims
7. approval after admin resolution
8. disconnect during reserved state
9. disconnect during in-progress state
10. staff match fixed and later human candidate appears

## Recovery principle

If automation gets messy, admin must be able to repair the room manually.

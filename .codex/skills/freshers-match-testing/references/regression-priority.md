# Regression Priority

## Highest priority regressions

1. duplicate nickname can slip through
2. old session still works after relogin
3. table remains reserved after cancel
4. double payout on repeated approval
5. chip balances diverge from ledger
6. disqualified participant can queue again

## Assertion rule

Do not stop at HTTP status assertions. Also assert:

- participant status
- match status
- table status
- chip balances
- ledger row count or delta shape

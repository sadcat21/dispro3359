---
name: Peer cash handover mirror expense
description: Peer-handover (تسليم لزميل) writes two `expenses` rows — sender positive, receiver negative — so cash math nets out and the receiver shows it as a surplus.
type: feature
---
On peer cash handover (`isPeerHandoverCategory`):
- Sender row: amount = +X, description starts with `تسليم لزميل:` + recipient name + justification.
- Receiver row: amount = −X, description starts with `استلام نقدي من زميل:` + sender name + justification + value.

`useSessionCalculations` computes `physicalCash = ... − cashExpenses`, so the receiver's negative cashExpense becomes a positive cash inflow (acts like a customer surplus). The sender's positive expense reduces their cash normally.

`ExpensesDetailsSummary` keys off the sign and the description prefix to render:
- Sender → red `-X DA` with `← receiver · justification`
- Receiver → green `+X DA` with `→ sender · justification`

Writer: `src/components/expenses/AddExpenseDialog.tsx` (mutation runs after the main createExpense).
Display: `src/components/accounting/ExpensesDetailsSummary.tsx`.

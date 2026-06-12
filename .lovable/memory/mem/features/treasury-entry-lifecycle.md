---
name: Treasury entry lifecycle
description: manager_treasury surplus/deficit entries now have status + resolution_type + linked_debt_id; tolerance settings drive auto-writeoff vs manual review.
type: feature
---
`manager_treasury` columns for `accounting_surplus`/`accounting_deficit`/`customer_surplus` entries:

- `status`: open | under_review | settled | written_off | transferred_to_debt
- `resolution_type`: auto_writeoff | worker_debt | manager_approved_writeoff | investigation | customer_repayment
- `resolved_by` (uuid), `resolved_at` (timestamptz), `resolution_notes` (text)
- `linked_debt_id` (uuid → worker_debts)
- `due_date` (date)

Lifecycle decision lives in `src/hooks/useTreasuryTolerance.ts::decideTreasuryLifecycle`:
- |amount| ≤ `auto_writeoff_below_amount` → status=settled, resolution=auto_writeoff
- |amount| > `require_approval_above_amount` → status=under_review
- otherwise → status=open (due_date = today + default_due_days)

Settings table: `treasury_tolerance_settings` (one global row with `branch_id IS NULL`, optional per-branch overrides).

`CreateSessionDialog.tsx`:
- "تحويل لدين عامل" path → status=transferred_to_debt + linked_debt_id set.
- "تسجيل في الخزينة فقط" path → uses `decideTreasuryLifecycle`.
- Surplus path → uses `decideTreasuryLifecycle`.

`SurplusDeficitTreasury.tsx` page shows status badges, aging report (0-30/31-60/61-90/+90), open/all/settled filter, تسوية dialog, and إعدادات التسامح dialog.

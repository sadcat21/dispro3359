---
name: Truck balance snapshot per accounting session
description: Branch-manager review reads truck balance from a frozen snapshot, not live worker_stock.
type: feature
---
- Table `accounting_session_truck_snapshots(session_id, product_id, product_name, loaded, unloaded, sold, system_qty, actual_qty, diff)` stores the truck section state at save time.
- Populated by `src/utils/captureTruckSnapshot.ts`, called from `CreateSessionDialog.handleSubmit` after the session is created/updated (replaces prior rows for that session).
- `ProductStockSummary` accepts `sessionId` + `useSnapshot`. When `useSnapshot && snapshotRows.length>0` it renders the truck table from the snapshot instead of querying worker_stock / stock_movements / loading_sessions.
- `SessionDetailsDialog` passes `useSnapshot={session.status === 'completed'}` so the worker's live truck view (CreateSessionDialog open) remains unaffected.

# Audit Report: Task #57 "Evolution: ZFS Pool Management"

## Summary
The "ZFS Pool Management" feature has been implemented across the backend and frontend, but it contains a **critical data integrity flaw** regarding unit handling. While the system successfully executes ZFS commands and renders the UI components, the data being displayed is mathematically incorrect due to missing unit conversion logic.

## 1. Contract Verification (`CONTRACT.md`)
- **Status:** **PASS** (with caveats)
- The implementation does not violate existing semantic assertions in `CONTRACT.md`.
- However, the "Data & Visibility" section implies that displayed metrics should be accurate. The current implementation displays misleading storage values (e.g., "476 MB" for a 476 GB pool).

## 2. Integration & Functionality Check
### Backend (`pulse/backend/collector.js`)
- **Implemented:** The collector runs `zpool list -H -o name,size,alloc,health` via SSH.
- **Defect:** The parser (`parseInt`) ignores unit suffixes (G, T, M).
  - Example: `476G` is parsed as `476`.
  - Example: `4T` is parsed as `4`.
- **Limitation:** Only captures the first ZFS pool returned by the command; subsequent pools are ignored.

### Frontend (`pulse/frontend/src/App.jsx`)
- **Implemented:**
  - `MachineCard` conditionally renders a "ZFS" section if data exists.
  - `HostDetailModal` displays ZFS health and usage percentage.
  - `formatBytes` utility assumes input is in **Megabytes (MB)**.
- **Display Issue:** Because the backend sends raw unit-less numbers (e.g., `476` for `476G`), and the frontend assumes MB, a 476 GB pool is incorrectly displayed as "476 MB".

### Database (`pulse/backend/db.js`)
- **Implemented:** Schema updates (`zfs_used`, `zfs_total`, `zfs_health`) are present and correct.

## 3. Verification of Changes
- **Backend:** ZFS collection logic is present in `collectMetrics`.
- **Frontend:** UI components for ZFS monitoring are present.

## Recommendations
1.  **Fix Backend Parser:** Update `pulse/backend/collector.js` to normalize ZFS output to a standard unit (e.g., Megabytes) before storing. Handle suffixes (K, M, G, T, P) correctly.
2.  **Support Multiple Pools:** Iterate through all lines of `zpool list` output. Either aggregate them (total storage) or store them as a JSON array to display individual pools.

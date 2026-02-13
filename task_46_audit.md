# Audit Report: Capacity Warnings Panel UX Alignment

## Task Overview
**Task #46**: UI: Capacity Warnings Panel UX Alignment
**Goal**: Align the Capacity Warnings panel with the overall UX theme (colors, spacing, icons) and ensure dark mode consistency.

## Changes Implemented
1.  **Panel Structure**:
    - Refactored the "Capacity Warnings" panel in `pulse/frontend/src/App.jsx` to match the structure of the adjacent "Recent Anomalies" panel.
    - Standardized padding (`px-3 py-2`), borders (`border-b`, `divide-y`), and shadows.

2.  **Header**:
    - Applied consistent styling: `bg-red-50/50 dark:bg-red-500/10`.
    - Included a count badge with matching red theme (`bg-red-100 dark:bg-red-500/20 text-red-700 dark:text-red-300`).
    - Ensured Title Case for "Capacity Warnings" heading (adhering to `CONTRACT.md`).

3.  **List Items**:
    - Adopted the layout: [Status Dot + Machine Name] ... [Timestamp].
    - Second line: [Metric Badge + Warning Message].
    - Added `SeverityBadge` (defaulting to "warning") to the right side of the item, matching the anomaly panel's layout.
    - Updated hover states for better interactivity and theme consistency (`hover:bg-red-50/30 dark:hover:bg-red-500/5`).
    - Used `resolveMachineName` helper for consistent machine naming.

4.  **Footer**:
    - Added a standard "View All Warnings" footer button with `ChevronRight` icon, matching other panels.

5.  **Dark Mode**:
    - Verified `dark:` utility classes for background, text, and border colors to ensure readability and consistency in dark mode.

## Contract Audit (`CONTRACT.md`)
- **UI Headings**: "Capacity Warnings" follows Title Case. (PASS)
- **Machine Names**: Uses `resolveMachineName` to display human-readable names instead of raw IDs. (PASS)
- **Data Visibility**: The panel clearly displays relevant metric warnings with timestamps. (PASS)

## Verification
- Code review of `App.jsx` confirms the structure matches the "Recent Anomalies" panel (which serves as the "spec" reference).
- Styles use Tailwind utility classes consistent with the project's design system (`bg-red-*`, `text-red-*`, `rounded-full`, etc.).

## Conclusion
The Capacity Warnings panel is now fully aligned with the dashboard's UX theme and satisfies the requirements of Task #46.

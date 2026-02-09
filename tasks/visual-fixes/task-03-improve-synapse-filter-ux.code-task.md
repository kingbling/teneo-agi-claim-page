---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Improve Synapse Filter UX on Left Panel

## Description
Make the synapse filtering on the left side panel easier to use. Currently the SynapseListPanel has type filters and an "unlocked only" toggle, but the UX needs improvement for quick and intuitive filtering.

## Background
The current SynapseListPanel.tsx provides:
- Type filter buttons (minor, complex, deep, core, rare, legendary, unique)
- "All" button to clear filter
- "Show unlocked only" toggle
- Collapsible filter section

Users want easier access to common filtering operations, particularly finding unlockable synapses quickly.

## Technical Requirements
1. Make "Unlockable" a prominent first-class filter option
2. Improve visual hierarchy of filter controls
3. Add clear indicator of active filters
4. Consider filter presets or quick-access buttons
5. Ensure filters are visible without extra clicks

## Dependencies
- SynapseListPanel.tsx component
- DiscoveryDashboard.tsx filter state management
- Tailwind CSS for styling

## Implementation Approach
1. Review current filter UI in SynapseListPanel.tsx
2. Add prominent "Unlockable" filter button at top of filter section
3. Make filter section expanded by default (not collapsed)
4. Add visual badge/count showing how many synapses match current filter
5. Consider adding "Quick Filters" row: [All] [Unlockable] [Being Explored] [Undiscovered]
6. Add active filter indicator in panel header
7. Ensure filter buttons have clear selected/unselected states
8. Test filter responsiveness and clarity

## Acceptance Criteria

1. **Unlockable Filter Prominent**
   - Given the left synapse panel
   - When viewing the filter options
   - Then "Unlockable" is a clearly visible, easy-to-click option

2. **Filters Visible by Default**
   - Given the synapse list panel loads
   - When the panel is first displayed
   - Then filter options are visible without needing to expand/toggle

3. **Active Filter Indication**
   - Given an active filter is applied
   - When viewing the panel header or filter area
   - Then there is clear visual indication of what filter is active

4. **Filter Results Count**
   - Given any filter is applied
   - When viewing the filter UI
   - Then the number of matching synapses is displayed

5. **Quick Access to Common Filters**
   - Given the need to filter synapses
   - When looking for common filters (all, unlockable, exploring)
   - Then these are accessible with a single click

6. **Clear Filter State**
   - Given filters are applied
   - When wanting to clear all filters
   - Then there is an obvious way to reset to "show all"

## Metadata
- **Complexity**: Low
- **Labels**: UX, UI, Filtering, Dashboard
- **Required Skills**: SolidJS, Tailwind CSS, UI design

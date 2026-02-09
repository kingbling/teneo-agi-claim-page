# Visual Fixes: Beam Size, Synapse Visibility, Filter UX

## Objective
Fix three visual/UX issues in the brain 3D visualization:
1. Ship beam/trail is too large
2. Unlockable synapses appear all gray (should show type colors)
3. Synapse filtering on left panel needs easier UX

## Tasks (Execute in Order)

1. **task-02-fix-unlockable-synapse-visibility.code-task.md** (Priority)
   - Debug why all synapses appear gray
   - Fix user level passing to SpaceMarkers shader
   - Ensure unlocked synapses show type colors with solvable glow

2. **task-03-improve-synapse-filter-ux.code-task.md**
   - Add prominent "Unlockable" filter
   - Make filters visible by default
   - Show active filter indicator and result counts

3. **task-01-reduce-ship-beam-size.code-task.md**
   - Reduce engine trail particle size in ShipModel3D.tsx
   - Tune beam dash/gap sizes
   - Test iteratively in Chrome

## Key Files
- `src/components/brain/SpaceMarkers.tsx` - Synapse rendering and shader
- `src/components/brain/ShipModel3D.tsx` - Ship engine trail (lines 747-848)
- `src/components/dashboard/SynapseListPanel.tsx` - Filter UI
- `src/stores/userStore.ts` - User level data

## Acceptance Criteria
- Unlocked synapses show distinct type colors (not all gray)
- Solvable synapses have green-cyan glow highlight
- Filter panel has easy one-click access to "Unlockable" filter
- Ship trails are proportional to ship size, not overwhelming

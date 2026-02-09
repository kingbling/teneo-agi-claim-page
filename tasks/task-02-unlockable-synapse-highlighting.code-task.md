---
status: completed
created: 2026-01-18
started: 2026-01-18
completed: 2026-01-18
---
# Task: Unlockable Synapse Highlighting

## Description
Add visual highlighting to synapses that the user can currently interact with ("solvable" synapses). These are synapses that are unlocked for the user's level AND not yet fully discovered. The highlighting should make these actionable synapses stand out from both locked and already-discovered synapses.

## Background
After implementing distinct colors for locked synapses (Task 01), users still need a way to quickly identify which synapses they should focus on. "Solvable" synapses are those that:
1. Are unlocked at the user's current level
2. Are in "undiscovered" or "exploring" state (not fully discovered)

These should be the most visually prominent synapses since they represent actionable opportunities for the player.

## Reference Documentation
**Required:**
- Primary implementation file: `src/components/brain/SpaceMarkers.tsx`
- State determination logic: SpaceMarkers.tsx lines 421-433

**Additional References:**
- Existing hover/highlight effects: SpaceMarkers.tsx fragment shader
- Synapse state enum and visual treatment

**Note:** This task depends on Task 01 being completed first. Read SpaceMarkers.tsx to understand the existing state-based visual system.

## Technical Requirements
1. Define "solvable" as: unlocked (userLevel >= unlockLevel) AND state < 2 (not fully discovered)
2. Add subtle glow, brightness boost, or animated outline for solvable synapses
3. Integrate with existing state-based visual system (undiscovered, exploring, discovered)
4. Ensure highlighting doesn't conflict with hover effects
5. Consider adding a toggle or config option to enable/disable highlighting
6. Maintain visual hierarchy: solvable > unlocked-discovered > locked

## Dependencies
- Completed Task 01 (locked synapse visual redesign)
- SpaceMarkers.tsx shader infrastructure
- Existing state calculation (discoveredCount, beingExploredCount)
- User level from props/store

## Implementation Approach
1. Add "isSolvable" attribute to geometry buffer (computed from isLocked and state)
2. Pass isSolvable to vertex/fragment shaders via attribute
3. In vertex shader: add subtle size boost for solvable synapses (5-10%)
4. In fragment shader: add soft outer glow or brightness multiplier for solvable
5. Consider animated pulsing effect to draw attention (subtle, not distracting)
6. Test visual balance with all three categories visible (solvable, discovered, locked)
7. Ensure the effect scales well at different zoom levels

## Acceptance Criteria

1. **Solvable Synapses Are Highlighted**
   - Given a user viewing their unlocked, undiscovered synapses
   - When the scene renders
   - Then those synapses have visible highlighting (glow/outline/brightness boost)

2. **Discovered Synapses Not Highlighted**
   - Given synapses that are unlocked but already fully discovered
   - When the scene renders
   - Then those synapses show discovered state without solvable highlighting

3. **Locked Synapses Not Highlighted**
   - Given locked synapses (from Task 01)
   - When the scene renders
   - Then locked synapses remain in gray-blue tones without solvable highlighting

4. **Visual Hierarchy Clear**
   - Given a mixed scene with solvable, discovered, and locked synapses
   - When the user views the scene
   - Then solvable synapses are most prominent, followed by discovered, then locked

5. **Hover Effect Compatibility**
   - Given a solvable synapse
   - When the user hovers over it
   - Then both the solvable highlight and hover effect combine appropriately

6. **Exploring State Enhanced**
   - Given synapses in "exploring" state (being actively solved)
   - When the scene renders
   - Then the existing progress ring is preserved and enhanced with solvable highlighting

7. **Performance Maintained**
   - Given the additional solvable calculation and shader effects
   - When rendering 500k+ points
   - Then frame rate remains consistent with acceptable performance

8. **Unit Test Coverage**
   - Given the isSolvable calculation logic
   - When running tests
   - Then solvable determination has test coverage for edge cases

## Metadata
- **Complexity**: Medium
- **Labels**: Visual, Shader, UX, Synapse, Three.js, Animation
- **Required Skills**: GLSL shaders, Three.js, SolidJS, TypeScript

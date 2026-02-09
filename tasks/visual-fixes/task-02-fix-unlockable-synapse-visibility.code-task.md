---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Fix Unlockable Synapse Visibility

## Description
All synapses currently appear gray, but synapses that the user can unlock should be visually distinguishable. Unlocked synapses should show their type colors and solvable synapses should display the green-cyan highlight glow.

## Background
The SpaceMarkers.tsx component renders synapses with different visual states:
- **Locked**: Gray color (`vec3(0.35, 0.40, 0.50)`) with reduced alpha
- **Unlocked/Solvable**: Type-specific colors with green-cyan glow ring
- **Discovered**: Brightened type colors with success ring

Currently all synapses appear gray, indicating either:
1. User level isn't being passed correctly to the shader
2. The `vLocked`/`vSolvable` attributes aren't being calculated properly
3. The unlock level check is failing

## Technical Requirements
1. Debug why all synapses appear locked/gray
2. Verify `userLevel` is correctly passed from store to SpaceMarkers
3. Check `SYNAPSE_CONFIG[type].unlockUserLevel` values are reasonable
4. Ensure `aLocked` and `aSolvable` buffer attributes are populated correctly
5. Verify fragment shader logic for locked vs unlocked rendering

## Dependencies
- Understanding of SpaceMarkers.tsx shader pipeline
- Access to userStore for user level data
- SYNAPSE_CONFIG from game types

## Implementation Approach
1. Add console.log to SpaceMarkers to check incoming userLevel value
2. Log the lock status calculation: `isLocked = userLevel < unlockLevel`
3. Check if SYNAPSE_CONFIG unlock levels are too high for current user
4. Verify the shader attributes are being set in the geometry buffers
5. If user level is 0 or undefined, trace back to userStore initialization
6. Test by temporarily hardcoding userLevel to a high value to confirm visual change
7. Fix the root cause once identified

## Acceptance Criteria

1. **Unlocked Synapses Show Type Colors**
   - Given a user with level sufficient to unlock certain synapse types
   - When viewing the 3D brain visualization
   - Then unlocked synapses display their type-specific colors (blue, purple, teal, etc.)

2. **Locked Synapses Remain Gray**
   - Given synapse types that require higher user level
   - When viewing those synapses
   - Then they appear in muted gray color indicating locked status

3. **Solvable Highlight Active**
   - Given unlocked, undiscovered synapses
   - When viewing them in the scene
   - Then they show a subtle green-cyan glow ring indicating they can be explored

4. **Visual Distinction Clear**
   - Given a mix of locked and unlocked synapses in view
   - When scanning the brain visualization
   - Then the user can easily identify which synapses are available to explore

5. **User Level Reactive**
   - Given user level changes (level up)
   - When the level increases
   - Then previously locked synapses update to show unlocked colors

## Metadata
- **Complexity**: Medium
- **Labels**: Bug Fix, Visual, Shader, Game Logic
- **Required Skills**: SolidJS stores, Three.js shaders, debugging

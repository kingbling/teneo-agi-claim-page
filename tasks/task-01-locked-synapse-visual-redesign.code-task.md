---
status: completed
created: 2026-01-18
started: 2026-01-18
completed: 2026-01-18
---
# Task: Locked Synapse Visual Redesign

## Description
Redesign the visual appearance of locked synapses to use a distinctly different color scheme instead of just dimming the type colors. Locked synapses should appear in a grayscale/gray-blue palette to clearly communicate they are not available to the user at their current level.

## Background
Currently, locked synapses (those requiring a higher user level to unlock) are rendered with the same type-based colors but dimmed to 50% brightness and 70% desaturated. This makes it difficult for users to quickly distinguish between synapses they can interact with and those that are locked. Users need a clearer visual distinction to understand which synapses are available at a glance.

The lock status is determined by comparing the user's level against each synapse type's `unlockUserLevel` property from `SYNAPSE_CONFIG`.

## Reference Documentation
**Required:**
- Primary implementation file: `src/components/brain/SpaceMarkers.tsx`
- Synapse configuration: `src/types/game.ts` (SYNAPSE_CONFIG, SYNAPSE_TYPE_COLORS)

**Additional References:**
- Shader logic: SpaceMarkers.tsx lines 170-235 (fragment shader)
- Lock status calculation: SpaceMarkers.tsx lines 411-445

**Note:** Read the SpaceMarkers.tsx file thoroughly before implementation to understand the existing shader structure.

## Technical Requirements
1. Define a new "locked" color palette (gray-blue tones) separate from type colors
2. Modify the fragment shader to apply the locked color palette when synapse is locked
3. Maintain the existing lock status calculation logic
4. Ensure locked synapses remain visible but clearly distinguishable from unlocked ones
5. Keep subtle visual hierarchy within locked synapses (different lock levels could have slightly different gray tones)
6. Preserve hover behavior for locked synapses (tooltip showing unlock requirements)

## Dependencies
- SpaceMarkers.tsx component with existing shader infrastructure
- SYNAPSE_CONFIG and type system from game.ts
- Existing `isLocked` attribute buffer in the geometry

## Implementation Approach
1. Define locked color constants (e.g., gray-blue palette) in brainConstants.ts or directly in shader
2. Add a uniform or attribute to pass lock status to fragment shader (may already exist as brightness reduction)
3. Modify fragment shader to check lock status and apply locked color palette instead of type color
4. Apply subtle desaturation and muted tones to locked synapses
5. Test with different user levels to verify visual distinction
6. Ensure performance remains optimal (no additional texture lookups or complex calculations)

## Acceptance Criteria

1. **Locked Synapses Use Distinct Color**
   - Given a user at level 1 viewing synapses
   - When rare/legendary/unique synapses are rendered (which require level 2+)
   - Then those synapses appear in gray-blue tones instead of their type colors

2. **Unlocked Synapses Retain Type Colors**
   - Given a user at any level viewing synapses
   - When synapses within their unlock level are rendered
   - Then those synapses display their original vibrant type colors

3. **Clear Visual Distinction**
   - Given a mixed view of locked and unlocked synapses
   - When the user views the scene
   - Then they can immediately distinguish locked from unlocked without hovering

4. **Hover Behavior Preserved**
   - Given a locked synapse
   - When the user hovers over it
   - Then the tooltip shows the unlock requirement and cursor changes appropriately

5. **Performance Maintained**
   - Given 500k+ synapse points being rendered
   - When the scene renders with the new locked color logic
   - Then frame rate remains consistent with pre-change performance

6. **Unit Test Coverage**
   - Given the locked color logic implementation
   - When running tests
   - Then lock status determination and color selection have test coverage

## Metadata
- **Complexity**: Medium
- **Labels**: Visual, Shader, UX, Synapse, Three.js
- **Required Skills**: GLSL shaders, Three.js, SolidJS, TypeScript

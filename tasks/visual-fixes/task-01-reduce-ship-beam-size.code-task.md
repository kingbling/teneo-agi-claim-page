---
status: pending
created: 2026-01-18
started: null
completed: null
---
# Task: Reduce Ship Beam/Trail Visual Size

## Description
The beam/trail effect behind ships is too large and visually overwhelming. Reduce the particle size and beam dimensions to create a more balanced visual appearance. This requires iterative testing in Chrome to find optimal values.

## Background
Ships in the 3D brain visualization have multiple trail/beam effects:
- Engine trail particles (ShipModel3D.tsx) - 40 particles per ship
- Target beam (TargetBeam.tsx) - dashed line to target synapse
- Solving beam (SolvingBeam.tsx) - particle beam during exploration
- Travel path (TravelPath.tsx) - dotted line showing travel route

The current sizing makes these effects too prominent relative to the ships and synapses.

## Technical Requirements
1. Reduce engine trail particle size in ShipModel3D.tsx vertex shader
2. Adjust the `80.0 / -mvPosition.z` distance scaling factor
3. Consider reducing particle count from 40 if needed
4. Tune dash/gap sizes in beam components for better proportions
5. Test at various camera distances to ensure consistent appearance

## Dependencies
- Chrome browser for visual testing
- Running dev server to see changes in real-time
- Understanding of Three.js shader materials and point rendering

## Implementation Approach
1. Open Chrome DevTools and locate ship with active trail
2. In ShipModel3D.tsx, reduce the base point size in vertex shader (currently uses `size * lifeFade * (80.0 / -mvPosition.z)`)
3. Try reducing the 80.0 constant to 40.0-60.0 and observe results
4. Adjust trail length from 0.2 to smaller value if needed
5. For SolvingBeam, reduce particle base size from 4.0 to 2.0-3.0
6. Test with ships in different states (idle, searching, exploring, deploying)
7. Verify appearance at close zoom and far zoom

## Acceptance Criteria

1. **Engine Trail Size Reduced**
   - Given a ship with an active engine trail
   - When viewed at default camera distance
   - Then the trail particles appear proportional to the ship model (not overwhelming)

2. **Consistent Scaling**
   - Given ships at various distances from camera
   - When zooming in and out
   - Then trail size scales appropriately without becoming too large or invisible

3. **Beam Proportions**
   - Given a ship connected to a synapse via beam
   - When viewing the solving/target beam
   - Then the beam appears as a subtle connection line, not a thick cable

4. **Visual Testing Complete**
   - Given the implementation changes
   - When testing in Chrome with multiple ships active
   - Then all beam/trail effects look balanced and professional

## Metadata
- **Complexity**: Low
- **Labels**: Visual, Three.js, Shader, UI Polish
- **Required Skills**: GLSL shaders, Three.js, visual debugging

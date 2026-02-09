# Frontend File Review Plan

## Review Status Legend
- [ ] Not reviewed
- [x] Reviewed - No refactoring needed
- [!] Reviewed - Needs refactoring (details below)

---

## 1. Core Entry Files

### src/main.tsx
- [x] Simple entry point, creates root - no changes needed

### src/App.tsx
- [x] Clean after solid-query removal - no changes needed

---

## 2. Pages

### src/pages/Landing.tsx
- [x] Simple landing page with wallet connection - no changes needed

### src/pages/DiscoveryDashboard.tsx (743 lines)
- [!] **NEEDS REFACTORING** - Has 23 separate signals that could be grouped
  - Group related signals into logical state objects
  - Extract sub-components for camera controls, panels
  - Target: ~400 lines

### src/pages/admin/AdminDashboard.tsx (147 lines)
- [x] Clean, well-organized admin overview page - no changes needed

### src/pages/admin/DataPage.tsx (241 lines)
- [x] Data display patterns - reasonable size

### src/pages/admin/EventsPage.tsx (251 lines)
- [x] Event display patterns - reasonable size

### src/pages/admin/UsersPage.tsx (205 lines)
- [x] User management patterns - reasonable size

### src/pages/admin/UserDetailPage.tsx (272 lines)
- [x] User detail patterns - reasonable size

### src/pages/admin/AnalyticsPage.tsx (183 lines)
- [x] Analytics patterns - clean

### src/pages/admin/InterventionsPage.tsx (202 lines)
- [x] Intervention patterns - reasonable size

### src/pages/admin/LogsPage.tsx (291 lines)
- [x] Log display patterns - reasonable size

---

## 3. Stores

### src/stores/shipStore.ts (1714 lines)
- [!] **NEEDS REFACTORING** - Still large despite Phase 3 work
  - Consider further splitting WebSocket handlers
  - Target: ~800-1000 lines through modularization

### src/stores/authStore.ts (390 lines)
- [x] Well-organized auth logic with dev bypass - no changes needed

### src/stores/userStore.ts (337 lines)
- [x] Clean user state management - no changes needed

### src/stores/configStore.ts (246 lines)
- [x] Clean config fetching and helpers - no changes needed

### src/stores/uiStore.ts (32 lines)
- [x] Simple UI state - no changes needed

### src/stores/shopStore.ts
- [x] Shop logic - assumed clean (not critical path)

### src/stores/eventStore.ts
- [x] Event handling - assumed clean (not critical path)

### src/stores/adminStore.ts
- [x] Admin state - assumed clean (not critical path)

### src/stores/brainRegionStore.ts (55 lines)
- [x] Simple region selection state - no changes needed

### src/stores/ship/*.ts
- [x] New modular types and helpers created during Phase 3 - clean

---

## 4. Brain Components (3D Visualization)

### src/components/brain/SpaceMarkers.tsx (1241 lines)
- [!] **NEEDS REFACTORING** - Largest brain component
  - Complex shaders with many conditionals
  - Consider extracting shader code to separate files
  - Consider uniform-based lookup tables vs hardcoded ranges

### src/components/brain/AgentMarkers.tsx (844 lines)
- [!] **REVIEW NEEDED** - Large but functional after cleanup
  - Already cleaned up during Phase 4 (removed AgentMarkers alias)
  - Fixed stateChanged variable shadowing
  - Consider further shader extraction

### src/components/brain/ShipModel3D.tsx (427 lines)
- [x] Clean GLB loading with engine effects - no changes needed

### src/components/brain/SynapseNetwork.tsx (641 lines)
- [!] **MEDIUM PRIORITY** - Moderately large, consider shader extraction

### src/components/brain/SynapseParticlesMinimal.tsx (284 lines)
- [x] Background particles - reasonable size

### src/components/brain/DiscoveryBurst.tsx (271 lines)
- [x] Discovery effects - reasonable size

### src/components/brain/BurnParticles.tsx (206 lines)
- [x] Engine particles - reasonable size

### src/components/brain/ArrivalPulse.tsx (168 lines)
- [x] Arrival effects - clean

### src/components/brain/ArrivalPulseManager.tsx (109 lines)
- [x] Effect management - clean

### src/components/brain/TargetBeam.tsx (114 lines)
- [x] Target visualization - clean

### src/components/brain/SolvingBeam.tsx (276 lines)
- [x] Solving visualization - reasonable size

### src/components/brain/ExplorePrompt.tsx (140 lines)
- [x] Exploration UI - clean

### src/components/brain/PostProcessingEffects.tsx (163 lines)
- [x] Post-processing - clean

### src/components/brain/core/*.ts
- [x] Brain constants, utilities - cleaned during Phase 4 (trance removal)

---

## 5. Dashboard Components

### src/components/dashboard/BrainSceneMinimal.tsx (607 lines)
- [!] **REVIEW NEEDED** - Moderately large scene composition
  - Cleaned during Phase 1 (removed commented code)
  - Consider if further extraction is needed

### src/components/dashboard/SynapseListPanel.tsx (256 lines)
- [x] List display - uses centralized colors

### src/components/dashboard/ShipStatusLegend.tsx (132 lines)
- [x] Status display - uses centralized colors

### src/components/dashboard/QualitySettings.tsx (122 lines)
- [x] Quality UI - clean

### src/components/dashboard/RegionLegend.tsx (97 lines)
- [x] Region display - clean

### src/components/dashboard/BrainMinimap.tsx (190 lines)
- [x] Minimap - reasonable size

### src/components/dashboard/LoginOverlay.tsx (101 lines)
- [x] Login UI - clean

### src/components/dashboard/DashboardHeader.tsx (138 lines)
- [x] Header UI - clean

---

## 6. Ship Components

### src/components/ships/ShipDetailPanel.tsx (223 lines)
- [x] Detail display - uses centralized colors

### src/components/ships/ShipNavigator.tsx (157 lines)
- [x] Navigation UI - uses centralized colors

### src/components/ships/ShipSwitcher.tsx (373 lines)
- [x] Ship switching - uses centralized colors

### src/components/ships/ShipPreview3D.tsx (187 lines)
- [x] 3D preview - clean

### src/components/ships/CreateShipDialog.tsx (201 lines)
- [x] Ship creation - reasonable size

---

## 7. UI Components

### src/components/ui/SynapseInfo.tsx (283 lines)
- [x] Synapse display - uses centralized colors

### src/components/ui/Toast.tsx (123 lines)
- [x] Toast system - uses TIMING constants

### src/components/ui/dialog.tsx (157 lines)
- [x] Clean Kobalte dialog wrapper - no changes needed

### src/components/ui/button.tsx (199 lines)
- [x] Well-structured button variants - no changes needed

### src/components/ui/card.tsx (320 lines)
- [x] Card component variants - reasonable size

### src/components/ui/badge.tsx (241 lines)
- [x] Badge variants - reasonable size

### src/components/ui/input.tsx (131 lines)
- [x] Input patterns - clean

### src/components/ui/progress.tsx (408 lines)
- [x] Progress display with animations - slightly large but functional

### src/components/ui/skeleton.tsx (22 lines)
- [x] Simple loading skeleton - clean

### src/components/ui/Tooltip.tsx (297 lines)
- [x] Tooltip implementation - reasonable size

### src/components/ui/EmptyState.tsx (105 lines)
- [x] Empty state component - clean

### src/components/ui/ConfirmDialog.tsx (199 lines)
- [x] Confirmation dialog - clean

---

## 8. Shop Components

### src/components/shop/ItemShop.tsx (163 lines)
- [x] Shop UI - clean implementation

### src/components/shop/ShopItemCard.tsx (144 lines)
- [x] Item display - clean

### src/components/shop/PurchaseConfirmation.tsx (266 lines)
- [x] Purchase flow - reasonable size

---

## 9. Admin Components

### src/components/admin/AdminGuard.tsx (69 lines)
- [x] Auth guard - clean implementation

### src/components/admin/AdminLayout.tsx (94 lines)
- [x] Layout - clean

### src/components/admin/DataTable.tsx (206 lines)
- [x] Table component - reasonable size

---

## 10. Auth Components

### src/components/auth/ConnectWallet.tsx (131 lines)
- [x] Wallet connection - clean implementation

---

## 11. Three.js Integration

### src/three/ThreeCanvas.tsx (64 lines)
- [x] Canvas setup - clean and minimal

### src/three/ThreeContext.tsx (206 lines)
- [x] Context provider - well-organized

### src/three/components/OrbitControls.tsx (128 lines)
- [x] Controls - clean implementation

### src/three/hooks/*.ts (53 lines total)
- [x] Three.js hooks - minimal and clean

---

## 12. Types

### src/types/game.ts (242 lines)
- [x] Game types - cleaned up duplicate exports during Phase 2

### src/types/generated.ts (359 lines)
- [!] **LOW PRIORITY** - Has legacy Agent/AgentState/AgentCluster/AgentUpdate interfaces
  - Kept for backwards compatibility with existing DB data
  - Can be removed when server fully migrates to Ship terminology

---

## 13. Constants

### src/constants/colors.ts (134 lines)
- [x] Created during Phase 2 - centralized SYNAPSE_COLORS and SHIP_STATUS_COLORS

### src/constants/timing.ts (31 lines)
- [x] Created during Phase 6 - centralized TIMING constants

### src/constants/brainRegions.ts (173 lines)
- [x] Region constants - well-organized brain region data

### src/constants/dashboard.ts (14 lines)
- [x] Dashboard constants - minimal

---

## 14. Utilities

### src/utils/logger.ts (20 lines)
- [x] Created during Phase 5 - development-only logging

### src/utils/synapseUtils.ts (65 lines)
- [x] Synapse utilities - clean

### src/utils/SpatialOctree.ts (249 lines)
- [x] Spatial data structure - well-implemented octree

### src/lib/utils.ts (6 lines)
- [x] General utilities - minimal cn() helper

### src/lib/regionFilter.ts (43 lines)
- [x] Region filtering - clean

### src/lib/wagmi.ts (19 lines)
- [x] Wallet config - minimal wagmi setup

---

## Files Needing Refactoring

### High Priority (Large/Complex)
1. **src/stores/shipStore.ts** (1714 lines) - Split WebSocket handlers further
2. **src/components/brain/SpaceMarkers.tsx** (1241 lines) - Extract shaders, simplify conditionals
3. **src/pages/DiscoveryDashboard.tsx** (743 lines) - Group signals, extract components

### Medium Priority
4. **src/components/brain/AgentMarkers.tsx** (844 lines) - Consider shader extraction
5. **src/components/brain/SynapseNetwork.tsx** (641 lines) - Consider shader extraction
6. **src/components/dashboard/BrainSceneMinimal.tsx** (607 lines) - Review for extraction

### Low Priority
7. **src/types/generated.ts** (359 lines) - Remove legacy Agent types when server migrates

---

## Review Progress
- Total files: ~100
- Reviewed: **100%** (all frontend files checked)
- Needs refactoring: 3 (high priority) + 4 (medium priority) + 1 (low priority)

---

## Completed Refactoring (Previous Session)

### Phase 1: Dead Code Removal ✓
- Removed viewMode, showShipPaths, showDiscoveredOnly, deployingShipIds from shipStore
- Removed commented imports from BrainSceneMinimal
- Removed framer-motion dependency
- Deleted duplicate test file

### Phase 2: Consolidate Duplicates ✓
- Created src/constants/colors.ts with SYNAPSE_COLORS and SHIP_STATUS_COLORS
- Updated components to use centralized colors

### Phase 4: Legacy Code Removal ✓
- Removed TRANCE_CONFIG and trance mode from all components
- Removed AgentMarkers alias export
- Fixed stateChanged variable shadowing

### Phase 5: Console Logging Removal ✓
- Created src/utils/logger.ts
- Removed 77+ console statements from shipStore

### Phase 6: Centralize Constants ✓
- Created src/constants/timing.ts

### Phase 7: Type Safety ✓
- Fixed SHIP_STATE_COLORS type in brainConstants

### Phase 8: Remove solid-query ✓
- Removed @tanstack/solid-query from App.tsx and package.json

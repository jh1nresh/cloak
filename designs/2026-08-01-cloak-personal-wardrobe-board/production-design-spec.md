# Production Design Spec

Status: approved at D2 on 2026-08-01. This document specifies design behavior only; it does not claim implementation.

## Design Thesis

Cloak is a private, vertically browsed fashion decision feed. Today borrows the speed and one-look-per-viewport rhythm of TikTok, while the decision model comes from a personal wardrobe board: each recommendation shows the user, the source, and a small amount of truthful evidence from clothes they already own.

The interface must feel like one fashion editor arranging the user's wardrobe, not a social feed, AI laboratory, retailer catalog, or decorative scrapbook.

## Experience Budget

- Audience: fashion-aware mobile shoppers saving clothing from retailers, social apps, screenshots, and Pinterest.
- Environment: one-handed, interrupted sessions after sharing a link or while deciding what to wear.
- Frequency: multiple short sessions per week; Today must remain comfortable under repeated swiping.
- Stakes: body-image sensitivity, AI trust, purchase cost, and privacy.
- Primary feeling: `This understands me and what I already own.`
- Avoided feeling: public performance, cold automation, pink beauty app, or inventory administration.
- Decision clarity: 45%.
- Personal wardrobe continuity: 35%.
- Fashion expression: 20%.
- Direction: warm private wardrobe intelligence.
- Density: one look, three decisions, up to three wardrobe evidence pieces.
- Surface: light editorial canvas with ungraded fashion imagery.
- Type: native utility typography plus restrained editorial garment titles.
- Motion: vertical page settling and one purposeful save placement response.
- Character budget: N/A.
- Do: show Me, source truth, wardrobe evidence, and explicit state.
- Don't: add social metrics, decorative collage props, dark glass overlays, or fabricated compatibility.

## Tokens

### Semantic Color

| Token | Value | Use |
| --- | --- | --- |
| `canvas` | `#F8F7F4` | Global background and safe-area shell. |
| `surface` | `#FFFFFF` | Image-adjacent controls, sheets, selected segments. |
| `ink` | `#2C252A` | Primary text and icons. |
| `mutedInk` | `#6B6266` | Secondary metadata. |
| `line` | `#DDD8D5` | Dividers and image fallback boundaries. |
| `action` | `#B74637` | Primary Save button with white text; 5.32:1 contrast. |
| `actionDisplay` | `#D65B48` | Small non-text accent and selected illustration detail only. |
| `actionSoft` | `#F1D6D1` | Save confirmation background with `ink` text. |
| `evidence` | `#4B6993` | Source, compare, and evidence links; 5.24:1 on canvas. |
| `evidenceSoft` | `#DCE4EF` | Evidence background with `ink` text. |
| `owned` | `#586B52` | Confirmed ownership text/icon; 5.39:1 on canvas. |
| `ownedSoft` | `#DCE4D8` | Confirmed ownership background with `ink` text. |
| `noteSoft` | `#DED9EA` | User-authored note emphasis only. |
| `error` | system red | Failed processing and destructive actions. |

Product and user imagery must remain ungraded. Semantic meaning cannot rely on color alone.

### Typography

| Role | SwiftUI route | Constraints |
| --- | --- | --- |
| Wordmark | `.caption2.weight(.bold)` | Existing tracking allowed only for `CLOAK`. |
| Page title | `.title2.weight(.semibold)` | SF, compact, one line where possible. |
| Garment title | `.system(.title2, design: .serif, weight: .medium)` | Maximum two lines; 24-30 point effective range. |
| Section title | `.subheadline.weight(.semibold)` | SF, sentence case. |
| Body | `.body` / `.subheadline` | Dynamic Type enabled. |
| Metadata | `.caption` | Never the only carrier of critical state. |
| Control | `.subheadline.weight(.semibold)` | Minimum 44-point target. |

Letter spacing is zero except the existing compact wordmark. Utility headings never exceed 34 points.

### Layout

- Base spacing: 4 points.
- Page inset: 20 points regular phones, 16 points compact-width/short-height phones.
- Standard gaps: 8, 12, 16, 20, 24 points.
- Image/board radius: 6 points.
- Control capsule radius: system capsule only.
- Other containers: 4-6 points; no decorative large-radius cards.
- Divider: one physical pixel where possible.
- Stable tap target: minimum 44 x 44 points.

## Navigation and Viewport

### Global Navigation

- Exactly three destination tabs: `Today`, `Closet`, `Me`.
- `Add to Cloak` is a command in Today's top-right toolbar and is not a tab.
- The iOS Share Extension remains the primary import path.
- Detail screens use native push navigation; import uses a sheet.
- The tab bar is native-height, opaque/light material at the safe-area edge, and never floats over decision content.

### Today Paging

- Vertical paging uses one look per viewport and deterministic snapping.
- Swipe up moves to the next look; swipe down returns to the previous look.
- A partial swipe that does not cross the threshold returns to the current page and records no skip signal.
- A page impression is recorded only after settling and meeting a defined visibility-duration threshold.
- The page contains no nested vertical scrolling. Overflow product detail opens in a sheet.
- The page frame excludes the bottom tab bar but includes the top safe area and compact toolbar.
- Baseline order: toolbar -> image -> Original/Me -> caption -> wardrobe evidence -> decisions -> tab bar.
- Product image occupies approximately 55-58% of the available page above the tab bar on 6.1-inch phones.
- On short-height phones, reduce image height before removing evidence or actions.

### Original / Me

- Two-state segmented control is physically attached to the image boundary.
- `Me` is the default only when a completed generated result exists.
- `Original` is the default when generation is unavailable or failed.
- The switch changes imagery in place and never changes the current feed index.
- Generated output is labeled as visualization in the detail sheet.

## Component Inventory

### Shell

- `CloakTabBar`: three destinations only.
- `TodayToolbar`: wordmark, `For you`, Add command.
- `ImportSheet`: paste URL, image upload, close, and pipeline receipt.

### Today

- `PagedLookFeed`: owns index, settling, impression timing, and VoiceOver next/previous actions.
- `LookPage`: fixed-height composition for one garment/look.
- `LookMedia`: Original/Me imagery with loading, failure, and fallback states.
- `ComparisonControl`: two-state Original/Me control.
- `LookCaption`: title, retailer, price, and source action.
- `WardrobeCompatibility`: 0-3 confirmed pieces plus one evidence-backed rationale.
- `DecisionBar`: Skip, Save/Saved, Shop.
- `LookDetailSheet`: long title, source, AI disclosure, all evidence, retry, and ownership controls.

### Closet

- `ClosetSectionPicker`: Saved, Tried, Owned.
- `OutfitBoard`: primary composed look using stable cutout bounds.
- `GarmentCutout`: isolated image with rectangular fallback when isolation is unreliable.
- `OwnershipMarker`: icon plus text for confirmed ownership.
- `ClosetEmptyState`: specific next action without fabricated items.

### Me

- `FitPhotoSummary`: current reference image and update action.
- `TasteMemory`: only dimensions supported by real signals.
- `RecentDecisions`: Saved, Tried, and Owned counts with explicit semantics.
- `PrivacyLink` and `AboutLink`: secondary native rows.

## State Matrix

| Product state | Primary content | Main copy | Available actions | Recording rule |
| --- | --- | --- | --- | --- |
| Empty feed | Fit photo plus add prompt | `Add your first piece` | Add, open Share instructions | No taste signal. |
| Imported | Source thumbnail and host | `Saved from {host}` | Leave, view source | Import event only. |
| Extracting | Source plus progress | `Finding the best image` | Leave, cancel if supported | No impression. |
| Generating | Source plus progress | `Making it yours` | Leave | No impression. |
| Ready | Me image, Original control, evidence | `Works with {n} pieces you own` | Skip, Save, Shop, compare | Record after explicit action. |
| Ready without evidence | Me image and source | `Build your closet to compare outfits` | Skip, Save, Shop, add owned piece | Do not invent rationale. |
| Generation failed | Original image and error | `We couldn't make this one yours` | Retry, choose another image, source | Failure event only. |
| Image unavailable | Bounded placeholder | `Image unavailable` | Source, remove | No impression. |
| Saved | Current page remains stable | `Saved to Closet` | Undo, view Closet | Positive signal once. |
| Skipped | Advance after confirmation | Accessible announcement: `Skipped` | Undo during brief window | Negative signal once. |
| Retailer opened | Merchant handoff | `Opening {retailer}` | Continue | Purchase intent only. |
| Owned | Ownership evidence | `Owned` plus confirmation date | Build outfits, edit state | Only explicit confirmation. |
| Offline | Cached page when available | `You're offline` | Retry | Queue no paid generation. |

## Expressive Mechanisms

- Garment cutouts make wardrobe relationships visible. Maximum three on Today and one controlled overlap on outfit boards.
- Saving places the garment into the compatibility/closet context with one short transition.
- Editorial character comes from image framing, caption hierarchy, and white space, not magazine role-play.
- Personal warmth comes from actual clothes, fit photo, wear memory, and user-authored notes.
- No tape, torn paper, stickers, handwriting fixtures, confetti, social metrics, or mascot.

## Motion and Reduced Motion

| Event | Default | Reduce Motion |
| --- | --- | --- |
| Feed page change | Native deceleration and page settle, no scale effect | Direct page settle without spring/scale. |
| Original / Me | 160-200 ms crossfade | Immediate replacement with state announcement. |
| Save | 180-220 ms cutout placement/ease-out | Color/icon state change only. |
| Skip | Page advances after action acknowledgment | Immediate advance. |
| Import sheet | Native sheet presentation | Native reduced-motion behavior. |
| Processing | Determinate step text; subtle system progress | Same text and static progress indicator. |

No ambient looping animation. Motion never communicates the only evidence of success or failure.

## Assets and Ownership

- Runtime retailer images: external source evidence; display under product/runtime terms and retain source link.
- User fit photo: sensitive user-provided asset; never bundled in product source.
- Generated Me image: runtime output; label as visualization and preserve deletion/privacy route.
- Garment cutouts: derived at runtime from user/retailer imagery; rectangular fallback required.
- SF Symbols: production icon source.
- New York/SF system fonts: production typography route; no external font dependency.
- `hybrid-v1-board.png` and `today-paging-d2-board.png`: directional fixtures only, never shipped as UI or brand assets.
- Existing debug Unsplash imagery: must not ship as user or retailer data.

## Exact Copy and Typography

### Global

- Tabs: `Today`, `Closet`, `Me`.
- Add accessibility label: `Add to Cloak`.
- Context: `For you`.

### Today

- Compare: `Original`, `Me`.
- Evidence count: `Works with {count} pieces you own`.
- Sparse evidence: `Build your closet to compare outfits`.
- Decisions: `Skip`, `Save`, `Saved`, `Shop`.
- Source: `View source`.
- AI disclosure in detail: `This is an AI visualization. Color, details, and physical fit may vary.`

### Pipeline

- `Finding the best image`
- `Making it yours`
- `Ready to compare`
- Failure: `We couldn't make this one yours.`
- Failure actions: `Try again`, `Choose another image`.

### Closet

- Title: `Closet`.
- Sections: `Saved`, `Tried`, `Owned`.
- Empty saved: `Nothing saved yet` / `Save a look from Today and it will stay here.`
- Empty tried: `No completed looks` / `Finished try-ons will collect here.`
- Empty owned: `No confirmed pieces` / `Opening a retailer never marks an item as owned.`

### Me

- Title: `Your style, remembered`.
- Sections: `Fit photo`, `Your taste`, `Recent decisions`, `Privacy & data`, `About Cloak`.
- No-signal state: `Cloak learns from what you save, skip, try, and shop.`

## Accessibility

- All actions have 44 x 44 point minimum targets and explicit labels.
- VoiceOver reading order follows visual hierarchy; garment image descriptions include garment type and current Original/Me state, not appearance judgments.
- `PagedLookFeed` exposes adjustable actions for next and previous look.
- After paging, VoiceOver focus moves to the new garment title; after Save/Skip, announce the result once.
- Original/Me and Saved state expose `.isSelected` or equivalent traits.
- Dynamic Type is supported through accessibility sizes.
- At accessibility sizes, image height contracts, garment title remains at two lines, compatibility thumbnails become a labelled count row, and detail overflow moves to the sheet.
- Color is paired with text/icon state. Ownership always includes `Owned`.
- Final implementation must verify contrast programmatically or with Accessibility Inspector.
- Reduce Transparency uses opaque surfaces. No information depends on blur.
- Reduce Motion behavior follows the motion table.
- The approved design is light appearance. Production must explicitly set light appearance until a separate dark palette is designed and verified.

## Real Data Replacements

- Mockup retailer names, prices, garments, counts, taste colors, silhouettes, brands, and ownership states are fixtures.
- `WardrobeEvidence` currently contains debug visual data and must be omitted when confirmed backend/local evidence is unavailable.
- Taste dimensions beyond local action totals must not appear until supported by a real recommendation/taste contract.
- Outfit boards require real saved/owned associations; do not generate random boards in production.
- Buy/open retailer remains intent and never changes ownership.
- Fit photo and generated output must come from the active profile only.

## Implementation Order

1. Replace visual tokens and shared controls in `CloakTheme.swift`; add contrast-focused tests or assertions where practical.
2. Change `AppTab.discover` display title to `Today`; replace the custom four-item shell in `AppShellView.swift` with three destinations and a Today toolbar Add command.
3. Preserve `ScrollView` paging in `FeedView.swift`, then replace `GarmentCard` with fixed-height `LookPage`, media comparison, compatibility, and decision bar.
4. Reuse and consolidate Original/Me and processing semantics from `ResultView.swift`; avoid two competing result presentations.
5. Recompose `ClosetView.swift` around outfit boards and bounded garment cutouts while preserving Saved/Tried/Owned truth.
6. Recompose `ProfileView.swift` around fit photo and real taste memory; retain privacy and data controls.
7. Add empty, failed, offline, long-title, sparse-evidence, and accessibility-size fixtures.
8. Build without booting a simulator, then run the focused runtime screenshot and accessibility matrix on one owned headless simulator.

## Visual Verification

### Static/build gate

```bash
xcodebuild \
  -project ios/Cloak.xcodeproj \
  -scheme Cloak \
  -destination 'generic/platform=iOS Simulator' \
  CODE_SIGNING_ALLOWED=NO \
  build
```

### Required runtime captures

- Today: ready with evidence, ready without evidence, mid-swipe, long title, generation failure.
- Closet: Saved with outfit board, Tried, Owned empty, and image-isolation fallback.
- Me: zero signals, populated real signals, fit-photo replacement entry.
- Import: URL input, extraction progress, failure retained source.

### Viewports and settings

- Compact height: 375 x 667.
- Baseline: 393 x 852.
- Large phone: 430 x 932.
- Default text, XXXL, and one accessibility text size.
- VoiceOver traversal and adjustable next/previous actions.
- Reduce Motion and Reduce Transparency.
- Offline/cached image failure.

Verify no overlaps, clipped controls, nested vertical gesture conflict, blank image regions, incorrect ownership, or tab/add ambiguity. Any simulator booted for this gate must be shut down and verified `Shutdown` before completion.

## Residual Risks

- Today may become vertically cramped on compact-height phones; implementation must prioritize decisions and evidence over price/detail copy.
- Garment cutout quality is source-dependent and may weaken the pinboard metaphor; the rectangular fallback must look intentional.
- The current data model cannot yet support the full visual taste-memory mockup.
- Original and generated imagery may have incompatible aspect ratios; comparison framing rules require runtime testing.
- Light-only appearance is a deliberate v1 limitation and must be revisited before dark mode is enabled.
- Generated mockups show directional text and imagery, not final assets or pixel specifications.

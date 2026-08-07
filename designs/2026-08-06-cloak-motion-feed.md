# Cloak Motion Feed — Full-Bleed Video Design Spec

Status: draft for review. Pairs with `specs/2026-08-06-tryon-agent-checkout.md`
(P1 motion try-on).

Relationship to prior design decisions:

- **Supersedes the layout system** of
  `designs/2026-08-01-cloak-personal-wardrobe-board/production-design-spec.md`
  for the `Today` tab only. That spec was designed for still-image results; the
  motion pipeline outputs 9:16 video, and boxing video into a 55% image area on
  a light canvas wastes the most expensive asset in the product.
- **Preserves its decision model unchanged:** wardrobe evidence contract, no
  social metrics, three tabs, explicit ownership states, ungraded imagery,
  impression/skip semantics, `NOT OWNED` honesty.
- **Revives and extends** `designs/2026-08-01-cloak-full-screen-glass.md`
  (implemented, then superseded) — full-bleed surface, one bottom glass layer,
  no social trade dress. Video is the reason it comes back.
- `Closet` and `Me` tabs keep the light editorial system from the production
  spec. Only the feed goes dark. The app reads as: gallery-dark where content
  performs, editorial-light where you manage.

## Design Brief

```
Direction: Gallery Editorial, dark variant — full-bleed video, UI recedes,
           chrome is invisible until needed. TikTok's immersion and rhythm,
           none of its social chrome or trade dress.
Density:   one look per viewport; max 3 decisions + 1 evidence line on feed
Surface:   full-bleed 9:16 video on warm near-black; one bottom glass band;
           deterministic scrims, never floating cards
Type mood: quiet, editorial, label-like — text annotates the video, never
           competes with it
Motion:    deterministic snap, poster→video crossfade, no bounce
Do:
  - let the video be the entire interface; every chrome pixel must justify itself
  - keep Original / Me one tap away at all times
  - keep decisions (Save / Buy) as labeled buttons, not icon mystery meat
  - use scrims for text legibility, sized to content, top and bottom only
  - keep wardrobe evidence to a single tappable line on the feed
Don't:
  - right-side vertical icon rail (TikTok trade dress + social chrome)
  - like/comment/share counts, avatars, usernames, follow anything
  - color-grade or filter the video; garment color is source truth
  - pure #000 backgrounds; use warm near-black
  - burden the feed with size/fit claims before P2 has evidence
```

## Tokens

Dark-surface adaptation of the existing warm palette. Light-canvas tokens from
the production spec remain authoritative for Closet / Me / sheets.

| Token | Value | Use |
| --- | --- | --- |
| `stage` | `#161114` | Feed background behind/around video; warm near-black, never `#000` |
| `stageInk` | `#F5EFF0` | Primary text on stage/scrim |
| `stageMuted` | `rgba(245,239,240,0.64)` | Secondary metadata on scrim |
| `action` | `#D65B48` | Primary CTA on dark (`Buy`, `Try on`); the light-spec `#B74637` fails contrast on video scrims |
| `actionInk` | `#FFFFFF` | Text on `action` |
| `glass` | system dark material | Bottom band, segmented control, toolbar buttons |
| `scrimTop` | linear, `rgba(22,17,20,0.55)` → clear, height 96pt | Status bar + toolbar legibility |
| `scrimBottom` | linear, clear → `rgba(22,17,20,0.72)`, height ≈ 34% of viewport | Metadata + action legibility |
| `owned` | `#9DB894` | Ownership signal on dark (light-spec `#586B52` fails on dark) |
| `evidence` | `#93B0D3` | Evidence/source links on dark |
| `generating` | `stageMuted` | Status chip text during queue/processing |

Rules carried over: semantic meaning never relies on color alone; video and
product imagery are never graded, tinted, or filtered — scrims sit *over* dead
zones (top/bottom), not across the garment.

## Typography

Same roles as the production spec, re-weighted for dark:

| Role | SwiftUI route | Notes |
| --- | --- | --- |
| Garment title on feed | `.system(.title3, design: .serif, weight: .medium)` | One line, truncate; serif keeps the editorial voice on dark |
| Brand + price | `.subheadline.weight(.semibold)` + `.subheadline` | `stageInk` / `stageMuted` |
| Evidence line | `.caption` | Single line, `evidence` color, tappable |
| Controls | `.subheadline.weight(.semibold)` | 44pt min targets |
| Status chips | `.caption.weight(.semibold)` | GENERATING / FAILED / NOT OWNED |

Zero letter spacing except the `CLOAK` wordmark. Nothing on the feed exceeds
title3 — the video is the headline.

## Viewport Anatomy

```
┌──────────────────────────────┐
│ ▒ scrimTop                   │
│ CLOAK          For you   ＋  │  toolbar: wordmark, feed label, Add
│                              │
│                              │
│        FULL-BLEED            │  9:16 motion video, fills viewport
│        MOTION VIDEO          │  edge-to-edge, extends under tab bar
│        (you, turning)        │
│                              │
│              ┌ Original│Me ┐ │  glass segmented pill, bottom-right,
│                              │  above metadata stack
│ ▒ scrimBottom                │
│ Rick Owens                   │  brand        (metadata stack,
│ Oversized Cotton Top         │  title         bottom-left,
│ $580 · NOT OWNED             │  price+state   left-aligned)
│ ⌂ pairs with 2 owned pieces  │  evidence line (omit if none)
│ [   Save   ] [  Buy it  ]    │  action row on glass band
│──────────────────────────────│
│   Today    Closet    Me      │  native tab bar, dark material
└──────────────────────────────┘
```

Composition rules:

- Video is `aspectFill` to the viewport. Subject framing comes from the
  guided 3s capture (medium-full body), so `aspectFill` crops walls, not the
  person.
- All interactive controls live above the tab bar safe area. The video may run
  underneath the tab bar (dark material); decisions never do.
- Metadata stack is bottom-left, max 4 lines. Anything longer lives in the
  detail sheet (swipe left or tap title).
- No nested vertical scrolling on a page — unchanged from the production spec.
- The `Original | Me` pill anchors bottom-right, clear of the metadata stack.
  `Me` shows the motion video; `Original` shows the retailer's source image
  (still). Switching never changes feed index — unchanged rule.

## Video Behavior

| Event | Behavior |
| --- | --- |
| Page settles | Poster frame (`result_url`) visible immediately; video crossfades in ≤300ms once ready and plays |
| Playback | Autoplay, loop seamlessly, always silent (VTON output has no audio; no mute toggle exists) |
| Scroll away | Player pauses and releases; poster remains for instant back-swipe |
| Tap-and-hold on video | Pause while held (inspection), resume on release |
| Double-tap on video | Save, with undo toast — the one borrowed gesture, because it maps to our decision model, not to a social one |
| Tap on video (single) | Nothing. Single-tap ambiguity kills trust in gesture surfaces |
| Off-screen prefetch | Preload next page's poster + video; never more than one ahead |

## States

| State | Feed presentation |
| --- | --- |
| `queued` / `processing` | `Original` image full-bleed + glass chip `GENERATING YOUR LOOK` with indeterminate progress; `Me` segment disabled |
| `completed` | Default segment = `Me` (motion video) |
| `failed` | `Original` full-bleed + chip `COULDN'T GENERATE — RETRY`; retry is a 44pt button, not the chip itself |
| Still-image legacy looks | Render exactly as before in the same feed; `Me` shows the still; no fake motion |
| No body video yet | First feed cell is the capture invitation card (stage bg, not video); every look shows `Original` only with a `See it on you` CTA routing to capture |

## Motion

- Paging: deterministic snap, spring settle ≈ 350ms, no overshoot bounce.
- Poster → video: opacity crossfade 300ms. Video → poster on exit: 150ms.
  (Entry longer than exit.)
- Segmented `Original|Me`: content cross-dissolve 200ms in place, no slide.
- Save confirmation: button fills `actionSoft`-on-dark, check 300ms; no
  full-screen hearts, no particle effects.
- Reduce Motion: no autoplay — poster with a play button; crossfades become
  cuts; paging snap without spring.

## Accessibility

- Reduce Transparency: glass band and pills become opaque `stage` with a 1px
  `stageMuted` border.
- VoiceOver: page announces "Look 3 of 12, Rick Owens Oversized Cotton Top,
  five hundred eighty dollars, not owned, showing on you." Custom
  next/previous-page rotor actions carry over from `PagedLookFeed`.
- Video gets a text alternative: "Video of you wearing [title], turning."
- All decision controls: visible labels + ≥44pt. Double-tap-to-save has a
  labeled equivalent (the Save button) — gestures are never the only path.
- Contrast: `stageInk` on `scrimBottom` ≥ 4.5:1 at the metadata baseline;
  verify at the scrim's weakest point, not its darkest.

## What This Deliberately Refuses

Carrying the production spec's ethics onto a dark surface:

- No like counts, view counts, comments, shares-as-metric, or any number that
  performs popularity. Cloak is a private mirror, not an audience.
- No right-side icon rail. That silhouette *is* TikTok's trade dress, and every
  icon on it is social chrome we don't have.
- No infinite-algorithm cosplay: the feed is the user's own saved items ordered
  by recency/taste, and the label says `For you` over *their* wardrobe, not a
  discovery firehose.
- No fabricated fit or compatibility claims. Size suggestions appear only when
  P2 ships with evidence; until then price + ownership state only.
- No dark-pattern urgency (stock counters, timers) anywhere near `Buy`.

## Anti-Slop Check

- Pure `#000`: none — `stage` is `#161114` warm near-black. PASS
- `transition: all`: n/a in SwiftUI; no implicit `.animation(nil)` blankets.
  PASS by construction, verify in review.
- Single accent: `action` persimmon is the only saturated UI color on the
  feed; `owned`/`evidence` are desaturated signal tints. PASS
- Type restraint: 2 families (SF + serif titles), 3 weights, 5 sizes. PASS
- Convergence test: full-bleed personal video with serif annotation and no
  social rail does not read as template output. PASS
- Flag: glass-on-video is currently a common AI-generated aesthetic. What
  keeps this out of slop territory is restraint — one glass band, scrims only
  in dead zones, and labeled text buttons instead of icon grids. Hold that
  line in implementation.

## Fitting Room (P4) — Direction Sketch

The second surface of the same engine (see spec § Two try-on surfaces). Not
designed in detail here — direction constraints only, so the feed's system
extends instead of forking:

- Same `stage` dark system as the feed. The fitting room is the feed's
  full-intent sibling, not a new aesthetic.
- Entered deliberately from the shortlist ("Try these on live"), never
  ambiently. Session framing: explicit start, visible LIVE indicator with
  elapsed time, hard cap ~3 min with one-tap extend. The meter is honest —
  never hidden.
- Layout: live mirror full-bleed; the shortlist as a horizontal thumbnail rail
  at the bottom (glass), tap or swipe to swap garments in place. No vertical
  paging — this surface compares, it does not browse.
- The rail is the one place a horizontal element exists in the app; it earns
  it because comparison is horizontal by nature.
- Exit state is a decision: each garment card carries `Buy` with the size
  pre-selected (P2). Ending a session without choosing prompts once — "keep
  your favorite?" — then lets go. No guilt loops.
- Reduce Motion / camera-denied: fitting room falls back to the batch feed
  gracefully; it is an enhancement tier, never the only path to purchase.

## Open Questions (need JhiNResH's call)

1. Swipe-left on a page → detail sheet or push? Production spec used sheets
   for overflow; TikTok muscle memory says swipe-left = profile. Proposal:
   swipe-left opens the detail sheet, same as tapping the title.
2. Does `Skip` survive as an explicit control, or is swiping past the implicit
   skip signal? Proposal: implicit only on the feed (swipe past after
   impression threshold = skip event), explicit Skip stays in the detail sheet.
3. Capture invitation frequency for users who declined body video — every
   session start, or once per N sessions?

## Verification

- SwiftUI implementation builds for the `Cloak` scheme.
- Simulator renders: completed motion look, generating state, failed state,
  legacy still look, and no-body-video state.
- Reduce Motion and Reduce Transparency runtime passes on at least the feed.
- Contrast measured on a real video frame at the metadata baseline, not on a
  mock.

# Cloak Full-Screen Glass

Status: implemented on 2026-08-01, then superseded by
`designs/2026-08-01-cloak-personal-wardrobe-board/production-design-spec.md`.

## Direction

Cloak uses a vertically paged, full-screen fashion surface with transparent
controls. It adapts the immersion and one-item-per-viewport behavior of short
video feeds without copying social engagement chrome or trade dress.

- Save and Skip are secondary glass actions.
- Try on and Open retailer use translucent berry as the primary action.
- The garment or try-on result remains visible behind one bottom glass layer.
- `NOT OWNED` remains explicit until confirmed ownership exists.
- Original / Me comparison remains visible on completed results.

## Color Roles

- Warm ink: `#30262A`
- Rose canvas: `#FBEFED`
- Porcelain: `#FFF9F6`
- Soft berry action: `#BA425F`
- Sage ownership: `#61725E`
- Soft sage evidence: `#C8D6C3`
- Denim provenance: `#456C7D`
- Rose divider: `#DFC8CC`

Product imagery is never color-graded. Retailer garment color remains source
truth.

## Wardrobe Evidence Contract

Personal warmth comes from confirmed wardrobe continuity, not decoration.

- Show at most two owned pieces, one wear-memory signal, and one rationale.
- Every recommendation must expose the owned evidence supporting it.
- Omit the entire module when confirmed evidence is unavailable.
- `buy_clicked` is interest, not ownership.
- Current owned pieces, wear count/date, and rationale are DEBUG visual fixtures;
  production does not fabricate these values.

## Accessibility

- Actions use at least 44-point targets with visible labels.
- Material controls have deterministic dark scrims and borders.
- Reduce Transparency replaces Material with opaque warm ink.
- Reduce Motion removes positional movement while preserving state changes.

## Verification

- Generic iOS Simulator build passed with signing disabled.
- Feed and completed-result states were rendered on a headless iPhone 15 Pro
  simulator running iOS 26.5.
- The task-created simulator was shut down, verified, and deleted.
- VoiceOver, accessibility Dynamic Type, and Reduce Transparency runtime QA
  remain follow-up work.

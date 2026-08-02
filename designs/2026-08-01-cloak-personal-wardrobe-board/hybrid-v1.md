# Hybrid v1

## Preview

Working title: **The Personal Wardrobe Board**.

Rendered D2 board: `hybrid-v1-board.png` (1536 x 1024).

Focused Today paging revision: `today-paging-d2-board.png` (1710 x 919). This board supersedes the original preview's four-item bottom navigation and defines the settled -> swipe up -> settled interaction.

The shell behaves like a disciplined editorial product. The content behaves like a living wardrobe: the user's generated look is composed with a small number of confirmed owned pieces and a concise, evidence-backed recommendation.

## Screen Mapping

### Today / Discover

- Compact `CLOAK` wordmark and `For you` context label.
- The feed pages vertically with one look per viewport and deterministic snap behavior.
- Swipe up advances to the next look; swipe down returns to the previous look.
- Each page is internally fixed-height and does not contain a competing vertical scroll region.
- A portrait-oriented Me frame occupying roughly 58% of the usable height.
- Original / Me control attached to the frame, not floating elsewhere.
- Up to three owned garment cutouts form one compatibility strip below the image.
- Product name and source use a compact editorial caption hierarchy.
- Bottom decision row: Skip icon, primary Save, retailer arrow. No vertical action rail.
- Longer product details open in a sheet so the paging gesture remains predictable.

### Closet

- Compact title: `Closet`, not `Your closet` at hero scale.
- Saved / Tried / Owned is a native segmented control.
- Default view presents outfit boards first, then individual garments.
- Clean garment cutouts sit on gallery white with stable image bounds.
- Ownership is shown with a small green semantic marker and text, never inferred from retailer clicks.

### Me

- `Your style, remembered` is the content thesis.
- Fit photo appears as a useful source asset with update control.
- Taste memory uses a small visual row of learned colors, silhouettes, and brands backed by real signals.
- Privacy and settings remain accessible below the personal content.

### Import / Preparing

- Source thumbnail, retailer, and garment title appear immediately.
- Progress language maps to real pipeline states: `Finding the best image`, `Making it yours`, `Ready to compare`.
- Failed source extraction offers paste image or retry without losing the saved link.

## Unified Shell

### Color

- Gallery white: `#F8F7F4` for the app canvas.
- Plum ink: `#2C252A` for primary text and iconography.
- Tomato: `#D65B48` for Save and primary action.
- Cornflower: `#657FA8` for source, comparison, and recommendation evidence.
- Leaf: `#71816A` for confirmed ownership only.
- Pale lilac: `#DED9EA` for user-authored notes or a single supporting emphasis.
- Retailer imagery remains ungraded and supplies most of the screen color.

### Typography

- Native San Francisco for navigation, controls, metadata, and body copy.
- New York serif only for garment/look titles at 24-30 points.
- No utility heading larger than 34 points.
- Letter spacing remains zero except the compact existing wordmark.

### Shape and Spacing

- 4-point base grid; primary page inset 20 points.
- Image and board radius: 4-6 points maximum.
- Controls use native circles or capsules only when their interaction requires it.
- No nested cards and no floating section containers.

### Iconography

- SF Symbols, medium weight.
- Text labels accompany ambiguous actions.
- No sparkle icon as the persistent product identity.

### Navigation

- Native three-item bottom tab bar with `Today`, `Closet`, and `Me`.
- Add moves to the Today top bar as a command; the iOS Share Sheet remains the primary capture path.
- The shell is opaque or lightly materialized only at the safe-area edge; it never covers decision content.

## Product State Model

| State | Visible proof | Main action | Accent |
| --- | --- | --- | --- |
| Imported | Source thumbnail and URL host | Continue in background | Cornflower |
| Preparing | Current pipeline step | Cancel or leave | Cornflower |
| Ready | Me image plus Original control | Save | Tomato |
| Needs attention | Failed step and retained source | Retry / choose image | Tomato |
| Saved | Saved confirmation and closet destination | View closet | Tomato |
| Opened retailer | Merchant handoff acknowledgment | Return to Cloak | Cornflower |
| Owned | Explicit confirmation and owned date | Build outfits | Leaf |

## Feedback and Expressive Mechanism Rules

- A completed vertical swipe settles on exactly one new look; partial pages spring back without changing the taste model.
- Page impression is recorded only after the look settles and meets the visibility-duration threshold.
- Saving places a garment cutout into the compatibility strip with one short ease-out transition.
- Switching Original / Me crossfades in place; Reduce Motion uses an immediate state change.
- The compatibility explanation cites no more than three confirmed pieces and one behavior signal.
- A sparse closet shows one helpful add-from-photo action instead of fabricated evidence.
- No confetti, looping motion, social counts, creator handles, or public reactions.
- Reduce Motion removes spring/scale effects but keeps direct paged navigation; VoiceOver exposes next/previous look actions.

## Generated-Fixture Caveats

- Mockup portraits, garment cutouts, retailer names, prices, and recommendation copy are illustrative.
- Generated text and icon geometry are not production assets.
- The preview's tab icons, segmentation, and action widths communicate hierarchy only; production must use native controls and measured tap targets.
- The production app must use SF Symbols, real retailer imagery, real user photos, and real state data.

## Remaining Risks

- The composition may feel empty with one or zero owned items; sparse-state mockups are required before implementation.
- Garment cutout quality may vary by source and needs a bounded rectangular fallback.
- Today pages can become vertically cramped with long product names or accessibility text sizes; production must cap the compact caption at two lines and move overflow details into a sheet.
- Accessibility contrast must be measured on the final native implementation, especially tomato on gallery white.

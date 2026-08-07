import SwiftUI

/// Overflow detail for one look. The feed page never scrolls; everything that
/// does not fit lives here.
struct LookDetailSheet: View {
    let look: FeedLook
    let primaryLabel: String
    let onPrimary: () -> Void
    let onSkip: () -> Void
    let onBuy: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            header

            HStack(alignment: .top, spacing: 14) {
                RemoteFillImage(url: look.originalUrl, localData: look.garment.localImageData)
                    .frame(width: 78, height: 104)
                    .clipShape(RoundedRectangle(cornerRadius: 8, style: .continuous))

                VStack(alignment: .leading, spacing: 4) {
                    if let brand = look.brand {
                        Text(brand)
                            .font(.footnote.weight(.semibold))
                    }
                    Text(look.title)
                        .font(.system(.title2, design: .serif, weight: .medium))
                        .fixedSize(horizontal: false, vertical: true)
                    HStack(alignment: .firstTextBaseline, spacing: 7) {
                        if let price = look.price {
                            Text(price)
                        }
                        Text("·").foregroundStyle(CloakTheme.paperInk.opacity(0.5))
                        Text(look.ownershipLabel)
                            .font(.caption2.weight(.semibold))
                            .tracking(1)
                            .foregroundStyle(
                                look.isOwned ? CloakTheme.paperOwned : CloakTheme.paperInk.opacity(0.72)
                            )
                    }
                    .font(.subheadline)
                    .padding(.top, 2)
                }
            }

            Rectangle()
                .fill(CloakTheme.paperInk.opacity(0.1))
                .frame(height: 1)
                .padding(.vertical, 18)

            evidenceSection

            Spacer(minLength: 12)

            Text("No size or fit claim until fit data exists.")
                .font(.caption)
                .foregroundStyle(CloakTheme.paperInk.opacity(0.68))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.bottom, 12)

            actions
        }
        .foregroundStyle(CloakTheme.paperInk)
        .padding(.horizontal, 20)
        .padding(.bottom, 20)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .background(CloakTheme.paper)
    }

    private var header: some View {
        HStack {
            Spacer()
            Button("Done", action: onClose)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CloakTheme.paperAction)
                .frame(height: 44)
        }
        .padding(.bottom, 4)
    }

    @ViewBuilder
    private var evidenceSection: some View {
        // Omit the whole module when there is no confirmed evidence.
        if let evidence = look.evidence, !evidence.pieces.isEmpty {
            Text("WARDROBE EVIDENCE")
                .font(.caption2.weight(.semibold))
                .tracking(1.3)
                .foregroundStyle(CloakTheme.paperInk.opacity(0.72))

            HStack(alignment: .center, spacing: 10) {
                ForEach(Array(evidence.pieces.prefix(2))) { piece in
                    RemoteFillImage(url: piece.imageUrl)
                        .frame(width: 70, height: 88)
                        .clipShape(RoundedRectangle(cornerRadius: 7, style: .continuous))
                        .accessibilityLabel("Owned: \(piece.title)")
                }

                Text(evidence.rationale)
                    .font(.footnote)
                    .foregroundStyle(CloakTheme.paperInk.opacity(0.68))
                    .fixedSize(horizontal: false, vertical: true)
            }
            .padding(.top, 12)
        }
    }

    private var actions: some View {
        HStack(spacing: 9) {
            Button("Skip", action: onSkip)
                .buttonStyle(SheetOutlineButtonStyle(fills: false))

            Button(primaryLabel, action: onPrimary)
                .buttonStyle(SheetOutlineButtonStyle(fills: true))

            Button("Buy it", action: onBuy)
                .buttonStyle(SheetFilledButtonStyle())
        }
    }
}

private struct SheetOutlineButtonStyle: ButtonStyle {
    let fills: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CloakTheme.paperInk)
            .padding(.horizontal, fills ? 0 : 18)
            .frame(maxWidth: fills ? .infinity : nil)
            .frame(height: 48)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(configuration.isPressed ? CloakTheme.paperInk.opacity(0.06) : .clear)
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(CloakTheme.paperInk.opacity(0.18))
            )
    }
}

private struct SheetFilledButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(configuration.isPressed
                          ? CloakTheme.paperAction.opacity(0.85)
                          : CloakTheme.paperAction)
            )
    }
}

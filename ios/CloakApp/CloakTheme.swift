import SwiftUI

enum CloakTheme {
    static let ink = Color(red: 48 / 255, green: 38 / 255, blue: 42 / 255)
    static let canvas = Color(red: 251 / 255, green: 239 / 255, blue: 237 / 255)
    static let surface = Color(red: 255 / 255, green: 249 / 255, blue: 246 / 255)
    static let line = Color(red: 223 / 255, green: 200 / 255, blue: 204 / 255)
    static let muted = Color(red: 111 / 255, green: 100 / 255, blue: 104 / 255)
    static let action = Color(red: 186 / 255, green: 66 / 255, blue: 95 / 255)
    static let actionPressed = Color(red: 140 / 255, green: 48 / 255, blue: 74 / 255)
    static let actionSoft = Color(red: 244 / 255, green: 220 / 255, blue: 225 / 255)
    static let owned = Color(red: 97 / 255, green: 114 / 255, blue: 94 / 255)
    static let ownedSoft = Color(red: 200 / 255, green: 214 / 255, blue: 195 / 255)
    static let sourceInfo = Color(red: 69 / 255, green: 108 / 255, blue: 125 / 255)

    static let imageScrim = LinearGradient(
        stops: [
            .init(color: ink.opacity(0.52), location: 0),
            .init(color: ink.opacity(0.04), location: 0.24),
            .init(color: ink.opacity(0.04), location: 0.5),
            .init(color: ink.opacity(0.9), location: 1),
        ],
        startPoint: .top,
        endPoint: .bottom
    )
}

struct CloakGlassBackground: View {
    var opacity = 0.54
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        ZStack {
            if !reduceTransparency {
                Rectangle().fill(.ultraThinMaterial)
            }
            Rectangle()
                .fill(CloakTheme.ink.opacity(reduceTransparency ? 0.96 : opacity))
        }
    }
}

struct CloakRailAction: View {
    let systemImage: String
    let title: String
    var isPrimary = false
    let action: () -> Void
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        Button(action: action) {
            VStack(spacing: 4) {
                ZStack {
                    if !reduceTransparency && !isPrimary {
                        Circle().fill(.ultraThinMaterial)
                    }
                    Circle()
                        .fill(backgroundColor)
                    Circle()
                        .stroke(CloakTheme.surface.opacity(isPrimary ? 0.58 : 0.4))
                    Image(systemName: systemImage)
                        .font(.system(size: 18, weight: .semibold))
                }
                .frame(width: 48, height: 48)
                .shadow(color: CloakTheme.ink.opacity(0.24), radius: 10, y: 4)

                Text(title)
                    .font(.caption2.weight(.bold))
                    .lineLimit(1)
                    .shadow(color: CloakTheme.ink, radius: 5, y: 2)
            }
            .frame(width: 58)
            .foregroundStyle(CloakTheme.surface)
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }

    private var backgroundColor: Color {
        if isPrimary {
            return CloakTheme.action.opacity(reduceTransparency ? 1 : 0.82)
        }
        return CloakTheme.ink.opacity(reduceTransparency ? 0.96 : 0.32)
    }
}

struct CloakWardrobeEvidenceView: View {
    let evidence: WardrobeEvidence

    var body: some View {
        VStack(alignment: .leading, spacing: 9) {
            HStack(spacing: 8) {
                ForEach(Array(evidence.pieces.prefix(2))) { piece in
                    ZStack(alignment: .topTrailing) {
                        AsyncImage(url: piece.imageUrl) { phase in
                            if case .success(let image) = phase {
                                image
                                    .resizable()
                                    .scaledToFill()
                            } else {
                                CloakTheme.surface.opacity(0.12)
                            }
                        }
                        .frame(width: 44, height: 52)
                        .clipped()
                        .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.32)))

                        Circle()
                            .fill(CloakTheme.owned)
                            .frame(width: 9, height: 9)
                            .overlay(Circle().stroke(CloakTheme.surface, lineWidth: 2))
                            .padding(4)
                    }
                    .accessibilityElement(children: .ignore)
                    .accessibilityLabel("Owned: \(piece.title)")
                }

                VStack(alignment: .leading, spacing: 3) {
                    Text("Your reliable base")
                        .font(.caption.weight(.bold))
                        .foregroundStyle(CloakTheme.surface)
                    wearSummary
                        .font(.caption2)
                        .foregroundStyle(CloakTheme.surface.opacity(0.74))
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            Text(evidence.rationale)
                .font(.system(.caption, design: .serif))
                .foregroundStyle(CloakTheme.surface.opacity(0.82))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.leading, 10)
                .overlay(alignment: .leading) {
                    Rectangle()
                        .fill(CloakTheme.actionSoft)
                        .frame(width: 2)
                }
        }
    }

    private var wearSummary: Text {
        var result = Text("")
        if let wearCount = evidence.wearCount {
            result = Text("\(wearCount)")
                .font(.system(.subheadline, design: .serif, weight: .medium))
                .foregroundColor(CloakTheme.ownedSoft)
                + Text(" wears")
        }
        if let lastWorn = evidence.lastWorn {
            if evidence.wearCount != nil {
                result = result + Text(" · ")
            }
            result = result + Text(lastWorn)
        }
        return result
    }
}

struct CloakGlassPrimaryButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: 48)
            .foregroundStyle(CloakTheme.surface)
            .background(
                configuration.isPressed
                    ? CloakTheme.actionPressed
                    : CloakTheme.action.opacity(reduceTransparency ? 1 : 0.84)
            )
            .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.38)))
    }
}

struct CloakWordmark: View {
    var color: Color = CloakTheme.surface

    var body: some View {
        Text("CLOAK")
            .font(.caption2.weight(.bold))
            .tracking(3)
            .foregroundStyle(color)
            .accessibilityAddTraits(.isHeader)
    }
}

struct CloakPrimaryButtonStyle: ButtonStyle {
    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: 50)
            .foregroundStyle(CloakTheme.surface)
            .background(configuration.isPressed ? CloakTheme.actionPressed : CloakTheme.action)
    }
}

struct CloakComparisonControl: View {
    @Binding var showsOriginal: Bool

    var body: some View {
        HStack(spacing: 0) {
            comparisonButton("Original", selected: showsOriginal) {
                showsOriginal = true
            }
            comparisonButton("Me", selected: !showsOriginal) {
                showsOriginal = false
            }
        }
        .padding(3)
        .frame(width: 132, height: 36)
        .background(CloakTheme.ink.opacity(0.42))
        .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.38)))
    }

    private func comparisonButton(_ title: String, selected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            Text(title)
                .font(.caption2.weight(.bold))
                .frame(maxWidth: .infinity, maxHeight: .infinity)
                .foregroundStyle(selected ? CloakTheme.action : CloakTheme.surface)
                .background(selected ? CloakTheme.surface : .clear)
        }
        .buttonStyle(.plain)
        .accessibilityAddTraits(selected ? .isSelected : [])
    }
}

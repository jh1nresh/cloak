import SwiftUI

private enum ClosetSection: String, CaseIterable, Identifiable {
    case saved = "Saved"
    case tried = "Tried"
    case owned = "Owned"

    var id: String { rawValue }
}

struct ClosetView: View {
    @ObservedObject var store: AppStore
    @State private var section: ClosetSection = .saved

    private let columns = [
        GridItem(.flexible(), spacing: 10),
        GridItem(.flexible(), spacing: 10),
    ]

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                pageHeader
                sectionPicker
                    .padding(.top, 22)
                content
                    .padding(.top, 18)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 116)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
        .task {
            await store.loadFeed()
        }
    }

    private var pageHeader: some View {
        VStack(alignment: .leading, spacing: 10) {
            CloakWordmark(color: CloakTheme.ink)
            Text("Your closet")
                .font(.system(.largeTitle, design: .serif, weight: .medium))
                .foregroundStyle(CloakTheme.ink)
            Text("Pieces you kept, looks you tried, and purchases with confirmed ownership.")
                .font(.subheadline)
                .foregroundStyle(CloakTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var sectionPicker: some View {
        Picker("Closet section", selection: $section) {
            ForEach(ClosetSection.allCases) { option in
                Text(option.rawValue).tag(option)
            }
        }
        .pickerStyle(.segmented)
        .tint(CloakTheme.action)
    }

    @ViewBuilder
    private var content: some View {
        switch section {
        case .saved:
            if store.savedGarments.isEmpty {
                ClosetEmptyState(
                    systemImage: "bookmark",
                    title: "Nothing saved yet",
                    message: "Keep a piece from Discover and it will stay here.",
                    actionTitle: "Browse Discover"
                ) {
                    store.selectedTab = .discover
                }
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(store.savedGarments, id: \.libraryKey) { garment in
                        SavedGarmentTile(store: store, garment: garment)
                    }
                }
            }
        case .tried:
            if store.completedLooks.isEmpty {
                ClosetEmptyState(
                    systemImage: "sparkles",
                    title: "No completed looks",
                    message: "Finished try-ons will collect here automatically.",
                    actionTitle: "Find a piece"
                ) {
                    store.selectedTab = .discover
                }
            } else {
                LazyVGrid(columns: columns, spacing: 12) {
                    ForEach(store.completedLooks) { look in
                        CompletedLookTile(look: look)
                    }
                }
            }
        case .owned:
            ClosetEmptyState(
                systemImage: "checkmark.seal",
                title: "No confirmed pieces",
                message: "Saved items and retailer visits are not treated as ownership.",
                actionTitle: nil,
                action: nil
            )
        }
    }
}

private struct SavedGarmentTile: View {
    @ObservedObject var store: AppStore
    let garment: Garment

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            GarmentImageView(garment: garment)
                .aspectRatio(3 / 4, contentMode: .fill)
                .clipped()

            VStack(alignment: .leading, spacing: 5) {
                Text(garment.brand ?? garment.domain ?? "Saved piece")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(CloakTheme.action)
                    .lineLimit(1)
                Text(garment.title ?? "Untitled garment")
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CloakTheme.ink)
                    .lineLimit(2)
                    .frame(minHeight: 38, alignment: .topLeading)
                if let price = garment.price {
                    Text(price)
                        .font(.caption)
                        .foregroundStyle(CloakTheme.muted)
                }

                HStack(spacing: 8) {
                    Button {
                        Task { await store.tryOn(garment) }
                    } label: {
                        Image(systemName: "sparkles")
                            .frame(maxWidth: .infinity)
                    }
                    .buttonStyle(ClosetIconButtonStyle(isPrimary: true))
                    .accessibilityLabel("Try on \(garment.title ?? "saved piece")")

                    Menu {
                        if garment.sourceUrl != nil {
                            Button {
                                Task { await store.buy(garment) }
                            } label: {
                                Label("Open retailer", systemImage: "arrow.up.right")
                            }
                        }
                        Button(role: .destructive) {
                            store.removeSaved(garment)
                        } label: {
                            Label("Remove from saved", systemImage: "bookmark.slash")
                        }
                    } label: {
                        Image(systemName: "ellipsis")
                            .frame(width: 42, height: 42)
                    }
                    .buttonStyle(ClosetIconButtonStyle(isPrimary: false))
                    .accessibilityLabel("More actions")
                }
                .padding(.top, 7)
            }
            .padding(10)
        }
        .background(CloakTheme.surface)
        .overlay(Rectangle().stroke(CloakTheme.line))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

private struct CompletedLookTile: View {
    let look: CompletedLook

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            AsyncImage(url: look.resultUrl) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    UnavailableImageView()
                case .empty:
                    ProgressView().tint(CloakTheme.action)
                @unknown default:
                    UnavailableImageView()
                }
            }
            .frame(maxWidth: .infinity)
            .aspectRatio(3 / 4, contentMode: .fill)
            .clipped()

            VStack(alignment: .leading, spacing: 5) {
                Text(look.brand ?? "TRY-ON")
                    .font(.caption2.weight(.bold))
                    .foregroundStyle(CloakTheme.action)
                    .lineLimit(1)
                Text(look.title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CloakTheme.ink)
                    .lineLimit(2)
                    .frame(minHeight: 38, alignment: .topLeading)
                Text(look.completedAt.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(CloakTheme.muted)
            }
            .padding(10)
        }
        .background(CloakTheme.surface)
        .overlay(Rectangle().stroke(CloakTheme.line))
        .clipShape(RoundedRectangle(cornerRadius: 4))
    }
}

private struct ClosetEmptyState: View {
    let systemImage: String
    let title: String
    let message: String
    let actionTitle: String?
    let action: (() -> Void)?

    var body: some View {
        VStack(spacing: 14) {
            Image(systemName: systemImage)
                .font(.system(size: 34, weight: .light))
                .foregroundStyle(CloakTheme.action)
            Text(title)
                .font(.system(.title2, design: .serif, weight: .medium))
                .foregroundStyle(CloakTheme.ink)
            Text(message)
                .font(.subheadline)
                .foregroundStyle(CloakTheme.muted)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
            if let actionTitle, let action {
                Button(actionTitle, action: action)
                    .buttonStyle(CloakPrimaryButtonStyle())
                    .padding(.top, 8)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.horizontal, 24)
        .padding(.vertical, 64)
    }
}

private struct ClosetIconButtonStyle: ButtonStyle {
    let isPrimary: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.body.weight(.semibold))
            .foregroundStyle(isPrimary ? CloakTheme.surface : CloakTheme.ink)
            .frame(height: 42)
            .background(isPrimary ? CloakTheme.action : CloakTheme.canvas)
            .overlay(Rectangle().stroke(isPrimary ? CloakTheme.action : CloakTheme.line))
            .opacity(configuration.isPressed ? 0.72 : 1)
    }
}

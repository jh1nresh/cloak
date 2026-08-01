import PhotosUI
import SwiftUI

struct FeedView: View {
    @ObservedObject var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedGarment: PhotosPickerItem?

    var body: some View {
        ZStack {
            CloakTheme.ink.ignoresSafeArea()

            ScrollView(.vertical) {
                LazyVStack(spacing: 0) {
                    if store.garments.isEmpty && !store.isLoading {
                        EmptyFeedView {
                            store.presentImport()
                        }
                        .containerRelativeFrame(.vertical)
                    }

                    ForEach(Array(store.garments.enumerated()), id: \.offset) { _, garment in
                        GarmentCard(
                            garment: garment,
                            evidence: store.wardrobeEvidence(for: garment),
                            isSaved: store.isSaved(garment),
                            isLoading: store.isLoading,
                            onTryOn: {
                                Task {
                                    await store.tryOn(garment)
                                }
                            },
                            onSave: {
                                Task {
                                    await store.save(garment)
                                }
                            },
                            onSkip: {
                                Task {
                                    await store.skip(garment)
                                }
                            },
                            onOpenRetailer: {
                                Task {
                                    await store.buy(garment)
                                }
                            }
                        )
                        .containerRelativeFrame(.vertical)
                    }
                }
                .scrollTargetLayout()
            }
            .scrollIndicators(.hidden)
            .scrollTargetBehavior(.paging)
            .ignoresSafeArea()

            VStack {
                TopChrome()
                Spacer()
            }

            if store.isImportPresented {
                ImportPanel(
                    text: $store.importURLText,
                    isLoading: store.isLoading,
                    onSubmit: {
                        Task {
                            await store.importGarment()
                            if store.errorMessage == nil {
                                store.isImportPresented = false
                            }
                        }
                    },
                    onClose: {
                        store.isImportPresented = false
                    },
                    uploadPicker: {
                        PhotosPicker(selection: $selectedGarment, matching: .images) {
                            Label("Upload garment image", systemImage: "photo.badge.plus")
                                .font(.subheadline.weight(.semibold))
                                .frame(maxWidth: .infinity)
                                .frame(height: 48)
                                .foregroundStyle(CloakTheme.ink)
                                .background(CloakTheme.surface)
                                .overlay(Rectangle().stroke(CloakTheme.line))
                        }
                    }
                )
                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(reduceMotion ? .linear(duration: 0.15) : .easeOut(duration: 0.22), value: store.isImportPresented)
        .task {
            await store.loadFeed()
        }
        .onChange(of: selectedGarment) { _, newItem in
            guard let newItem else {
                return
            }
            Task {
                await store.addLocalGarment(from: newItem)
                selectedGarment = nil
                store.isImportPresented = false
            }
        }
    }
}

struct GarmentCard: View {
    let garment: Garment
    let evidence: WardrobeEvidence?
    let isSaved: Bool
    let isLoading: Bool
    let onTryOn: () -> Void
    let onSave: () -> Void
    let onSkip: () -> Void
    let onOpenRetailer: () -> Void

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                GarmentImageView(garment: garment)
                    .ignoresSafeArea()

                CloakTheme.imageScrim
                    .ignoresSafeArea()

                sourceChrome
                    .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topTrailing)
                    .padding(.top, 68)
                    .padding(.horizontal, 18)

                actionRail
                    .position(
                        x: max(42, proxy.size.width - 42),
                        y: proxy.size.height * (evidence == nil ? 0.58 : 0.46)
                    )

                glassPanel
                    .frame(width: proxy.size.width)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(CloakTheme.ink)
        }
    }

    private var sourceChrome: some View {
        VStack(alignment: .trailing, spacing: 2) {
            Text(garment.isLocal ? "Uploaded" : "Imported")
                .font(.caption2.weight(.bold))
            Text(garment.domain ?? garment.brand ?? "Garment image")
                .font(.caption2)
                .foregroundStyle(CloakTheme.surface.opacity(0.76))
                .lineLimit(1)
        }
        .foregroundStyle(CloakTheme.surface)
        .shadow(color: CloakTheme.ink.opacity(0.42), radius: 8, y: 2)
    }

    private var actionRail: some View {
        VStack(spacing: 13) {
            CloakRailAction(
                systemImage: isSaved ? "bookmark.fill" : "bookmark",
                title: isSaved ? "Saved" : "Save",
                action: onSave
            )
            CloakRailAction(systemImage: "xmark", title: "Skip", action: onSkip)
            CloakRailAction(
                systemImage: "sparkles",
                title: isLoading ? "Working" : "Try on",
                isPrimary: true,
                action: onTryOn
            )
            .disabled(isLoading)
        }
    }

    private var glassPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(CloakTheme.surface.opacity(0.56))
                .frame(width: 38, height: 4)
                .frame(maxWidth: .infinity)

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 4) {
                    Text(evidence == nil ? pipelineLabel : "YOUR CLOSET")
                        .font(.caption2.weight(.bold))
                        .tracking(1.1)
                        .foregroundStyle(CloakTheme.actionSoft)
                    Text(garment.title ?? "Untitled garment")
                        .font(.system(.title2, design: .serif, weight: .medium))
                        .foregroundStyle(CloakTheme.surface)
                        .lineLimit(2)
                }
                .layoutPriority(1)
                Spacer(minLength: 8)
                Text("NOT OWNED")
                    .font(.system(size: 9, weight: .bold))
                    .tracking(0.8)
                    .padding(.horizontal, 8)
                    .frame(height: 28)
                    .foregroundStyle(CloakTheme.surface)
                    .background(CloakTheme.surface.opacity(0.1))
                    .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.38)))
            }
            .padding(.top, 12)

            HStack(spacing: 8) {
                if let brand = garment.brand {
                    Text(brand)
                }
                if garment.brand != nil, garment.price != nil {
                    Text("/")
                }
                if let price = garment.price {
                    Text(price)
                }
                Spacer()
                if garment.sourceUrl != nil {
                    Button(action: onOpenRetailer) {
                        Label("View source", systemImage: "arrow.up.right")
                    }
                    .font(.caption.weight(.semibold))
                    .foregroundStyle(CloakTheme.surface)
                    .buttonStyle(.plain)
                }
            }
            .font(.caption)
            .foregroundStyle(CloakTheme.surface.opacity(0.7))
            .padding(.top, 8)

            if let evidence {
                CloakWardrobeEvidenceView(evidence: evidence)
                    .padding(.top, 12)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 128)
        .background {
            CloakGlassBackground()
                .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(CloakTheme.surface.opacity(0.24))
                .frame(height: 1)
        }
    }

    private var pipelineLabel: String {
        garment.recommendedPipeline == .modelSwap ? "Model swap available" : "Virtual try-on"
    }

}

struct GarmentImageView: View {
    let garment: Garment

    var body: some View {
        Group {
            if garment.isLocal,
               let data = garment.localImageData,
               let image = UIImage(data: data) {
                Image(uiImage: image)
                    .resizable()
                    .scaledToFill()
            } else {
                AsyncImage(url: garment.imageUrl) { phase in
                    switch phase {
                    case .success(let image):
                        image
                            .resizable()
                            .scaledToFill()
                    case .failure:
                        UnavailableImageView()
                    case .empty:
                        ProgressView()
                            .tint(CloakTheme.surface)
                    @unknown default:
                        UnavailableImageView()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .background(CloakTheme.ink)
    }
}

struct ImportPanel<UploadPicker: View>: View {
    @Binding var text: String
    let isLoading: Bool
    let onSubmit: () -> Void
    let onClose: () -> Void
    @ViewBuilder let uploadPicker: () -> UploadPicker

    var body: some View {
        ZStack(alignment: .bottom) {
            CloakTheme.ink.opacity(0.48)
                .ignoresSafeArea()
                .onTapGesture(perform: onClose)

            VStack(alignment: .leading, spacing: 14) {
                HStack {
                    VStack(alignment: .leading, spacing: 4) {
                        Text("ADD TO CLOAK")
                            .font(.caption2.weight(.bold))
                            .tracking(1.2)
                            .foregroundStyle(CloakTheme.action)
                        Text("Import a piece")
                            .font(.system(.title2, design: .serif, weight: .medium))
                    }
                    Spacer()
                    Button(action: onClose) {
                        Image(systemName: "xmark")
                            .font(.body.weight(.semibold))
                            .frame(width: 44, height: 44)
                    }
                    .foregroundStyle(CloakTheme.ink)
                    .buttonStyle(.plain)
                    .accessibilityLabel("Close import")
                }

                TextField("Paste product link", text: $text)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14)
                    .frame(height: 50)
                    .background(CloakTheme.surface)
                    .overlay(Rectangle().stroke(CloakTheme.line))

                Button(action: onSubmit) {
                    Label(isLoading ? "Analyzing link" : "Analyze product link", systemImage: "arrow.right")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakPrimaryButtonStyle())
                .disabled(isLoading || text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty)

                HStack(spacing: 12) {
                    Rectangle().fill(CloakTheme.line).frame(height: 1)
                    Text("OR")
                        .font(.caption2.weight(.bold))
                        .foregroundStyle(CloakTheme.muted)
                    Rectangle().fill(CloakTheme.line).frame(height: 1)
                }

                uploadPicker()
            }
            .foregroundStyle(CloakTheme.ink)
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 30)
            .background(CloakTheme.canvas)
        }
    }
}

struct TopChrome: View {
    var body: some View {
        HStack(spacing: 10) {
            CloakWordmark()
            Spacer()
            Text("FOR YOU")
                .font(.caption2.weight(.bold))
                .tracking(1.2)
                .padding(.horizontal, 10)
                .frame(height: 32)
                .background(CloakTheme.ink.opacity(0.34))
                .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.2)))
        }
        .foregroundStyle(CloakTheme.surface)
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .shadow(color: CloakTheme.ink.opacity(0.4), radius: 8, y: 2)
    }
}

struct EmptyFeedView: View {
    let onImport: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            Text("YOUR PRIVATE FITTING ROOM")
                .font(.caption2.weight(.bold))
                .tracking(1.3)
                .foregroundStyle(CloakTheme.action)
            Text("Share a piece.\nSee it on you.")
                .font(.system(size: 42, weight: .medium, design: .serif))
                .foregroundStyle(CloakTheme.ink)
                .padding(.top, 9)
            Text("Paste a retailer link or upload a garment image to start your first look.")
                .font(.body)
                .foregroundStyle(CloakTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Button(action: onImport) {
                Label("Import a piece", systemImage: "link.badge.plus")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(CloakPrimaryButtonStyle())
            .padding(.top, 26)
            Spacer()
        }
        .padding(.horizontal, 20)
        .padding(.top, 72)
        .background(CloakTheme.canvas)
    }
}

struct UnavailableImageView: View {
    var body: some View {
        VStack(spacing: 12) {
            Image(systemName: "photo")
                .font(.largeTitle)
            Text("Image unavailable")
                .font(.headline)
        }
        .foregroundStyle(CloakTheme.surface.opacity(0.75))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(CloakTheme.ink)
    }
}

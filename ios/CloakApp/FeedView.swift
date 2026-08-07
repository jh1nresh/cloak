import PhotosUI
import SwiftUI

/// Today: a full-bleed motion feed. One look per viewport, deterministic
/// paging, no nested scrolling. Everything that does not fit opens the sheet.
struct FeedView: View {
    @ObservedObject var store: AppStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var selectedGarment: PhotosPickerItem?
    @State private var activePageID: String?
    @State private var segmentByLook: [String: Bool] = [:]
    @State private var heldLookID: String?
    @State private var sheetLook: FeedLook?

    private var looks: [FeedLook] { store.feedLooks }

    /// The capture invitation occupies the first page until a body capture
    /// exists, so the feed never silently shows retailer stills without saying
    /// why.
    private var showsCaptureInvite: Bool {
        !store.hasBodyCapture && !looks.isEmpty
    }

    var body: some View {
        GeometryReader { root in
            content(bottomInset: FeedView.tabBarHeight + root.safeAreaInsets.bottom)
        }
    }

    /// Tab bar content height. The bar's own background bleeds into the safe
    /// area, so decision controls must clear both.
    private static let tabBarHeight: CGFloat = 49

    private func content(bottomInset: CGFloat) -> some View {
        ZStack {
            CloakTheme.stage.ignoresSafeArea()

            if looks.isEmpty && !store.isLoading {
                EmptyFeedView { store.presentImport() }
            } else {
                pager(bottomInset: bottomInset)
            }

            FeedToolbar(
                label: "For you",
                onAdd: { store.presentImport() }
            )
            .frame(maxHeight: .infinity, alignment: .top)

            if let toast = store.toast {
                UndoToast(
                    text: toast.text,
                    onUndo: { store.undoSave() }
                )
                .padding(.horizontal, 18)
                // Clears the action row rather than covering it.
                .padding(.bottom, bottomInset + 88)
                .frame(maxHeight: .infinity, alignment: .bottom)
                .transition(reduceMotion ? .opacity : .move(edge: .bottom).combined(with: .opacity))
                .task(id: toast.id) {
                    try? await Task.sleep(for: .seconds(3.2))
                    store.dismissToast()
                }
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
                    onClose: { store.isImportPresented = false },
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
        .animation(reduceMotion ? .linear(duration: 0.15) : .easeOut(duration: 0.22), value: store.toast)
        .sheet(item: $sheetLook) { look in
            LookDetailSheet(
                look: look,
                primaryLabel: primaryLabel(for: look),
                onPrimary: {
                    sheetLook = nil
                    performPrimary(for: look)
                },
                onSkip: {
                    sheetLook = nil
                    Task { await store.skip(look.garment) }
                },
                onBuy: {
                    sheetLook = nil
                    Task { await store.buy(look.garment) }
                },
                onClose: { sheetLook = nil }
            )
            .presentationDetents([.fraction(0.74)])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(22)
        }
        .task {
            await store.loadFeed()
        }
        .task(id: store.activeTryOn?.id) {
            await pollActiveLook()
        }
        .onChange(of: selectedGarment) { _, newItem in
            guard newItem != nil else { return }
            Task {
                await store.addLocalGarment(from: newItem!)
                selectedGarment = nil
                store.isImportPresented = false
            }
        }
    }

    private func pager(bottomInset: CGFloat) -> some View {
        ScrollView(.vertical) {
            LazyVStack(spacing: 0) {
                if showsCaptureInvite {
                    CaptureInvitePage(
                        onRecord: { store.selectedTab = .profile },
                        onDismiss: {}
                    )
                    .containerRelativeFrame(.vertical)
                    .id(FeedView.invitePageID)
                }

                ForEach(Array(looks.enumerated()), id: \.element.id) { index, look in
                    LookPage(
                        look: look,
                        index: index,
                        total: looks.count,
                        bottomInset: bottomInset,
                        hasBodyCapture: store.hasBodyCapture,
                        showsMe: segmentBinding(for: look),
                        isActive: activePageID == look.id,
                        isHeld: heldLookID == look.id,
                        primaryLabel: primaryLabel(for: look),
                        onPrimary: { performPrimary(for: look) },
                        onBuy: { Task { await store.buy(look.garment) } },
                        onOpenDetail: { sheetLook = look },
                        onDoubleTap: {
                            guard store.hasBodyCapture else { return }
                            Task { await store.saveWithUndo(look.garment) }
                        },
                        onHoldChanged: { held in
                            heldLookID = held ? look.id : nil
                        }
                    )
                    .containerRelativeFrame(.vertical)
                    .id(look.id)
                }
            }
            .scrollTargetLayout()
        }
        .scrollIndicators(.hidden)
        .scrollTargetBehavior(.paging)
        .scrollPosition(id: $activePageID, anchor: .center)
        .ignoresSafeArea()
        .onAppear {
            if activePageID == nil {
                activePageID = showsCaptureInvite ? FeedView.invitePageID : looks.first?.id
            }
        }
    }

    private static let invitePageID = "cloak.capture-invite"

    /// Drives the GENERATING chip to a resolution without leaving the feed.
    private func pollActiveLook() async {
        while store.activeTryOn?.status.isInFlight == true {
            try? await Task.sleep(for: .seconds(2))
            guard !Task.isCancelled else { return }
            await store.refreshActiveTryOn()
        }
        // Release the slot so the next try-on can start; the finished look
        // resolves from completedLooks afterwards.
        store.finalizeActiveLookIfComplete()
    }

    private func segmentBinding(for look: FeedLook) -> Binding<Bool> {
        Binding(
            get: {
                // Default to Me only when a completed result actually exists.
                segmentByLook[look.id] ?? (look.hasResult && store.hasBodyCapture)
            },
            set: { segmentByLook[look.id] = $0 }
        )
    }

    private func primaryLabel(for look: FeedLook) -> String {
        if !store.hasBodyCapture { return "See it on you" }
        switch look.status {
        case .failed: return "Retry"
        case .notStarted: return "See it on you"
        case .queued, .processing, .finalizing: return "Generating"
        case .completed: return look.isSaved ? "Saved" : "Save"
        }
    }

    private func performPrimary(for look: FeedLook) {
        guard store.hasBodyCapture else {
            store.selectedTab = .profile
            return
        }
        switch look.status {
        case .notStarted, .failed:
            Task { await store.tryOn(look.garment) }
        case .queued, .processing, .finalizing:
            break
        case .completed:
            Task { await store.saveWithUndo(look.garment) }
        }
    }
}

// MARK: - One page

private struct LookPage: View {
    let look: FeedLook
    let index: Int
    let total: Int
    let bottomInset: CGFloat
    let hasBodyCapture: Bool
    @Binding var showsMe: Bool
    let isActive: Bool
    let isHeld: Bool
    let primaryLabel: String
    let onPrimary: () -> Void
    let onBuy: () -> Void
    let onOpenDetail: () -> Void
    let onDoubleTap: () -> Void
    let onHoldChanged: (Bool) -> Void

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isMeEnabled: Bool { look.hasResult && hasBodyCapture }
    private var showingMe: Bool { showsMe && isMeEnabled }

    var body: some View {
        // The fill media reports an oversized ideal width, so the page is
        // pinned to the viewport before anything else lays out against it.
        GeometryReader { proxy in
            ZStack {
                media
                CloakTheme.stageScrimTop
                    .frame(height: 96)
                    .frame(maxHeight: .infinity, alignment: .top)
                    .allowsHitTesting(false)
                CloakTheme.stageScrimBottom
                    .frame(height: proxy.size.height * 0.34)
                    .frame(maxHeight: .infinity, alignment: .bottom)
                    .allowsHitTesting(false)
                statusChip
                controls
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .clipped()
        }
        .background(CloakTheme.stage)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            look.accessibilityDescription(index: index, total: total, showingMe: showingMe)
        )
    }

    private var media: some View {
        Group {
            if showingMe {
                MotionMediaView(
                    posterUrl: look.resultUrl,
                    videoUrl: look.videoUrl,
                    isActive: isActive,
                    isHeld: isHeld
                )
            } else {
                RemoteFillImage(url: look.originalUrl, localData: look.garment.localImageData)
            }
        }
        .contentShape(Rectangle())
        // Double tap saves. A single tap does nothing — ambiguous single-tap
        // targets on a full-bleed surface destroy trust.
        .onTapGesture(count: 2, perform: onDoubleTap)
        // Press and hold pauses for inspection. Pausing only after the minimum
        // duration keeps taps and scroll drags from triggering it.
        .onLongPressGesture(minimumDuration: 0.25) {
            onHoldChanged(true)
        } onPressingChanged: { pressing in
            if !pressing { onHoldChanged(false) }
        }
        .onChange(of: isActive) { _, active in
            if !active { onHoldChanged(false) }
        }
    }

    @ViewBuilder
    private var statusChip: some View {
        if hasBodyCapture, let chip = look.statusChip {
            CloakStatusChip(label: chip, isGenerating: look.status.isInFlight)
                .frame(maxHeight: .infinity, alignment: .center)
                .offset(y: -40)
                .allowsHitTesting(false)
        }
    }

    private var controls: some View {
        VStack(alignment: .leading, spacing: 14) {
            CloakStageSegment(showsMe: $showsMe, isMeEnabled: isMeEnabled)
                .frame(maxWidth: .infinity, alignment: .trailing)

            metadata

            HStack(spacing: 9) {
                Button(primaryLabel, action: onPrimary)
                    .buttonStyle(StageOutlineButtonStyle(isConfirmed: primaryLabel == "Saved"))
                    .disabled(look.status.isInFlight)

                Button("Buy it", action: onBuy)
                    .buttonStyle(StageFilledButtonStyle())
            }
            .padding(8)
            .cloakStageGlass(RoundedRectangle(cornerRadius: 18, style: .continuous))
        }
        .padding(.horizontal, 18)
        .padding(.bottom, bottomInset + 14)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
    }

    private var metadata: some View {
        VStack(alignment: .leading, spacing: 3) {
            if let brand = look.brand {
                Text(brand)
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(CloakTheme.stageInk)
            }

            Button(action: onOpenDetail) {
                Text(look.title)
                    .font(.system(.title3, design: .serif, weight: .medium))
                    .foregroundStyle(CloakTheme.stageInk)
                    .lineLimit(1)
                    .truncationMode(.tail)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("\(look.title). Open detail")

            HStack(alignment: .firstTextBaseline, spacing: 7) {
                if let price = look.price {
                    Text(price).foregroundStyle(CloakTheme.stageInk)
                }
                if look.price != nil {
                    Text("·").foregroundStyle(CloakTheme.stageInk.opacity(0.4))
                }
                Text(look.ownershipLabel)
                    .font(.caption2.weight(.semibold))
                    .tracking(1)
                    .foregroundStyle(
                        look.isOwned ? CloakTheme.stageOwned : CloakTheme.stageInk.opacity(0.64)
                    )
            }
            .font(.footnote)

            if hasBodyCapture, let summary = look.evidenceSummary {
                Button(action: onOpenDetail) {
                    Text("\(summary) ›")
                        .font(.caption)
                        .foregroundStyle(CloakTheme.stageEvidence)
                }
                .buttonStyle(.plain)
                .padding(.top, 2)
            }
        }
        .frame(maxWidth: 290, alignment: .leading)
        .frame(maxWidth: .infinity, alignment: .leading)
    }
}

// MARK: - Capture invitation

private struct CaptureInvitePage: View {
    let onRecord: () -> Void
    let onDismiss: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 22) {
            Text("START HERE")
                .font(.caption.weight(.semibold))
                .tracking(1.8)
                .foregroundStyle(CloakTheme.stageInk.opacity(0.64))

            Text("A capture of you,\nonce.")
                .font(.system(size: 30, weight: .regular, design: .serif))
                .foregroundStyle(CloakTheme.stageInk)
                .lineSpacing(2)

            Text("One guided capture and every look in this feed is generated on you. Stored with your profile, deletable anytime.")
                .font(.subheadline)
                .foregroundStyle(CloakTheme.stageInk.opacity(0.64))
                .frame(maxWidth: 270, alignment: .leading)
                .fixedSize(horizontal: false, vertical: true)

            Button("Add my capture", action: onRecord)
                .buttonStyle(StageFilledButtonStyle(fillsWidth: false))

            Button("Not now", action: onDismiss)
                .font(.subheadline)
                .foregroundStyle(CloakTheme.stageInk.opacity(0.64))
                .frame(height: 44)
        }
        .padding(.horizontal, 34)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(CloakTheme.stage)
    }
}

// MARK: - Chrome

private struct FeedToolbar: View {
    let label: String
    let onAdd: () -> Void

    var body: some View {
        HStack {
            Text("CLOAK")
                .font(.subheadline.weight(.bold))
                .tracking(3)
                .foregroundStyle(CloakTheme.stageInk)
                .accessibilityAddTraits(.isHeader)

            Spacer()

            Text(label)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CloakTheme.stageInk.opacity(0.64))

            Spacer()

            Button(action: onAdd) {
                Image(systemName: "plus")
                    .font(.system(size: 21, weight: .light))
                    .foregroundStyle(CloakTheme.stageInk)
                    .frame(width: 44, height: 44)
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Add to Cloak")
        }
        .padding(.horizontal, 18)
        .frame(height: 44)
    }
}

private struct UndoToast: View {
    let text: String
    let onUndo: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Text(text)
                .font(.footnote)
                .foregroundStyle(CloakTheme.stageInk)
            Spacer()
            Button("Undo", action: onUndo)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(CloakTheme.stageEvidence)
                .frame(height: 44)
        }
        .padding(.leading, 16)
        .padding(.trailing, 8)
        .frame(height: 48)
        .cloakStageGlass(RoundedRectangle(cornerRadius: 14, style: .continuous))
    }
}

// MARK: - Button styles

private struct StageOutlineButtonStyle: ButtonStyle {
    var isConfirmed = false

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(CloakTheme.stageInk)
            .frame(maxWidth: .infinity)
            .frame(height: 46)
            .background(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .fill(background(pressed: configuration.isPressed))
            )
            .overlay(
                RoundedRectangle(cornerRadius: 12, style: .continuous)
                    .stroke(CloakTheme.stageInk.opacity(0.22))
            )
    }

    private func background(pressed: Bool) -> Color {
        if isConfirmed { return CloakTheme.stageOwned.opacity(0.22) }
        return pressed ? CloakTheme.stageInk.opacity(0.12) : .clear
    }
}

private struct StageFilledButtonStyle: ButtonStyle {
    var fillsWidth = true

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.subheadline.weight(.semibold))
            .foregroundStyle(.white)
            .padding(.horizontal, fillsWidth ? 0 : 24)
            .frame(maxWidth: fillsWidth ? .infinity : nil)
            .frame(height: fillsWidth ? 46 : 50)
            .background(
                RoundedRectangle(cornerRadius: fillsWidth ? 12 : 14, style: .continuous)
                    .fill(configuration.isPressed
                          ? CloakTheme.stageAction.opacity(0.85)
                          : CloakTheme.stageAction)
            )
    }
}

// MARK: - Shared

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

struct EmptyFeedView: View {
    let onImport: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            Spacer()
            Text("YOUR PRIVATE FITTING ROOM")
                .font(.caption2.weight(.bold))
                .tracking(1.3)
                .foregroundStyle(CloakTheme.stageAction)
            Text("Share a piece.\nSee it on you.")
                .font(.system(size: 38, weight: .regular, design: .serif))
                .foregroundStyle(CloakTheme.stageInk)
                .padding(.top, 9)
            Text("Paste a retailer link or upload a garment image to start your first look.")
                .font(.body)
                .foregroundStyle(CloakTheme.stageInk.opacity(0.64))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 14)
            Button("Import a piece", action: onImport)
                .buttonStyle(StageFilledButtonStyle(fillsWidth: false))
                .padding(.top, 26)
            Spacer()
        }
        .padding(.horizontal, 24)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .leading)
        .background(CloakTheme.stage)
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

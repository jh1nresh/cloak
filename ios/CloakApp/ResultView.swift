import SwiftUI
import UIKit

struct ResultView: View {
    @ObservedObject var store: AppStore
    @State private var saveMessage: String?

    var body: some View {
        ZStack {
            CloakTheme.ink.ignoresSafeArea()

            if let tryOn = store.activeTryOn {
                switch tryOn.status {
                case .completed:
                    CompletedResultView(
                        store: store,
                        tryOn: tryOn,
                        garment: store.activeGarment,
                        saveMessage: $saveMessage
                    )
                case .failed:
                    FailedResultView(
                        message: tryOn.errorMessage ?? "Try-on failed.",
                        onDone: store.closeResult
                    )
                case .queued, .processing, .finalizing:
                    ProcessingResultView(status: tryOn.status)
                }
            }
        }
        .task(id: store.activeTryOn?.id) {
            await pollUntilDone()
        }
        .alert("Cloak", isPresented: Binding(
            get: { saveMessage != nil },
            set: { isPresented in
                if !isPresented {
                    saveMessage = nil
                }
            }
        )) {
            Button("OK", role: .cancel) {
                saveMessage = nil
            }
        } message: {
            Text(saveMessage ?? "")
        }
    }

    private func pollUntilDone() async {
        while let current = store.activeTryOn,
              current.status != .completed,
              current.status != .failed {
            try? await Task.sleep(for: .seconds(2))
            await store.refreshActiveTryOn()
        }
    }
}

struct ProcessingResultView: View {
    let status: TryOn.Status

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CloakWordmark()
                .padding(.top, 18)

            Spacer()

            Text(statusLabel)
                .font(.caption2.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(CloakTheme.actionSoft)
            Text(title)
                .font(.system(.largeTitle, design: .serif, weight: .medium))
                .foregroundStyle(CloakTheme.surface)
                .padding(.top, 8)
            Text("Keep Cloak open while the image is generated. Your original source stays attached to this look.")
                .font(.body)
                .foregroundStyle(CloakTheme.surface.opacity(0.66))
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            ProgressView()
                .tint(CloakTheme.surface)
                .controlSize(.large)
                .padding(.top, 28)

            Spacer()
        }
        .padding(.horizontal, 20)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var statusLabel: String {
        switch status {
        case .queued:
            return "WAITING FOR TRY-ON"
        case .processing:
            return "MAKING THE MODEL YOU"
        case .finalizing:
            return "FINISHING YOUR LOOK"
        case .completed:
            return "READY"
        case .failed:
            return "FAILED"
        }
    }

    private var title: String {
        switch status {
        case .queued:
            return "Your look is queued."
        case .processing:
            return "See the piece, on you."
        case .finalizing:
            return "Almost ready."
        case .completed:
            return "Your look is ready."
        case .failed:
            return "Try-on failed."
        }
    }
}

struct CompletedResultView: View {
    @ObservedObject var store: AppStore
    let tryOn: TryOn
    let garment: Garment?
    @Binding var saveMessage: String?
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showsOriginal = false

    var body: some View {
        GeometryReader { proxy in
            ZStack(alignment: .bottom) {
                displayedImage
                    .id(showsOriginal)
                    .transition(.opacity)
                    .ignoresSafeArea()

                CloakTheme.imageScrim
                    .ignoresSafeArea()

                VStack {
                    resultChrome
                    if garment != nil {
                        CloakComparisonControl(showsOriginal: $showsOriginal)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .padding(.top, 12)
                    }
                    Spacer()
                }
                .frame(width: max(0, proxy.size.width - 36), height: proxy.size.height, alignment: .top)
                .overlay(alignment: .trailing) {
                    actionRail
                        .offset(y: evidence == nil ? 20 : -48)
                }
                .padding(.top, 10)

                glassPanel
                    .frame(width: proxy.size.width)
            }
            .frame(width: proxy.size.width, height: proxy.size.height)
            .background(CloakTheme.ink)
        }
        .animation(reduceMotion ? nil : .easeOut(duration: 0.18), value: showsOriginal)
    }

    @ViewBuilder
    private var displayedImage: some View {
        if showsOriginal, let garment {
            GarmentImageView(garment: garment)
        } else {
            AsyncImage(url: tryOn.resultUrl) { phase in
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
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .clipped()
        }
    }

    private var resultChrome: some View {
        HStack(spacing: 10) {
            CloakWordmark()
            Spacer()
            VStack(alignment: .trailing, spacing: 2) {
                Text(garment?.isLocal == true ? "Uploaded" : "Imported")
                    .font(.caption2.weight(.bold))
                Text(garment?.domain ?? garment?.brand ?? "Original source")
                    .font(.caption2)
                    .foregroundStyle(CloakTheme.surface.opacity(0.76))
            }
            .lineLimit(1)

            if let resultUrl = tryOn.resultUrl {
                Menu {
                    Button {
                        Task {
                            await saveImage(resultUrl)
                        }
                    } label: {
                        Label("Save image", systemImage: "square.and.arrow.down")
                    }
                    ShareLink(item: resultUrl) {
                        Label("Share image", systemImage: "square.and.arrow.up")
                    }
                } label: {
                    Image(systemName: "ellipsis")
                        .font(.body.weight(.semibold))
                        .frame(width: 38, height: 38)
                        .background(CloakTheme.ink.opacity(0.34))
                        .overlay(Circle().stroke(CloakTheme.surface.opacity(0.2)))
                        .clipShape(Circle())
                }
            }

            Button(action: store.closeResult) {
                Image(systemName: "xmark")
                    .font(.body.weight(.semibold))
                    .frame(width: 38, height: 38)
                    .background(CloakTheme.ink.opacity(0.34))
                    .overlay(Circle().stroke(CloakTheme.surface.opacity(0.2)))
                    .clipShape(Circle())
            }
            .accessibilityLabel("Close result")
        }
        .foregroundStyle(CloakTheme.surface)
        .shadow(color: CloakTheme.ink.opacity(0.4), radius: 8, y: 2)
    }

    private var actionRail: some View {
        VStack(spacing: 13) {
            CloakRailAction(systemImage: "bookmark", title: "Save") {
                saveLook()
            }
            CloakRailAction(systemImage: "xmark", title: "Skip") {
                skipLook()
            }
        }
    }

    private var glassPanel: some View {
        VStack(alignment: .leading, spacing: 0) {
            Capsule()
                .fill(CloakTheme.surface.opacity(0.56))
                .frame(width: 38, height: 4)
                .frame(maxWidth: .infinity)

            HStack(alignment: .firstTextBaseline, spacing: 12) {
                VStack(alignment: .leading, spacing: 5) {
                    Text(panelEyebrow)
                        .font(.caption2.weight(.bold))
                        .tracking(1.1)
                        .foregroundStyle(CloakTheme.actionSoft)
                    Text(garment?.title ?? "Your try-on result")
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

            if let evidence {
                CloakWardrobeEvidenceView(evidence: evidence)
                    .padding(.top, 12)
            } else {
                Text(resultNote)
                    .font(.caption)
                    .foregroundStyle(CloakTheme.surface.opacity(0.72))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 9)
            }

            if garment?.sourceUrl != nil {
                Button {
                    openRetailer()
                } label: {
                    Label("Open retailer", systemImage: "arrow.up.right")
                        .lineLimit(1)
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakGlassPrimaryButtonStyle())
                .padding(.top, 12)

                Text("This stays outside your closet until purchase is confirmed.")
                    .font(.caption2)
                    .foregroundStyle(CloakTheme.surface.opacity(0.62))
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 7)
            } else {
                Button {
                    saveLook()
                } label: {
                    Label("Save look", systemImage: "bookmark")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakGlassPrimaryButtonStyle())
                .padding(.top, 12)
            }
        }
        .padding(.horizontal, 18)
        .padding(.top, 10)
        .padding(.bottom, 30)
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

    private var evidence: WardrobeEvidence? {
        store.wardrobeEvidence(for: garment)
    }

    private var panelEyebrow: String {
        if showsOriginal {
            return "ORIGINAL SOURCE"
        }
        return evidence == nil ? "YOUR LOOK IS READY" : "YOUR CLOSET"
    }

    private var resultNote: String {
        if showsOriginal {
            return "Compare the source image before deciding. Cloak keeps the retailer attached to this look."
        }
        return "Save or skip to teach Cloak your taste. No body or size score is inferred from this image."
    }

    private func saveLook() {
        guard let garment else {
            saveMessage = "Look saved."
            return
        }
        Task {
            await store.save(garment)
            if store.errorMessage == nil {
                saveMessage = "Saved to Cloak."
            }
        }
    }

    private func skipLook() {
        guard let garment else {
            store.closeResult()
            return
        }
        Task {
            await store.skip(garment)
            store.closeResult()
        }
    }

    private func openRetailer() {
        guard let garment else {
            return
        }
        Task {
            await store.buy(garment)
        }
    }

    private func saveImage(_ url: URL) async {
        do {
            let (data, _) = try await URLSession.shared.data(from: url)
            guard let image = UIImage(data: data) else {
                throw APIClientError.missingResult
            }
            UIImageWriteToSavedPhotosAlbum(image, nil, nil, nil)
            saveMessage = "Saved to Photos."
        } catch {
            saveMessage = error.localizedDescription
        }
    }
}

struct FailedResultView: View {
    let message: String
    let onDone: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            CloakWordmark(color: CloakTheme.ink)

            Spacer()

            Text("TRY-ON FAILED")
                .font(.caption2.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(Color(red: 180 / 255, green: 35 / 255, blue: 24 / 255))
            Text("Keep the source. Try again.")
                .font(.system(.largeTitle, design: .serif, weight: .medium))
                .foregroundStyle(CloakTheme.ink)
                .padding(.top, 8)
            Text(message)
                .font(.body)
                .foregroundStyle(CloakTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
                .padding(.top, 12)

            Button("Back to looks", action: onDone)
                .buttonStyle(CloakPrimaryButtonStyle())
                .padding(.top, 28)

            Spacer()
        }
        .padding(20)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(CloakTheme.canvas)
    }
}

import SwiftUI
import UIKit

struct ResultView: View {
    @ObservedObject var store: AppStore
    @State private var saveMessage: String?

    var body: some View {
        ZStack {
            Color.black.ignoresSafeArea()

            if let tryOn = store.activeTryOn {
                switch tryOn.status {
                case .completed:
                    CompletedResultView(tryOn: tryOn, onDone: store.closeResult, saveMessage: $saveMessage)
                case .failed:
                    FailedResultView(message: tryOn.errorMessage ?? "Try-on failed.", onDone: store.closeResult)
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
        VStack(spacing: 18) {
            ProgressView()
                .controlSize(.large)
                .tint(.white)
            Text(title)
                .font(.title2.weight(.bold))
            Text("You can leave this screen open while Cloak finalizes the image.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.68))
                .multilineTextAlignment(.center)
        }
        .foregroundStyle(.white)
        .padding(24)
    }

    private var title: String {
        switch status {
        case .queued:
            return "Queued"
        case .processing:
            return "Trying it on"
        case .finalizing:
            return "Finishing image"
        case .completed:
            return "Done"
        case .failed:
            return "Failed"
        }
    }
}

struct CompletedResultView: View {
    let tryOn: TryOn
    let onDone: () -> Void
    @Binding var saveMessage: String?

    var body: some View {
        ZStack(alignment: .bottom) {
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
                        .tint(.white)
                @unknown default:
                    UnavailableImageView()
                }
            }
            .ignoresSafeArea()

            LinearGradient(colors: [.clear, .black.opacity(0.78)], startPoint: .center, endPoint: .bottom)
                .ignoresSafeArea()

            HStack(spacing: 14) {
                Button(action: onDone) {
                    Label("Keep swiping", systemImage: "arrow.down")
                }
                .buttonStyle(ResultButtonStyle(kind: .secondary))

                if let resultUrl = tryOn.resultUrl {
                    Button {
                        Task {
                            await saveImage(resultUrl)
                        }
                    } label: {
                        Label("Save", systemImage: "square.and.arrow.down")
                    }
                    .buttonStyle(ResultButtonStyle(kind: .primary))

                    ShareLink(item: resultUrl) {
                        Image(systemName: "square.and.arrow.up")
                            .font(.headline.weight(.bold))
                            .frame(width: 50, height: 50)
                            .background(.white.opacity(0.16))
                            .clipShape(Circle())
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.bottom, 34)
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
        VStack(spacing: 16) {
            Image(systemName: "exclamationmark.triangle.fill")
                .font(.system(size: 48))
            Text("Try-on failed")
                .font(.title2.weight(.bold))
            Text(message)
                .font(.body)
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
            Button("Back to feed", action: onDone)
                .buttonStyle(ResultButtonStyle(kind: .primary))
        }
        .foregroundStyle(.white)
        .padding(24)
    }
}

struct ResultButtonStyle: ButtonStyle {
    enum Kind {
        case primary
        case secondary
    }

    let kind: Kind

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .font(.headline)
            .padding(.horizontal, 16)
            .frame(height: 50)
            .background(kind == .primary ? Color.white : Color.white.opacity(0.16))
            .foregroundStyle(kind == .primary ? Color.black : Color.white)
            .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            .scaleEffect(configuration.isPressed ? 0.97 : 1)
    }
}

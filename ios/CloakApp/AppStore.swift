import Foundation
import PhotosUI
import SwiftUI
import UIKit
import UniformTypeIdentifiers

@MainActor
final class AppStore: ObservableObject {
    @Published var profile: FitProfile?
    @Published var garments: [Garment] = []
    @Published var activeTryOn: TryOn?
    @Published var activeGarment: Garment?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var importURLText = ""
    @Published private var wardrobeEvidenceByGarmentID: [UUID: WardrobeEvidence] = [:]

    private let api: APIClient
    private let profileKey = "cloak.fitProfile"

    init(api: APIClient = APIClient()) {
        self.api = api
#if DEBUG
        if let previewState = ProcessInfo.processInfo.environment["CLOAK_UI_PREVIEW"] {
            loadVisualFixture(state: previewState)
            return
        }
#endif
        loadSavedProfile()
    }

    func loadFeed() async {
        guard garments.isEmpty else {
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            garments = try await api.fetchGarments()
        } catch {
            errorMessage = readable(error)
        }
    }

    func createProfile(from item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIClientError.missingResult
            }
            let contentType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"

            isLoading = true
            defer { isLoading = false }

            profile = try await api.createAvatar(imageData: data, contentType: contentType)
            saveProfile()
        } catch {
            errorMessage = readable(error)
        }
    }

    func addLocalGarment(from item: PhotosPickerItem) async {
        do {
            guard let data = try await item.loadTransferable(type: Data.self) else {
                throw APIClientError.missingResult
            }
            let contentType = item.supportedContentTypes.first?.preferredMIMEType ?? "image/jpeg"
            garments.insert(.localImage(data: data, contentType: contentType), at: 0)
        } catch {
            errorMessage = readable(error)
        }
    }

    func importGarment() async {
        let trimmed = importURLText.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            return
        }
        await importGarment(from: trimmed)
    }

    func importGarment(from urlString: String) async {
        isLoading = true
        defer { isLoading = false }

        do {
            let garment = try await api.importGarment(from: urlString, userId: profile?.userId)
            garments.removeAll { $0.id == garment.id || $0.sourceUrl == garment.sourceUrl }
            garments.insert(garment, at: 0)
            importURLText = ""
        } catch {
            errorMessage = readable(error)
        }
    }

    func tryOn(_ garment: Garment) async {
        guard let profile else {
            errorMessage = "Upload a fit photo first."
            return
        }

        isLoading = true
        defer { isLoading = false }

        do {
            let id = try await api.submitTryOn(profile: profile, garment: garment)
            activeGarment = garment
            activeTryOn = TryOn(id: id, status: .processing, resultUrl: nil, errorMessage: nil)
        } catch {
            errorMessage = readable(error)
        }
    }

    func refreshActiveTryOn() async {
        guard let activeTryOn else {
            return
        }

        do {
            self.activeTryOn = try await api.fetchTryOn(id: activeTryOn.id)
        } catch {
            errorMessage = readable(error)
        }
    }

    func save(_ garment: Garment) async {
        await recordTasteEvent("save", garment: garment)
    }

    func skip(_ garment: Garment) async {
        await recordTasteEvent("skip", garment: garment)
        garments.removeAll { $0 == garment }
    }

    func buy(_ garment: Garment) async {
        await recordTasteEvent("buy_click", garment: garment)
        if let sourceUrl = garment.sourceUrl {
            await UIApplication.shared.open(sourceUrl)
        }
    }

    func closeResult() {
        activeTryOn = nil
        activeGarment = nil
    }

    func wardrobeEvidence(for garment: Garment?) -> WardrobeEvidence? {
        guard let id = garment?.id else {
            return nil
        }
        return wardrobeEvidenceByGarmentID[id]
    }

    func resetProfile() {
        profile = nil
        UserDefaults.standard.removeObject(forKey: profileKey)
    }

    func handleOpenURL(_ url: URL) {
        guard url.scheme == "cloak" else {
            return
        }

        if let components = URLComponents(url: url, resolvingAgainstBaseURL: false),
           let sharedURL = components.queryItems?.first(where: { $0.name == "url" })?.value {
            importURLText = sharedURL
            Task {
                await importGarment(from: sharedURL)
            }
        } else if URLComponents(url: url, resolvingAgainstBaseURL: false)?
            .queryItems?
            .contains(where: { $0.name == "sharedImage" }) == true {
            importSharedImageFromAppGroup()
        }
    }

    private func importSharedImageFromAppGroup() {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.cloak.mobile") else {
            errorMessage = "Shared image storage is not available."
            return
        }

        let imageURL = containerURL.appending(path: "shared-garment")
        guard let data = try? Data(contentsOf: imageURL) else {
            errorMessage = "Could not read the shared image."
            return
        }

        let defaults = UserDefaults(suiteName: "group.app.cloak.mobile")
        let contentType = defaults?.string(forKey: "shared-garment-content-type") ?? "image/jpeg"
        garments.insert(.localImage(data: data, contentType: contentType), at: 0)
    }

    private func saveProfile() {
        guard let profile,
              let data = try? JSONEncoder().encode(profile) else {
            return
        }
        UserDefaults.standard.set(data, forKey: profileKey)
    }

    private func loadSavedProfile() {
        guard let data = UserDefaults.standard.data(forKey: profileKey),
              let saved = try? JSONDecoder().decode(FitProfile.self, from: data) else {
            return
        }
        profile = saved
    }

#if DEBUG
    private func loadVisualFixture(state: String) {
        let originalURL = URL(string: "https://images.unsplash.com/photo-1529139574466-a303027c1d8b?auto=format&fit=crop&w=1200&q=88")!
        let resultURL = URL(string: "https://images.unsplash.com/photo-1485230895905-ec40ba36b9bc?auto=format&fit=crop&w=1200&q=88")!
        let garment = Garment(
            id: UUID(uuidString: "B2AB6897-B53E-44D5-BDDF-DDE5354880CB"),
            sourceUrl: URL(string: "https://example.com/products/cherry-wool-coat"),
            imageUrl: originalURL,
            imageClassification: "on_model",
            recommendedPipeline: .modelSwap,
            savedItemId: UUID(uuidString: "F80BDD2C-5EED-42F8-A5DD-FB281A340D3F"),
            title: "Cherry wool coat with sculpted shoulders",
            brand: "Atelier No. 8",
            price: "$428",
            domain: "example.com"
        )

        profile = FitProfile(userId: "visual-fixture", avatarUrl: originalURL)
        garments = [garment]

        if let garmentID = garment.id {
            wardrobeEvidenceByGarmentID[garmentID] = WardrobeEvidence(
                pieces: [
                    WardrobePiece(
                        id: UUID(uuidString: "67D32487-465E-4A83-9D4C-BA8438B4F7B5")!,
                        imageUrl: resultURL,
                        title: "Black wide-leg trousers"
                    ),
                    WardrobePiece(
                        id: UUID(uuidString: "59D5C680-6701-4AF6-BBD3-93694A78E97F")!,
                        imageUrl: originalURL,
                        title: "Quiet neutral knit"
                    ),
                ],
                wearCount: 8,
                lastWorn: "last worn Saturday",
                rationale: "Cloak noticed that this adds one confident color to pieces you already trust."
            )
        }

        if state == "result" {
            activeGarment = garment
            activeTryOn = TryOn(
                id: UUID(uuidString: "43B281A9-3BD8-4B90-9E0C-608363F7C4B9")!,
                status: .completed,
                resultUrl: resultURL,
                errorMessage: nil
            )
        }
    }
#endif

    private func recordTasteEvent(_ eventType: String, garment: Garment) async {
        guard let profile else {
            return
        }

        do {
            try await api.recordTasteEvent(
                userId: profile.userId,
                garment: garment,
                eventType: eventType,
                metadata: [
                    "title": garment.title,
                    "brand": garment.brand,
                    "price": garment.price,
                    "domain": garment.domain,
                    "recommendedPipeline": garment.recommendedPipeline?.rawValue
                ]
            )
        } catch {
            errorMessage = readable(error)
        }
    }

    private func readable(_ error: Error) -> String {
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }
}

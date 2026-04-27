import Foundation
import PhotosUI
import SwiftUI
import UniformTypeIdentifiers

@MainActor
final class AppStore: ObservableObject {
    @Published var profile: FitProfile?
    @Published var garments: [Garment] = []
    @Published var activeTryOn: TryOn?
    @Published var isLoading = false
    @Published var errorMessage: String?
    @Published var importURLText = ""

    private let api: APIClient
    private let profileKey = "cloak.fitProfile"

    init(api: APIClient = APIClient()) {
        self.api = api
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
            let garment = try await api.importGarment(from: urlString)
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

    func closeResult() {
        activeTryOn = nil
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

    private func readable(_ error: Error) -> String {
        if let localized = error as? LocalizedError,
           let description = localized.errorDescription {
            return description
        }
        return error.localizedDescription
    }
}

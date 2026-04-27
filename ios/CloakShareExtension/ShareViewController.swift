import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        resolveSharedItem()
    }

    private func resolveSharedItem() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.url.identifier) }) {
            provider.loadItem(forTypeIdentifier: UTType.url.identifier, options: nil) { [weak self] item, _ in
                if let url = item as? URL {
                    Task { @MainActor [weak self] in
                        self?.openCloak(sharedURL: url.absoluteString)
                    }
                } else {
                    Task { @MainActor [weak self] in
                        self?.finish()
                    }
                }
            }
            return
        }

        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.plainText.identifier) }) {
            provider.loadItem(forTypeIdentifier: UTType.plainText.identifier, options: nil) { [weak self] item, _ in
                if let text = item as? String,
                   let url = Self.firstURL(in: text) {
                    Task { @MainActor [weak self] in
                        self?.openCloak(sharedURL: url.absoluteString)
                    }
                } else {
                    Task { @MainActor [weak self] in
                        self?.finish()
                    }
                }
            }
            return
        }

        if let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(UTType.image.identifier) }) {
            let contentType = provider.registeredTypeIdentifiers
                .compactMap { UTType($0)?.preferredMIMEType }
                .first ?? "image/jpeg"
            provider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { [weak self, contentType] fileURL, _ in
                guard let fileURL,
                      let data = try? Data(contentsOf: fileURL),
                      Self.saveSharedImage(data: data, contentType: contentType) else {
                    Task { @MainActor [weak self] in
                        self?.finish()
                    }
                    return
                }
                Task { @MainActor [weak self] in
                    self?.openCloak(sharedImage: true)
                }
            }
            return
        }

        finish()
    }

    private func openCloak(sharedURL: String) {
        var components = URLComponents()
        components.scheme = "cloak"
        components.host = "tryon"
        components.queryItems = [URLQueryItem(name: "url", value: sharedURL)]
        guard let url = components.url else {
            finish()
            return
        }
        open(url)
    }

    private func openCloak(sharedImage: Bool) {
        guard let url = URL(string: "cloak://tryon?sharedImage=1") else {
            finish()
            return
        }
        open(url)
    }

    private func open(_ url: URL) {
        DispatchQueue.main.async { [weak self] in
            self?.extensionContext?.open(url) { [weak self] _ in
                Task { @MainActor [weak self] in
                    self?.finish()
                }
            }
        }
    }

    nonisolated private static func saveSharedImage(data: Data, contentType: String) -> Bool {
        guard let containerURL = FileManager.default.containerURL(forSecurityApplicationGroupIdentifier: "group.app.cloak.mobile") else {
            return false
        }

        let targetURL = containerURL.appending(path: "shared-garment")
        do {
            try data.write(to: targetURL, options: [.atomic])
            UserDefaults(suiteName: "group.app.cloak.mobile")?
                .set(contentType, forKey: "shared-garment-content-type")
            return true
        } catch {
            return false
        }
    }

    private func finish() {
        DispatchQueue.main.async { [weak self] in
            self?.extensionContext?.completeRequest(returningItems: nil)
        }
    }

    nonisolated private static func firstURL(in text: String) -> URL? {
        let detector = try? NSDataDetector(types: NSTextCheckingResult.CheckingType.link.rawValue)
        let range = NSRange(text.startIndex..<text.endIndex, in: text)
        return detector?
            .firstMatch(in: text, options: [], range: range)?
            .url
    }
}

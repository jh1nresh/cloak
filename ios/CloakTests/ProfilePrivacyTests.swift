import XCTest
import SwiftUI
import UIKit
@testable import Cloak

private struct FixtureReply: Sendable {
    let status: Int
    let data: Data
}

private final class FixtureRouter: @unchecked Sendable {
    private let lock = NSLock()
    private var avatarID = "dummy-A"
    private var avatarFails = false
    private var heldPath: String?
    private var pending: [FixtureURLProtocol] = []

    func configure(avatar: String = "dummy-A", fails: Bool = false, hold: String? = nil) {
        lock.lock()
        defer { lock.unlock() }
        avatarID = avatar
        avatarFails = fails
        heldPath = hold
    }

    var pendingCount: Int {
        lock.lock()
        defer { lock.unlock() }
        return pending.count
    }

    func route(_ item: FixtureURLProtocol) {
        lock.lock()
        if item.request.url?.path == heldPath {
            pending.append(item)
            lock.unlock()
            return
        }
        let id = avatarID, fails = avatarFails
        lock.unlock()
        let path = item.request.url?.path
        if item.request.url?.host != "fixture.invalid" {
            item.fail()
        } else if path == "/api/avatar" {
            item.complete(Self.avatar(id, fails: fails))
        } else if path == "/api/garments" {
            item.complete(FixtureReply(status: 200, data: Data(#"{"garments":[]}"#.utf8)))
        } else if path == "/api/scrape-garment" {
            item.complete(Self.garment())
        } else if path == "/api/taste-events" {
            item.complete(FixtureReply(status: 200, data: Data(#"{"ok":true}"#.utf8)))
        } else {
            item.fail()
        }
    }

    func deliverPending(_ reply: FixtureReply) {
        lock.lock()
        let items = pending
        pending = []
        heldPath = nil
        lock.unlock()
        for item in items { item.complete(reply) }
    }

    static func avatar(_ id: String, fails: Bool = false) -> FixtureReply {
        if fails { return FixtureReply(status: 500, data: Data(#"{"error":"dummy-failure"}"#.utf8)) }
        let value = ["userId": id, "avatarUrl": "https://fixture.invalid/\(id).png"]
        return FixtureReply(status: 200, data: try! JSONSerialization.data(withJSONObject: value))
    }

    static func garment() -> FixtureReply {
        FixtureReply(status: 200, data: Data(#"{"garment":{"id":"00000000-0000-0000-0000-000000000001","image_url":"https://fixture.invalid/old.png","title":"old profile"},"imageUrl":"https://fixture.invalid/old.png","savedItem":{"id":"00000000-0000-0000-0000-000000000002"}}"#.utf8))
    }
}

private final class FixtureURLProtocol: URLProtocol, @unchecked Sendable {
    static let router = FixtureRouter()
    override class func canInit(with request: URLRequest) -> Bool { true }
    override class func canonicalRequest(for request: URLRequest) -> URLRequest { request }
    override func startLoading() { Self.router.route(self) }
    override func stopLoading() {}
    func fail() { client?.urlProtocol(self, didFailWithError: URLError(.unsupportedURL)) }
    func complete(_ reply: FixtureReply) {
        let response = HTTPURLResponse(url: request.url!, statusCode: reply.status, httpVersion: nil, headerFields: ["Content-Type": "application/json"])!
        client?.urlProtocol(self, didReceive: response, cacheStoragePolicy: .notAllowed)
        client?.urlProtocol(self, didLoad: reply.data)
        client?.urlProtocolDidFinishLoading(self)
    }
}

final class ProfilePrivacyTests: XCTestCase {
    @MainActor
    private func makeStore() -> (AppStore, URLSession) {
        FixtureURLProtocol.router.configure()
        let configuration = URLSessionConfiguration.ephemeral
        configuration.protocolClasses = [FixtureURLProtocol.self]
        let session = URLSession(configuration: configuration)
        let store = AppStore(api: APIClient(baseURL: URL(string: "https://fixture.invalid")!, session: session))
        store.resetProfile()
        return (store, session)
    }

    @MainActor
    private func marker() -> Data {
        UIGraphicsImageRenderer(size: CGSize(width: 32, height: 32)).image { context in
            UIColor.magenta.setFill()
            context.fill(CGRect(x: 0, y: 0, width: 32, height: 32))
        }.pngData()!
    }

    @MainActor
    private func waitUntil(_ condition: () -> Bool) async throws {
        for _ in 0..<100 {
            if condition() { return }
            try await Task.sleep(for: .milliseconds(20))
        }
        XCTFail("Dummy operation did not reach the expected state")
    }

    @MainActor
    private func enableDummyCapture(_ store: AppStore) {
        store.profile?.bodyVideoUrl = URL(string: "https://fixture.invalid/body.mp4")!
    }

    private func checkedGarmentReply() throws -> FixtureReply {
        let reply = FixtureRouter.garment()
        // Use the production response model and the same default JSONDecoder
        // configuration as APIClient before trusting a 200 fixture.
        let decoded = try JSONDecoder().decode(ScrapeGarmentResponse.self, from: reply.data)
        XCTAssertEqual(decoded.imageUrl.absoluteString, "https://fixture.invalid/old.png")
        XCTAssertEqual(decoded.garment.imageUrl, decoded.imageUrl)
        XCTAssertEqual(decoded.garment.id, UUID(uuidString: "00000000-0000-0000-0000-000000000001"))
        XCTAssertEqual(decoded.savedItem?.id, UUID(uuidString: "00000000-0000-0000-0000-000000000002"))
        return reply
    }

    @MainActor
    private func render(_ window: UIWindow, name: String) -> Int {
        window.layoutIfNeeded()
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        let image = UIGraphicsImageRenderer(bounds: window.bounds, format: format).image { _ in
            window.drawHierarchy(in: window.bounds, afterScreenUpdates: true)
        }
        let attachment = XCTAttachment(image: image)
        attachment.name = name
        attachment.lifetime = .keepAlways
        add(attachment)
        let cgImage = image.cgImage!, width = cgImage.width, height = cgImage.height
        var pixels = [UInt8](repeating: 0, count: width * height * 4)
        let context = CGContext(data: &pixels, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue | CGBitmapInfo.byteOrder32Big.rawValue)!
        context.draw(cgImage, in: CGRect(x: 0, y: 0, width: width, height: height))
        return stride(from: 0, to: pixels.count, by: 4).filter { pixels[$0] > 240 && pixels[$0 + 1] < 15 && pixels[$0 + 2] > 240 }.count
    }

    @MainActor
    func testClearAndReonboardRemovesMarkerFromRealFeed() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        await store.createProfile(imageData: marker(), contentType: "image/png")
        XCTAssertEqual(store.profile?.userId, "dummy-A")
        enableDummyCapture(store)
        store.garments = [Garment.localImage(data: marker(), contentType: "image/png")]
        try await waitUntil { UIApplication.shared.connectedScenes.contains { $0 is UIWindowScene } }
        let scene = try XCTUnwrap(UIApplication.shared.connectedScenes.compactMap { $0 as? UIWindowScene }.first)
        let window = UIWindow(windowScene: scene)
        window.frame = scene.screen.bounds
        window.windowLevel = .normal + 1
        window.rootViewController = UIHostingController(rootView: RootView(store: store))
        window.makeKeyAndVisible()
        defer { window.isHidden = true }
        try await Task.sleep(for: .milliseconds(500))
        XCTAssertGreaterThan(render(window, name: "A-before-clear"), 1000)
        store.resetProfile()
        try await Task.sleep(for: .milliseconds(200))
        XCTAssertNil(store.profile)
        FixtureURLProtocol.router.configure(avatar: "dummy-B")
        await store.createProfile(imageData: marker(), contentType: "image/png")
        enableDummyCapture(store)
        try await Task.sleep(for: .milliseconds(500))
        XCTAssertEqual(store.profile?.userId, "dummy-B")
        XCTAssertTrue(store.garments.isEmpty)
        XCTAssertEqual(render(window, name: "B-after-clear-and-reonboard"), 0)
        XCTAssertTrue(store.completedLooks.isEmpty)
        XCTAssertTrue(store.savedGarmentKeys.isEmpty)
    }

    @MainActor
    func testSuccessfulReplacementClearsButFailedReplacementKeepsCurrentProfile() async {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        await store.createProfile(imageData: marker(), contentType: "image/png")
        let garment = Garment.localImage(data: marker())
        store.garments = [garment]
        FixtureURLProtocol.router.configure(avatar: "dummy-B", fails: true)
        await store.createProfile(imageData: marker(), contentType: "image/png")
        XCTAssertEqual(store.profile?.userId, "dummy-A")
        XCTAssertEqual(store.garments, [garment])
        FixtureURLProtocol.router.configure(avatar: "dummy-B")
        await store.createProfile(imageData: marker(), contentType: "image/png")
        XCTAssertEqual(store.profile?.userId, "dummy-B")
        XCTAssertTrue(store.garments.isEmpty)
        XCTAssertFalse(store.isLoading)
        XCTAssertNil(store.errorMessage)
    }

    @MainActor
    func testCurrentImportClosesPanelAfterSuccess() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        _ = try checkedGarmentReply()
        await store.createProfile(imageData: marker(), contentType: "image/png")
        store.presentImport()
        store.importURLText = " https://fixture.invalid/product "

        await store.importGarment()

        XCTAssertFalse(store.isImportPresented)
        XCTAssertEqual(store.importURLText, "")
        XCTAssertEqual(store.garments.count, 1)
        XCTAssertEqual(store.garments.first?.savedItemId, UUID(uuidString: "00000000-0000-0000-0000-000000000002"))
        XCTAssertEqual(store.savedGarmentKeys.count, 1)
        XCTAssertNil(store.errorMessage)
        XCTAssertFalse(store.isLoading)
    }

    @MainActor
    func testCurrentImportFailureKeepsPanelOpen() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        await store.createProfile(imageData: marker(), contentType: "image/png")
        store.presentImport()
        store.importURLText = "https://fixture.invalid/product"
        FixtureURLProtocol.router.configure(hold: "/api/scrape-garment")
        let operation = Task { await store.importGarment() }
        try await waitUntil { FixtureURLProtocol.router.pendingCount == 1 }
        FixtureURLProtocol.router.deliverPending(FixtureReply(status: 500, data: Data(#"{"error":"dummy-failure"}"#.utf8)))
        await operation.value

        XCTAssertTrue(store.isImportPresented)
        XCTAssertEqual(store.importURLText, "https://fixture.invalid/product")
        XCTAssertTrue(store.garments.isEmpty)
        XCTAssertEqual(store.errorMessage, "dummy-failure")
        XCTAssertFalse(store.isLoading)
    }

    @MainActor
    func testStaleImportAndFailureCannotChangeNewProfile() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        let success = try checkedGarmentReply()
        for status in [200, 500] {
            FixtureURLProtocol.router.configure()
            await store.createProfile(imageData: marker(), contentType: "image/png")
            store.presentImport()
            store.importURLText = "https://fixture.invalid/old-product"
            FixtureURLProtocol.router.configure(hold: "/api/scrape-garment")
            let operation = Task { await store.importGarment() }
            try await waitUntil { FixtureURLProtocol.router.pendingCount == 1 }
            store.resetProfile()
            FixtureURLProtocol.router.configure(avatar: "dummy-B", hold: "/api/scrape-garment")
            await store.createProfile(imageData: marker(), contentType: "image/png")
            store.presentImport()
            store.importURLText = "https://fixture.invalid/new-product"
            let reply = status == 200 ? success : FixtureReply(status: 500, data: Data(#"{"error":"old-profile-failure"}"#.utf8))
            FixtureURLProtocol.router.deliverPending(reply)
            await operation.value
            XCTAssertEqual(store.profile?.userId, "dummy-B")
            XCTAssertTrue(store.garments.isEmpty)
            XCTAssertTrue(store.savedGarmentKeys.isEmpty)
            XCTAssertTrue(store.isImportPresented)
            XCTAssertEqual(store.importURLText, "https://fixture.invalid/new-product")
            XCTAssertNil(store.errorMessage)
            XCTAssertFalse(store.isLoading)
        }
    }

    @MainActor
    func testLocalGarmentClosesPanelAndCompletesSelectionOnlyOnSuccess() async {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        await store.createProfile(imageData: marker(), contentType: "image/png")
        let imageData = marker()
        for succeeds in [false, true] {
            store.presentImport()
            store.errorMessage = nil
            var selection: String? = "current-selection"
            await store.addLocalGarment(
                contentType: "image/png",
                loadData: { succeeds ? imageData : nil },
                onSuccess: { selection = nil }
            )

            XCTAssertEqual(store.isImportPresented, !succeeds)
            XCTAssertEqual(selection, succeeds ? nil : "current-selection")
            if succeeds {
                XCTAssertEqual(store.garments.first?.localImageData, imageData)
                XCTAssertEqual(store.savedGarmentKeys.count, 1)
                XCTAssertNil(store.errorMessage)
            } else {
                XCTAssertTrue(store.garments.isEmpty)
                XCTAssertNotNil(store.errorMessage)
            }
        }
    }

    @MainActor
    func testDelayedLocalGarmentCompletionCannotChangeNewProfileImport() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        let imageData = marker()
        for succeeds in [true, false] {
            FixtureURLProtocol.router.configure()
            await store.createProfile(imageData: imageData, contentType: "image/png")
            store.presentImport()
            var selection: String? = "old-selection"
            var pendingLoad: CheckedContinuation<Data?, Error>?
            let operation = Task {
                await store.addLocalGarment(
                    contentType: "image/png",
                    loadData: {
                        try await withCheckedThrowingContinuation { pendingLoad = $0 }
                    },
                    onSuccess: { selection = nil }
                )
            }
            try await waitUntil { pendingLoad != nil }
            store.resetProfile()
            FixtureURLProtocol.router.configure(avatar: "dummy-B")
            await store.createProfile(imageData: imageData, contentType: "image/png")
            store.presentImport()
            store.importURLText = "https://fixture.invalid/new-product"
            selection = "new-selection"
            let continuation = try XCTUnwrap(pendingLoad)
            if succeeds {
                continuation.resume(returning: imageData)
            } else {
                continuation.resume(throwing: URLError(.cannotDecodeContentData))
            }
            await operation.value

            XCTAssertEqual(store.profile?.userId, "dummy-B")
            XCTAssertTrue(store.isImportPresented)
            XCTAssertEqual(store.importURLText, "https://fixture.invalid/new-product")
            XCTAssertEqual(selection, "new-selection")
            XCTAssertTrue(store.garments.isEmpty)
            XCTAssertTrue(store.savedGarmentKeys.isEmpty)
            XCTAssertNil(store.errorMessage)
        }
    }

    @MainActor
    func testDelayedAvatarCannotRestoreClearedProfile() async throws {
        let (store, session) = makeStore()
        defer { store.resetProfile(); session.invalidateAndCancel() }
        FixtureURLProtocol.router.configure(hold: "/api/avatar")
        let operation = Task { await store.createProfile(imageData: marker(), contentType: "image/png") }
        try await waitUntil { FixtureURLProtocol.router.pendingCount == 1 }
        store.resetProfile()
        FixtureURLProtocol.router.deliverPending(FixtureRouter.avatar("obsolete"))
        await operation.value
        XCTAssertNil(store.profile)
        XCTAssertTrue(store.garments.isEmpty)
        XCTAssertFalse(store.isLoading)
    }
}

import Foundation

enum APIClientError: LocalizedError {
    case badURL
    case badResponse
    case server(String)
    case missingResult

    var errorDescription: String? {
        switch self {
        case .badURL:
            return "Invalid API URL."
        case .badResponse:
            return "Unexpected server response."
        case .server(let message):
            return message
        case .missingResult:
            return "The server did not return a result."
        }
    }
}

struct APIClient {
    let baseURL: URL
    private let session: URLSession
    private let decoder = JSONDecoder()
    private let encoder = JSONEncoder()

    init(baseURL: URL? = nil, session: URLSession = .shared) {
        let configuredBaseURL = Bundle.main.object(forInfoDictionaryKey: "CLOAKAPIBaseURL") as? String
        let environmentBaseURL = ProcessInfo.processInfo.environment["CLOAK_API_BASE_URL"]
        self.baseURL = baseURL
            ?? URL(string: environmentBaseURL ?? configuredBaseURL ?? "http://localhost:3002")!
        self.session = session
    }

    func fetchGarments(limit: Int = 30) async throws -> [Garment] {
        let response: GarmentsResponse = try await send(path: "/api/garments?limit=\(limit)")
        return response.garments
    }

    func importGarment(from sourceURL: String, userId: String?) async throws -> Garment {
        var payload = ["url": sourceURL]
        if let userId {
            payload["userId"] = userId
        }
        let body = try encoder.encode(payload)
        let response: ScrapeGarmentResponse = try await send(
            path: "/api/scrape-garment",
            method: "POST",
            body: body,
            contentType: "application/json"
        )
        return response.garment.attaching(savedItemId: response.savedItem?.id)
    }

    func createAvatar(imageData: Data, contentType: String, height: Int? = nil, weight: Int? = nil) async throws -> FitProfile {
        var fields: [String: String] = [:]
        if let height {
            fields["height"] = String(height)
        }
        if let weight {
            fields["weight"] = String(weight)
        }

        let boundary = "Boundary-\(UUID().uuidString)"
        let body = multipartBody(
            boundary: boundary,
            fields: fields,
            fileField: "photo",
            filename: "fit-photo.\(fileExtension(for: contentType))",
            contentType: contentType,
            data: imageData
        )

        let response: AvatarResponse = try await send(
            path: "/api/avatar",
            method: "POST",
            body: body,
            contentType: "multipart/form-data; boundary=\(boundary)"
        )
        return FitProfile(userId: response.userId, avatarUrl: response.avatarUrl)
    }

    func submitTryOn(profile: FitProfile, garment: Garment) async throws -> UUID {
        var payload: [String: String] = [
            "userId": profile.userId,
            "avatarUrl": profile.avatarUrl.absoluteString
        ]

        if let id = garment.id {
            payload["garmentId"] = id.uuidString
            if let savedItemId = garment.savedItemId {
                payload["savedItemId"] = savedItemId.uuidString
            }
        } else if garment.isLocal, let data = garment.localImageData {
            let contentType = garment.localContentType ?? "image/jpeg"
            payload["garmentImageBase64"] = "data:\(contentType);base64,\(data.base64EncodedString())"
        } else {
            payload["garmentImageUrl"] = garment.imageUrl.absoluteString
        }

        let body = try encoder.encode(payload)
        let response: TryOnSubmitResponse = try await send(
            path: "/api/tryon",
            method: "POST",
            body: body,
            contentType: "application/json"
        )
        return response.tryonId
    }

    func recordTasteEvent(
        userId: String,
        garment: Garment,
        eventType: String,
        metadata: [String: String?] = [:]
    ) async throws {
        var payload: [String: Any] = [
            "userId": userId,
            "eventType": eventType,
            "metadata": metadata.compactMapValues { $0 }
        ]
        if let id = garment.id {
            payload["garmentId"] = id.uuidString
        }
        if let savedItemId = garment.savedItemId {
            payload["savedItemId"] = savedItemId.uuidString
        }

        let body = try JSONSerialization.data(withJSONObject: payload)
        let _: TasteEventResponse = try await send(
            path: "/api/taste-events",
            method: "POST",
            body: body,
            contentType: "application/json"
        )
    }

    func fetchTryOn(id: UUID) async throws -> TryOn {
        try await send(path: "/api/tryon/\(id.uuidString)")
    }

    private func send<T: Decodable>(
        path: String,
        method: String = "GET",
        body: Data? = nil,
        contentType: String? = nil
    ) async throws -> T {
        guard let url = URL(string: path, relativeTo: baseURL) else {
            throw APIClientError.badURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = method
        request.httpBody = body
        request.timeoutInterval = 45
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        if let contentType {
            request.setValue(contentType, forHTTPHeaderField: "Content-Type")
        }

        let (data, response) = try await session.data(for: request)
        guard let httpResponse = response as? HTTPURLResponse else {
            throw APIClientError.badResponse
        }

        if !(200..<300).contains(httpResponse.statusCode) {
            if let apiError = try? decoder.decode(APIErrorResponse.self, from: data) {
                throw APIClientError.server(apiError.detail ?? apiError.error)
            }
            throw APIClientError.server("Request failed with status \(httpResponse.statusCode).")
        }

        return try decoder.decode(T.self, from: data)
    }

    private func multipartBody(
        boundary: String,
        fields: [String: String],
        fileField: String,
        filename: String,
        contentType: String,
        data: Data
    ) -> Data {
        var body = Data()

        for (name, value) in fields {
            body.append("--\(boundary)\r\n")
            body.append("Content-Disposition: form-data; name=\"\(name)\"\r\n\r\n")
            body.append("\(value)\r\n")
        }

        body.append("--\(boundary)\r\n")
        body.append("Content-Disposition: form-data; name=\"\(fileField)\"; filename=\"\(filename)\"\r\n")
        body.append("Content-Type: \(contentType)\r\n\r\n")
        body.append(data)
        body.append("\r\n--\(boundary)--\r\n")

        return body
    }

    private func fileExtension(for contentType: String) -> String {
        switch contentType {
        case "image/png":
            return "png"
        case "image/webp":
            return "webp"
        case "image/heic":
            return "heic"
        case "image/heif":
            return "heif"
        default:
            return "jpg"
        }
    }
}

private extension Data {
    mutating func append(_ string: String) {
        append(Data(string.utf8))
    }
}

import Foundation

struct FitProfile: Codable, Equatable {
    let userId: String
    let avatarUrl: URL
}

struct Garment: Codable, Identifiable, Equatable {
    let id: UUID?
    let sourceUrl: URL?
    let imageUrl: URL
    let title: String?
    let brand: String?
    let price: String?
    let domain: String?
    let isLocal: Bool
    let localImageData: Data?
    let localContentType: String?

    enum CodingKeys: String, CodingKey {
        case id
        case sourceUrl = "source_url"
        case imageUrl = "image_url"
        case title
        case brand
        case price
        case domain
    }

    init(
        id: UUID?,
        sourceUrl: URL?,
        imageUrl: URL,
        title: String?,
        brand: String?,
        price: String?,
        domain: String?,
        isLocal: Bool = false,
        localImageData: Data? = nil,
        localContentType: String? = nil
    ) {
        self.id = id
        self.sourceUrl = sourceUrl
        self.imageUrl = imageUrl
        self.title = title
        self.brand = brand
        self.price = price
        self.domain = domain
        self.isLocal = isLocal
        self.localImageData = localImageData
        self.localContentType = localContentType
    }

    init(from decoder: Decoder) throws {
        let container = try decoder.container(keyedBy: CodingKeys.self)
        id = try container.decodeIfPresent(UUID.self, forKey: .id)
        sourceUrl = try container.decodeIfPresent(URL.self, forKey: .sourceUrl)
        imageUrl = try container.decode(URL.self, forKey: .imageUrl)
        title = try container.decodeIfPresent(String.self, forKey: .title)
        brand = try container.decodeIfPresent(String.self, forKey: .brand)
        price = try container.decodeIfPresent(String.self, forKey: .price)
        domain = try container.decodeIfPresent(String.self, forKey: .domain)
        isLocal = false
        localImageData = nil
        localContentType = nil
    }

    static func localImage(data: Data, contentType: String = "image/jpeg") -> Garment {
        Garment(
            id: nil,
            sourceUrl: nil,
            imageUrl: URL(string: "https://cloak.local/local-garment")!,
            title: "Uploaded garment",
            brand: "Camera roll",
            price: nil,
            domain: nil,
            isLocal: true,
            localImageData: data,
            localContentType: contentType
        )
    }
}

struct TryOn: Codable, Identifiable, Equatable {
    enum Status: String, Codable {
        case queued
        case processing
        case finalizing
        case completed
        case failed
    }

    let id: UUID
    let status: Status
    let resultUrl: URL?
    let errorMessage: String?

    enum CodingKeys: String, CodingKey {
        case id
        case status
        case resultUrl = "result_url"
        case errorMessage = "error_message"
    }
}

struct GarmentsResponse: Decodable {
    let garments: [Garment]
}

struct ScrapeGarmentResponse: Decodable {
    let garment: Garment
    let imageUrl: URL

    enum CodingKeys: String, CodingKey {
        case garment
        case imageUrl
    }
}

struct AvatarResponse: Decodable {
    let userId: String
    let avatarUrl: URL
}

struct TryOnSubmitResponse: Decodable {
    let tryonId: UUID
    let status: String
}

struct APIErrorResponse: Decodable {
    let error: String
    let detail: String?
}

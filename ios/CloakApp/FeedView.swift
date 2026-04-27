import PhotosUI
import SwiftUI

struct FeedView: View {
    @ObservedObject var store: AppStore
    @State private var selectedGarment: PhotosPickerItem?
    @State private var showImportField = false

    var body: some View {
        ZStack {
            Color(red: 0.08, green: 0.07, blue: 0.06).ignoresSafeArea()
            Circle()
                .fill(Color(red: 0.72, green: 0.46, blue: 0.42).opacity(0.18))
                .frame(width: 280, height: 280)
                .blur(radius: 90)
                .offset(y: -330)

            ScrollView(.vertical) {
                LazyVStack(spacing: 0) {
                    if store.garments.isEmpty && !store.isLoading {
                        EmptyFeedView(showImportField: $showImportField)
                            .containerRelativeFrame(.vertical)
                    }

                    ForEach(Array(store.garments.enumerated()), id: \.offset) { _, garment in
                        GarmentCard(
                            garment: garment,
                            isLoading: store.isLoading,
                            onTryOn: {
                                Task {
                                    await store.tryOn(garment)
                                }
                            },
                            onImport: {
                                showImportField = true
                            },
                            uploadPicker: {
                                PhotosPicker(selection: $selectedGarment, matching: .images) {
                                    FeedIconButton(systemImage: "photo.badge.plus", title: "Upload")
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
                TopChrome(profile: store.profile, onReset: store.resetProfile)
                Spacer()
            }

            if showImportField {
                ImportPanel(
                    text: $store.importURLText,
                    isLoading: store.isLoading,
                    onSubmit: {
                        Task {
                            await store.importGarment()
                            showImportField = false
                        }
                    },
                    onClose: {
                        showImportField = false
                    }
                )
                .transition(.move(edge: .bottom).combined(with: .opacity))
            }
        }
        .animation(.spring(response: 0.34, dampingFraction: 0.86), value: showImportField)
        .task {
            await store.loadFeed()
        }
        .onChange(of: selectedGarment) { _, newItem in
            guard let newItem else {
                return
            }
            Task {
                await store.addLocalGarment(from: newItem)
            }
        }
    }
}

struct GarmentCard<UploadPicker: View>: View {
    let garment: Garment
    let isLoading: Bool
    let onTryOn: () -> Void
    let onImport: () -> Void
    @ViewBuilder let uploadPicker: () -> UploadPicker

    var body: some View {
        ZStack {
            GarmentImageView(garment: garment)
                .ignoresSafeArea()

            LinearGradient(
                colors: [.clear, Color(red: 0.08, green: 0.07, blue: 0.06).opacity(0.88)],
                startPoint: .center,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            HStack(alignment: .bottom, spacing: 18) {
                VStack(alignment: .leading, spacing: 10) {
                    Text(garment.title ?? "Untitled garment")
                        .font(.title2.weight(.bold))
                        .lineLimit(2)
                    HStack(spacing: 8) {
                        if let brand = garment.brand {
                            Text(brand)
                        }
                        if let price = garment.price {
                            Text(price)
                        }
                    }
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(.white.opacity(0.78))

                    Button(action: onTryOn) {
                        Label(isLoading ? "Working" : "Try on", systemImage: "sparkles")
                            .font(.headline)
                            .frame(maxWidth: .infinity)
                            .frame(height: 52)
                    }
                    .background(.white)
                    .foregroundStyle(Color(red: 0.09, green: 0.08, blue: 0.07))
                    .disabled(isLoading)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                VStack(spacing: 16) {
                    Button(action: onImport) {
                        FeedIconButton(systemImage: "link.badge.plus", title: "Link")
                    }
                    uploadPicker()
                    ShareLink(item: garment.sourceUrl ?? garment.imageUrl) {
                        FeedIconButton(systemImage: "square.and.arrow.up", title: "Share")
                    }
                }
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 18)
            .padding(.bottom, 32)
            .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        }
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
                            .tint(.white)
                    @unknown default:
                        UnavailableImageView()
                    }
                }
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .clipped()
        .background(Color.black)
    }
}

struct FeedIconButton: View {
    let systemImage: String
    let title: String

    var body: some View {
        VStack(spacing: 6) {
            Image(systemName: systemImage)
                .font(.title2.weight(.bold))
                .frame(width: 50, height: 50)
                .background(.black.opacity(0.32))
                .overlay(Circle().stroke(.white.opacity(0.16)))
                .clipShape(Circle())
            Text(title)
                .font(.caption2.weight(.bold))
        }
        .foregroundStyle(.white)
        .shadow(radius: 10)
    }
}

struct ImportPanel: View {
    @Binding var text: String
    let isLoading: Bool
    let onSubmit: () -> Void
    let onClose: () -> Void

    var body: some View {
        VStack(spacing: 14) {
            Capsule()
                .fill(.white.opacity(0.22))
                .frame(width: 44, height: 5)

            HStack(spacing: 10) {
                TextField("Paste product link", text: $text)
                    .textInputAutocapitalization(.never)
                    .keyboardType(.URL)
                    .autocorrectionDisabled()
                    .padding(.horizontal, 14)
                    .frame(height: 48)
                    .background(.white.opacity(0.1))
                    .clipShape(RoundedRectangle(cornerRadius: 12, style: .continuous))

                Button(action: onSubmit) {
                    Image(systemName: isLoading ? "hourglass" : "arrow.up")
                        .font(.headline.weight(.bold))
                        .frame(width: 48, height: 48)
                    .background(.white)
                    .foregroundStyle(Color(red: 0.09, green: 0.08, blue: 0.07))
                    .clipShape(Circle())
                }
                .disabled(isLoading)
            }
        }
        .padding(18)
        .padding(.bottom, 10)
        .background(Color(red: 0.08, green: 0.07, blue: 0.06).opacity(0.92))
        .foregroundStyle(.white)
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .bottom)
        .onTapGesture(count: 2, perform: onClose)
    }
}

struct TopChrome: View {
    let profile: FitProfile?
    let onReset: () -> Void

    var body: some View {
        HStack {
            VStack(alignment: .leading, spacing: 3) {
                Text("CLOAK")
                    .font(.caption2.weight(.bold))
                    .tracking(3)
                    .foregroundStyle(.white.opacity(0.45))
                Text("Fit feed")
                    .font(.headline.weight(.semibold))
            }
            Spacer()
            Menu {
                Button("Reset fit photo", role: .destructive, action: onReset)
            } label: {
                AsyncImage(url: profile?.avatarUrl) { image in
                    image
                        .resizable()
                        .scaledToFill()
                } placeholder: {
                    Image(systemName: "person.crop.circle.fill")
                }
                .frame(width: 36, height: 36)
                .clipShape(Circle())
            }
        }
        .foregroundStyle(.white)
        .padding(.horizontal, 18)
        .padding(.top, 12)
        .shadow(radius: 10)
    }
}

struct EmptyFeedView: View {
    @Binding var showImportField: Bool

    var body: some View {
        VStack(spacing: 18) {
            Spacer()
            Image(systemName: "tshirt.fill")
                .font(.system(size: 64))
            Text("Add your first garment")
                .font(.title2.weight(.bold))
            Text("Paste a product link or upload a screenshot from your camera roll.")
                .font(.body)
                .foregroundStyle(.white.opacity(0.7))
                .multilineTextAlignment(.center)
            Button {
                showImportField = true
            } label: {
                Label("Paste link", systemImage: "link.badge.plus")
                    .font(.headline)
                    .padding(.horizontal, 28)
                    .padding(.vertical, 14)
                    .background(.white)
                .foregroundStyle(Color(red: 0.09, green: 0.08, blue: 0.07))
                .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
            }
            Spacer()
        }
        .padding(24)
        .foregroundStyle(.white)
        .background(Color(red: 0.08, green: 0.07, blue: 0.06))
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
        .foregroundStyle(.white.opacity(0.75))
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color(red: 0.08, green: 0.08, blue: 0.09))
    }
}

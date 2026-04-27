import PhotosUI
import SwiftUI

struct OnboardingView: View {
    @ObservedObject var store: AppStore
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        ZStack {
            LinearGradient(
                colors: [Color.black, Color(red: 0.08, green: 0.09, blue: 0.1)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            VStack(alignment: .leading, spacing: 28) {
                Spacer()

                VStack(alignment: .leading, spacing: 12) {
                    Text("Cloak")
                        .font(.system(size: 58, weight: .black, design: .rounded))
                    Text("Save clothes from anywhere. Swipe through fits. Try them on your own photo.")
                        .font(.title3.weight(.medium))
                        .foregroundStyle(.white.opacity(0.72))
                        .lineLimit(nil)
                }

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(store.isLoading ? "Creating fit profile" : "Upload fit photo", systemImage: "person.crop.square")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, 17)
                        .background(.white)
                        .foregroundStyle(.black)
                        .clipShape(RoundedRectangle(cornerRadius: 14, style: .continuous))
                }
                .disabled(store.isLoading)

                Text("Use a clear full-body photo. Cloak stores this as your private fit profile on the backend.")
                    .font(.footnote)
                    .foregroundStyle(.white.opacity(0.56))
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 24)
            .padding(.bottom, 36)
        }
        .overlay {
            if store.isLoading {
                ProgressView()
                    .controlSize(.large)
                    .tint(.white)
            }
        }
        .onChange(of: selectedPhoto) { _, newItem in
            guard let newItem else {
                return
            }
            Task {
                await store.createProfile(from: newItem)
            }
        }
    }
}

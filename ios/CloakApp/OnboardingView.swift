import PhotosUI
import SwiftUI

struct OnboardingView: View {
    @ObservedObject var store: AppStore
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        let uploadTitle = store.isLoading ? "Creating fit profile" : "Upload fit photo"

        ZStack {
            LinearGradient(
                colors: [Color(red: 0.13, green: 0.11, blue: 0.09), Color(red: 0.05, green: 0.04, blue: 0.035)],
                startPoint: .top,
                endPoint: .bottom
            )
            .ignoresSafeArea()

            Circle()
                .fill(Color(red: 0.72, green: 0.46, blue: 0.42).opacity(0.26))
                .frame(width: 280, height: 280)
                .blur(radius: 80)
                .offset(y: -260)

            VStack(alignment: .leading, spacing: 22) {
                HStack {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("CLOAK")
                            .font(.caption.weight(.bold))
                            .tracking(4)
                            .foregroundStyle(.white.opacity(0.45))
                        Text("Fit profile")
                            .font(.system(size: 34, weight: .semibold))
                    }
                    Spacer()
                    Text("CL")
                        .font(.footnote.weight(.bold))
                        .frame(width: 48, height: 48)
                        .overlay(Rectangle().stroke(.white.opacity(0.16)))
                        .background(.white.opacity(0.07))
                }

                FittingRoomPreview()

                HStack(spacing: 8) {
                    ProfileChip(title: "Front")
                    ProfileChip(title: "Bright")
                    ProfileChip(title: "Full body")
                }

                Spacer(minLength: 0)

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(uploadTitle, systemImage: "person.crop.square")
                        .font(.headline)
                        .frame(maxWidth: .infinity)
                        .frame(height: 54)
                        .background(.white)
                        .foregroundStyle(Color(red: 0.09, green: 0.08, blue: 0.07))
                }
                .disabled(store.isLoading)

                Text("Your image is stored by the backend for try-on generation.")
                    .font(.footnote.weight(.medium))
                    .foregroundStyle(.white.opacity(0.46))
                    .frame(maxWidth: .infinity, alignment: .center)
            }
            .foregroundStyle(.white)
            .padding(.horizontal, 20)
            .padding(.bottom, 24)
            .padding(.top, 18)
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

struct FittingRoomPreview: View {
    var body: some View {
        ZStack {
            LinearGradient(
                colors: [
                    Color(red: 0.96, green: 0.92, blue: 0.86),
                    Color(red: 0.76, green: 0.68, blue: 0.6),
                    Color(red: 0.24, green: 0.19, blue: 0.16),
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )

            VStack {
                HStack {
                    Text("FIT FRAME")
                    Spacer()
                    Text("01")
                }
                .font(.system(size: 10, weight: .bold))
                .tracking(2)
                .foregroundStyle(.black.opacity(0.42))
                .padding(18)

                Spacer()
            }

            VStack(spacing: 0) {
                Circle()
                    .fill(Color(red: 0.91, green: 0.85, blue: 0.79))
                    .frame(width: 62, height: 62)
                RoundedRectangle(cornerRadius: 46, style: .continuous)
                    .fill(Color(red: 0.1, green: 0.08, blue: 0.07))
                    .frame(width: 112, height: 176)
                    .offset(y: -4)
            }
            .offset(y: 48)

            HStack {
                Rectangle()
                    .fill(.white.opacity(0.35))
                    .frame(width: 56, height: 66)
                Spacer()
                Rectangle()
                    .fill(.white.opacity(0.35))
                    .frame(width: 56, height: 66)
            }
            .padding(.horizontal, 22)
            .frame(maxHeight: .infinity, alignment: .bottom)
            .padding(.bottom, 24)
        }
        .aspectRatio(4 / 5, contentMode: .fit)
        .overlay(Rectangle().stroke(.white.opacity(0.12)))
        .padding(12)
        .background(.white.opacity(0.06))
        .overlay(Rectangle().stroke(.white.opacity(0.12)))
        .shadow(color: .black.opacity(0.36), radius: 36, y: 24)
    }
}

struct ProfileChip: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.caption.weight(.bold))
            .frame(maxWidth: .infinity)
            .frame(height: 42)
            .background(.white.opacity(0.06))
            .overlay(Rectangle().stroke(.white.opacity(0.1)))
            .foregroundStyle(.white.opacity(0.68))
    }
}

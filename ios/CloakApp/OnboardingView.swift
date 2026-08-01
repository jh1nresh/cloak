import PhotosUI
import SwiftUI

struct OnboardingView: View {
    @ObservedObject var store: AppStore
    @State private var selectedPhoto: PhotosPickerItem?

    var body: some View {
        let uploadTitle = store.isLoading ? "Creating profile" : "Choose fit photo"

        ZStack {
            CloakTheme.canvas.ignoresSafeArea()

            VStack(alignment: .leading, spacing: 0) {
                header
                fittingGuide
                    .padding(.top, 26)
                guidance
                    .padding(.top, 22)

                Spacer(minLength: 20)

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(uploadTitle, systemImage: "person.crop.rectangle")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakPrimaryButtonStyle())
                .disabled(store.isLoading)

                Text("Your photo is stored by Cloak's backend for try-on generation. You can replace it from your profile.")
                    .font(.caption)
                    .foregroundStyle(CloakTheme.muted)
                    .multilineTextAlignment(.center)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 12)
            }
            .padding(.horizontal, 20)
            .padding(.top, 18)
            .padding(.bottom, 18)
        }
        .overlay {
            if store.isLoading {
                CloakTheme.ink.opacity(0.36).ignoresSafeArea()
                ProgressView()
                    .controlSize(.large)
                    .tint(CloakTheme.surface)
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

    private var header: some View {
        VStack(alignment: .leading, spacing: 14) {
            CloakWordmark(color: CloakTheme.ink)
            Text("Your fitting profile")
                .font(.system(.largeTitle, design: .serif, weight: .medium))
                .foregroundStyle(CloakTheme.ink)
            Text("One clear, full-body photo lets Cloak place shared clothes on you.")
                .font(.body)
                .foregroundStyle(CloakTheme.muted)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    private var fittingGuide: some View {
        ZStack {
            CloakTheme.ink

            Rectangle()
                .stroke(CloakTheme.surface.opacity(0.28), style: StrokeStyle(lineWidth: 1, dash: [8, 7]))
                .padding(18)

            VStack(spacing: 14) {
                Image(systemName: "person.fill")
                    .font(.system(size: 112, weight: .thin))
                Text("HEAD TO TOE")
                    .font(.caption2.weight(.bold))
                    .tracking(2)
            }
            .foregroundStyle(CloakTheme.surface)

            VStack {
                HStack {
                    Text("FIT FRAME")
                    Spacer()
                    Text("01")
                }
                .font(.caption2.weight(.bold))
                .tracking(1.5)
                .foregroundStyle(CloakTheme.surface.opacity(0.64))
                Spacer()
            }
            .padding(30)
        }
        .aspectRatio(4 / 5, contentMode: .fit)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Fit photo guide. Stand facing forward and include your full body.")
    }

    private var guidance: some View {
        VStack(spacing: 0) {
            GuideRow(number: "01", title: "Face forward", detail: "Keep your pose natural and unobstructed.")
            Divider().overlay(CloakTheme.line)
            GuideRow(number: "02", title: "Use even light", detail: "Avoid strong shadows and backlighting.")
            Divider().overlay(CloakTheme.line)
            GuideRow(number: "03", title: "Show your full body", detail: "Leave a little space around your outline.")
        }
    }
}

private struct GuideRow: View {
    let number: String
    let title: String
    let detail: String

    var body: some View {
        HStack(alignment: .firstTextBaseline, spacing: 14) {
            Text(number)
                .font(.caption2.weight(.bold))
                .foregroundStyle(CloakTheme.action)
                .frame(width: 22, alignment: .leading)
            VStack(alignment: .leading, spacing: 2) {
                Text(title)
                    .font(.subheadline.weight(.semibold))
                    .foregroundStyle(CloakTheme.ink)
                Text(detail)
                    .font(.caption)
                    .foregroundStyle(CloakTheme.muted)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.vertical, 10)
    }
}

import PhotosUI
import SwiftUI

struct ProfileView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                header
                stats
                    .padding(.top, 24)
                profileLinks
                    .padding(.top, 30)
                supportLinks
                    .padding(.top, 28)
            }
            .padding(.horizontal, 18)
            .padding(.top, 18)
            .padding(.bottom, 116)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .toolbar(.hidden, for: .navigationBar)
    }

    private var header: some View {
        VStack(alignment: .leading, spacing: 16) {
            CloakWordmark(color: CloakTheme.ink)
            HStack(spacing: 16) {
                AsyncImage(url: store.profile?.avatarUrl) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    Image(systemName: "person.crop.circle.fill")
                        .resizable()
                        .foregroundStyle(CloakTheme.line)
                }
                .frame(width: 82, height: 102)
                .background(CloakTheme.surface)
                .overlay(Rectangle().stroke(CloakTheme.line))
                .clipped()

                VStack(alignment: .leading, spacing: 6) {
                    Text("Your Cloak")
                        .font(.system(.largeTitle, design: .serif, weight: .medium))
                        .foregroundStyle(CloakTheme.ink)
                    Text(tasteStatus)
                        .font(.subheadline)
                        .foregroundStyle(CloakTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }
            }
        }
    }

    private var stats: some View {
        HStack(spacing: 0) {
            ProfileStat(value: store.savedGarments.count, label: "Saved")
            Divider().overlay(CloakTheme.line).frame(height: 44)
            ProfileStat(value: store.completedLooks.count, label: "Tried")
            Divider().overlay(CloakTheme.line).frame(height: 44)
            ProfileStat(value: store.tasteSummary.signalCount, label: "Signals")
        }
        .padding(.vertical, 14)
        .overlay(alignment: .top) { Divider().overlay(CloakTheme.line) }
        .overlay(alignment: .bottom) { Divider().overlay(CloakTheme.line) }
    }

    private var profileLinks: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(title: "PERSONAL")
            NavigationLink {
                FitProfileView(store: store)
            } label: {
                ProfileLinkRow(systemImage: "person.crop.rectangle", title: "Fit photo", detail: "Replace or remove")
            }
            NavigationLink {
                TasteProfileView(store: store)
            } label: {
                ProfileLinkRow(systemImage: "heart.text.square", title: "Taste", detail: tasteDetail)
            }
        }
        .buttonStyle(.plain)
    }

    private var supportLinks: some View {
        VStack(alignment: .leading, spacing: 0) {
            SectionLabel(title: "CLOAK")
            NavigationLink {
                PrivacyDataView(store: store)
            } label: {
                ProfileLinkRow(systemImage: "hand.raised", title: "Privacy & data", detail: "Photos and local history")
            }
            NavigationLink {
                AboutCloakView(store: store)
            } label: {
                ProfileLinkRow(systemImage: "info.circle", title: "About", detail: "Version 1.0")
            }
        }
        .buttonStyle(.plain)
    }

    private var tasteStatus: String {
        if store.tasteSummary.signalCount == 0 {
            return "Your taste profile starts with what you keep and skip."
        }
        return "Learning from \(store.tasteSummary.signalCount) private shopping signals."
    }

    private var tasteDetail: String {
        store.tasteSummary.signalCount == 0 ? "No signals yet" : "\(store.tasteSummary.signalCount) signals"
    }
}

struct FitProfileView: View {
    @ObservedObject var store: AppStore
    @State private var selectedPhoto: PhotosPickerItem?
    @State private var confirmsRemoval = false

    var body: some View {
        let replaceTitle = store.isLoading ? "Replacing photo" : "Replace fit photo"

        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                AsyncImage(url: store.profile?.avatarUrl) { image in
                    image.resizable().scaledToFill()
                } placeholder: {
                    ProgressView().tint(CloakTheme.action)
                }
                .frame(maxWidth: .infinity)
                .aspectRatio(4 / 5, contentMode: .fill)
                .clipped()
                .overlay(Rectangle().stroke(CloakTheme.line))

                VStack(alignment: .leading, spacing: 8) {
                    Text("FIT PHOTO")
                        .font(.caption2.weight(.bold))
                        .tracking(1.2)
                        .foregroundStyle(CloakTheme.action)
                    Text("The image Cloak uses for try-on")
                        .font(.system(.title2, design: .serif, weight: .medium))
                        .foregroundStyle(CloakTheme.ink)
                    Text("A replacement creates a new fitting profile. Saved and tried items on this device are cleared so two profiles never share private history.")
                        .font(.subheadline)
                        .foregroundStyle(CloakTheme.muted)
                        .fixedSize(horizontal: false, vertical: true)
                }

                PhotosPicker(selection: $selectedPhoto, matching: .images) {
                    Label(replaceTitle, systemImage: "photo.badge.arrow.down")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakPrimaryButtonStyle())
                .disabled(store.isLoading)

                Button(role: .destructive) {
                    confirmsRemoval = true
                } label: {
                    Label("Remove profile from this iPhone", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakSecondaryButtonStyle())
            }
            .padding(18)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .navigationTitle("Fit photo")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.isTabBarHidden = true }
        .onDisappear { store.isTabBarHidden = false }
        .confirmationDialog(
            "Remove this fitting profile?",
            isPresented: $confirmsRemoval,
            titleVisibility: .visible
        ) {
            Button("Remove from this iPhone", role: .destructive, action: store.resetProfile)
            Button("Cancel", role: .cancel) {}
        } message: {
            Text("This clears the local profile, saved pieces, tried looks, and taste signals. It does not delete cloud data.")
        }
        .onChange(of: selectedPhoto) { _, item in
            guard let item else { return }
            Task {
                await store.createProfile(from: item)
                selectedPhoto = nil
            }
        }
    }
}

struct TasteProfileView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 0) {
                Text("Taste is behavior, not a quiz.")
                    .font(.system(.largeTitle, design: .serif, weight: .medium))
                    .foregroundStyle(CloakTheme.ink)
                Text("Cloak currently keeps only your action totals on this device. Brand, color, silhouette, and price preferences require the recommendation backend.")
                    .font(.subheadline)
                    .foregroundStyle(CloakTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)
                    .padding(.top, 10)

                VStack(spacing: 0) {
                    TasteSignalRow(title: "Saved", value: store.tasteSummary.saves, systemImage: "bookmark")
                    TasteSignalRow(title: "Skipped", value: store.tasteSummary.skips, systemImage: "xmark")
                    TasteSignalRow(title: "Retailer visits", value: store.tasteSummary.retailerOpens, systemImage: "arrow.up.right")
                    TasteSignalRow(title: "Completed try-ons", value: store.completedLooks.count, systemImage: "sparkles")
                }
                .padding(.top, 28)
            }
            .padding(18)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .navigationTitle("Taste")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.isTabBarHidden = true }
        .onDisappear { store.isTabBarHidden = false }
    }
}

struct PrivacyDataView: View {
    @ObservedObject var store: AppStore
    @State private var confirmsRemoval = false

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 28) {
                PrivacySection(
                    title: "FIT PHOTO",
                    text: "Your photo is uploaded to Cloak's backend and used to generate try-on images. It is sensitive personal data."
                )
                PrivacySection(
                    title: "ON THIS IPHONE",
                    text: "Cloak stores your fitting profile reference, saved-piece keys, completed-look links, and action totals in local app storage."
                )
                PrivacySection(
                    title: "OWNERSHIP",
                    text: "Saving a piece or opening a retailer never marks it as owned. Ownership requires separate confirmation."
                )
                PrivacySection(
                    title: "CLOUD DELETION",
                    text: "Cloud deletion is not available inside this private-beta build. Removing the local profile does not delete backend media or records."
                )

                Button(role: .destructive) {
                    confirmsRemoval = true
                } label: {
                    Label("Clear data on this iPhone", systemImage: "trash")
                        .frame(maxWidth: .infinity)
                }
                .buttonStyle(CloakSecondaryButtonStyle())
            }
            .padding(18)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .navigationTitle("Privacy & data")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.isTabBarHidden = true }
        .onDisappear { store.isTabBarHidden = false }
        .confirmationDialog(
            "Clear Cloak data on this iPhone?",
            isPresented: $confirmsRemoval,
            titleVisibility: .visible
        ) {
            Button("Clear local data", role: .destructive, action: store.resetProfile)
            Button("Cancel", role: .cancel) {}
        }
    }
}

struct AboutCloakView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: 22) {
                CloakWordmark(color: CloakTheme.ink)
                Text("See the piece, on you.")
                    .font(.system(.largeTitle, design: .serif, weight: .medium))
                    .foregroundStyle(CloakTheme.ink)
                Text("Cloak turns shared fashion links and garment images into a private try-on feed. It preserves the original retailer source so every look can be checked before a decision.")
                    .font(.body)
                    .foregroundStyle(CloakTheme.muted)
                    .fixedSize(horizontal: false, vertical: true)

                Divider().overlay(CloakTheme.line)

                LabeledContent("Version", value: "1.0")
                LabeledContent("Build", value: "1")
                LabeledContent("Mode", value: "Private beta")
            }
            .padding(18)
        }
        .background(CloakTheme.canvas.ignoresSafeArea())
        .navigationTitle("About")
        .navigationBarTitleDisplayMode(.inline)
        .onAppear { store.isTabBarHidden = true }
        .onDisappear { store.isTabBarHidden = false }
    }
}

private struct ProfileStat: View {
    let value: Int
    let label: String

    var body: some View {
        VStack(spacing: 3) {
            Text(value, format: .number)
                .font(.title3.weight(.semibold))
                .foregroundStyle(CloakTheme.ink)
            Text(label)
                .font(.caption)
                .foregroundStyle(CloakTheme.muted)
        }
        .frame(maxWidth: .infinity)
    }
}

private struct SectionLabel: View {
    let title: String

    var body: some View {
        Text(title)
            .font(.caption2.weight(.bold))
            .tracking(1.2)
            .foregroundStyle(CloakTheme.action)
            .padding(.bottom, 6)
    }
}

private struct ProfileLinkRow: View {
    let systemImage: String
    let title: String
    let detail: String

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: systemImage)
                .font(.body.weight(.medium))
                .foregroundStyle(CloakTheme.action)
                .frame(width: 24)
            Text(title)
                .font(.body.weight(.medium))
                .foregroundStyle(CloakTheme.ink)
            Spacer()
            Text(detail)
                .font(.caption)
                .foregroundStyle(CloakTheme.muted)
                .lineLimit(1)
            Image(systemName: "chevron.right")
                .font(.caption.weight(.semibold))
                .foregroundStyle(CloakTheme.muted)
        }
        .frame(minHeight: 54)
        .overlay(alignment: .bottom) { Divider().overlay(CloakTheme.line) }
        .contentShape(Rectangle())
    }
}

private struct TasteSignalRow: View {
    let title: String
    let value: Int
    let systemImage: String

    var body: some View {
        HStack(spacing: 13) {
            Image(systemName: systemImage)
                .foregroundStyle(CloakTheme.action)
                .frame(width: 24)
            Text(title)
                .foregroundStyle(CloakTheme.ink)
            Spacer()
            Text(value, format: .number)
                .font(.body.weight(.semibold))
                .foregroundStyle(CloakTheme.ink)
        }
        .frame(minHeight: 56)
        .overlay(alignment: .bottom) { Divider().overlay(CloakTheme.line) }
    }
}

private struct PrivacySection: View {
    let title: String
    let text: String

    var body: some View {
        VStack(alignment: .leading, spacing: 7) {
            Text(title)
                .font(.caption2.weight(.bold))
                .tracking(1.2)
                .foregroundStyle(CloakTheme.action)
            Text(text)
                .font(.body)
                .foregroundStyle(CloakTheme.ink)
                .fixedSize(horizontal: false, vertical: true)
        }
    }
}

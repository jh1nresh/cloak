import SwiftUI

struct AppShellView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        ZStack(alignment: .bottom) {
            Group {
                switch store.selectedTab {
                case .discover:
                    FeedView(store: store)
                case .closet:
                    NavigationStack {
                        ClosetView(store: store)
                    }
                case .profile:
                    NavigationStack {
                        ProfileView(store: store)
                    }
                }
            }

            if !store.isImportPresented && !store.isTabBarHidden {
                CloakTabBar(
                    selection: $store.selectedTab,
                    onImport: store.presentImport
                )
                .padding(.horizontal, 14)
                .padding(.bottom, 8)
            }
        }
        .ignoresSafeArea(.keyboard)
    }
}

private struct CloakTabBar: View {
    @Binding var selection: AppTab
    let onImport: () -> Void
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    var body: some View {
        HStack(spacing: 4) {
            tabButton(.discover)
            tabButton(.closet)

            Button(action: onImport) {
                Image(systemName: "plus")
                    .font(.system(size: 19, weight: .bold))
                    .foregroundStyle(CloakTheme.surface)
                    .frame(width: 52, height: 44)
                    .background(CloakTheme.action)
                    .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.18)))
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Import a piece")

            tabButton(.profile)
        }
        .padding(6)
        .background {
            if reduceTransparency {
                CloakTheme.ink
            } else {
                Rectangle().fill(.ultraThinMaterial)
            }
        }
        .background(CloakTheme.ink.opacity(0.72))
        .overlay(Rectangle().stroke(CloakTheme.surface.opacity(0.2)))
        .shadow(color: CloakTheme.ink.opacity(0.24), radius: 18, y: 7)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        Button {
            selection = tab
        } label: {
            VStack(spacing: 3) {
                Image(systemName: selection == tab ? selectedSymbol(for: tab) : tab.systemImage)
                    .font(.system(size: 18, weight: .semibold))
                    .frame(height: 20)
                Text(tab.title)
                    .font(.system(size: 9, weight: .semibold))
                    .lineLimit(1)
            }
            .foregroundStyle(selection == tab ? CloakTheme.surface : CloakTheme.surface.opacity(0.58))
            .frame(maxWidth: .infinity)
            .frame(height: 44)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(selection == tab ? .isSelected : [])
    }

    private func selectedSymbol(for tab: AppTab) -> String {
        switch tab {
        case .discover: "sparkles"
        case .closet: "hanger"
        case .profile: "person.crop.circle.fill"
        }
    }
}

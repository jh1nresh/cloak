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
                CloakTabBar(selection: $store.selectedTab)
            }
        }
        .ignoresSafeArea(.keyboard)
    }
}

/// Three destinations, native height, at the safe-area edge. Import is a
/// command in Today's toolbar, not a tab — the bar never floats over decision
/// content.
private struct CloakTabBar: View {
    @Binding var selection: AppTab
    @Environment(\.accessibilityReduceTransparency) private var reduceTransparency

    private var isOverStage: Bool { selection == .discover }

    var body: some View {
        HStack(spacing: 0) {
            ForEach(AppTab.allCases) { tab in
                tabButton(tab)
            }
        }
        .frame(height: 49)
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                if !reduceTransparency {
                    Rectangle().fill(.ultraThinMaterial)
                }
                Rectangle().fill(surfaceTint)
            }
            .ignoresSafeArea(edges: .bottom)
        }
        .overlay(alignment: .top) {
            Rectangle()
                .fill(separator)
                .frame(height: 0.5)
        }
        .environment(\.colorScheme, isOverStage ? .dark : .light)
    }

    private var surfaceTint: Color {
        if isOverStage {
            return CloakTheme.stage.opacity(reduceTransparency ? 1 : 0.62)
        }
        return CloakTheme.paper.opacity(reduceTransparency ? 1 : 0.80)
    }

    private var separator: Color {
        isOverStage
            ? CloakTheme.stageInk.opacity(reduceTransparency ? 0.64 : 0.10)
            : CloakTheme.paperInk.opacity(0.12)
    }

    private func tabButton(_ tab: AppTab) -> some View {
        Button {
            selection = tab
        } label: {
            Text(tab.title)
                .font(.caption2.weight(selection == tab ? .semibold : .medium))
                .foregroundStyle(foreground(for: tab))
                .frame(maxWidth: .infinity)
                .frame(height: 49)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel(tab.title)
        .accessibilityAddTraits(selection == tab ? .isSelected : [])
    }

    private func foreground(for tab: AppTab) -> Color {
        let selected = selection == tab
        if isOverStage {
            return selected ? CloakTheme.stageInk : CloakTheme.stageInk.opacity(0.5)
        }
        return selected ? CloakTheme.paperInk : CloakTheme.paperInk.opacity(0.68)
    }
}

import SwiftUI

@main
struct CloakApp: App {
    @StateObject private var store = AppStore()

    var body: some Scene {
        WindowGroup {
            RootView(store: store)
                .onOpenURL { url in
                    store.handleOpenURL(url)
                }
        }
    }
}

struct RootView: View {
    @ObservedObject var store: AppStore

    var body: some View {
        Group {
            if store.profile == nil {
                OnboardingView(store: store)
            } else if store.activeTryOn != nil {
                ResultView(store: store)
            } else {
                FeedView(store: store)
            }
        }
        .alert("Cloak", isPresented: errorBinding) {
            Button("OK", role: .cancel) {
                store.errorMessage = nil
            }
        } message: {
            Text(store.errorMessage ?? "")
        }
    }

    private var errorBinding: Binding<Bool> {
        Binding(
            get: { store.errorMessage != nil },
            set: { isPresented in
                if !isPresented {
                    store.errorMessage = nil
                }
            }
        )
    }
}

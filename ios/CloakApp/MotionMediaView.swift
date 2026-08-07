import AVFoundation
import SwiftUI

/// Silent looping player for motion try-on output. VTON results carry no audio,
/// so there is no mute control to expose.
private final class LoopingPlayerUIView: UIView {
    override class var layerClass: AnyClass { AVPlayerLayer.self }

    private var playerLayer: AVPlayerLayer { layer as! AVPlayerLayer }
    private var looper: AVPlayerLooper?
    private var queuePlayer: AVQueuePlayer?
    private var currentURL: URL?

    func configure(url: URL) {
        guard currentURL != url else { return }
        currentURL = url

        let item = AVPlayerItem(url: url)
        let player = AVQueuePlayer()
        player.isMuted = true
        player.actionAtItemEnd = .advance
        looper = AVPlayerLooper(player: player, templateItem: item)
        queuePlayer = player

        playerLayer.player = player
        playerLayer.videoGravity = .resizeAspectFill
    }

    func setPlaying(_ playing: Bool) {
        guard let queuePlayer else { return }
        if playing {
            queuePlayer.play()
        } else {
            queuePlayer.pause()
        }
    }

    func teardown() {
        queuePlayer?.pause()
        playerLayer.player = nil
        looper = nil
        queuePlayer = nil
        currentURL = nil
    }
}

private struct LoopingPlayer: UIViewRepresentable {
    let url: URL
    let isPlaying: Bool

    func makeUIView(context: Context) -> UIView {
        let view = LoopingPlayerUIView()
        view.backgroundColor = UIColor(CloakTheme.stage)
        view.configure(url: url)
        view.setPlaying(isPlaying)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {
        guard let view = uiView as? LoopingPlayerUIView else { return }
        view.configure(url: url)
        view.setPlaying(isPlaying)
    }

    static func dismantleUIView(_ uiView: UIView, coordinator: ()) {
        (uiView as? LoopingPlayerUIView)?.teardown()
    }
}

/// Full-bleed media for one feed page.
///
/// The poster frame shows immediately and the video crosses over it once the
/// page is active, so back-swiping never lands on an empty cell. Under Reduce
/// Motion the video never autoplays — the poster stays with a play control.
struct MotionMediaView: View {
    let posterUrl: URL?
    let videoUrl: URL?
    /// Page is settled and on screen.
    let isActive: Bool
    /// Held down for inspection.
    let isHeld: Bool

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var wantsPlayback = false

    private var showsVideo: Bool {
        guard videoUrl != nil, isActive else { return false }
        return reduceMotion ? wantsPlayback : true
    }

    private var isPlaying: Bool {
        showsVideo && !isHeld
    }

    var body: some View {
        ZStack {
            CloakTheme.stage

            RemoteFillImage(url: posterUrl)
                .opacity(showsVideo ? 0 : 1)

            if let videoUrl, isActive {
                LoopingPlayer(url: videoUrl, isPlaying: isPlaying)
                    .opacity(showsVideo ? 1 : 0)
                    .allowsHitTesting(false)
            }

            if videoUrl != nil, reduceMotion, !wantsPlayback, isActive {
                Button {
                    wantsPlayback = true
                } label: {
                    Image(systemName: "play.fill")
                        .font(.system(size: 20, weight: .semibold))
                        .foregroundStyle(CloakTheme.stageInk)
                        .frame(width: 62, height: 62)
                        .background(Circle().fill(CloakTheme.stage.opacity(0.5)))
                        .overlay(Circle().stroke(CloakTheme.stageInk.opacity(0.5)))
                }
                .buttonStyle(.plain)
                .accessibilityLabel("Play look")
            }

            if isHeld, showsVideo, !reduceMotion {
                Text("PAUSED")
                    .font(.caption.weight(.semibold))
                    .tracking(1.1)
                    .foregroundStyle(CloakTheme.stageInk.opacity(0.8))
                    .padding(.horizontal, 15)
                    .padding(.vertical, 9)
                    .cloakStageGlass(RoundedRectangle(cornerRadius: 11, style: .continuous))
                    .allowsHitTesting(false)
            }
        }
        // Entry takes longer than exit.
        .animation(
            reduceMotion ? nil : .easeInOut(duration: showsVideo ? 0.3 : 0.15),
            value: showsVideo
        )
        .onChange(of: isActive) { _, active in
            if !active { wantsPlayback = false }
        }
        .clipped()
    }
}

/// `scaledToFill` remote image with the stage as its backing. Product imagery
/// is never graded or tinted.
struct RemoteFillImage: View {
    let url: URL?
    var localData: Data?

    var body: some View {
        // Drawn as an overlay on a flexible spacer: a `scaledToFill` image
        // reports its own natural size, which would otherwise widen every
        // container it sits in.
        Color.clear
            .overlay {
                content
            }
            .clipped()
    }

    @ViewBuilder
    private var content: some View {
        if let localData, let image = UIImage(data: localData) {
            Image(uiImage: image)
                .resizable()
                .scaledToFill()
        } else if let url {
            AsyncImage(url: url) { phase in
                switch phase {
                case .success(let image):
                    image.resizable().scaledToFill()
                case .failure:
                    CloakTheme.stage
                case .empty:
                    ZStack {
                        CloakTheme.stage
                        ProgressView().tint(CloakTheme.stageInk.opacity(0.6))
                    }
                @unknown default:
                    CloakTheme.stage
                }
            }
        } else {
            CloakTheme.stage
        }
    }
}

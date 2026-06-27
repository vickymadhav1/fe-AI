import Cocoa

final class AppDelegate: NSObject, NSApplicationDelegate {
    private var window: NSWindow?

    func applicationDidFinishLaunching(_ notification: Notification) {
        NSApp.setActivationPolicy(.accessory)

        let rect = NSRect(x: 220, y: 220, width: 520, height: 260)
        let window = NSWindow(
            contentRect: rect,
            styleMask: [.titled, .closable, .resizable, .fullSizeContentView],
            backing: .buffered,
            defer: false
        )

        window.title = "Interview Mate AI Native Stealth Probe"
        window.isOpaque = false
        window.backgroundColor = NSColor.black.withAlphaComponent(0.72)
        window.level = .floating
        window.collectionBehavior = [.canJoinAllSpaces, .fullScreenAuxiliary]
        window.sharingType = .none

        let label = NSTextField(labelWithString: "Visible locally. Attempting NSWindow.sharingType = .none.")
        label.textColor = .white
        label.font = NSFont.systemFont(ofSize: 18, weight: .semibold)
        label.frame = NSRect(x: 28, y: 112, width: 464, height: 36)

        let detail = NSTextField(labelWithString: "Verify remotely in Meet, Teams, Zoom, and Webex. ScreenCaptureKit paths may still vary.")
        detail.textColor = NSColor.white.withAlphaComponent(0.72)
        detail.font = NSFont.systemFont(ofSize: 13, weight: .medium)
        detail.frame = NSRect(x: 28, y: 78, width: 464, height: 28)

        let content = NSView(frame: rect)
        content.addSubview(label)
        content.addSubview(detail)
        window.contentView = content
        window.makeKeyAndOrderFront(nil)
        self.window = window
    }
}

let app = NSApplication.shared
let delegate = AppDelegate()
app.delegate = delegate
app.run()


{
  "targets": [
    {
      "target_name": "stealth_bridge",
      "sources": [
        "src/stealth_bridge.cc"
      ],
      "conditions": [
        ["OS=='mac'", {
          "sources": ["src/platform_mac.mm"],
          "libraries": ["-framework AppKit"]
        }],
        ["OS=='win'", {
          "sources": ["src/platform_win.cc"],
          "libraries": ["user32.lib", "dwmapi.lib"]
        }],
        ["OS=='linux'", {
          "sources": ["src/platform_linux.cc"]
        }]
      ]
    }
  ]
}


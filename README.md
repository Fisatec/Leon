# Léon
Léon converts any website into a standalone desktop application using Electron. It automatically extracts or accepts custom icons, supports frameless custom titlebars, preserves window state, and builds portable artifacts via electron-builder.

✨ Features
- Convert any URL into a portable desktop app
- Automatic icon detection / Option to upload your own icon
- Frameless or system titlebar modes
- Optionale persistent window size and position
- Optional scrollbar removal for a cleaner app-like view
- Builds with electron-builder (Windows Portable, macOS DMG, Linux AppImage / deb)

🚀 Quick Start
Requirements: 
>Node.js ≥ 18 and npm
   ```
   git clone https://github.com/fisatec/leon
   cd leon
   npm install
   npm run start
   ```
Use the GUI to enter a website URL, choose an icon (optional), and select your build target.

🧱 Build Léon itself
If you want to package Léon for distribution:
```
npm run build
```
Generated apps use electron-builder internally. Cross‑platform builds may require additional tools (e.g. Wine).

⚙️ How It Works  
Icon Handling: Tries custom Icon or Google S2 favicon first (256px PNG → ICO). Falls back to /favicon.ico.  
Window Mode: Choose between frameless (custom titlebar) or native system frame.  
Window State: Position and size are remembered per app.  
Safety: External links open in the default browser. Léon adds a permissive CSP to support most sites.

🤝 Contributing  
Contributions are welcome!  
Ideas include improving icon fallback logic, tightening CSP, or adding new platform presets.

📜 License  
MIT License — free to use, modify, and distribute.

  
>**Léon** – The elegant way to bring any website to your desktop.

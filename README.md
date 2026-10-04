# Ambient Light for YouTube Music™

An immersive browser extension that brings dynamic, real-time ambient lighting effects to **YouTube Music** (`music.youtube.com`), inspired by the popular *Ambient light for YouTube* extension.

Works on **Google Chrome**, **Microsoft Edge**, **Brave**, **Opera**, and any Chromium-based browser.

---

## ✨ Features

- 🌈 **Dual-Source Ambient Glow**:
  - **Video Mode**: Real-time 30fps/60fps color extraction from playing music videos.
  - **Song Mode**: Instant, rich ambient atmospheric glow extracted directly from album artwork.
- 🎭 **Two Lighting Modes**:
  - **Player Halo**: A vibrant halo glowing directly around the music video or album cover (classic Ambilight experience).
  - **Full Backdrop**: An expansive, immersive ambient glow filling the entire YouTube Music player page.
- 🎛️ **In-Player "AL" Button**:
  - Directly embedded into YouTube Music’s player bar next to volume/controls (just like on YouTube!).
  - **Click**: Opens a quick flyout settings menu right on the page.
  - **Shift + Click**: Instantly toggles Ambient Light ON/OFF.
- 🎚️ **Customizable Controls**:
  - **Blur Radius**: 10px to 160px
  - **Spread / Size**: 100% to 200%
  - **Brightness**: 50% to 200%
  - **Saturation**: 50% to 250% (boost colors for vivid neon effects)
  - **Opacity**: 10% to 100%
  - **Framerate Limiter**: 15 FPS (Battery Saver), 30 FPS (Balanced), 60 FPS (Ultra-smooth)
- ⚡ **One-Click Presets**:
  - *Subtle*, *Cinematic*, *Vibrant*, *Ultra Glow*
- 🚀 **High Performance**:
  - Uses low-resolution offscreen canvas buffers and hardware-accelerated GPU compositor filters (`will-change: filter, transform`).
  - Automatic zero-CPU pause when audio/video is paused or when viewing static album art.

---

## 📦 How to Install (Load as Unpacked Extension)

Since this is your custom extension, you can install it into your browser in under 30 seconds:

### In Google Chrome / Brave:
1. Open Chrome/Brave and go to `chrome://extensions` in your address bar.
2. In the top-right corner, toggle **Developer mode** to **ON**.
3. Click the **Load unpacked** button in the top-left corner.
4. Select the folder:
   ```
   yt-music-ambient-light
   ```
   (Located inside your workspace at `c:\Users\Rishabh\OneDrive\ドキュメント\CODES\hack main\yt-music-ambient-light\`)
5. Done! The **Ambient Light for YouTube Music** extension is now active.

### In Microsoft Edge:
1. Open Edge and navigate to `edge://extensions`.
2. In the left sidebar, toggle **Developer mode** to **ON**.
3. Click **Load unpacked** and select the `yt-music-ambient-light` folder.

---

## 🎵 How to Use

1. Navigate to **[music.youtube.com](https://music.youtube.com)**.
2. Play any song or music video.
3. Open the player (click the album art or expand the bottom player).
4. You will immediately see the dynamic ambient lighting glow behind the player!
5. In the bottom-right player bar, click the **AL** button to tweak blur, spread, brightness, or switch to **Full Backdrop** mode.
6. Click the extension icon in your browser toolbar to open the full settings panel and explore presets like **Vibrant** or **Cinematic**.

---

## 🛠️ File Structure

```
yt-music-ambient-light/
├── manifest.json          # Chrome Manifest V3 configuration
├── content.js             # Real-time frame capture, observer, and AL button
├── content.css            # Ambient lighting canvas styles & quick menu
├── popup/
│   ├── popup.html         # Settings popup UI
│   ├── popup.css          # Dark frosted-glass theme
│   └── popup.js           # Slider controls & storage sync
├── icons/                 # Extension icons (16px, 32px, 48px, 128px)
│   ├── icon16.png
│   ├── icon32.png
│   ├── icon48.png
│   └── icon128.png
└── README.md              # Documentation
```

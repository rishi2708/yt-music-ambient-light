/**
 * Ambient Light for YouTube Music™ - Content Engine
 * Injects multi-layer fluid ambient lighting (Wide Aura + Center Bloom)
 * across Home, Playlists, Library & Player pages, with frosted glass UI.
 */

(function () {
  'use strict';

  const DEFAULT_SETTINGS = {
    enabled: true,
    mode: 'fullscreen', // 'fullscreen' (Whole Screen) | 'halo' (Player Halo)
    blur: 40, // px (optimized for ultra-light GPU load)
    spread: 140, // %
    brightness: 118, // %
    saturation: 160, // %
    opacity: 94, // %
    framerate: 24, // fps (silky smooth, 0 lag)
    smoothness: 400, // ms
    showButton: true
  };

  let settings = { ...DEFAULT_SETTINGS };

  // Runtime State
  let wrapper = null;
  let canvasAuraActive = null;
  let canvasAuraBuffer = null;
  let canvasBloomActive = null;
  let canvasBloomBuffer = null;

  let ctxAuraActive = null;
  let ctxAuraBuffer = null;
  let ctxBloomActive = null;
  let ctxBloomBuffer = null;

  let videoEl = null;
  let rafId = null;
  let lastFrameTime = 0;
  let lastImageSrc = '';
  let isVideoPlaying = false;
  let quickCardEl = null;

  // --------------------------------------------------------------------------
  // 1. Settings & Storage Management
  // --------------------------------------------------------------------------

  function getStorageArea() {
    return (chrome && chrome.storage && chrome.storage.sync)
      ? chrome.storage.sync
      : (chrome && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
  }

  function loadSettings() {
    const storage = getStorageArea();
    if (!storage) {
      applySettings();
      return;
    }

    storage.get(DEFAULT_SETTINGS, (items) => {
      if (chrome.runtime.lastError) {
        console.warn('[AmbientLight-YTM] Error loading settings:', chrome.runtime.lastError);
        return;
      }
      settings = { ...DEFAULT_SETTINGS, ...items };
      applySettings();
    });
  }

  function saveSettings(newSettings) {
    settings = { ...settings, ...newSettings };
    applySettings();

    const storage = getStorageArea();
    if (storage) {
      storage.set(newSettings, () => {
        if (chrome.runtime.lastError) {
          console.warn('[AmbientLight-YTM] Error saving settings:', chrome.runtime.lastError);
        }
      });
    }
  }

  if (chrome && chrome.storage && chrome.storage.onChanged) {
    chrome.storage.onChanged.addListener((changes) => {
      let updated = false;
      for (const [key, change] of Object.entries(changes)) {
        if (key in settings) {
          settings[key] = change.newValue;
          updated = true;
        }
      }
      if (updated) {
        applySettings();
        updateQuickCardValues();
      }
    });
  }

  function applySettings() {
    if (!wrapper) return;

    if (!settings.enabled) {
      wrapper.classList.add('ytm-al-disabled');
      document.body.classList.remove('ytm-al-active');
      document.body.classList.remove('ytm-al-fullscreen-active');
      stopRenderLoop();
    } else {
      wrapper.classList.remove('ytm-al-disabled');
      document.body.classList.add('ytm-al-active');

      if (settings.mode === 'fullscreen') {
        document.body.classList.add('ytm-al-fullscreen-active');
        wrapper.classList.add('ytm-al-mode-fullscreen');
        wrapper.classList.remove('ytm-al-mode-halo');

        wrapper.style.top = '0px';
        wrapper.style.left = '0px';
        wrapper.style.transform = 'none';
        wrapper.style.width = '100vw';
        wrapper.style.height = '100vh';
        wrapper.style.zIndex = '0';
      } else {
        document.body.classList.remove('ytm-al-fullscreen-active');
        wrapper.classList.remove('ytm-al-mode-fullscreen');
        wrapper.classList.add('ytm-al-mode-halo');
        updateHaloPosition();
      }

      startRenderLoop();
    }

    // Apply CSS Variables
    wrapper.style.setProperty('--ytm-al-blur', `${Math.round(settings.blur * 0.9)}px`);
    wrapper.style.setProperty('--ytm-al-aura-blur', `${Math.round(settings.blur * 1.2)}px`);
    wrapper.style.setProperty('--ytm-al-spread', `${settings.spread}%`);
    wrapper.style.setProperty('--ytm-al-brightness', `${settings.brightness}%`);
    wrapper.style.setProperty('--ytm-al-saturation', `${settings.saturation}%`);
    wrapper.style.setProperty('--ytm-al-opacity', (settings.opacity / 100).toString());
    wrapper.style.setProperty('--ytm-al-fade-time', `${settings.smoothness}ms`);

    // In-Player button status
    const btn = document.getElementById('ytm-al-player-btn');
    if (btn) {
      if (settings.enabled) {
        btn.classList.remove('disabled');
        btn.setAttribute('title', 'Ambient Light: ON (Click for settings, Shift+click to toggle)');
      } else {
        btn.classList.add('disabled');
        btn.setAttribute('title', 'Ambient Light: OFF (Click for settings, Shift+click to toggle)');
      }
    }

    ensureTopBarAndSearchTransparency();
  }

  function updateHaloPosition() {
    if (settings.mode !== 'halo' || !wrapper) return;
    const player = document.querySelector('ytmusic-player-page[player-page-open] #player')
      || document.querySelector('ytmusic-player');
    if (player && player.offsetParent !== null) {
      const rect = player.getBoundingClientRect();
      wrapper.style.top = `${rect.top + window.scrollY + rect.height / 2}px`;
      wrapper.style.left = `${rect.left + window.scrollX + rect.width / 2}px`;
      wrapper.style.transform = 'translate(-50%, -50%)';
      wrapper.style.width = `${rect.width}px`;
      wrapper.style.height = `${rect.height}px`;
      wrapper.style.zIndex = '0';
    }
  }

  // --------------------------------------------------------------------------
  // 2. Active DOM & Shadow-DOM Navigation Bar & Search Transparency Enforcer
  // --------------------------------------------------------------------------

  const SHADOW_STYLE_CSS = `
    :host {
      background: transparent !important;
      background-color: transparent !important;
    }
    #background.ytmusic-nav-bar,
    #nav-bar-background,
    #mini-guide-background,
    #nav-bar-divider {
      display: none !important;
      height: 0px !important;
      width: 0px !important;
      opacity: 0 !important;
      visibility: hidden !important;
      background: transparent !important;
    }
    #container.ytmusic-search-box,
    .search-box.ytmusic-search-box {
      background: rgba(255, 255, 255, 0.1) !important;
      backdrop-filter: blur(20px) !important;
      border: 1px solid rgba(255, 255, 255, 0.16) !important;
      border-radius: 8px !important;
    }
    input#input {
      background: transparent !important;
      color: #ffffff !important;
    }
    #contentContainer.tp-yt-app-drawer,
    #contentContainer {
      background: rgba(10, 10, 16, 0.22) !important;
      background-color: rgba(10, 10, 16, 0.22) !important;
      backdrop-filter: blur(28px) saturate(160%) !important;
      -webkit-backdrop-filter: blur(28px) saturate(160%) !important;
      border-right: 1px solid rgba(255, 255, 255, 0.08) !important;
      box-shadow: none !important;
    }
    #scrim {
      background: transparent !important;
      opacity: 0 !important;
    }
    #sections,
    #items,
    #guide-wrapper,
    #guide-content {
      background: transparent !important;
      background-color: transparent !important;
      backdrop-filter: none !important;
      -webkit-backdrop-filter: none !important;
    }
  `;

  function injectShadowStyles(hostEl) {
    if (!hostEl || !hostEl.shadowRoot) return;
    try {
      let tag = hostEl.shadowRoot.querySelector('style[data-ytm-al]');
      if (!tag) {
        tag = document.createElement('style');
        tag.setAttribute('data-ytm-al', 'true');
        hostEl.shadowRoot.appendChild(tag);
      }
      if (tag.textContent !== SHADOW_STYLE_CSS) {
        tag.textContent = SHADOW_STYLE_CSS;
      }
    } catch (e) {
      // Ignore cross-origin / closed errors if any
    }
  }

  function ensureTopBarAndSearchTransparency() {
    if (!settings.enabled || settings.mode !== 'fullscreen') return;

    // 1. Completely destroy and hide all filler background blocks in Light DOM
    const destroySelectors = [
      '#nav-bar-background',
      '#mini-guide-background',
      '#nav-bar-divider',
      'ytmusic-app-layout #nav-bar-background',
      'ytmusic-app-layout #mini-guide-background',
      '#layout[player-ui-state="PLAYER_PAGE_OPEN"] #mini-guide-background',
      '#layout[player-ui-state="PLAYER_PAGE_OPEN"] #nav-bar-background',
      'ytmusic-nav-bar #background',
      'ytmusic-nav-bar .background',
      'ytmusic-nav-bar [id*="background"]',
      '#browse-page > #background'
    ];
    destroySelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('display', 'none', 'important');
        el.style.setProperty('height', '0px', 'important');
        el.style.setProperty('width', '0px', 'important');
        el.style.setProperty('opacity', '0', 'important');
        el.style.setProperty('visibility', 'hidden', 'important');
        el.style.setProperty('pointer-events', 'none', 'important');
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
      });
    });

    // 2. Navigation Bar: Translucent Frosted Glass
    document.querySelectorAll('ytmusic-nav-bar, ytmusic-nav-bar#nav-bar, #nav-bar.ytmusic-app, #layout > ytmusic-nav-bar').forEach((el) => {
      el.style.setProperty('background', 'rgba(10, 10, 16, 0.22)', 'important');
      el.style.setProperty('background-color', 'rgba(10, 10, 16, 0.22)', 'important');
      el.style.setProperty('background-image', 'none', 'important');
      el.style.setProperty('backdrop-filter', 'blur(28px) saturate(160%)', 'important');
      el.style.setProperty('-webkit-backdrop-filter', 'blur(28px) saturate(160%)', 'important');
      el.style.setProperty('border-bottom', '1px solid rgba(255, 255, 255, 0.08)', 'important');
    });

    // Clear inner nav-bar content wrappers
    document.querySelectorAll('.center-content.ytmusic-nav-bar, .left-content.ytmusic-nav-bar, .right-content.ytmusic-nav-bar').forEach((el) => {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
    });

    // 3. Search Box Glassmorphism (Targeting #container, .search-box, input)
    const searchContainers = [
      'ytmusic-search-box #container',
      'ytmusic-search-box .container',
      'ytmusic-search-box [id="container"]',
      'ytmusic-search-box .search-box',
      'ytmusic-search-box #search-box',
      'ytmusic-search-box div.search-box',
      '.search-box.style-scope.ytmusic-search-box',
      '#layout > ytmusic-nav-bar > div.center-content.style-scope.ytmusic-nav-bar > ytmusic-search-box > div',
      '#layout > ytmusic-nav-bar > div.center-content.style-scope.ytmusic-nav-bar > ytmusic-search-box > div > div.search-box.style-scope.ytmusic-search-box'
    ];
    searchContainers.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('background', 'rgba(255, 255, 255, 0.1)', 'important');
        el.style.setProperty('background-color', 'rgba(255, 255, 255, 0.1)', 'important');
        el.style.setProperty('backdrop-filter', 'blur(20px)', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'blur(20px)', 'important');
        el.style.setProperty('border', '1px solid rgba(255, 255, 255, 0.16)', 'important');
        el.style.setProperty('border-radius', '8px', 'important');
        el.style.setProperty('box-shadow', 'none', 'important');
      });
    });

    document.querySelectorAll('ytmusic-search-box input, ytmusic-search-box input#input, input#input.ytmusic-search-box').forEach((el) => {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
      el.style.setProperty('color', '#ffffff', 'important');
    });

    // 4. Left Sidebar Drawer & Mini-guide Glassmorphism (Single Frosted Glass Layer)
    const drawerElements = document.querySelectorAll(
      'tp-yt-app-drawer, tp-yt-app-drawer#guide, tp-yt-app-drawer#nav-drawer, #guide, #nav-drawer, ytmusic-mini-guide-renderer, ytmusic-app[is-bauhaus-sidenav-enabled] #guide-wrapper.ytmusic-app'
    );
    drawerElements.forEach((drawer) => {
      drawer.style.setProperty('background', 'rgba(10, 10, 16, 0.22)', 'important');
      drawer.style.setProperty('background-color', 'rgba(10, 10, 16, 0.22)', 'important');
      drawer.style.setProperty('backdrop-filter', 'blur(28px) saturate(160%)', 'important');
      drawer.style.setProperty('-webkit-backdrop-filter', 'blur(28px) saturate(160%)', 'important');
      drawer.style.setProperty('border-right', '1px solid rgba(255, 255, 255, 0.08)', 'important');
      drawer.style.setProperty('box-shadow', 'none', 'important');

      // Direct pierce into tp-yt-app-drawer shadow root for #contentContainer
      if (drawer.shadowRoot) {
        injectShadowStyles(drawer);
        const cc = drawer.shadowRoot.querySelector('#contentContainer') || drawer.shadowRoot.getElementById('contentContainer');
        if (cc) {
          cc.style.setProperty('background', 'rgba(10, 10, 16, 0.22)', 'important');
          cc.style.setProperty('background-color', 'rgba(10, 10, 16, 0.22)', 'important');
          cc.style.setProperty('backdrop-filter', 'blur(28px) saturate(160%)', 'important');
          cc.style.setProperty('-webkit-backdrop-filter', 'blur(28px) saturate(160%)', 'important');
          cc.style.setProperty('border-right', '1px solid rgba(255, 255, 255, 0.08)', 'important');
          cc.style.setProperty('box-shadow', 'none', 'important');
        }
      }
    });

    // Make all internal child containers inside the sidebar 100% transparent to prevent compounding opacity
    const innerGuideSelectors = [
      'ytmusic-guide-renderer',
      'ytmusic-guide-renderer #sections',
      'ytmusic-guide-renderer #items',
      'ytmusic-guide-renderer #header',
      'ytmusic-guide-renderer #guide-wrapper',
      'ytmusic-guide-renderer #guide-content',
      'ytmusic-guide-section-renderer',
      'ytmusic-guide-section-renderer #items',
      'ytmusic-guide-entry-renderer',
      'ytmusic-mini-guide-renderer #sections',
      'ytmusic-mini-guide-section-renderer',
      'div#guide-wrapper',
      'div#guide-content',
      'div#mini-guide',
      'div#sections',
      'div#items',
      'tp-yt-paper-listbox'
    ];
    innerGuideSelectors.forEach((sel) => {
      document.querySelectorAll(sel).forEach((el) => {
        el.style.setProperty('background', 'transparent', 'important');
        el.style.setProperty('background-color', 'transparent', 'important');
        el.style.setProperty('backdrop-filter', 'none', 'important');
        el.style.setProperty('-webkit-backdrop-filter', 'none', 'important');
      });
    });

    // 5. App Layout & Player Page Transparency (Without overriding native top positioning)
    document.querySelectorAll('ytmusic-app-layout, ytmusic-app-layout#layout, ytmusic-player-page, #player-page, ytmusic-player-page .content, ytmusic-player-page #main-panel').forEach((el) => {
      el.style.setProperty('background', 'transparent', 'important');
      el.style.setProperty('background-color', 'transparent', 'important');
    });

    // 6. Deep Inject into all Shadow Roots
    const shadowHosts = [
      'ytmusic-app-layout',
      'ytmusic-nav-bar',
      'ytmusic-search-box',
      'ytmusic-player-page',
      'ytmusic-guide-renderer',
      'ytmusic-mini-guide-renderer',
      'tp-yt-app-drawer',
      'tp-yt-app-drawer#guide',
      'tp-yt-app-drawer#nav-drawer',
      'ytmusic-guide-section-renderer'
    ];
    shadowHosts.forEach((hostSelector) => {
      document.querySelectorAll(hostSelector).forEach((host) => {
        injectShadowStyles(host);
      });
    });
  }

  // --------------------------------------------------------------------------
  // 3. Dual-Layer Fluid Ambient Canvas Pipeline (Aura + Bloom)
  // --------------------------------------------------------------------------

  function initAmbientWrapper() {
    if (document.getElementById('ytm-ambilight-wrapper')) return;

    wrapper = document.createElement('div');
    wrapper.id = 'ytm-ambilight-wrapper';
    wrapper.className = 'ytm-ambilight-wrapper';

    // Layer 1: Wide Aura Active & Buffer
    canvasAuraActive = document.createElement('canvas');
    canvasAuraActive.className = 'ytm-ambilight-canvas aura active';
    canvasAuraActive.width = 32;
    canvasAuraActive.height = 18;
    ctxAuraActive = canvasAuraActive.getContext('2d', { alpha: true, desynchronized: true });

    canvasAuraBuffer = document.createElement('canvas');
    canvasAuraBuffer.className = 'ytm-ambilight-canvas aura';
    canvasAuraBuffer.width = 32;
    canvasAuraBuffer.height = 18;
    ctxAuraBuffer = canvasAuraBuffer.getContext('2d', { alpha: true, desynchronized: true });

    // Layer 2: Radiant Center Bloom Active & Buffer
    canvasBloomActive = document.createElement('canvas');
    canvasBloomActive.className = 'ytm-ambilight-canvas bloom active';
    canvasBloomActive.width = 32;
    canvasBloomActive.height = 18;
    ctxBloomActive = canvasBloomActive.getContext('2d', { alpha: true, desynchronized: true });

    canvasBloomBuffer = document.createElement('canvas');
    canvasBloomBuffer.className = 'ytm-ambilight-canvas bloom';
    canvasBloomBuffer.width = 32;
    canvasBloomBuffer.height = 18;
    ctxBloomBuffer = canvasBloomBuffer.getContext('2d', { alpha: true, desynchronized: true });

    wrapper.appendChild(canvasAuraActive);
    wrapper.appendChild(canvasAuraBuffer);
    wrapper.appendChild(canvasBloomActive);
    wrapper.appendChild(canvasBloomBuffer);

    // Place at z-index: -1 behind all page content
    document.body.insertBefore(wrapper, document.body.firstChild);

    applySettings();
  }

  function swapCanvases() {
    if (!canvasAuraActive || !canvasAuraBuffer) return;

    // Swap Aura layer
    canvasAuraBuffer.classList.add('active');
    canvasAuraActive.classList.remove('active');
    const tempAura = canvasAuraActive;
    canvasAuraActive = canvasAuraBuffer;
    canvasAuraBuffer = tempAura;
    const tempAuraCtx = ctxAuraActive;
    ctxAuraActive = ctxAuraBuffer;
    ctxAuraBuffer = tempAuraCtx;

    // Swap Bloom layer
    canvasBloomBuffer.classList.add('active');
    canvasBloomActive.classList.remove('active');
    const tempBloom = canvasBloomActive;
    canvasBloomActive = canvasBloomBuffer;
    canvasBloomBuffer = tempBloom;
    const tempBloomCtx = ctxBloomActive;
    ctxBloomActive = ctxBloomBuffer;
    ctxBloomBuffer = tempBloomCtx;
  }

  // --------------------------------------------------------------------------
  // 4. Robust Media Render Pipeline
  // --------------------------------------------------------------------------

  function isVideoActive() {
    const video = document.querySelector('ytmusic-player video, .html5-video-container video, #movie_player video');
    if (!video) return false;
    return !video.paused && !video.ended && video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;
  }

  function getAlbumImage() {
    const barImg = document.querySelector('ytmusic-player-bar .thumbnail-image-wrapper img')
      || document.querySelector('ytmusic-player-bar img#img')
      || document.querySelector('.image.ytmusic-player-bar')
      || document.querySelector('ytmusic-player-bar img');
    if (barImg && barImg.src && barImg.src.startsWith('http')) return barImg;

    const playerImg = document.querySelector('ytmusic-player #song-image img#img')
      || document.querySelector('ytmusic-player yt-img-shadow#thumbnail img')
      || document.querySelector('#song-image img');
    if (playerImg && playerImg.src && playerImg.src.startsWith('http')) return playerImg;

    return null;
  }

  function renderAlbumImage() {
    if (wrapper && wrapper.classList.contains('video-active')) {
      wrapper.classList.remove('video-active');
    }

    const img = getAlbumImage();
    if (!img || !img.src || !img.complete || img.naturalWidth === 0) return;
    if (img.src === lastImageSrc) return;

    try {
      // Draw into Aura buffer (32x32 for lightweight processing)
      canvasAuraBuffer.width = 32;
      canvasAuraBuffer.height = 32;
      ctxAuraBuffer.imageSmoothingQuality = 'medium';
      ctxAuraBuffer.clearRect(0, 0, 32, 32);
      ctxAuraBuffer.drawImage(img, 0, 0, 32, 32);

      // Draw into Bloom buffer
      canvasBloomBuffer.width = 32;
      canvasBloomBuffer.height = 32;
      ctxBloomBuffer.imageSmoothingQuality = 'medium';
      ctxBloomBuffer.clearRect(0, 0, 32, 32);
      ctxBloomBuffer.drawImage(canvasAuraBuffer, 0, 0, 32, 32);

      swapCanvases();
      lastImageSrc = img.src;
    } catch (e) {
      // Ignore paint exceptions
    }
  }

  function renderVideoFrame() {
    const video = videoEl || document.querySelector('ytmusic-player video, .html5-video-container video, #movie_player video');
    if (!video || video.paused || video.ended || video.readyState < 2) return;
    if (!video.videoWidth || !video.videoHeight) return;

    if (wrapper && !wrapper.classList.contains('video-active')) {
      wrapper.classList.add('video-active');
    }

    try {
      // 32x18 resolution matches 16:9 video with minimal GPU memory bandwidth
      if (canvasAuraActive.width !== 32 || canvasAuraActive.height !== 18) {
        canvasAuraActive.width = 32;
        canvasAuraActive.height = 18;
      }

      // Fast bilinear sampling avoids heavy bicubic filter shader passes
      ctxAuraActive.imageSmoothingQuality = 'low';
      ctxAuraActive.drawImage(video, 0, 0, 32, 18);

      // In Halo mode, copy Aura canvas to Bloom canvas (instant GPU blit)
      if (settings.mode === 'halo') {
        if (canvasBloomActive.width !== 32 || canvasBloomActive.height !== 18) {
          canvasBloomActive.width = 32;
          canvasBloomActive.height = 18;
        }
        ctxBloomActive.imageSmoothingQuality = 'low';
        ctxBloomActive.drawImage(canvasAuraActive, 0, 0, 32, 18);
      }
    } catch (e) {
      // Ignore paint exceptions
    }
  }

  function renderLoop(currentTime) {
    if (!settings.enabled) {
      rafId = null;
      return;
    }

    const isVideo = isVideoActive();
    // Cap at 24 FPS for video (cinematic & 100% lag-free) and 10 FPS for static image check
    const targetFps = isVideo ? Math.min(settings.framerate || 24, 24) : 10;
    const interval = 1000 / targetFps;
    const elapsed = currentTime - lastFrameTime;

    if (elapsed >= interval) {
      lastFrameTime = currentTime - (elapsed % interval);

      if (isVideo) {
        renderVideoFrame();
      } else {
        renderAlbumImage();
      }
    }

    rafId = requestAnimationFrame(renderLoop);
  }

  function startRenderLoop() {
    if (!rafId && settings.enabled) {
      rafId = requestAnimationFrame(renderLoop);
    }
  }

  function stopRenderLoop() {
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  // --------------------------------------------------------------------------
  // 5. Media Elements Watcher & Event Listeners
  // --------------------------------------------------------------------------

  function hookVideoEvents() {
    const video = document.querySelector('ytmusic-player video, .html5-video-container video, #movie_player video');
    if (video && video !== videoEl) {
      videoEl = video;

      videoEl.addEventListener('play', () => {
        isVideoPlaying = true;
        startRenderLoop();
      });

      videoEl.addEventListener('pause', () => {
        isVideoPlaying = false;
      });

      videoEl.addEventListener('seeking', () => {
        renderVideoFrame();
      });

      videoEl.addEventListener('seeked', () => {
        renderVideoFrame();
      });

      videoEl.addEventListener('loadeddata', () => {
        renderVideoFrame();
      });

      videoEl.addEventListener('emptied', () => {
        lastImageSrc = '';
      });
    }
  }

  // --------------------------------------------------------------------------
  // 6. In-Player "AL" Button Injection into ytmusic-player-bar
  // --------------------------------------------------------------------------

  function injectPlayerButton() {
    if (document.getElementById('ytm-al-player-btn')) return;

    const rightControls = document.querySelector('ytmusic-player-bar .right-controls-buttons');
    if (!rightControls) return;

    const btn = document.createElement('button');
    btn.id = 'ytm-al-player-btn';
    btn.className = `ytm-al-player-btn ${settings.enabled ? '' : 'disabled'}`;
    btn.setAttribute('title', `Ambient Light: ${settings.enabled ? 'ON' : 'OFF'} (Click for quick settings, Shift+click to toggle)`);
    btn.setAttribute('aria-label', 'Ambient Light Settings');

    btn.innerHTML = `
      <span class="ytm-al-icon">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.66 0-3-1.34-3-3s1.34-3 3-3 3 1.34 3 3-1.34 3-3 3zm0-13c-.55 0-1 .45-1 1v1.5c0 .55.45 1 1 1s1-.45 1-1V3c0-.55-.45-1-1-1zm0 16c-.55 0-1 .45-1 1v1.5c0 .55.45 1 1 1s1-.45 1-1V19c0-.55-.45-1-1-1zm8-8c0-.55-.45-1-1-1h-1.5c-.55 0-1 .45-1 1s.45 1 1 1H19c.55 0 1-.45 1-1zM6.5 12c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1s.45 1 1 1h1.5c.55 0 1-.45 1-1zm11.16-6.45c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.06-1.06zm-11.32 11.32c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.06-1.06zM7.76 6.96c.39-.39.39-1.02 0-1.41l-1.06-1.06c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0zm10.26 10.26c-.39-.39-1.02-.39-1.41 0-.39.39-.39 1.02 0 1.41l1.06 1.06c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41l-1.06-1.06z"/>
        </svg>
      </span>
      <span class="ytm-al-dot"></span>
    `;

    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.shiftKey) {
        saveSettings({ enabled: !settings.enabled });
      } else {
        toggleQuickCard();
      }
    });

    rightControls.insertBefore(btn, rightControls.firstChild);
  }

  // --------------------------------------------------------------------------
  // 7. In-Page Quick Settings Flyout Card
  // --------------------------------------------------------------------------

  function toggleQuickCard() {
    if (quickCardEl) {
      closeQuickCard();
    } else {
      openQuickCard();
    }
  }

  function closeQuickCard() {
    if (quickCardEl) {
      quickCardEl.remove();
      quickCardEl = null;
      document.removeEventListener('click', onDocumentClickOutside);
    }
  }

  function onDocumentClickOutside(e) {
    if (quickCardEl && !quickCardEl.contains(e.target) && e.target.id !== 'ytm-al-player-btn') {
      closeQuickCard();
    }
  }

  function openQuickCard() {
    closeQuickCard();

    quickCardEl = document.createElement('div');
    quickCardEl.id = 'ytm-al-quick-card';
    quickCardEl.innerHTML = `
      <div class="ytm-al-card-header">
        <div class="ytm-al-card-title">
          <span style="color:#ff0055">✦</span> Ambient Light
        </div>
        <button class="ytm-al-close-btn" id="ytm-al-card-close" title="Close">✕</button>
      </div>

      <!-- Master Toggle -->
      <div class="ytm-al-switch-row">
        <span>Enable Effect</span>
        <label class="ytm-al-switch">
          <input type="checkbox" id="ytm-qc-toggle" ${settings.enabled ? 'checked' : ''}>
          <span class="ytm-al-switch-slider"></span>
        </label>
      </div>

      <!-- Mode Selector -->
      <div class="ytm-al-mode-selector">
        <button class="ytm-al-mode-btn ${settings.mode === 'fullscreen' ? 'active' : ''}" data-mode="fullscreen">Whole Screen</button>
        <button class="ytm-al-mode-btn ${settings.mode === 'halo' ? 'active' : ''}" data-mode="halo">Player Halo</button>
      </div>

      <!-- Blur Slider -->
      <div class="ytm-al-row">
        <div class="ytm-al-label-row">
          <span>Blur Radius</span>
          <span class="ytm-al-val" id="ytm-qc-blur-val">${settings.blur}px</span>
        </div>
        <input type="range" class="ytm-al-slider" id="ytm-qc-blur" min="10" max="160" step="5" value="${settings.blur}">
      </div>

      <!-- Spread / Size Slider -->
      <div class="ytm-al-row">
        <div class="ytm-al-label-row">
          <span>Spread / Scale</span>
          <span class="ytm-al-val" id="ytm-qc-spread-val">${settings.spread}%</span>
        </div>
        <input type="range" class="ytm-al-slider" id="ytm-qc-spread" min="100" max="200" step="5" value="${settings.spread}">
      </div>

      <!-- Brightness Slider -->
      <div class="ytm-al-row">
        <div class="ytm-al-label-row">
          <span>Brightness</span>
          <span class="ytm-al-val" id="ytm-qc-brightness-val">${settings.brightness}%</span>
        </div>
        <input type="range" class="ytm-al-slider" id="ytm-qc-brightness" min="50" max="200" step="5" value="${settings.brightness}">
      </div>
    `;

    document.body.appendChild(quickCardEl);

    document.getElementById('ytm-al-card-close').addEventListener('click', closeQuickCard);

    document.getElementById('ytm-qc-toggle').addEventListener('change', (e) => {
      saveSettings({ enabled: e.target.checked });
    });

    quickCardEl.querySelectorAll('.ytm-al-mode-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const mode = btn.getAttribute('data-mode');
        quickCardEl.querySelectorAll('.ytm-al-mode-btn').forEach((b) => b.classList.remove('active'));
        btn.classList.add('active');
        saveSettings({ mode });
      });
    });

    const blurSlider = document.getElementById('ytm-qc-blur');
    blurSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('ytm-qc-blur-val').textContent = `${val}px`;
      saveSettings({ blur: val });
    });

    const spreadSlider = document.getElementById('ytm-qc-spread');
    spreadSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('ytm-qc-spread-val').textContent = `${val}%`;
      saveSettings({ spread: val });
    });

    const brightnessSlider = document.getElementById('ytm-qc-brightness');
    brightnessSlider.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      document.getElementById('ytm-qc-brightness-val').textContent = `${val}%`;
      saveSettings({ brightness: val });
    });

    setTimeout(() => {
      document.addEventListener('click', onDocumentClickOutside);
    }, 50);
  }

  function updateQuickCardValues() {
    if (!quickCardEl) return;
    const toggle = document.getElementById('ytm-qc-toggle');
    if (toggle) toggle.checked = settings.enabled;

    const blurSlider = document.getElementById('ytm-qc-blur');
    const blurVal = document.getElementById('ytm-qc-blur-val');
    if (blurSlider && blurVal) {
      blurSlider.value = settings.blur;
      blurVal.textContent = `${settings.blur}px`;
    }

    const spreadSlider = document.getElementById('ytm-qc-spread');
    const spreadVal = document.getElementById('ytm-qc-spread-val');
    if (spreadSlider && spreadVal) {
      spreadSlider.value = settings.spread;
      spreadVal.textContent = `${settings.spread}%`;
    }

    const brightSlider = document.getElementById('ytm-qc-brightness');
    const brightVal = document.getElementById('ytm-qc-brightness-val');
    if (brightSlider && brightVal) {
      brightSlider.value = settings.brightness;
      brightVal.textContent = `${settings.brightness}%`;
    }

    quickCardEl.querySelectorAll('.ytm-al-mode-btn').forEach((btn) => {
      if (btn.getAttribute('data-mode') === settings.mode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });
  }

  // --------------------------------------------------------------------------
  // 8. Initialization & Lifecycle Observer
  // --------------------------------------------------------------------------

  function checkAndInit() {
    initAmbientWrapper();
    injectPlayerButton();
    hookVideoEvents();
    ensureTopBarAndSearchTransparency();
    if (settings.mode === 'halo') {
      updateHaloPosition();
    }
  }

  window.addEventListener('resize', () => {
    if (settings.mode === 'halo') {
      updateHaloPosition();
    }
  });

  window.addEventListener('yt-navigate-finish', () => {
    ensureTopBarAndSearchTransparency();
    checkAndInit();
  });
  window.addEventListener('yt-page-data-updated', () => {
    ensureTopBarAndSearchTransparency();
  });
  window.addEventListener('popstate', () => {
    ensureTopBarAndSearchTransparency();
  });

  function startObserver() {
    checkAndInit();

    const observer = new MutationObserver(() => {
      checkAndInit();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    setInterval(checkAndInit, 2000);
  }

  // Bootstrap
  loadSettings();

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      startObserver();
      startRenderLoop();
    });
  } else {
    startObserver();
    startRenderLoop();
  }
})();

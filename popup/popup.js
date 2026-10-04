/**
 * Ambient Light for YouTube Music™ - Popup Logic
 * Controls settings persistence, live preview sync, and presets.
 */

document.addEventListener('DOMContentLoaded', () => {
  const DEFAULTS = {
    enabled: true,
    mode: 'fullscreen', // Whole Screen is default!
    blur: 90,
    spread: 140,
    brightness: 115,
    saturation: 150,
    opacity: 90,
    framerate: 30,
    smoothness: 400
  };

  const PRESETS = {
    subtle: { blur: 60, spread: 120, brightness: 100, saturation: 120, opacity: 75 },
    cinematic: { blur: 90, spread: 140, brightness: 115, saturation: 150, opacity: 90 },
    vibrant: { blur: 110, spread: 160, brightness: 125, saturation: 190, opacity: 95 },
    ultra: { blur: 150, spread: 190, brightness: 140, saturation: 230, opacity: 100 }
  };

  let settings = { ...DEFAULTS };

  // DOM Elements
  const masterToggle = document.getElementById('master-toggle');
  const previewGlow = document.getElementById('preview-glow');

  const sliderBlur = document.getElementById('slider-blur');
  const valBlur = document.getElementById('val-blur');

  const sliderSpread = document.getElementById('slider-spread');
  const valSpread = document.getElementById('val-spread');

  const sliderBrightness = document.getElementById('slider-brightness');
  const valBrightness = document.getElementById('val-brightness');

  const sliderSaturation = document.getElementById('slider-saturation');
  const valSaturation = document.getElementById('val-saturation');

  const sliderOpacity = document.getElementById('slider-opacity');
  const valOpacity = document.getElementById('val-opacity');

  const modeTabs = document.querySelectorAll('.mode-tab');
  const presetChips = document.querySelectorAll('.chip');
  const fpsBtns = document.querySelectorAll('.fps-btn');
  const btnReset = document.getElementById('btn-reset');

  function getStorageArea() {
    return (chrome && chrome.storage && chrome.storage.sync)
      ? chrome.storage.sync
      : (chrome && chrome.storage && chrome.storage.local ? chrome.storage.local : null);
  }

  function saveSettings(changed) {
    settings = { ...settings, ...changed };
    updateUI();

    const storage = getStorageArea();
    if (storage) {
      storage.set(changed);
    }
  }

  function updateUI() {
    // Master switch
    masterToggle.checked = settings.enabled;

    // Sliders & text badges
    sliderBlur.value = settings.blur;
    valBlur.textContent = `${settings.blur}px`;

    sliderSpread.value = settings.spread;
    valSpread.textContent = `${settings.spread}%`;

    sliderBrightness.value = settings.brightness;
    valBrightness.textContent = `${settings.brightness}%`;

    sliderSaturation.value = settings.saturation;
    valSaturation.textContent = `${settings.saturation}%`;

    sliderOpacity.value = settings.opacity;
    valOpacity.textContent = `${settings.opacity}%`;

    // Mode tabs
    modeTabs.forEach((tab) => {
      if (tab.getAttribute('data-mode') === settings.mode) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // FPS buttons
    fpsBtns.forEach((btn) => {
      if (parseInt(btn.getAttribute('data-fps'), 10) === settings.framerate) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Live Preview styling
    if (previewGlow) {
      if (!settings.enabled) {
        previewGlow.style.opacity = '0';
      } else {
        const previewBlur = Math.round(settings.blur * 0.28);
        const previewScale = (settings.spread / 100) * 0.9;
        previewGlow.style.filter = `blur(${previewBlur}px) brightness(${settings.brightness}%) saturate(${settings.saturation}%)`;
        previewGlow.style.transform = `translate(-50%, -50%) scale(${previewScale})`;
        previewGlow.style.opacity = (settings.opacity / 100).toString();
      }
    }
  }

  // Bind Listeners
  masterToggle.addEventListener('change', (e) => {
    saveSettings({ enabled: e.target.checked });
  });

  sliderBlur.addEventListener('input', (e) => {
    saveSettings({ blur: parseInt(e.target.value, 10) });
    highlightActivePreset();
  });

  sliderSpread.addEventListener('input', (e) => {
    saveSettings({ spread: parseInt(e.target.value, 10) });
    highlightActivePreset();
  });

  sliderBrightness.addEventListener('input', (e) => {
    saveSettings({ brightness: parseInt(e.target.value, 10) });
    highlightActivePreset();
  });

  sliderSaturation.addEventListener('input', (e) => {
    saveSettings({ saturation: parseInt(e.target.value, 10) });
    highlightActivePreset();
  });

  sliderOpacity.addEventListener('input', (e) => {
    saveSettings({ opacity: parseInt(e.target.value, 10) });
    highlightActivePreset();
  });

  modeTabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const mode = tab.getAttribute('data-mode');
      saveSettings({ mode });
    });
  });

  fpsBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const fps = parseInt(btn.getAttribute('data-fps'), 10);
      saveSettings({ framerate: fps });
    });
  });

  presetChips.forEach((chip) => {
    chip.addEventListener('click', () => {
      const presetKey = chip.getAttribute('data-preset');
      const preset = PRESETS[presetKey];
      if (preset) {
        presetChips.forEach((c) => c.classList.remove('active'));
        chip.classList.add('active');
        saveSettings(preset);
      }
    });
  });

  function highlightActivePreset() {
    let matched = false;
    for (const [key, preset] of Object.entries(PRESETS)) {
      if (
        preset.blur === settings.blur &&
        preset.spread === settings.spread &&
        preset.brightness === settings.brightness &&
        preset.saturation === settings.saturation &&
        preset.opacity === settings.opacity
      ) {
        presetChips.forEach((c) => {
          c.classList.toggle('active', c.getAttribute('data-preset') === key);
        });
        matched = true;
        break;
      }
    }
    if (!matched) {
      presetChips.forEach((c) => c.classList.remove('active'));
    }
  }

  btnReset.addEventListener('click', () => {
    saveSettings(DEFAULTS);
    highlightActivePreset();
  });

  // Initial Load from Storage
  const storage = getStorageArea();
  if (storage) {
    storage.get(DEFAULTS, (items) => {
      settings = { ...DEFAULTS, ...items };
      updateUI();
      highlightActivePreset();
    });
  } else {
    updateUI();
  }
});

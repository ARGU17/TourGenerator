(function () {
  'use strict';

  const state = {
    maplibre: window.maplibregl ? 'ready' : 'idle',
    echarts: window.echarts ? 'ready' : 'idle'
  };

  function emit(name, detail) {
    window.dispatchEvent(new CustomEvent(`gt-vendor-${name}`, { detail }));
  }

  function loadStylesheet(url) {
    if (!url || document.querySelector(`link[data-gt-vendor-css="${url}"]`)) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = url;
    link.dataset.gtVendorCss = url;
    // Carga no bloqueante: el núcleo local arranca aunque el CDN no responda.
    link.media = 'print';
    link.onload = () => { link.media = 'all'; };
    link.onerror = () => link.remove();
    document.head.appendChild(link);
  }

  function loadScriptCandidate(url, test, timeoutMs) {
    return new Promise((resolve, reject) => {
      if (test()) {
        resolve(url);
        return;
      }

      const script = document.createElement('script');
      let settled = false;
      const finish = (ok, error) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        script.onload = null;
        script.onerror = null;
        if (!ok) script.remove();
        ok ? resolve(url) : reject(error || new Error(`No se pudo cargar ${url}`));
      };

      const timer = window.setTimeout(() => {
        finish(false, new Error(`Tiempo de espera agotado para ${url}`));
      }, timeoutMs);

      script.async = true;
      script.crossOrigin = 'anonymous';
      script.src = url;
      script.dataset.gtVendorScript = url;
      script.onload = () => finish(test(), new Error(`El script ${url} se cargó, pero no expuso la API esperada.`));
      script.onerror = () => finish(false, new Error(`Error de red al cargar ${url}`));
      document.head.appendChild(script);
    });
  }

  async function loadWithFallbacks(name, urls, test, timeoutMs) {
    if (test()) {
      state[name] = 'ready';
      emit(name, { status: 'ready', source: 'already-present' });
      return true;
    }
    if (state[name] === 'loading') return false;

    state[name] = 'loading';
    for (const url of urls) {
      try {
        await loadScriptCandidate(url, test, timeoutMs);
        state[name] = 'ready';
        emit(name, { status: 'ready', source: url });
        return true;
      } catch (error) {
        console.warn(`[Grand Tour Stage Lab] ${error.message}`);
      }
    }

    state[name] = 'fallback';
    emit(name, { status: 'fallback' });
    return false;
  }

  function loadMapLibre() {
    const cfg = window.APP_CONFIG || {};
    const cssUrls = cfg.mapLibreCssUrls || [
      'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
      'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css'
    ];
    cssUrls.forEach(loadStylesheet);
    return loadWithFallbacks(
      'maplibre',
      cfg.mapLibreJsUrls || [
        'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
        'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js'
      ],
      () => Boolean(window.maplibregl?.Map),
      Number(cfg.vendorTimeoutMs) || 5500
    );
  }

  function loadECharts() {
    const cfg = window.APP_CONFIG || {};
    return loadWithFallbacks(
      'echarts',
      cfg.echartsJsUrls || [
        'https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js',
        'https://unpkg.com/echarts@5.6.0/dist/echarts.min.js'
      ],
      () => Boolean(window.echarts?.init),
      Number(cfg.vendorTimeoutMs) || 5500
    );
  }

  async function loadAll() {
    const results = await Promise.allSettled([loadMapLibre(), loadECharts()]);
    return {
      maplibre: state.maplibre,
      echarts: state.echarts,
      results
    };
  }

  window.VendorLoader = {
    loadAll,
    loadMapLibre,
    loadECharts,
    state
  };
})();

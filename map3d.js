(function () {
  'use strict';

  let map = null;
  let loaded = false;
  let currentStage = null;
  let persistentMarkers = [];
  let riderMarker = null;
  let hoverMarker = null;
  let animationFrame = null;
  let animationStart = 0;
  let animationRunning = false;
  let onAnimationState = null;

  const routeSourceId = 'stage-route';
  const routeOutlineId = 'stage-route-outline';
  const routeLineId = 'stage-route-line';

  function createStyle() {
    const config = window.APP_CONFIG || {};
    return {
      version: 8,
      sources: {
        osm: {
          type: 'raster',
          tiles: config.mapRasterTiles || ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png'],
          tileSize: 256,
          attribution: '&copy; OpenStreetMap contributors',
          maxzoom: 19
        },
        terrainSource: {
          type: 'raster-dem',
          url: config.terrainTileJson || 'https://tiles.mapterhorn.com/tilejson.json'
        },
        hillshadeSource: {
          type: 'raster-dem',
          url: config.terrainTileJson || 'https://tiles.mapterhorn.com/tilejson.json'
        }
      },
      layers: [
        { id: 'osm', type: 'raster', source: 'osm', paint: { 'raster-saturation': -0.36, 'raster-contrast': 0.13, 'raster-brightness-max': 0.78 } },
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'hillshadeSource',
          paint: {
            'hillshade-shadow-color': '#071018',
            'hillshade-highlight-color': '#dcecf1',
            'hillshade-accent-color': '#4c6574',
            'hillshade-exaggeration': 0.55
          }
        }
      ],
      terrain: { source: 'terrainSource', exaggeration: 1.2 },
      sky: {}
    };
  }

  function init(elementId, messageElementId, animationStateCallback) {
    if (!window.maplibregl) return;
    onAnimationState = animationStateCallback || null;
    map = new maplibregl.Map({
      container: elementId,
      style: createStyle(),
      center: [2.2, 46.4],
      zoom: 4.8,
      pitch: 68,
      bearing: -12,
      maxPitch: 85,
      maxZoom: 18,
      antialias: true,
      attributionControl: true
    });

    map.addControl(new maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ maxWidth: 130, unit: 'metric' }), 'bottom-left');

    map.on('load', () => {
      loaded = true;
      addRouteLayers();
      if (currentStage) render(currentStage);
    });

    map.on('error', (event) => {
      const message = document.getElementById(messageElementId);
      if (!message) return;
      const errorText = event?.error?.message || '';
      if (/terrain|tile|source/i.test(errorText)) {
        message.textContent = 'No se ha podido cargar alguna capa cartográfica o de terreno. La ruta y el perfil siguen disponibles; comprueba la conexión a Internet.';
        message.classList.remove('hidden');
        setTimeout(() => message.classList.add('hidden'), 7000);
      }
    });
  }

  function addRouteLayers() {
    if (!map || !loaded || map.getSource(routeSourceId)) return;
    map.addSource(routeSourceId, {
      type: 'geojson',
      data: { type: 'FeatureCollection', features: [] }
    });
    map.addLayer({
      id: routeOutlineId,
      type: 'line',
      source: routeSourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': 'rgba(3, 8, 12, .92)', 'line-width': 9, 'line-opacity': 0.8 }
    });
    map.addLayer({
      id: routeLineId,
      type: 'line',
      source: routeSourceId,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: {
        'line-color': [
          'interpolate', ['linear'], ['get', 'difficulty'],
          0, '#72f0a8',
          0.35, '#f5cf5b',
          0.65, '#ff9f43',
          1, '#ff5c5c'
        ],
        'line-width': 5,
        'line-opacity': 0.98
      }
    });
  }

  function difficultyForStage(stage) {
    const mapping = { flat: 0.05, itt: 0.12, rolling: 0.35, punchy: 0.52, medium_mountain: 0.72, high_mountain: 1 };
    return mapping[stage.type] ?? 0.35;
  }

  function stageFeature(stage) {
    return {
      type: 'Feature',
      properties: { difficulty: difficultyForStage(stage), source: stage.source },
      geometry: {
        type: 'LineString',
        coordinates: stage.points.map((point) => [point.lon, point.lat])
      }
    };
  }

  function clearMarkers() {
    persistentMarkers.forEach((marker) => marker.remove());
    persistentMarkers = [];
    riderMarker?.remove();
    riderMarker = null;
    hoverMarker?.remove();
    hoverMarker = null;
  }

  function markerElement(className, text) {
    const element = document.createElement('div');
    element.className = className;
    if (text) element.textContent = text;
    return element;
  }

  function addMarker(point, className, popupText) {
    if (!map || !point) return null;
    const marker = new maplibregl.Marker({ element: markerElement(className), anchor: 'center' })
      .setLngLat([point.lon, point.lat]);
    if (popupText) marker.setPopup(new maplibregl.Popup({ offset: 18 }).setHTML(popupText));
    marker.addTo(map);
    persistentMarkers.push(marker);
    return marker;
  }

  function boundsForStage(stage) {
    const bounds = new maplibregl.LngLatBounds();
    stage.points.forEach((point) => bounds.extend([point.lon, point.lat]));
    return bounds;
  }

  function render(stage) {
    currentStage = stage;
    stopAnimation();
    if (!map || !loaded || !stage?.points?.length) return;
    addRouteLayers();
    const source = map.getSource(routeSourceId);
    source?.setData({ type: 'FeatureCollection', features: [stageFeature(stage)] });
    clearMarkers();

    const first = stage.points[0];
    const last = stage.points[stage.points.length - 1];
    addMarker(first, 'route-marker start', `<strong>${escapeHtml(stage.startName)}</strong><br>Salida`);
    addMarker(last, 'route-marker finish', `<strong>${escapeHtml(stage.finishName)}</strong><br>Meta`);

    (stage.climbs || []).slice(0, 6).forEach((climb) => {
      const point = stage.points[climb.endIndex];
      if (!point) return;
      addMarker(point, 'route-marker climb', `<strong>${escapeHtml(climb.name)}</strong><br>Cat. ${escapeHtml(climb.category)} · ${climb.lengthKm.toFixed(1)} km al ${climb.avgGrade.toFixed(1)} %`);
    });

    const bounds = boundsForStage(stage);
    map.fitBounds(bounds, { padding: { top: 70, bottom: 70, left: 55, right: 55 }, pitch: 64, bearing: routeBearing(stage), duration: 1000, maxZoom: 11.5 });
  }

  function routeBearing(stage) {
    const first = stage.points[0];
    const last = stage.points[stage.points.length - 1];
    if (!first || !last) return 0;
    const dx = last.lon - first.lon;
    const dy = last.lat - first.lat;
    return ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360 - 20;
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function setPerspective(mode) {
    if (!map) return;
    if (mode === 'top') {
      map.easeTo({ pitch: 0, bearing: 0, duration: 650 });
    } else {
      map.easeTo({ pitch: 68, bearing: currentStage ? routeBearing(currentStage) : -12, duration: 650 });
    }
  }

  function setTerrainExaggeration(value) {
    if (!map || !loaded) return;
    try {
      map.setTerrain({ source: 'terrainSource', exaggeration: Number(value) || 0 });
    } catch (error) {
      console.warn('No se pudo modificar el terreno', error);
    }
  }

  function highlightPoint(point) {
    if (!map || !loaded) return;
    if (!point) {
      hoverMarker?.remove();
      hoverMarker = null;
      return;
    }
    if (!hoverMarker) {
      hoverMarker = new maplibregl.Marker({ element: markerElement('rider-marker', '•'), anchor: 'center' }).addTo(map);
    }
    hoverMarker.setLngLat([point.lon, point.lat]);
  }

  function interpolatePoint(points, progress) {
    if (!points.length) return null;
    const targetKm = progress * points[points.length - 1].distanceKm;
    let low = 0;
    let high = points.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high) / 2);
      if (points[mid].distanceKm < targetKm) low = mid + 1;
      else high = mid;
    }
    const index = clamp(low, 1, points.length - 1);
    const a = points[index - 1];
    const b = points[index];
    const span = Math.max(0.0001, b.distanceKm - a.distanceKm);
    const t = (targetKm - a.distanceKm) / span;
    return {
      lat: a.lat + (b.lat - a.lat) * t,
      lon: a.lon + (b.lon - a.lon) * t,
      ele: a.ele + (b.ele - a.ele) * t
    };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function animateRoute() {
    if (!map || !loaded || !currentStage?.points?.length) return;
    if (animationRunning) {
      stopAnimation();
      return;
    }
    animationRunning = true;
    onAnimationState?.(true);
    hoverMarker?.remove();
    hoverMarker = null;

    if (!riderMarker) {
      riderMarker = new maplibregl.Marker({ element: markerElement('rider-marker', '●'), anchor: 'center' }).addTo(map);
    }
    animationStart = performance.now();
    const duration = clamp(currentStage.distanceKm * 70, 9000, 22000);

    const frame = (now) => {
      if (!animationRunning) return;
      const elapsed = now - animationStart;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const point = interpolatePoint(currentStage.points, eased);
      if (point) {
        riderMarker.setLngLat([point.lon, point.lat]);
        if (progress > 0.02 && progress < 0.98) {
          map.easeTo({ center: [point.lon, point.lat], duration: 0, essential: true });
        }
      }
      if (progress >= 1) {
        stopAnimation(false);
        render(currentStage);
        return;
      }
      animationFrame = requestAnimationFrame(frame);
    };
    animationFrame = requestAnimationFrame(frame);
  }

  function stopAnimation(removeMarker = true) {
    animationRunning = false;
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = null;
    if (removeMarker) {
      riderMarker?.remove();
      riderMarker = null;
    }
    onAnimationState?.(false);
  }

  function resize() { map?.resize(); }

  window.Map3DView = {
    init,
    render,
    setPerspective,
    setTerrainExaggeration,
    highlightPoint,
    animateRoute,
    stopAnimation,
    resize
  };
})();

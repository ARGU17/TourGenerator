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

  let elementId = null;
  let messageElementId = null;
  let container = null;
  let fallbackCanvas = null;
  let fallbackContext = null;
  let resizeObserver = null;
  let perspective = '3d';
  let terrainExaggeration = 1.2;
  let hoverPoint = null;
  let riderProgress = null;
  let renderer = 'fallback';
  let renderSerial = 0;
  let syncBadge = null;
  let lastTerrainErrorAt = 0;
  let pendingRender = null;
  let syncTimer = null;
  let messageTimer = null;
  let routeLayersReady = false;

  const routeSourceId = 'stage-route-v14';
  const routeOutlineId = 'stage-route-outline-v14';
  const routeLineId = 'stage-route-line-v14';

  function createStyle() {
    const config = window.APP_CONFIG || {};
    const terrain = {
      type: 'raster-dem',
      url: config.terrainTileJson || 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
      tileSize: 256,
      maxzoom: 14
    };
    if (config.terrainEncoding) terrain.encoding = config.terrainEncoding;

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
        terrainSource: terrain
      },
      layers: [
        {
          id: 'osm',
          type: 'raster',
          source: 'osm',
          paint: {
            'raster-saturation': -0.34,
            'raster-contrast': 0.10,
            'raster-brightness-max': 0.82
          }
        },
        {
          id: 'hillshade',
          type: 'hillshade',
          source: 'terrainSource',
          paint: {
            'hillshade-shadow-color': '#071018',
            'hillshade-highlight-color': '#dcecf1',
            'hillshade-accent-color': '#4c6574',
            'hillshade-exaggeration': 0.42
          }
        }
      ]
    };
  }

  function init(id, messageId, animationStateCallback) {
    elementId = id;
    messageElementId = messageId;
    onAnimationState = animationStateCallback || null;
    container = document.getElementById(id);
    if (!container) return;
    initFallback();
    upgrade();
  }

  function ensureSyncBadge() {
    if (!container) return null;
    if (syncBadge && syncBadge.isConnected) return syncBadge;
    syncBadge = document.createElement('div');
    syncBadge.className = 'map-sync-badge';
    syncBadge.textContent = 'Preparando mapa…';
    container.appendChild(syncBadge);
    return syncBadge;
  }

  function updateSyncBadge(stage, suffix) {
    const badge = ensureSyncBadge();
    if (!badge) return;
    if (!stage) {
      badge.textContent = 'Sin etapa seleccionada';
      return;
    }
    const mode = stage.routeStatus === 'real' ? 'OSM REAL' : 'LOCAL';
    const km = Number.isFinite(stage.distanceKm) ? `${stage.distanceKm.toFixed(1)} km` : '';
    badge.textContent = `ETAPA ${stage.number || '–'} · ${mode}${km ? ` · ${km}` : ''}${suffix ? ` · ${suffix}` : ''}`;
  }

  function initFallback() {
    if (!container) return;
    renderer = 'fallback';
    container.innerHTML = '';
    container.classList.add('fallback-3d-active');
    fallbackCanvas = document.createElement('canvas');
    fallbackCanvas.className = 'fallback-3d-canvas';
    fallbackCanvas.setAttribute('aria-label', 'Visualización local 3D del recorrido');
    container.appendChild(fallbackCanvas);
    fallbackContext = fallbackCanvas.getContext('2d');

    const label = document.createElement('span');
    label.className = 'fallback-mode-label map-fallback-label';
    label.textContent = '3D LOCAL';
    container.appendChild(label);
    syncBadge = null;
    ensureSyncBadge();
    updateSyncBadge(currentStage);

    resizeObserver?.disconnect?.();
    if (typeof window.ResizeObserver === 'function') {
      resizeObserver = new window.ResizeObserver(() => drawFallback());
      resizeObserver.observe(container);
    } else {
      resizeObserver = null;
      window.addEventListener('resize', drawFallback, { passive: true });
    }
    drawFallback();
  }

  function upgrade() {
    if (map || !container || !window.maplibregl?.Map) return false;
    try {
      stopAnimation();
      resizeObserver?.disconnect?.();
      container.classList.remove('fallback-3d-active');
      container.innerHTML = '';
      fallbackCanvas = null;
      fallbackContext = null;
      syncBadge = null;
      renderer = 'maplibre';
      loaded = false;
      routeLayersReady = false;
      pendingRender = null;
      if (syncTimer) { clearTimeout(syncTimer); syncTimer = null; }

      map = new window.maplibregl.Map({
        container: elementId,
        style: createStyle(),
        center: [2.2, 46.4],
        zoom: 4.8,
        pitch: perspective === 'top' ? 0 : 68,
        bearing: perspective === 'top' ? 0 : -12,
        maxPitch: 85,
        maxZoom: 18,
        antialias: true,
        attributionControl: true
      });

      ensureSyncBadge();
      map.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
      map.addControl(new window.maplibregl.ScaleControl({ maxWidth: 130, unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        loaded = true;
        try {
          map.setTerrain({ source: 'terrainSource', exaggeration: terrainExaggeration });
        } catch (error) {
          console.warn('[Grand Tour Stage Lab] El terreno DEM no pudo activarse; el mapa y la ruta siguen funcionando.', error);
        }
        try {
          map.setSky?.({
            'sky-color': '#071018',
            'sky-horizon-blend': 0.45,
            'horizon-color': '#173346',
            'horizon-fog-blend': 0.35,
            'fog-color': '#6d8797',
            'fog-ground-blend': 0.08
          });
        } catch (_) { /* Sky is optional. */ }
        routeLayersReady = addRouteLayers();
        if (currentStage) render(currentStage);
      });

      map.on('styledata', () => {
        if (!loaded || !map) return;
        routeLayersReady = addRouteLayers() || routeLayersReady;
        flushPendingRender();
      });

      map.on('idle', () => {
        if (!loaded || !map) return;
        routeLayersReady = addRouteLayers() || routeLayersReady;
        flushPendingRender();
      });

      map.on('error', (event) => {
        const errorText = event?.error?.message || '';
        if (/terrain|dem|tile|source|network|fetch/i.test(errorText)) {
          const now = Date.now();
          if (now - lastTerrainErrorAt > 6000) {
            lastTerrainErrorAt = now;
            showMessage('Alguna tesela de mapa o relieve no ha respondido. La ruta seleccionada continúa sincronizada.', 5200);
          }
        }
      });
      return true;
    } catch (error) {
      console.warn('[Grand Tour Stage Lab] MapLibre no pudo inicializarse; se utiliza el visor 3D local.', error);
      try { map?.remove(); } catch (_) { /* noop */ }
      map = null;
      loaded = false;
      initFallback();
      if (currentStage) drawFallback();
      return false;
    }
  }

  function showMessage(text, duration) {
    const message = document.getElementById(messageElementId);
    if (!message) return;
    if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
    message.textContent = text;
    message.classList.remove('hidden');
    if (duration) {
      messageTimer = setTimeout(() => {
        message.classList.add('hidden');
        messageTimer = null;
      }, duration);
    }
  }

  function hideMessage() {
    const message = document.getElementById(messageElementId);
    if (message) message.classList.add('hidden');
    if (messageTimer) { clearTimeout(messageTimer); messageTimer = null; }
  }

  function addRouteLayers() {
    // MapLibre permite añadir fuentes y capas después del evento `load`, aunque
    // isStyleLoaded() pueda seguir siendo false mientras descarga teselas/DEM.
    // La comprobación anterior provocaba un bucle permanente de reintentos.
    if (!map || !loaded || !map.getStyle?.()) return false;
    try {
      if (!map.getSource(routeSourceId)) {
        map.addSource(routeSourceId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: [] },
          lineMetrics: true
        });
      }
      if (!map.getLayer(routeOutlineId)) {
        map.addLayer({
          id: routeOutlineId,
          type: 'line',
          source: routeSourceId,
          filter: ['==', ['get', 'kind'], 'segment'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': 'rgba(3, 8, 12, .94)', 'line-width': 9, 'line-opacity': 0.86 }
        });
      }
      if (!map.getLayer(routeLineId)) {
        map.addLayer({
          id: routeLineId,
          type: 'line',
          source: routeSourceId,
          filter: ['==', ['get', 'kind'], 'segment'],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['case',
              ['<=', ['get', 'grade'], -4], '#3c9dff',
              ['<=', ['get', 'grade'], 2], '#72f0a8',
              ['<=', ['get', 'grade'], 5], '#f1d35e',
              ['<=', ['get', 'grade'], 8], '#ff9f43',
              '#ff5c5c'
            ],
            'line-width': 5,
            'line-opacity': 0.99
          }
        });
      }
      return true;
    } catch (error) {
      console.warn('[Grand Tour Stage Lab] No se pudieron preparar las capas de ruta.', error);
      return false;
    }
  }

  function validPoint(point) {
    return point && Number.isFinite(Number(point.lon)) && Number.isFinite(Number(point.lat)) &&
      Number(point.lon) >= -180 && Number(point.lon) <= 180 && Number(point.lat) >= -85 && Number(point.lat) <= 85;
  }

  function sanitizedPoints(stage, maximum = 1400) {
    const source = Array.isArray(stage?.points) ? stage.points : [];
    const valid = source.filter(validPoint).map((point) => ({
      ...point,
      lon: Number(point.lon),
      lat: Number(point.lat),
      ele: Number.isFinite(Number(point.ele)) ? Number(point.ele) : 0,
      grade: Number.isFinite(Number(point.grade)) ? Number(point.grade) : 0
    }));
    if (valid.length <= maximum) return valid;
    const step = Math.ceil(valid.length / maximum);
    const sampled = valid.filter((_, index) => index % step === 0);
    if (sampled[sampled.length - 1] !== valid[valid.length - 1]) sampled.push(valid[valid.length - 1]);
    return sampled;
  }

  function stageFeatureCollection(stage, points) {
    const features = [];
    for (let i = 1; i < points.length; i++) {
      features.push({
        type: 'Feature',
        id: `${stage.id || stage.number || 'stage'}-${i}`,
        properties: {
          kind: 'segment',
          grade: Number(points[i].grade) || 0,
          stageNumber: Number(stage.number) || 0,
          renderSerial
        },
        geometry: {
          type: 'LineString',
          coordinates: [[points[i - 1].lon, points[i - 1].lat], [points[i].lon, points[i].lat]]
        }
      });
    }
    return { type: 'FeatureCollection', features };
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
    if (!map || !validPoint(point)) return null;
    const marker = new window.maplibregl.Marker({ element: markerElement(className), anchor: 'center' }).setLngLat([Number(point.lon), Number(point.lat)]);
    if (popupText) marker.setPopup(new window.maplibregl.Popup({ offset: 18 }).setHTML(popupText));
    marker.addTo(map);
    persistentMarkers.push(marker);
    return marker;
  }

  function boundsForPoints(points) {
    const bounds = new window.maplibregl.LngLatBounds();
    points.forEach((point) => bounds.extend([point.lon, point.lat]));
    return bounds;
  }

  function render(stage) {
    currentStage = stage;
    hoverPoint = null;
    stopAnimation();
    const serial = ++renderSerial;
    updateSyncBadge(stage, 'ACTUALIZANDO');
    if (renderer === 'maplibre' && map) {
      pendingRender = { stage, serial, attempts: 0, startedAt: Date.now(), warned: false };
      schedulePendingRender(0);
    } else {
      updateSyncBadge(stage);
      drawFallback();
    }
  }

  function schedulePendingRender(delayMs = 80) {
    if (syncTimer) clearTimeout(syncTimer);
    syncTimer = window.setTimeout(() => {
      syncTimer = null;
      flushPendingRender();
    }, Math.max(0, delayMs));
  }

  function flushPendingRender() {
    const pending = pendingRender;
    if (!pending || pending.serial !== renderSerial || renderer !== 'maplibre' || !map) return;
    if (!loaded) {
      pending.attempts++;
      updateSyncBadge(pending.stage, 'CARGANDO MAPA');
      schedulePendingRender(120);
      return;
    }

    routeLayersReady = addRouteLayers() || routeLayersReady;
    const source = routeLayersReady ? map.getSource(routeSourceId) : null;
    if (!routeLayersReady || !source?.setData) {
      pending.attempts++;
      const elapsed = Date.now() - pending.startedAt;
      updateSyncBadge(pending.stage, elapsed > 2500 ? 'ESPERANDO CAPAS' : 'PREPARANDO CAPAS');
      // No se muestra un error en cada intento. Se mantiene una única cola de
      // sincronización y se reintenta cuando MapLibre emite styledata/idle.
      if (elapsed > 9000 && !pending.warned) {
        pending.warned = true;
        showMessage('El mapa base sigue cargando. La ruta se añadirá automáticamente en cuanto MapLibre termine de preparar el estilo.', 5000);
      }
      if (elapsed > 15000 && pending.attempts > 35) {
        console.warn('[Grand Tour Stage Lab] MapLibre no preparó las capas de ruta; se activa el visor 3D local estable.');
        const stageToKeep = pending.stage;
        pendingRender = null;
        try { map.remove(); } catch (_) { /* noop */ }
        map = null;
        loaded = false;
        routeLayersReady = false;
        initFallback();
        currentStage = stageToKeep;
        updateSyncBadge(stageToKeep, '3D LOCAL');
        drawFallback();
        showMessage('El mapa cartográfico no terminó de preparar sus capas. Se ha activado automáticamente el visor 3D local con la ruta completa.', 6500);
        return;
      }
      schedulePendingRender(Math.min(500, 100 + pending.attempts * 25));
      return;
    }

    try {
      renderMapNow(pending.stage, pending.serial, source);
      pendingRender = null;
      hideMessage();
    } catch (error) {
      pending.attempts++;
      const recoverable = /style|source|layer|load|ready|available|remove/i.test(error?.message || '');
      console.warn('[Grand Tour Stage Lab] Sincronización de mapa aplazada.', error);
      updateSyncBadge(pending.stage, recoverable ? 'REINTENTANDO' : 'MAPA DEGRADADO');
      if (!recoverable || pending.attempts > 18) {
        showMessage(`El mapa no pudo dibujar la ruta todavía: ${error.message}. Se conserva el perfil y el GPX.`, 6500);
      }
      schedulePendingRender(recoverable ? 220 : 650);
    }
  }

  function renderMapNow(stage, serial, source) {
    if (!map || !loaded || serial !== renderSerial) return;
    const points = sanitizedPoints(stage);
    if (points.length < 2) {
      updateSyncBadge(stage, 'GEOMETRÍA INVÁLIDA');
      showMessage('La etapa seleccionada no contiene al menos dos coordenadas cartográficas válidas.', 6500);
      return;
    }

    map.stop();
    source.setData(stageFeatureCollection(stage, points));
    clearMarkers();

    const first = points[0];
    const last = points[points.length - 1];
    addMarker(first, 'route-marker start', `<strong>${escapeHtml(stage.startName)}</strong><br>Salida`);
    addMarker(last, 'route-marker finish', `<strong>${escapeHtml(stage.finishName)}</strong><br>Meta`);

    (stage.climbs || []).slice(0, 6).forEach((climb) => {
      const originalPoint = stage.points?.[climb.endIndex];
      if (!validPoint(originalPoint)) return;
      addMarker(originalPoint, 'route-marker climb', `<strong>${escapeHtml(climb.name)}</strong><br>Cat. ${escapeHtml(climb.category)} · ${Number(climb.lengthKm || 0).toFixed(1)} km al ${Number(climb.avgGrade || 0).toFixed(1)} %`);
    });

    const bounds = boundsForPoints(points);
    const padding = { top: 58, bottom: 58, left: 48, right: 48 };
    const camera = map.cameraForBounds?.(bounds, { padding, maxZoom: 11.5 });
    const target = camera || { center: bounds.getCenter(), zoom: 8 };
    map.easeTo({
      ...target,
      pitch: perspective === 'top' ? 0 : 66,
      bearing: perspective === 'top' ? 0 : routeBearingFromPoints(points),
      duration: 720,
      essential: true
    });
    map.triggerRepaint?.();
    updateSyncBadge(stage);
  }

  function routeBearingFromPoints(points) {
    const first = points[0];
    const last = points[points.length - 1];
    if (!first || !last) return 0;
    const averageLat = (first.lat + last.lat) * Math.PI / 360;
    const dx = (last.lon - first.lon) * Math.cos(averageLat);
    const dy = last.lat - first.lat;
    return ((Math.atan2(dx, dy) * 180 / Math.PI) + 360) % 360 - 18;
  }

  function routeBearing(stage) {
    return routeBearingFromPoints(sanitizedPoints(stage, 10000));
  }

  function escapeHtml(value) {
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function setPerspective(mode) {
    perspective = mode === 'top' ? 'top' : '3d';
    if (renderer === 'maplibre' && map) {
      map.stop();
      map.easeTo({ pitch: perspective === 'top' ? 0 : 68, bearing: perspective === 'top' ? 0 : currentStage ? routeBearing(currentStage) : -12, duration: 650, essential: true });
      if (currentStage) window.setTimeout(() => render(currentStage), 90);
    } else drawFallback();
  }

  function setTerrainExaggeration(value) {
    terrainExaggeration = Math.max(0, Number(value) || 0);
    if (renderer === 'maplibre' && map && loaded) {
      try {
        map.setTerrain({ source: 'terrainSource', exaggeration: terrainExaggeration });
        map.triggerRepaint?.();
      } catch (error) {
        console.warn('No se pudo modificar el terreno', error);
      }
    } else drawFallback();
  }

  function highlightPoint(point) {
    hoverPoint = validPoint(point) ? point : null;
    if (renderer === 'maplibre' && map && loaded) {
      if (!hoverPoint) {
        hoverMarker?.remove();
        hoverMarker = null;
        return;
      }
      if (!hoverMarker) hoverMarker = new window.maplibregl.Marker({ element: markerElement('rider-marker', '•'), anchor: 'center' }).addTo(map);
      hoverMarker.setLngLat([Number(hoverPoint.lon), Number(hoverPoint.lat)]);
    } else drawFallback();
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
    return { lat: a.lat + (b.lat - a.lat) * t, lon: a.lon + (b.lon - a.lon) * t, ele: a.ele + (b.ele - a.ele) * t, grade: a.grade + (b.grade - a.grade) * t, distanceKm: targetKm };
  }

  function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }

  function animateRoute() {
    if (!currentStage?.points?.length) return;
    if (animationRunning) {
      stopAnimation();
      return;
    }
    animationRunning = true;
    onAnimationState?.(true);
    hoverPoint = null;

    if (renderer === 'maplibre' && map && loaded && !riderMarker) {
      riderMarker = new window.maplibregl.Marker({ element: markerElement('rider-marker', '●'), anchor: 'center' }).addTo(map);
    }

    animationStart = performance.now();
    const duration = clamp(currentStage.distanceKm * 70, 9000, 22000);
    const frame = (now) => {
      if (!animationRunning) return;
      const elapsed = now - animationStart;
      const progress = Math.min(1, elapsed / duration);
      const eased = progress < 0.5 ? 2 * progress * progress : 1 - Math.pow(-2 * progress + 2, 2) / 2;
      const point = interpolatePoint(currentStage.points, eased);
      riderProgress = eased;

      if (renderer === 'maplibre' && map && loaded && validPoint(point)) {
        riderMarker?.setLngLat([point.lon, point.lat]);
        if (progress > 0.02 && progress < 0.98) map.easeTo({ center: [point.lon, point.lat], duration: 0, essential: true });
      } else {
        drawFallback();
      }

      if (progress >= 1) {
        stopAnimation(false);
        riderProgress = null;
        if (renderer === 'maplibre') render(currentStage);
        else drawFallback();
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
    riderProgress = null;
    if (removeMarker) {
      riderMarker?.remove();
      riderMarker = null;
    }
    onAnimationState?.(false);
    if (renderer === 'fallback') drawFallback();
  }

  function gradeColor(grade) {
    const g = Number(grade) || 0;
    if (g <= -4) return '#3c9dff';
    if (g <= 2) return '#72f0a8';
    if (g <= 5) return '#f1d35e';
    if (g <= 8) return '#ff9f43';
    return '#ff5c5c';
  }

  function samplePoints(points, maximum) {
    if (points.length <= maximum) return points;
    const step = Math.ceil(points.length / maximum);
    const sampled = points.filter((_, index) => index % step === 0);
    if (sampled[sampled.length - 1] !== points[points.length - 1]) sampled.push(points[points.length - 1]);
    return sampled;
  }

  function normalizedRoute(stage) {
    const points = samplePoints(stage.points, 620);
    const minLon = Math.min(...points.map((p) => p.lon));
    const maxLon = Math.max(...points.map((p) => p.lon));
    const minLat = Math.min(...points.map((p) => p.lat));
    const maxLat = Math.max(...points.map((p) => p.lat));
    const minEle = Math.min(...points.map((p) => p.ele));
    const maxEle = Math.max(...points.map((p) => p.ele));
    const lonSpan = Math.max(0.0001, maxLon - minLon);
    const latSpan = Math.max(0.0001, maxLat - minLat);
    const eleSpan = Math.max(1, maxEle - minEle);
    return {
      points: points.map((p) => ({ ...p, nx: (p.lon - minLon) / lonSpan - 0.5, ny: (p.lat - minLat) / latSpan - 0.5, nz: (p.ele - minEle) / eleSpan })),
      minLon, maxLon, minLat, maxLat, minEle, maxEle, lonSpan, latSpan, eleSpan
    };
  }

  function projector(width, height, bounds) {
    const margin = Math.min(width, height) * 0.09;
    const usableW = Math.max(1, width - margin * 2);
    const usableH = Math.max(1, height - margin * 2);
    const geographicAspect = Math.max(0.35, Math.min(2.8, bounds.lonSpan / Math.max(0.0001, bounds.latSpan)));
    const baseScale = Math.min(usableW / Math.max(1, geographicAspect), usableH) * 0.92;

    if (perspective === 'top') {
      return (p) => ({
        x: width / 2 + p.nx * baseScale * geographicAspect,
        y: height / 2 - p.ny * baseScale,
        z: p.nz
      });
    }

    const angle = -0.47;
    const ca = Math.cos(angle);
    const sa = Math.sin(angle);
    return (p) => {
      const rx = p.nx * ca - p.ny * sa;
      const ry = p.nx * sa + p.ny * ca;
      const zLift = p.nz * Math.min(height * 0.34, 150) * terrainExaggeration;
      return {
        x: width / 2 + rx * baseScale * geographicAspect,
        y: height * 0.64 - ry * baseScale * 0.48 - zLift,
        z: p.nz
      };
    };
  }

  function pointToNormalized(point, bounds) {
    return {
      ...point,
      nx: (point.lon - bounds.minLon) / bounds.lonSpan - 0.5,
      ny: (point.lat - bounds.minLat) / bounds.latSpan - 0.5,
      nz: (point.ele - bounds.minEle) / bounds.eleSpan
    };
  }

  function terrainElevation(nx, ny, route, stageSeed) {
    let nearest = [];
    for (let i = 0; i < route.length; i += Math.max(1, Math.floor(route.length / 90))) {
      const p = route[i];
      const d2 = (p.nx - nx) ** 2 + (p.ny - ny) ** 2;
      nearest.push({ d2, z: p.nz });
    }
    nearest.sort((a, b) => a.d2 - b.d2);
    const selected = nearest.slice(0, 5);
    let num = 0;
    let den = 0;
    selected.forEach((item) => {
      const w = 1 / Math.max(0.003, item.d2);
      num += item.z * w;
      den += w;
    });
    const base = den ? num / den : 0.25;
    const seed = Number(stageSeed || 1) % 997;
    const noise = 0.09 * Math.sin((nx * 8.7 + seed * 0.013) * Math.PI) * Math.cos((ny * 7.2 - seed * 0.009) * Math.PI);
    return clamp(base * 0.76 + 0.09 + noise, 0, 1.1);
  }

  function drawFallback() {
    if (!fallbackCanvas || !fallbackContext || !container) return;
    const rect = container.getBoundingClientRect();
    const width = Math.max(320, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (fallbackCanvas.width !== Math.floor(width * dpr) || fallbackCanvas.height !== Math.floor(height * dpr)) {
      fallbackCanvas.width = Math.floor(width * dpr);
      fallbackCanvas.height = Math.floor(height * dpr);
      fallbackCanvas.style.width = `${width}px`;
      fallbackCanvas.style.height = `${height}px`;
    }
    const ctx = fallbackContext;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);

    const bg = ctx.createLinearGradient(0, 0, 0, height);
    bg.addColorStop(0, '#102331');
    bg.addColorStop(0.56, '#091720');
    bg.addColorStop(1, '#050b11');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, width, height);

    if (!currentStage?.points?.length) {
      ctx.fillStyle = 'rgba(241,246,249,.62)';
      ctx.font = '600 13px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('Generando geometría de la etapa…', width / 2, height / 2);
      return;
    }

    const bounds = normalizedRoute(currentStage);
    const project = projector(width, height, bounds);
    const route = bounds.points;

    if (perspective === '3d') drawTerrainMesh(ctx, width, height, route, project, currentStage.seed);
    else drawTopographicGrid(ctx, width, height);

    const projected = route.map(project);
    drawRoute(ctx, projected, route);
    drawFallbackMarkers(ctx, currentStage, bounds, project, width, height);

    if (hoverPoint) drawFocusPoint(ctx, project(pointToNormalized(hoverPoint, bounds)), '#f1f6f9');
    if (riderProgress !== null) {
      const rider = interpolatePoint(currentStage.points, riderProgress);
      if (rider) drawFocusPoint(ctx, project(pointToNormalized(rider, bounds)), '#72f0a8', true);
    }

    ctx.fillStyle = 'rgba(241,246,249,.76)';
    ctx.font = '700 11px system-ui';
    ctx.textAlign = 'left';
    ctx.fillText(`${currentStage.flag || ''} ${currentStage.routeLabel}`, 18, 25);
    ctx.fillStyle = 'rgba(139,161,178,.72)';
    ctx.font = '600 9px system-ui';
    ctx.fillText(`${currentStage.distanceKm.toFixed(1)} km · ${Math.round(currentStage.ascentM)} m+ · ${perspective === '3d' ? 'perspectiva 3D' : 'vista cenital'}`, 18, 42);
  }

  function drawTopographicGrid(ctx, width, height) {
    ctx.save();
    ctx.strokeStyle = 'rgba(142,180,205,.10)';
    ctx.lineWidth = 1;
    for (let i = -height; i < width + height; i += 36) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i + height, height);
      ctx.stroke();
    }
    for (let y = 60; y < height; y += 52) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTerrainMesh(ctx, width, height, route, project, seed) {
    const cols = 20;
    const rows = 13;
    const grid = [];
    for (let r = 0; r <= rows; r++) {
      const row = [];
      for (let c = 0; c <= cols; c++) {
        const nx = c / cols - 0.5;
        const ny = r / rows - 0.5;
        const nz = terrainElevation(nx, ny, route, seed);
        row.push({ ...project({ nx, ny, nz }), nz });
      }
      grid.push(row);
    }

    for (let r = rows - 1; r >= 0; r--) {
      for (let c = 0; c < cols; c++) {
        const a = grid[r][c];
        const b = grid[r][c + 1];
        const d = grid[r + 1][c];
        const e = grid[r + 1][c + 1];
        const z = (a.nz + b.nz + d.nz + e.nz) / 4;
        ctx.beginPath();
        ctx.moveTo(a.x, a.y);
        ctx.lineTo(b.x, b.y);
        ctx.lineTo(e.x, e.y);
        ctx.lineTo(d.x, d.y);
        ctx.closePath();
        ctx.fillStyle = `rgba(${Math.round(17 + z * 28)}, ${Math.round(43 + z * 46)}, ${Math.round(49 + z * 38)}, .82)`;
        ctx.fill();
        ctx.strokeStyle = 'rgba(142,180,205,.075)';
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }

    const haze = ctx.createLinearGradient(0, height * 0.25, 0, height);
    haze.addColorStop(0, 'rgba(7,16,24,.08)');
    haze.addColorStop(1, 'rgba(3,8,12,.50)');
    ctx.fillStyle = haze;
    ctx.fillRect(0, 0, width, height);
  }

  function drawRoute(ctx, projected, route) {
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = 'rgba(1,5,8,.92)';
    ctx.lineWidth = 9;
    ctx.beginPath();
    projected.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y));
    ctx.stroke();

    for (let i = 1; i < projected.length; i++) {
      ctx.strokeStyle = gradeColor(route[i].grade);
      ctx.lineWidth = 4.2;
      ctx.beginPath();
      ctx.moveTo(projected[i - 1].x, projected[i - 1].y);
      ctx.lineTo(projected[i].x, projected[i].y);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawFallbackMarkers(ctx, stage, bounds, project, width, height) {
    const entries = [
      { point: stage.points[0], label: stage.startName, kind: 'S', color: '#72f0a8' },
      { point: stage.points[stage.points.length - 1], label: stage.finishName, kind: 'M', color: '#f1f6f9' }
    ];
    (stage.climbs || []).slice(0, 5).forEach((climb) => {
      const point = stage.points[climb.endIndex];
      if (point) entries.push({ point, label: climb.name, kind: String(climb.category), color: '#ff9f43' });
    });

    entries.forEach((entry, index) => {
      const p = project(pointToNormalized(entry.point, bounds));
      ctx.save();
      ctx.shadowColor = entry.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = entry.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, index < 2 ? 6 : 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#071018';
      ctx.font = `900 ${index < 2 ? 8 : 7}px system-ui`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(entry.kind, p.x, p.y + 0.5);
      ctx.fillStyle = 'rgba(241,246,249,.86)';
      ctx.font = '700 8px system-ui';
      ctx.textAlign = index === 0 ? 'left' : index === 1 ? 'right' : 'center';
      const tx = index === 0 ? p.x + 9 : index === 1 ? p.x - 9 : p.x;
      const ty = Math.max(55, Math.min(height - 12, p.y - 11));
      const label = String(entry.label || '').length > 22 ? `${String(entry.label).slice(0, 20)}…` : entry.label;
      ctx.fillText(label, tx, ty);
      ctx.restore();
    });
  }

  function drawFocusPoint(ctx, p, color, rider) {
    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = rider ? 18 : 12;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, rider ? 7 : 5.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.strokeStyle = '#071018';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function resize() {
    if (renderer === 'maplibre') {
      map?.resize();
      if (currentStage) window.setTimeout(() => render(currentStage), 80);
    } else drawFallback();
  }

  window.Map3DView = {
    init,
    render,
    setPerspective,
    setTerrainExaggeration,
    highlightPoint,
    animateRoute,
    stopAnimation,
    resize,
    upgrade
  };
})();

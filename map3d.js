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
      terrain: { source: 'terrainSource', exaggeration: terrainExaggeration }
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
      resizeObserver?.disconnect();
      container.classList.remove('fallback-3d-active');
      container.innerHTML = '';
      fallbackCanvas = null;
      fallbackContext = null;
      renderer = 'maplibre';
      loaded = false;

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

      map.addControl(new window.maplibregl.NavigationControl({ visualizePitch: true, showCompass: true, showZoom: true }), 'top-right');
      map.addControl(new window.maplibregl.ScaleControl({ maxWidth: 130, unit: 'metric' }), 'bottom-left');

      map.on('load', () => {
        loaded = true;
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
        addRouteLayers();
        if (currentStage) renderMap(currentStage);
      });

      map.on('error', (event) => {
        const errorText = event?.error?.message || '';
        if (/terrain|tile|source|network|fetch/i.test(errorText)) {
          showMessage('No se ha podido cargar alguna capa cartográfica o de terreno. La geometría y el perfil siguen disponibles.', 6500);
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
    message.textContent = text;
    message.classList.remove('hidden');
    if (duration) setTimeout(() => message.classList.add('hidden'), duration);
  }

  function addRouteLayers() {
    if (!map || !loaded || map.getSource(routeSourceId)) return;
    map.addSource(routeSourceId, { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
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
        'line-color': ['interpolate', ['linear'], ['get', 'difficulty'], 0, '#72f0a8', 0.35, '#f5cf5b', 0.65, '#ff9f43', 1, '#ff5c5c'],
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
      geometry: { type: 'LineString', coordinates: stage.points.map((point) => [point.lon, point.lat]) }
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
    const marker = new window.maplibregl.Marker({ element: markerElement(className), anchor: 'center' }).setLngLat([point.lon, point.lat]);
    if (popupText) marker.setPopup(new window.maplibregl.Popup({ offset: 18 }).setHTML(popupText));
    marker.addTo(map);
    persistentMarkers.push(marker);
    return marker;
  }

  function boundsForStage(stage) {
    const bounds = new window.maplibregl.LngLatBounds();
    stage.points.forEach((point) => bounds.extend([point.lon, point.lat]));
    return bounds;
  }

  function render(stage) {
    currentStage = stage;
    hoverPoint = null;
    stopAnimation();
    if (renderer === 'maplibre' && map && loaded) renderMap(stage);
    else drawFallback();
  }

  function renderMap(stage) {
    if (!map || !loaded || !stage?.points?.length) return;
    addRouteLayers();
    map.getSource(routeSourceId)?.setData({ type: 'FeatureCollection', features: [stageFeature(stage)] });
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

    map.fitBounds(boundsForStage(stage), {
      padding: { top: 70, bottom: 70, left: 55, right: 55 },
      pitch: perspective === 'top' ? 0 : 64,
      bearing: perspective === 'top' ? 0 : routeBearing(stage),
      duration: 900,
      maxZoom: 11.5
    });
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
    return String(value ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
  }

  function setPerspective(mode) {
    perspective = mode === 'top' ? 'top' : '3d';
    if (renderer === 'maplibre' && map) {
      if (perspective === 'top') map.easeTo({ pitch: 0, bearing: 0, duration: 650 });
      else map.easeTo({ pitch: 68, bearing: currentStage ? routeBearing(currentStage) : -12, duration: 650 });
    } else drawFallback();
  }

  function setTerrainExaggeration(value) {
    terrainExaggeration = Math.max(0, Number(value) || 0);
    if (renderer === 'maplibre' && map && loaded) {
      try { map.setTerrain({ source: 'terrainSource', exaggeration: terrainExaggeration }); }
      catch (error) { console.warn('No se pudo modificar el terreno', error); }
    } else drawFallback();
  }

  function highlightPoint(point) {
    hoverPoint = point || null;
    if (renderer === 'maplibre' && map && loaded) {
      if (!point) {
        hoverMarker?.remove();
        hoverMarker = null;
        return;
      }
      if (!hoverMarker) hoverMarker = new window.maplibregl.Marker({ element: markerElement('rider-marker', '•'), anchor: 'center' }).addTo(map);
      hoverMarker.setLngLat([point.lon, point.lat]);
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

      if (renderer === 'maplibre' && map && loaded && point) {
        riderMarker?.setLngLat([point.lon, point.lat]);
        if (progress > 0.02 && progress < 0.98) map.easeTo({ center: [point.lon, point.lat], duration: 0, essential: true });
      } else {
        drawFallback();
      }

      if (progress >= 1) {
        stopAnimation(false);
        riderProgress = null;
        if (renderer === 'maplibre') renderMap(currentStage);
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
    if (renderer === 'maplibre') map?.resize();
    else drawFallback();
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

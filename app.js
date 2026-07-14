(function () {
  'use strict';

  const DEFAULT_CONFIG = {
    mode: 'europe',
    stageCount: 21,
    seed: 20260714,
    totalDistance: 3350,
    flatCount: 7,
    rollingCount: 4,
    mediumCount: 3,
    highCount: 5,
    ittCount: 2,
    summitCount: 4,
    maxStageDistance: 225
  };

  const state = {
    tour: null,
    selectedIndex: 0,
    routeAllRunning: false,
    regenerateCounter: 0
  };

  const el = {};

  function cacheElements() {
    [
      'routingBadge', 'generateTourBtn', 'routeTourBtn', 'exportTourBtn', 'tourTitle', 'stageCounter',
      'tourSummary', 'stageList', 'stageTypeLabel', 'stageTitle', 'stageRouteLabel', 'stageStats',
      'routeStageBtn', 'regenerateStageBtn', 'exportStageBtn', 'view3dBtn', 'viewTopBtn',
      'terrainExaggeration', 'playRouteBtn', 'tourMode', 'stageCount', 'seedInput', 'totalDistance',
      'flatCount', 'rollingCount', 'mediumCount', 'highCount', 'ittCount', 'summitCount',
      'maxStageDistance', 'naturalConditions', 'applyNaturalBtn', 'generateFromPanelBtn',
      'resetConfigBtn', 'valhallaEndpoint', 'autoRouteNewStages', 'toastContainer'
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  function readConfig() {
    return {
      mode: el.tourMode.value,
      stageCount: Number(el.stageCount.value),
      seed: Number(el.seedInput.value),
      totalDistance: Number(el.totalDistance.value),
      flatCount: Number(el.flatCount.value),
      rollingCount: Number(el.rollingCount.value),
      mediumCount: Number(el.mediumCount.value),
      highCount: Number(el.highCount.value),
      ittCount: Number(el.ittCount.value),
      summitCount: Number(el.summitCount.value),
      maxStageDistance: Number(el.maxStageDistance.value)
    };
  }

  function writeConfig(config) {
    el.tourMode.value = config.mode;
    el.stageCount.value = config.stageCount;
    el.seedInput.value = config.seed;
    el.totalDistance.value = config.totalDistance;
    el.flatCount.value = config.flatCount;
    el.rollingCount.value = config.rollingCount;
    el.mediumCount.value = config.mediumCount;
    el.highCount.value = config.highCount;
    el.ittCount.value = config.ittCount;
    el.summitCount.value = config.summitCount;
    el.maxStageDistance.value = config.maxStageDistance;
  }

  function savePreferences() {
    try {
      localStorage.setItem('grand-tour-stage-lab-config', JSON.stringify(readConfig()));
      localStorage.setItem('grand-tour-stage-lab-endpoint', el.valhallaEndpoint.value);
    } catch (_) { /* Storage is optional. */ }
  }

  function restorePreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem('grand-tour-stage-lab-config') || 'null');
      if (saved) writeConfig({ ...DEFAULT_CONFIG, ...saved });
      const endpoint = localStorage.getItem('grand-tour-stage-lab-endpoint');
      if (endpoint) el.valhallaEndpoint.value = endpoint;
      else el.valhallaEndpoint.value = window.APP_CONFIG?.valhallaEndpoint || el.valhallaEndpoint.value;
    } catch (_) {
      writeConfig(DEFAULT_CONFIG);
    }
  }

  function toast(message, type = 'info', duration = 3800) {
    const node = document.createElement('div');
    node.className = `toast ${type}`;
    node.textContent = message;
    el.toastContainer.appendChild(node);
    setTimeout(() => {
      node.style.opacity = '0';
      node.style.transform = 'translateY(8px)';
      setTimeout(() => node.remove(), 240);
    }, duration);
  }

  function setRoutingBadge(mode, text) {
    el.routingBadge.className = `status-badge status-${mode}`;
    el.routingBadge.textContent = text;
  }

  function formatNumber(value, decimals = 0) {
    return Number(value || 0).toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function stageDifficultyLabel(stage) {
    return window.CYCLING_CATALOG.stageTypes[stage.type]?.short || stage.type.toUpperCase();
  }

  function renderTour() {
    const tour = state.tour;
    if (!tour) return;
    const stats = StageGenerator.tourStats(tour);
    el.tourTitle.textContent = tour.title;
    el.stageCounter.textContent = tour.stages.length;
    if (!state.routeAllRunning) el.routeTourBtn.textContent = `Enrutar ${tour.stages.length} etapas`;
    el.tourSummary.innerHTML = [
      summaryItem(`${formatNumber(stats.distanceKm, 0)} km`, 'Distancia real'),
      summaryItem(`${formatNumber(stats.ascentM, 0)} m+`, 'Desnivel acumulado'),
      summaryItem(`${stats.mountainStages}`, 'Etapas de montaña'),
      summaryItem(`${stats.realStages}/${tour.stages.length}`, 'Enrutadas por OSM')
    ].join('');

    el.stageList.innerHTML = tour.stages.map((stage, index) => {
      const active = index === state.selectedIndex ? 'active' : '';
      const realClass = stage.routeStatus === 'real' ? 'live' : '';
      return `
        <button class="stage-card ${active}" data-stage-index="${index}">
          <span class="stage-number">${String(stage.number).padStart(2, '0')}</span>
          <span class="stage-card-main">
            <strong>${escapeHtml(stage.routeLabel)}</strong>
            <span>${stage.flag} ${escapeHtml(stage.regionName)} · ${escapeHtml(stageDifficultyLabel(stage))}</span>
          </span>
          <span class="stage-card-meta">
            <strong>${formatNumber(stage.distanceKm, 1)} km</strong>
            <span><i class="stage-route-state ${realClass}"></i>${formatNumber(stage.ascentM, 0)} m+</span>
          </span>
        </button>`;
    }).join('');

    el.stageList.querySelectorAll('[data-stage-index]').forEach((button) => {
      button.addEventListener('click', () => selectStage(Number(button.dataset.stageIndex)));
    });

    renderSelectedStage();
  }

  function summaryItem(value, label) {
    return `<div class="summary-item"><strong>${value}</strong><span>${label}</span></div>`;
  }

  function metric(value, label) {
    return `<div class="metric"><strong>${value}</strong><span>${label}</span></div>`;
  }

  function renderSelectedStage() {
    const stage = state.tour?.stages[state.selectedIndex];
    if (!stage) return;
    const typeConfig = window.CYCLING_CATALOG.stageTypes[stage.type];
    el.stageTypeLabel.textContent = stageDifficultyLabel(stage);
    el.stageTypeLabel.style.background = typeConfig?.color || '#72f0a8';
    el.stageTitle.textContent = stage.title;
    el.stageRouteLabel.textContent = `${stage.flag} ${stage.routeLabel} · ${stage.regionName}`;
    el.stageStats.innerHTML = [
      metric(`${formatNumber(stage.distanceKm, 1)} km`, 'Distancia'),
      metric(`${formatNumber(stage.ascentM, 0)} m+`, 'Desnivel'),
      metric(`${formatNumber(stage.maxEleM, 0)} m`, 'Cota máxima'),
      metric(`${formatNumber(stage.maxGrade, 1)} %`, 'Pendiente máxima'),
      metric(`${stage.climbs?.length || 0}`, 'Puertos'),
      metric(stage.routeStatus === 'real' ? 'OSM real' : 'Incluido', 'Geometría')
    ].join('');
    el.routeStageBtn.textContent = stage.routeStatus === 'real' ? 'Recalcular ruta' : 'Carreteras reales';
    ProfileView.render(stage);
    Map3DView.render(stage);
  }

  function selectStage(index) {
    state.selectedIndex = StageGenerator.clamp(index, 0, state.tour.stages.length - 1);
    renderTour();
  }

  async function generateTour(configOverride) {
    const config = configOverride || readConfig();
    savePreferences();
    state.selectedIndex = 0;
    state.regenerateCounter = 0;
    state.tour = StageGenerator.generateTour(config);
    renderTour();
    setRoutingBadge('demo', 'Datos incluidos');
    toast(`Vuelta generada: ${state.tour.stages.length} etapas y semilla ${state.tour.config.seed}.`, 'success');

    if (el.autoRouteNewStages.checked) await routeAllStages();
  }

  function regenerateSelectedStage() {
    if (!state.tour) return;
    state.regenerateCounter++;
    const replacement = StageGenerator.regenerateStage(state.tour, state.selectedIndex, state.regenerateCounter);
    state.tour.stages[state.selectedIndex] = replacement;
    renderTour();
    setRoutingBadge('demo', 'Etapa regenerada');
    toast(`${replacement.title} regenerada en ${replacement.regionName}.`, 'success');
  }

  async function routeSelectedStage() {
    const stage = state.tour?.stages[state.selectedIndex];
    if (!stage) return;
    const endpoint = el.valhallaEndpoint.value.trim();
    if (!endpoint) {
      toast('Introduce un endpoint Valhalla válido.', 'error');
      return;
    }

    setStageButtonsDisabled(true);
    setRoutingBadge('busy', `Enrutando etapa ${stage.number}`);
    toast(`Consultando carreteras reales para ${stage.routeLabel}…`, 'info');
    try {
      const routed = await StageGenerator.routeStage(stage, endpoint);
      state.tour.stages[state.selectedIndex] = routed;
      renderTour();
      setRoutingBadge('live', 'Ruta OpenStreetMap');
      const delta = Math.abs(routed.distanceDifferencePct || 0);
      toast(`Etapa ${routed.number} enrutada: ${formatNumber(routed.distanceKm, 1)} km y ${formatNumber(routed.ascentM, 0)} m+.${delta > 18 ? ' La distancia difiere del objetivo por los condicionantes viarios.' : ''}`, 'success', 5600);
    } catch (error) {
      console.error(error);
      setRoutingBadge('error', 'Fallo de enrutado');
      toast(`No se pudo enrutar la etapa: ${error.message}. Se conserva la versión incluida.`, 'error', 7000);
    } finally {
      setStageButtonsDisabled(false);
    }
  }

  async function routeAllStages() {
    if (!state.tour || state.routeAllRunning) return;
    const endpoint = el.valhallaEndpoint.value.trim();
    if (!endpoint) {
      toast('Introduce un endpoint Valhalla válido.', 'error');
      return;
    }

    state.routeAllRunning = true;
    el.routeTourBtn.disabled = true;
    el.generateTourBtn.disabled = true;
    el.generateFromPanelBtn.disabled = true;
    let successes = 0;
    let failures = 0;

    for (let index = 0; index < state.tour.stages.length; index++) {
      const stage = state.tour.stages[index];
      setRoutingBadge('busy', `Enrutando ${index + 1}/${state.tour.stages.length}`);
      el.routeTourBtn.textContent = `${index + 1}/${state.tour.stages.length}`;
      try {
        state.tour.stages[index] = await StageGenerator.routeStage(stage, endpoint);
        successes++;
        if (index === state.selectedIndex) renderSelectedStage();
        renderStageListOnly();
      } catch (error) {
        failures++;
        console.warn(`Etapa ${index + 1}:`, error);
      }
      if (index < state.tour.stages.length - 1) await delay(window.APP_CONFIG?.routeRequestDelayMs || 1200);
    }

    state.routeAllRunning = false;
    el.routeTourBtn.disabled = false;
    el.generateTourBtn.disabled = false;
    el.generateFromPanelBtn.disabled = false;
    el.routeTourBtn.textContent = `Enrutar ${state.tour.stages.length} etapas`;
    renderTour();
    setRoutingBadge(failures ? 'demo' : 'live', failures ? `${successes} reales · ${failures} incluidas` : 'Vuelta OpenStreetMap');
    toast(`Enrutado finalizado: ${successes} etapas reales y ${failures} etapas conservadas en modo incluido.`, failures ? 'info' : 'success', 7000);
  }

  function renderStageListOnly() {
    const selected = state.selectedIndex;
    renderTour();
    state.selectedIndex = selected;
  }

  function setStageButtonsDisabled(disabled) {
    el.routeStageBtn.disabled = disabled;
    el.regenerateStageBtn.disabled = disabled;
    el.exportStageBtn.disabled = disabled;
  }

  function delay(ms) { return new Promise((resolve) => setTimeout(resolve, ms)); }

  async function exportTour() {
    if (!state.tour) return;
    el.exportTourBtn.disabled = true;
    el.exportTourBtn.textContent = 'Preparando…';
    try {
      await RouteExport.downloadTourZip(state.tour);
      toast('ZIP generado con GPX, JSON y manifiesto de la vuelta.', 'success');
    } catch (error) {
      toast(`No se pudo crear el ZIP: ${error.message}`, 'error');
    } finally {
      el.exportTourBtn.disabled = false;
      el.exportTourBtn.textContent = 'Exportar ZIP';
    }
  }

  function parseNaturalRequest() {
    const text = el.naturalConditions.value.trim();
    if (!text) {
      toast('Escribe primero los condicionantes.', 'info');
      return;
    }
    const parsed = StageGenerator.parseNaturalConditions(text, readConfig());
    writeConfig(parsed);
    toast('Condicionantes interpretados y trasladados al formulario.', 'success');
  }

  function resetConfig() {
    writeConfig(DEFAULT_CONFIG);
    el.naturalConditions.value = '';
    el.autoRouteNewStages.checked = false;
    el.valhallaEndpoint.value = window.APP_CONFIG?.valhallaEndpoint || 'https://valhalla1.openstreetmap.de/route';
    savePreferences();
    toast('Configuración restablecida.', 'info');
  }

  function bindEvents() {
    el.generateTourBtn.addEventListener('click', () => generateTour());
    el.generateFromPanelBtn.addEventListener('click', () => generateTour());
    el.routeTourBtn.addEventListener('click', routeAllStages);
    el.exportTourBtn.addEventListener('click', exportTour);
    el.routeStageBtn.addEventListener('click', routeSelectedStage);
    el.regenerateStageBtn.addEventListener('click', regenerateSelectedStage);
    el.exportStageBtn.addEventListener('click', () => {
      const stage = state.tour?.stages[state.selectedIndex];
      if (stage) RouteExport.downloadStageGPX(stage);
    });
    el.applyNaturalBtn.addEventListener('click', parseNaturalRequest);
    el.resetConfigBtn.addEventListener('click', resetConfig);
    el.view3dBtn.addEventListener('click', () => {
      el.view3dBtn.classList.add('active');
      el.viewTopBtn.classList.remove('active');
      Map3DView.setPerspective('3d');
    });
    el.viewTopBtn.addEventListener('click', () => {
      el.viewTopBtn.classList.add('active');
      el.view3dBtn.classList.remove('active');
      Map3DView.setPerspective('top');
    });
    el.terrainExaggeration.addEventListener('input', (event) => Map3DView.setTerrainExaggeration(event.target.value));
    el.playRouteBtn.addEventListener('click', () => Map3DView.animateRoute());
    el.valhallaEndpoint.addEventListener('change', savePreferences);
  }

  function escapeHtml(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function boot() {
    cacheElements();
    restorePreferences();
    ProfileView.init('profileChart', (point) => Map3DView.highlightPoint(point));
    Map3DView.init('map', 'mapMessage', (running) => {
      el.playRouteBtn.textContent = running ? '■ Detener' : '▶ Recorrer';
    });
    bindEvents();
    generateTour(readConfig());
  }

  document.addEventListener('DOMContentLoaded', boot);
})();

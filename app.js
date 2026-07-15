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
    regenerateCounter: 0,
    process: {
      id: 0,
      running: false,
      cancelRequested: false,
      startedAt: 0,
      elapsedTimer: null,
      autoHideTimer: null,
      logs: []
    }
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
      'resetConfigBtn', 'valhallaEndpoint', 'autoRouteNewStages', 'toastContainer',
      'processPanel', 'processIcon', 'processTitle', 'processDetail', 'processPercent', 'processBar',
      'processCounter', 'processElapsed', 'processLog', 'cancelProcessBtn', 'closeProcessBtn'
    ].forEach((id) => { el[id] = document.getElementById(id); });
  }

  function assertElements() {
    const missing = Object.entries(el).filter(([, value]) => !value).map(([key]) => key);
    if (missing.length) throw new Error(`Faltan elementos HTML: ${missing.join(', ')}`);
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
    } catch (_) { /* localStorage is optional. */ }
  }

  function restorePreferences() {
    try {
      const saved = JSON.parse(localStorage.getItem('grand-tour-stage-lab-config') || 'null');
      if (saved) writeConfig({ ...DEFAULT_CONFIG, ...saved });
      else writeConfig(DEFAULT_CONFIG);
      const endpoint = localStorage.getItem('grand-tour-stage-lab-endpoint');
      el.valhallaEndpoint.value = endpoint || window.APP_CONFIG?.valhallaEndpoint || el.valhallaEndpoint.value;
    } catch (_) {
      writeConfig(DEFAULT_CONFIG);
    }
    // Deliberately never auto-enable network routing from stored state.
    // Local generation remains the safe, immediate default.
    el.autoRouteNewStages.checked = false;
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

  function elapsedText(ms) {
    return `${(Math.max(0, ms) / 1000).toLocaleString('es-ES', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;
  }

  function beginProcess(title, detail, options = {}) {
    state.process.id += 1;
    state.process.running = true;
    state.process.cancelRequested = false;
    state.process.startedAt = performance.now();
    state.process.logs = [];
    clearInterval(state.process.elapsedTimer);
    clearTimeout(state.process.autoHideTimer);

    el.processPanel.classList.remove('hidden', 'process-success', 'process-error');
    el.processPanel.classList.add('process-running');
    el.processIcon.textContent = options.icon || '⚙';
    el.processTitle.textContent = title;
    el.processDetail.textContent = detail || '';
    el.processPercent.textContent = '0 %';
    el.processBar.style.width = '0%';
    el.processBar.parentElement.setAttribute('aria-valuenow', '0');
    el.processCounter.textContent = options.counter || 'Preparando…';
    el.processElapsed.textContent = '0,0 s';
    el.processLog.innerHTML = '';
    el.cancelProcessBtn.classList.toggle('hidden', !options.cancellable);
    el.cancelProcessBtn.disabled = false;
    el.cancelProcessBtn.textContent = 'Cancelar';
    el.closeProcessBtn.classList.add('hidden');

    const processId = state.process.id;
    state.process.elapsedTimer = setInterval(() => {
      if (!state.process.running || state.process.id !== processId) return;
      el.processElapsed.textContent = elapsedText(performance.now() - state.process.startedAt);
    }, 100);
    return processId;
  }

  function updateProcess(percent, detail, counter, logLine) {
    if (!state.process.running) return;
    const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
    el.processPercent.textContent = `${Math.round(normalized)} %`;
    el.processBar.style.width = `${normalized}%`;
    el.processBar.parentElement.setAttribute('aria-valuenow', String(Math.round(normalized)));
    if (detail) el.processDetail.textContent = detail;
    if (counter) el.processCounter.textContent = counter;
    if (logLine) appendProcessLog(logLine);
  }

  function appendProcessLog(line) {
    if (!line || state.process.logs[state.process.logs.length - 1] === line) return;
    state.process.logs.push(line);
    if (state.process.logs.length > 7) state.process.logs.shift();
    el.processLog.innerHTML = state.process.logs.map((item) => `<div class="process-log-line">${escapeHtml(item)}</div>`).join('');
    el.processLog.scrollTop = el.processLog.scrollHeight;
  }

  function finishProcess(success, title, detail, options = {}) {
    state.process.running = false;
    clearInterval(state.process.elapsedTimer);
    el.processPanel.classList.remove('process-running');
    el.processPanel.classList.add(success ? 'process-success' : 'process-error');
    el.processIcon.textContent = success ? '✓' : '!';
    el.processTitle.textContent = title;
    el.processDetail.textContent = detail || '';
    if (success) {
      el.processPercent.textContent = '100 %';
      el.processBar.style.width = '100%';
      el.processBar.parentElement.setAttribute('aria-valuenow', '100');
    }
    el.processElapsed.textContent = elapsedText(performance.now() - state.process.startedAt);
    el.cancelProcessBtn.classList.add('hidden');
    el.closeProcessBtn.classList.remove('hidden');
    if (options.counter) el.processCounter.textContent = options.counter;
    if (options.logLine) appendProcessLog(options.logLine);
    if (success && options.autoHide !== false) {
      state.process.autoHideTimer = setTimeout(() => el.processPanel.classList.add('hidden'), options.autoHideMs || 4500);
    }
  }

  function requestCancel() {
    if (!state.process.running) return;
    state.process.cancelRequested = true;
    el.cancelProcessBtn.disabled = true;
    el.cancelProcessBtn.textContent = 'Cancelando…';
    el.processDetail.textContent = 'Cancelación solicitada. El proceso se detendrá al terminar la operación actual.';
    appendProcessLog('Cancelación solicitada por el usuario.');
  }

  function closeProcess() {
    if (!state.process.running) el.processPanel.classList.add('hidden');
  }

  function stageDifficultyLabel(stage) {
    return window.CYCLING_CATALOG.stageTypes[stage.type]?.short || stage.type.toUpperCase();
  }

  function renderTour() {
    const tour = state.tour;
    if (!tour) return;
    const stats = window.StageGenerator.tourStats(tour);
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
      metric(stage.routeStatus === 'real' ? 'OSM real' : 'Local', 'Geometría')
    ].join('');
    el.routeStageBtn.textContent = stage.routeStatus === 'real' ? 'Recalcular ruta' : 'Carreteras reales';
    try { window.ProfileView?.render(stage); } catch (error) { console.warn('Perfil no disponible', error); }
    try { window.Map3DView?.render(stage); } catch (error) { console.warn('Visor 3D no disponible', error); }
  }

  function selectStage(index) {
    state.selectedIndex = window.StageGenerator.clamp(index, 0, state.tour.stages.length - 1);
    renderTour();
  }

  function setMainGenerationButtons(disabled) {
    el.generateTourBtn.disabled = disabled;
    el.generateFromPanelBtn.disabled = disabled;
  }

  async function generateTour(configOverride) {
    if (state.routeAllRunning || state.process.running) {
      toast('Ya hay un proceso activo. Espera a que termine o cancélalo.', 'info');
      return;
    }
    const config = configOverride || readConfig();
    savePreferences();
    setMainGenerationButtons(true);
    el.routeTourBtn.disabled = true;
    el.exportTourBtn.disabled = true;
    setRoutingBadge('busy', 'Generando localmente');
    beginProcess(
      `Generando ${Number(config.stageCount) || 21} etapas`,
      'El cálculo se realiza en este navegador, sin API, cuenta ni pago.',
      { cancellable: true, icon: '⚙', counter: 'Planificando calendario…' }
    );

    try {
      state.selectedIndex = 0;
      state.regenerateCounter = 0;
      const tour = await window.StageGenerator.generateTourAsync(
        config,
        (progress) => {
          const counter = progress.total ? `${progress.completed || 0}/${progress.total} etapas` : 'Planificando…';
          updateProcess(progress.percent, progress.detail, counter, progress.phase === 'stage-complete' ? progress.detail : null);
        },
        () => state.process.cancelRequested
      );
      state.tour = tour;
      updateProcess(97, 'Renderizando libro de ruta, perfil y vista 3D…', `${tour.stages.length}/${tour.stages.length} etapas`);
      await delay(20);
      renderTour();
      setRoutingBadge('demo', 'GPX local listo');
      finishProcess(true, 'Vuelta generada', `${tour.stages.length} etapas listas para visualizar y exportar en GPX.`, {
        counter: `${tour.stages.length} etapas · semilla ${tour.config.seed}`,
        logLine: 'Generación local completada sin llamadas externas.'
      });
      toast(`Vuelta generada: ${tour.stages.length} etapas y semilla ${tour.config.seed}.`, 'success');

      if (el.autoRouteNewStages.checked) {
        await delay(550);
        await routeAllStages();
      }
    } catch (error) {
      const cancelled = /cancelada/i.test(error.message);
      console.error('[Grand Tour Stage Lab] Error al generar la vuelta', error);
      setRoutingBadge(cancelled ? 'demo' : 'error', cancelled ? 'Generación cancelada' : 'Error de generación');
      finishProcess(false, cancelled ? 'Generación cancelada' : 'Error al generar', error.message, { autoHide: false });
      toast(cancelled ? 'Generación cancelada.' : `No se pudo generar la vuelta: ${error.message}`, cancelled ? 'info' : 'error', 7000);
    } finally {
      setMainGenerationButtons(false);
      el.routeTourBtn.disabled = !state.tour;
      el.exportTourBtn.disabled = !state.tour;
    }
  }

  async function regenerateSelectedStage() {
    if (!state.tour || state.process.running) return;
    const previous = state.tour.stages[state.selectedIndex];
    beginProcess(`Regenerando etapa ${previous.number}`, `Buscando otra combinación para ${previous.routeLabel}…`, { icon: '↻', counter: '0/1 etapas' });
    setStageButtonsDisabled(true);
    try {
      updateProcess(12, 'Preparando una nueva semilla y región compatible…', '0/1 etapas');
      await delay(30);
      state.regenerateCounter++;
      const replacement = window.StageGenerator.regenerateStage(state.tour, state.selectedIndex, state.regenerateCounter);
      updateProcess(82, `Nueva etapa calculada: ${replacement.routeLabel}.`, '1/1 etapas', `${replacement.distanceKm.toFixed(1)} km · ${Math.round(replacement.ascentM)} m+`);
      await delay(30);
      state.tour.stages[state.selectedIndex] = replacement;
      renderTour();
      setRoutingBadge('demo', 'Etapa local regenerada');
      finishProcess(true, 'Etapa regenerada', `${replacement.routeLabel} está lista.`, { counter: '1/1 etapas' });
      toast(`${replacement.title} regenerada en ${replacement.regionName}.`, 'success');
    } catch (error) {
      finishProcess(false, 'Error al regenerar', error.message, { autoHide: false });
      toast(`No se pudo regenerar la etapa: ${error.message}`, 'error');
    } finally {
      setStageButtonsDisabled(false);
    }
  }

  async function routeSelectedStage() {
    const stage = state.tour?.stages[state.selectedIndex];
    if (!stage || state.process.running) return;
    const endpoint = el.valhallaEndpoint.value.trim();
    if (!endpoint) {
      toast('Introduce un endpoint Valhalla válido.', 'error');
      return;
    }

    setStageButtonsDisabled(true);
    setRoutingBadge('busy', `Enrutando etapa ${stage.number}`);
    beginProcess(`Carreteras reales · etapa ${stage.number}`, 'Conectando con el servidor público Valhalla/OpenStreetMap…', {
      icon: '↗',
      counter: '1 solicitud externa'
    });
    updateProcess(12, 'Preparando puntos de paso y perfil de bicicleta de carretera…', 'Fase 1/3');
    await delay(30);
    updateProcess(24, 'Solicitud enviada. La barra permanecerá visible mientras responde el servidor.', 'Fase 2/3', `Endpoint: ${endpoint}`);

    try {
      const routed = await window.StageGenerator.routeStage(stage, endpoint);
      updateProcess(86, 'Ruta recibida. Calculando elevación, pendientes y puertos…', 'Fase 3/3');
      state.tour.stages[state.selectedIndex] = routed;
      await delay(20);
      renderTour();
      setRoutingBadge('live', 'Ruta OpenStreetMap');
      const delta = Math.abs(routed.distanceDifferencePct || 0);
      finishProcess(true, 'Etapa enrutada por carreteras reales', `${routed.routeLabel}: ${formatNumber(routed.distanceKm, 1)} km y ${formatNumber(routed.ascentM, 0)} m+.`, { counter: '1/1 etapas' });
      toast(`Etapa ${routed.number} enrutada.${delta > 18 ? ' La distancia difiere del objetivo por la red viaria.' : ''}`, 'success', 5600);
    } catch (error) {
      console.error(error);
      setRoutingBadge('error', 'Servidor real no disponible');
      finishProcess(false, 'No se pudo obtener la carretera real', `${error.message}. La etapa local sigue intacta y puede exportarse en GPX.`, { autoHide: false });
      toast(`No se pudo enrutar la etapa: ${error.message}. Se conserva la versión local.`, 'error', 8000);
    } finally {
      setStageButtonsDisabled(false);
    }
  }

  async function routeAllStages() {
    if (!state.tour || state.routeAllRunning || state.process.running) return;
    const endpoint = el.valhallaEndpoint.value.trim();
    if (!endpoint) {
      toast('Introduce un endpoint Valhalla válido.', 'error');
      return;
    }

    state.routeAllRunning = true;
    el.routeTourBtn.disabled = true;
    setMainGenerationButtons(true);
    el.exportTourBtn.disabled = true;
    let successes = 0;
    let failures = 0;
    let consecutiveNetworkFailures = 0;
    const total = state.tour.stages.length;

    beginProcess(`Enrutando ${total} etapas reales`, 'Cada etapa requiere una petición externa. No se cobra ni se necesita clave, pero el servidor público puede limitar el uso.', {
      cancellable: true,
      icon: '↗',
      counter: `0/${total} etapas`
    });

    for (let index = 0; index < total; index++) {
      if (state.process.cancelRequested) break;
      const stage = state.tour.stages[index];
      const base = (index / Math.max(1, total)) * 100;
      updateProcess(base, `Etapa ${index + 1}/${total}: consultando carreteras para ${stage.routeLabel}…`, `${index}/${total} etapas`, `Inicio etapa ${index + 1}: ${stage.routeLabel}`);
      setRoutingBadge('busy', `Enrutando ${index + 1}/${total}`);
      el.routeTourBtn.textContent = `${index + 1}/${total}`;
      try {
        state.tour.stages[index] = await window.StageGenerator.routeStage(stage, endpoint);
        successes++;
        consecutiveNetworkFailures = 0;
        updateProcess(((index + 1) / total) * 100, `Etapa ${index + 1} completada por OpenStreetMap.`, `${index + 1}/${total} etapas`, `✓ ${state.tour.stages[index].routeLabel}`);
        if (index === state.selectedIndex) renderSelectedStage();
        renderStageListOnly();
      } catch (error) {
        failures++;
        consecutiveNetworkFailures++;
        console.warn(`Etapa ${index + 1}:`, error);
        updateProcess(((index + 1) / total) * 100, `Etapa ${index + 1} no disponible; se conserva el GPX local.`, `${index + 1}/${total} etapas`, `✕ ${stage.routeLabel}: ${error.message}`);
        if (consecutiveNetworkFailures >= 3) {
          appendProcessLog('Tres fallos consecutivos: se detiene para no repetir solicitudes inútiles.');
          break;
        }
      }
      if (index < total - 1 && !state.process.cancelRequested) {
        const waitMs = Math.max(1100, window.APP_CONFIG?.routeRequestDelayMs || 1200);
        await delay(waitMs);
      }
    }

    const cancelled = state.process.cancelRequested;
    state.routeAllRunning = false;
    el.routeTourBtn.disabled = false;
    setMainGenerationButtons(false);
    el.exportTourBtn.disabled = false;
    el.routeTourBtn.textContent = `Enrutar ${state.tour.stages.length} etapas`;
    renderTour();

    const attempted = successes + failures;
    if (cancelled) {
      setRoutingBadge('demo', `${successes} reales · cancelado`);
      finishProcess(false, 'Enrutado cancelado', `${successes} etapas reales; las demás permanecen en modo local.`, { counter: `${attempted}/${total} intentadas`, autoHide: false });
      toast('Enrutado cancelado. No se ha perdido ninguna etapa local.', 'info', 6500);
    } else if (successes === 0 && failures > 0) {
      setRoutingBadge('error', 'Servidor externo sin respuesta');
      finishProcess(false, 'Servidor externo no disponible', `No se pudo enrutar ninguna etapa. Las ${total} etapas locales siguen listas para GPX.`, { counter: `${attempted}/${total} intentadas`, autoHide: false });
      toast('El servidor público no está disponible desde tu navegador. La generación y exportación local siguen funcionando.', 'error', 9000);
    } else {
      setRoutingBadge(failures ? 'demo' : 'live', failures ? `${successes} reales · ${failures} locales` : 'Vuelta OpenStreetMap');
      finishProcess(true, 'Enrutado finalizado', `${successes} etapas reales y ${total - successes} etapas locales.`, { counter: `${attempted}/${total} intentadas`, autoHideMs: 6500 });
      toast(`Enrutado finalizado: ${successes} etapas reales y ${total - successes} locales.`, failures ? 'info' : 'success', 7000);
    }
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
    if (!state.tour || state.process.running) return;
    el.exportTourBtn.disabled = true;
    beginProcess('Exportando vuelta completa', 'Generando un GPX y un JSON por etapa; todo se procesa localmente.', { icon: '⇩', counter: `0/${state.tour.stages.length} etapas` });
    try {
      await window.RouteExport.downloadTourZip(state.tour, (progress) => {
        const counter = progress.total ? `${progress.completed || 0}/${progress.total} etapas` : progress.phase === 'compress' ? 'Comprimiendo archivos' : 'Preparando descarga';
        updateProcess(progress.percent, progress.detail, counter, progress.phase === 'files' ? progress.detail : null);
      });
      finishProcess(true, 'ZIP exportado', 'GPX, JSON y manifiesto generados sin enviar tus rutas a ningún servicio.', { counter: `${state.tour.stages.length} GPX listos` });
      toast('ZIP generado con GPX, JSON y manifiesto de la vuelta.', 'success');
    } catch (error) {
      finishProcess(false, 'Error al exportar', error.message, { autoHide: false });
      toast(`No se pudo crear el ZIP: ${error.message}`, 'error');
    } finally {
      el.exportTourBtn.disabled = false;
    }
  }

  async function exportSelectedStage() {
    const stage = state.tour?.stages[state.selectedIndex];
    if (!stage || state.process.running) return;
    beginProcess(`Exportando etapa ${stage.number}`, 'Construyendo el archivo GPX 1.1 localmente…', { icon: '⇩', counter: '0/1 archivos' });
    try {
      updateProcess(28, 'Serializando coordenadas, elevación y pendientes…', '0/1 archivos');
      await delay(20);
      window.RouteExport.downloadStageGPX(stage);
      updateProcess(100, 'Descarga preparada.', '1/1 archivos', `${stage.routeLabel}.gpx`);
      finishProcess(true, 'GPX exportado', `${stage.routeLabel} se ha descargado.`, { counter: '1/1 archivos' });
    } catch (error) {
      finishProcess(false, 'Error al exportar GPX', error.message, { autoHide: false });
    }
  }

  function parseNaturalRequest() {
    const text = el.naturalConditions.value.trim();
    if (!text) {
      toast('Escribe primero los condicionantes.', 'info');
      return;
    }
    const parsed = window.StageGenerator.parseNaturalConditions(text, readConfig());
    writeConfig(parsed);
    toast('Condicionantes interpretados y trasladados al formulario.', 'success');
  }

  function resetConfig() {
    writeConfig(DEFAULT_CONFIG);
    el.naturalConditions.value = '';
    el.autoRouteNewStages.checked = false;
    el.valhallaEndpoint.value = window.APP_CONFIG?.valhallaEndpoint || 'https://valhalla1.openstreetmap.de/route';
    savePreferences();
    toast('Configuración restablecida. El enrutado automático queda desactivado.', 'info');
  }

  function bindEvents() {
    el.generateTourBtn.addEventListener('click', () => generateTour());
    el.generateFromPanelBtn.addEventListener('click', () => generateTour());
    el.routeTourBtn.addEventListener('click', routeAllStages);
    el.exportTourBtn.addEventListener('click', exportTour);
    el.routeStageBtn.addEventListener('click', routeSelectedStage);
    el.regenerateStageBtn.addEventListener('click', regenerateSelectedStage);
    el.exportStageBtn.addEventListener('click', exportSelectedStage);
    el.applyNaturalBtn.addEventListener('click', parseNaturalRequest);
    el.resetConfigBtn.addEventListener('click', resetConfig);
    el.cancelProcessBtn.addEventListener('click', requestCancel);
    el.closeProcessBtn.addEventListener('click', closeProcess);
    el.view3dBtn.addEventListener('click', () => {
      el.view3dBtn.classList.add('active');
      el.viewTopBtn.classList.remove('active');
      window.Map3DView.setPerspective('3d');
    });
    el.viewTopBtn.addEventListener('click', () => {
      el.viewTopBtn.classList.add('active');
      el.view3dBtn.classList.remove('active');
      window.Map3DView.setPerspective('top');
    });
    el.terrainExaggeration.addEventListener('input', (event) => window.Map3DView.setTerrainExaggeration(event.target.value));
    el.playRouteBtn.addEventListener('click', () => window.Map3DView.animateRoute());
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

  function initOptionalViews() {
    try {
      window.Map3DView?.init('map', 'mapMessage', (running) => {
        el.playRouteBtn.textContent = running ? '■ Detener' : '▶ Recorrer';
      });
    } catch (error) {
      console.warn('[Grand Tour Stage Lab] El visor 3D ha arrancado en modo degradado.', error);
    }
    try {
      window.ProfileView?.init('profileChart', (point) => window.Map3DView?.highlightPoint(point));
    } catch (error) {
      console.warn('[Grand Tour Stage Lab] El perfil ha arrancado en modo degradado.', error);
    }
  }

  function loadOptionalVendors() {
    window.addEventListener('gt-vendor-maplibre', (event) => {
      if (event.detail?.status === 'ready') {
        const upgraded = window.Map3DView?.upgrade?.();
        if (upgraded && state.tour) window.Map3DView.render(state.tour.stages[state.selectedIndex]);
      }
    });
    window.addEventListener('gt-vendor-echarts', (event) => {
      if (event.detail?.status === 'ready') {
        const upgraded = window.ProfileView?.upgrade?.();
        if (upgraded && state.tour) window.ProfileView.render(state.tour.stages[state.selectedIndex]);
      }
    });
    const vendorPromise = window.VendorLoader?.loadAll?.();
    if (vendorPromise && typeof vendorPromise.then === 'function') {
      vendorPromise.then((result) => {
        if (result?.maplibre === 'fallback' || result?.echarts === 'fallback') {
          console.info('[Grand Tour Stage Lab] Se mantienen los visores locales porque uno o más CDN no están disponibles.');
        }
      }).catch((error) => console.warn('Carga opcional de librerías', error));
    }
  }

  function enableCoreButtons() {
    el.generateTourBtn.disabled = false;
    el.generateFromPanelBtn.disabled = false;
    el.routeTourBtn.disabled = true;
    el.exportTourBtn.disabled = true;
  }

  async function boot() {
    try {
      cacheElements();
      assertElements();
      restorePreferences();
      bindEvents();
      initOptionalViews();

      if (!window.StageGenerator || !window.CYCLING_CATALOG || !window.RouteExport) {
        throw new Error('El núcleo JavaScript no se ha cargado. Usa el index.html autónomo incluido en el ZIP v1.2.');
      }

      enableCoreButtons();
      setRoutingBadge('busy', 'Motor local listo');
      updateProcess(5, 'Motor autónomo cargado. Iniciando la vuelta de ejemplo…', 'Núcleo verificado');
      await delay(50);
      state.process.running = false;
      clearInterval(state.process.elapsedTimer);
      el.processPanel.classList.add('hidden');

      await generateTour(readConfig());
      loadOptionalVendors();
      window.GT_STAGE_LAB = { state, generateTour, version: window.APP_CONFIG?.version || '1.2.0' };
    } catch (error) {
      console.error('[Grand Tour Stage Lab] Fallo de arranque', error);
      try {
        setRoutingBadge('error', 'Fallo de arranque');
        finishProcess(false, 'La aplicación no pudo arrancar', `${error.message}. Vuelve a subir el index.html autónomo de esta versión.`, { autoHide: false });
      } catch (_) { /* The DOM may be incomplete. */ }
    }
  }

  window.addEventListener('unhandledrejection', (event) => {
    console.error('[Grand Tour Stage Lab] Promesa no controlada', event.reason);
    if (el.processPanel && !state.process.running) {
      beginProcess('Error JavaScript detectado', 'Se ha capturado un error no controlado.', { icon: '!' });
      finishProcess(false, 'Error JavaScript detectado', String(event.reason?.message || event.reason || 'Error desconocido'), { autoHide: false });
    }
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, { once: true });
  else boot();
})();

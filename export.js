(function () {
  'use strict';

  function xmlEscape(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  function slugify(value) {
    return String(value || 'route')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80);
  }

  function stageToGPX(stage) {
    const points = stage.points || [];
    const metadata = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="Grand Tour Stage Lab"',
      ' xmlns="http://www.topografix.com/GPX/1/1"',
      ' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"',
      ' xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
      '  <metadata>',
      `    <name>${xmlEscape(stage.title)} — ${xmlEscape(stage.routeLabel)}</name>`,
      `    <desc>${xmlEscape(`${stage.typeLabel}; ${stage.country}; ${stage.regionName}; ${stage.distanceKm.toFixed(1)} km; ${Math.round(stage.ascentM)} m+`)}</desc>`,
      '  </metadata>'
    ];

    const waypoints = [];
    if (points.length) {
      waypoints.push(`  <wpt lat="${points[0].lat.toFixed(7)}" lon="${points[0].lon.toFixed(7)}"><ele>${points[0].ele.toFixed(1)}</ele><name>${xmlEscape(stage.startName)}</name><type>Start</type></wpt>`);
      waypoints.push(`  <wpt lat="${points[points.length - 1].lat.toFixed(7)}" lon="${points[points.length - 1].lon.toFixed(7)}"><ele>${points[points.length - 1].ele.toFixed(1)}</ele><name>${xmlEscape(stage.finishName)}</name><type>Finish</type></wpt>`);
    }
    (stage.climbs || []).forEach((climb) => {
      const point = points[climb.endIndex] || points[0];
      if (!point) return;
      waypoints.push(`  <wpt lat="${point.lat.toFixed(7)}" lon="${point.lon.toFixed(7)}"><ele>${point.ele.toFixed(1)}</ele><name>${xmlEscape(`${climb.name} Cat. ${climb.category}`)}</name><type>Summit</type></wpt>`);
    });

    const track = [
      '  <trk>',
      `    <name>${xmlEscape(stage.title)} — ${xmlEscape(stage.routeLabel)}</name>`,
      '    <type>Cycling</type>',
      '    <trkseg>',
      ...points.map((point) => `      <trkpt lat="${point.lat.toFixed(7)}" lon="${point.lon.toFixed(7)}"><ele>${point.ele.toFixed(1)}</ele><extensions><distance_km>${point.distanceKm.toFixed(3)}</distance_km><grade_pct>${point.grade.toFixed(2)}</grade_pct></extensions></trkpt>`),
      '    </trkseg>',
      '  </trk>',
      '</gpx>'
    ];

    return [...metadata, ...waypoints, ...track].join('\n');
  }

  function stageToJSON(stage) {
    return JSON.stringify({
      schema: 'grand-tour-stage-lab/v1',
      id: stage.id,
      number: stage.number,
      title: stage.title,
      routeLabel: stage.routeLabel,
      country: stage.country,
      region: stage.regionName,
      type: stage.type,
      source: stage.source,
      seed: stage.seed,
      distanceKm: stage.distanceKm,
      ascentM: stage.ascentM,
      descentM: stage.descentM,
      summitFinish: stage.summitFinish,
      waypoints: stage.waypoints,
      climbs: stage.climbs,
      sprint: stage.sprint,
      route: stage.points.map((point) => ({
        lat: point.lat,
        lon: point.lon,
        elevationM: point.ele,
        distanceKm: point.distanceKm,
        gradePct: point.grade
      }))
    }, null, 2);
  }

  function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  }

  function downloadStageGPX(stage) {
    const filename = `${String(stage.number).padStart(2, '0')}-${slugify(stage.routeLabel)}.gpx`;
    downloadBlob(new Blob([stageToGPX(stage)], { type: 'application/gpx+xml;charset=utf-8' }), filename);
  }

  async function downloadTourZip(tour) {
    if (!window.JSZip) throw new Error('JSZip no está disponible. Comprueba que has subido la carpeta /vendor completa.');
    const zip = new JSZip();
    const root = zip.folder(slugify(tour.title));
    const gpxFolder = root.folder('gpx');
    const jsonFolder = root.folder('json');

    tour.stages.forEach((stage) => {
      const baseName = `${String(stage.number).padStart(2, '0')}-${slugify(stage.routeLabel)}`;
      gpxFolder.file(`${baseName}.gpx`, stageToGPX(stage));
      jsonFolder.file(`${baseName}.json`, stageToJSON(stage));
    });

    root.file('tour-manifest.json', JSON.stringify({
      schema: 'grand-tour-stage-lab/tour-v1',
      id: tour.id,
      title: tour.title,
      createdAt: tour.createdAt,
      config: tour.config,
      stages: tour.stages.map((stage) => ({
        number: stage.number,
        id: stage.id,
        route: stage.routeLabel,
        country: stage.country,
        region: stage.regionName,
        type: stage.type,
        source: stage.source,
        distanceKm: stage.distanceKm,
        ascentM: stage.ascentM,
        file: `gpx/${String(stage.number).padStart(2, '0')}-${slugify(stage.routeLabel)}.gpx`
      }))
    }, null, 2));

    root.file('README.txt', [
      tour.title,
      '',
      'Contenido:',
      '- /gpx: tracks GPX 1.1 importables en aplicaciones cartográficas.',
      '- /json: datos enriquecidos con distancia, elevación, pendiente y puertos.',
      '- tour-manifest.json: índice completo de la vuelta.',
      '',
      'Fuente cartográfica del modo real: OpenStreetMap contributors mediante Valhalla.',
      'Generado con Grand Tour Stage Lab.'
    ].join('\n'));

    const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
    downloadBlob(blob, `${slugify(tour.title)}-${tour.config.seed}.zip`);
  }

  window.RouteExport = { stageToGPX, stageToJSON, downloadStageGPX, downloadTourZip, slugify };
})();

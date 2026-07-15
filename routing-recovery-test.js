'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

global.window = global;
global.APP_CONFIG = {
  routeRequestTimeoutMs: 1000,
  elevationIntervalM: 30,
  valhallaClientId: 'grand-tour-stage-lab-test'
};

require(path.join(__dirname, 'catalog.js'));
require(path.join(__dirname, 'generator.js'));

function encodePolyline6(points) {
  let lastLat = 0;
  let lastLon = 0;
  let encoded = '';
  const encodeValue = (value) => {
    let v = value < 0 ? ~(value << 1) : value << 1;
    while (v >= 0x20) {
      encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
      v >>= 5;
    }
    encoded += String.fromCharCode(v + 63);
  };
  for (const point of points) {
    const lat = Math.round(point.lat * 1e6);
    const lon = Math.round(point.lon * 1e6);
    encodeValue(lat - lastLat);
    encodeValue(lon - lastLon);
    lastLat = lat;
    lastLon = lon;
  }
  return encoded;
}

function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async json() { return body; },
    clone() { return this; },
    async text() { return JSON.stringify(body); }
  };
}

(async () => {
  const tour = StageGenerator.generateTour({
    mode: 'spain', stageCount: 3, seed: 24680, totalDistance: 450,
    flatCount: 1, rollingCount: 1, mediumCount: 0, highCount: 1,
    ittCount: 0, summitCount: 1, maxStageDistance: 190
  });
  const stage = tour.stages[0];
  assert.ok(stage.waypoints.length >= 2);

  let calls = 0;
  global.fetch = async () => {
    calls++;
    if (calls <= 2) return jsonResponse({ error: 'No suitable edges near one waypoint' });
    const first = stage.waypoints[0];
    const last = stage.waypoints[stage.waypoints.length - 1];
    const points = [
      { lat: first.lat, lon: first.lon },
      { lat: (first.lat + last.lat) / 2 + 0.02, lon: (first.lon + last.lon) / 2 + 0.03 },
      { lat: last.lat, lon: last.lon }
    ];
    return jsonResponse({
      trip: {
        summary: { length: 120, has_ferry: false },
        legs: [{
          shape: encodePolyline6(points),
          elevation: [100, 180, 260, 220, 160, 140],
          elevation_interval: 30
        }]
      }
    });
  };

  const attempts = [];
  const routed = await StageGenerator.routeStage(stage, 'https://example.test/route', {
    onAttempt: (info) => attempts.push(info.label)
  });

  assert.equal(routed.routeStatus, 'real');
  assert.equal(routed.source, 'valhalla');
  assert.ok(routed.points.length >= 2);
  assert.ok(calls >= 3, 'No se probaron estrategias adaptativas');
  assert.ok(attempts.length >= 3, 'No se notificaron los reintentos por estrategia');
  assert.notEqual(routed.routingMode, 'precisa', 'La prueba debía recuperar la etapa con una estrategia alternativa');

  console.log('✓ El enrutado adaptativo reduce/ancla waypoints y recupera una etapa rechazada inicialmente.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
global.window = global;
require(path.join(root, 'config.js'));
require(path.join(root, 'js', 'catalog.js'));
require(path.join(root, 'js', 'generator.js'));
require(path.join(root, 'js', 'export.js'));

function validateTour(config) {
  const tour = StageGenerator.generateTour(config);
  assert.equal(tour.stages.length, config.stageCount, 'Número de etapas incorrecto');
  assert.ok(tour.stages.every((stage) => stage.points.length > 20), 'Alguna etapa no contiene suficientes puntos');
  assert.ok(tour.stages.every((stage) => Number.isFinite(stage.distanceKm) && stage.distanceKm > 0), 'Distancia inválida');
  assert.ok(tour.stages.every((stage) => Number.isFinite(stage.ascentM) && stage.ascentM >= 0), 'Desnivel inválido');
  assert.ok(tour.stages.every((stage) => stage.points.every((point) => [point.lat, point.lon, point.ele, point.distanceKm, point.grade].every(Number.isFinite))), 'Track con valores no finitos');
  assert.ok(tour.stages.every((stage) => stage.distanceKm <= config.maxStageDistance + 0.01 || stage.type === 'itt'), 'Etapa por encima del máximo configurado');

  const gpx = RouteExport.stageToGPX(tour.stages[0]);
  assert.match(gpx, /<gpx version="1\.1"/);
  assert.match(gpx, /<trkpt lat=/);
  assert.match(gpx, /<ele>/);
  return tour;
}

const base = {
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

for (const mode of ['europe', 'france', 'spain', 'italy']) {
  for (const seed of [1, 42, 20260714]) validateTour({ ...base, mode, seed });
}

const parsed = StageGenerator.parseNaturalConditions(
  '18 etapas en España, 6 llanas, 4 de alta montaña, 2 CRI, 3 finales en alto, máximo 205 km y 2900 km totales, semilla 9876',
  { ...base, mode: 'europe' }
);
assert.equal(parsed.mode, 'spain');
assert.equal(parsed.stageCount, 18);
assert.equal(parsed.flatCount, 6);
assert.equal(parsed.highCount, 4);
assert.equal(parsed.ittCount, 2);
assert.equal(parsed.summitCount, 3);
assert.equal(parsed.maxStageDistance, 205);
assert.equal(parsed.totalDistance, 2900);
assert.equal(parsed.seed, 9876);
validateTour(parsed);

console.log('✓ Smoke tests superados: generación, condicionantes y GPX.');

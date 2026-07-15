'use strict';

const assert = require('node:assert/strict');
const path = require('node:path');

const elements = new Map();
function classList() { return { add() {}, remove() {}, contains() { return false; } }; }
function canvasContext() {
  const gradient = { addColorStop() {} };
  return new Proxy({ createLinearGradient: () => gradient, measureText: () => ({ width: 20 }) }, {
    get(target, prop) {
      if (prop in target) return target[prop];
      if (typeof prop === 'symbol') return undefined;
      return () => {};
    },
    set(target, prop, value) { target[prop] = value; return true; }
  });
}
function makeElement(tag = 'div') {
  return {
    tagName: tag.toUpperCase(),
    className: '', textContent: '', style: {}, dataset: {}, classList: classList(), isConnected: true,
    children: [],
    appendChild(child) { this.children.push(child); child.isConnected = true; return child; },
    setAttribute() {},
    getBoundingClientRect() { return { width: 900, height: 500 }; },
    getContext() { return canvasContext(); },
    addEventListener() {},
    set innerHTML(value) { this._innerHTML = value; this.children = []; },
    get innerHTML() { return this._innerHTML || ''; }
  };
}
const mapElement = makeElement('div');
const messageElement = makeElement('div');
elements.set('map', mapElement);
elements.set('mapMessage', messageElement);

global.document = {
  getElementById(id) { return elements.get(id) || null; },
  createElement(tag) { return makeElement(tag); }
};
global.window = global;
global.performance = { now: () => Date.now() };
global.requestAnimationFrame = (cb) => { cb(Date.now()); return 1; };
global.cancelAnimationFrame = () => {};
global.setTimeout = (cb) => { cb(); return 1; };
global.clearTimeout = () => {};
global.addEventListener = () => {};
global.devicePixelRatio = 1;
global.APP_CONFIG = {
  terrainTileJson: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
  terrainEncoding: 'mapbox',
  mapRasterTiles: ['https://a.tile.openstreetmap.org/{z}/{x}/{y}.png']
};

class Bounds {
  constructor() { this.coords = []; }
  extend(coord) { this.coords.push(coord); return this; }
  getCenter() {
    const xs = this.coords.map((c) => c[0]);
    const ys = this.coords.map((c) => c[1]);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...ys) + Math.max(...ys)) / 2];
  }
}
class Source {
  constructor() { this.data = null; }
  setData(data) { this.data = data; }
}
class FakeMap {
  constructor(options) {
    this.options = options;
    this.handlers = {};
    this.sources = new Map();
    this.layers = new Map();
    this.lastCamera = null;
    global.__fakeMap = this;
  }
  addControl() {}
  on(name, cb) { (this.handlers[name] ||= []).push(cb); }
  trigger(name, event = {}) { for (const cb of this.handlers[name] || []) cb(event); }
  isStyleLoaded() { return false; } // Simula teselas/DEM aún cargando.
  getStyle() { return { version: 8 }; }
  addSource(id) { this.sources.set(id, new Source()); }
  getSource(id) { return this.sources.get(id); }
  removeSource(id) { this.sources.delete(id); }
  addLayer(layer) { this.layers.set(layer.id, layer); }
  getLayer(id) { return this.layers.get(id); }
  removeLayer(id) { this.layers.delete(id); }
  setTerrain() {}
  setSky() {}
  stop() { this.stopped = true; }
  cameraForBounds(bounds) { this.lastBounds = bounds.coords.slice(); return { center: bounds.getCenter(), zoom: 8 }; }
  easeTo(camera) { this.lastCamera = camera; }
  triggerRepaint() { this.repainted = true; }
  resize() {}
  remove() {}
}
class Marker {
  setLngLat(value) { this.lngLat = value; return this; }
  setPopup() { return this; }
  addTo() { return this; }
  remove() {}
}
class Popup { setHTML() { return this; } }

global.maplibregl = {
  Map: FakeMap,
  Marker,
  Popup,
  LngLatBounds: Bounds,
  NavigationControl: class {},
  ScaleControl: class {}
};

require(path.join(__dirname, 'map3d.js'));
Map3DView.init('map', 'mapMessage');
__fakeMap.trigger('load');

function stage(number, lon0, lat0, lon1, lat1, status) {
  return {
    id: `stage-${number}`,
    number,
    routeStatus: status,
    routeLabel: `Ruta ${number}`,
    startName: `Salida ${number}`,
    finishName: `Meta ${number}`,
    distanceKm: 100 + number,
    ascentM: 1500,
    maxEleM: 1200,
    seed: number,
    climbs: [],
    points: [
      { lon: lon0, lat: lat0, ele: 100, grade: 0, distanceKm: 0 },
      { lon: (lon0 + lon1) / 2, lat: (lat0 + lat1) / 2, ele: 500, grade: 6, distanceKm: 50 },
      { lon: lon1, lat: lat1, ele: 200, grade: -4, distanceKm: 100 + number }
    ]
  };
}

const a = stage(1, -5.9, 43.3, -5.0, 43.2, 'real');
const b = stage(2, 6.1, 45.0, 7.0, 45.7, 'real');
Map3DView.render(a);
const source = __fakeMap.getSource('stage-route-v14');
assert.ok(source?.data?.features?.length >= 2, 'La primera etapa no llegó al GeoJSON del mapa');
const firstA = source.data.features[0].geometry.coordinates[0];
assert.deepEqual(firstA, [-5.9, 43.3]);

Map3DView.render(b);
const firstB = source.data.features[0].geometry.coordinates[0];
assert.deepEqual(firstB, [6.1, 45.0], 'El mapa conservó la geometría de la etapa anterior');
assert.ok(__fakeMap.stopped, 'La animación de cámara anterior no se detuvo antes de sincronizar');
assert.deepEqual(__fakeMap.lastBounds[0], [6.1, 45.0], 'La cámara no se recalculó con la etapa nueva');
assert.match(mapElement.children.find((child) => child.className === 'map-sync-badge')?.textContent || '', /ETAPA 2 · OSM REAL/);

console.log('✓ El visor actualiza GeoJSON aunque isStyleLoaded() permanezca false por teselas/DEM pendientes.');

window.APP_CONFIG = {
  appName: 'Grand Tour Stage Lab',
  version: '1.3.0-map-sync',
  valhallaEndpoint: 'https://valhalla1.openstreetmap.de/route',
  valhallaClientId: 'grand-tour-stage-lab.github.io',
  terrainTileJson: 'https://demotiles.maplibre.org/terrain-tiles/tiles.json',
  terrainEncoding: 'mapbox',
  mapRasterTiles: [
    'https://a.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://b.tile.openstreetmap.org/{z}/{x}/{y}.png',
    'https://c.tile.openstreetmap.org/{z}/{x}/{y}.png'
  ],
  mapLibreJsUrls: [
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.js',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.js'
  ],
  mapLibreCssUrls: [
    'https://unpkg.com/maplibre-gl@5.24.0/dist/maplibre-gl.css',
    'https://cdn.jsdelivr.net/npm/maplibre-gl@5.24.0/dist/maplibre-gl.css'
  ],
  echartsJsUrls: [
    'https://cdn.jsdelivr.net/npm/echarts@5.6.0/dist/echarts.min.js',
    'https://unpkg.com/echarts@5.6.0/dist/echarts.min.js'
  ],
  vendorTimeoutMs: 5500,
  routeRequestDelayMs: 1200,
  routeRequestTimeoutMs: 10000,
  elevationIntervalM: 30
};

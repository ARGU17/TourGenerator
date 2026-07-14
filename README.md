# Grand Tour Stage Lab 🚴‍♂️

Aplicación web estática para generar vueltas ciclistas de **1 a 30 etapas** en Francia, España, Italia o combinando los tres países.

## Versión 1.1 — corrección de arranque

Esta versión corrige el fallo por el que la interfaz HTML aparecía, pero el libro de ruta quedaba vacío y los botones no respondían.

La causa principal era que las bibliotecas externas se cargaban de manera bloqueante antes del núcleo local. Cuando GitHub Pages, el navegador, una red corporativa o un bloqueador no podía resolver alguno de esos CDN, el navegador no alcanzaba `app.js`; por tanto, no se generaban etapas ni se enlazaban los eventos de los botones.

Cambios aplicados:

- Los scripts locales arrancan antes que las dependencias visuales opcionales.
- Ningún fallo de MapLibre o ECharts puede bloquear los botones.
- Se incorpora un perfil SVG interactivo local, sin dependencia de Internet.
- Se incorpora una vista 2.5D/3D Canvas local, sin dependencia de Internet.
- MapLibre y ECharts se cargan después, de forma asíncrona, y mejoran los visores si están disponibles.
- JSZip se incluye dentro de `/vendor`, por lo que la exportación ZIP ya no depende de un CDN.
- El generador, los condicionantes, la regeneración y el GPX funcionan totalmente offline.
- Se añade una prueba automática ejecutable con `npm test`.

## Funcionalidades

- Generación de vueltas de 21 etapas con reparto realista entre llano, media montaña, alta montaña y contrarreloj.
- Catálogo geográfico con regiones, ciudades y puertos reales de Francia, España e Italia.
- Perfil altimétrico interactivo, coloreado por pendiente y con puertos/sprint señalados.
- Visualización local 3D/2.5D y mejora opcional sobre terreno cartográfico con MapLibre GL JS.
- Animación de un corredor recorriendo la etapa.
- Regeneración de una etapa concreta sin modificar el resto de la vuelta.
- Interpretación de condicionantes escritos en español.
- Conversión opcional a carreteras reales de OpenStreetMap mediante Valhalla.
- Exportación individual GPX y exportación completa ZIP con GPX + JSON + manifiesto.
- Despliegue automático en GitHub Pages.

## Funcionamiento de los modos

### 1. Datos incluidos — siempre disponible

La aplicación funciona inmediatamente, sin claves API y aunque el navegador no tenga acceso a los CDN. Genera rutas geográficas coherentes a partir de ciudades y puertos reales del catálogo, con perfiles altimétricos procedurales calibrados para cada tipo de etapa.

El perfil local y el visor 3D local también funcionan sin conexión. En la esquina de cada visualizador se muestra `PERFIL LOCAL` o `3D LOCAL` cuando se está usando este modo resistente a fallos.

### 2. Visualización cartográfica mejorada — opcional

Tras arrancar el núcleo, la aplicación intenta cargar MapLibre y ECharts de forma asíncrona. Si las bibliotecas y los tiles externos están disponibles, los visores se actualizan automáticamente. Si no están disponibles, la aplicación conserva los visores locales y el resto de funciones continúa operativo.

### 3. Carreteras reales — requiere servicio Valhalla

El botón **Carreteras reales** sustituye la geometría incluida por una ruta calculada sobre la red ciclable de OpenStreetMap usando Valhalla.

El botón **Enrutar 21 etapas** procesa toda la vuelta secuencialmente y conserva automáticamente la versión incluida de las etapas que no puedan enrutarse.

Endpoint predeterminado:

`https://valhalla1.openstreetmap.de/route`

Es un servicio externo. Puede fallar por límites de uso, CORS, indisponibilidad temporal o políticas de la red. Ese fallo ya no impide generar ni visualizar las etapas incluidas.

## Sustituir la versión anterior en GitHub

1. Conserva una copia del repositorio anterior si contiene cambios propios.
2. Descomprime este ZIP.
3. Sustituye **todos** los archivos del repositorio por el contenido de esta carpeta.
4. Comprueba especialmente que existen:
   - `js/vendor-loader.js`
   - `vendor/jszip.min.js`
   - las carpetas completas `js/`, `vendor/` y `.github/`
5. Haz commit y push.
6. En GitHub abre `Actions` y espera a que finalice **Deploy GitHub Pages**.
7. Recarga la web con `Ctrl+F5` para evitar que el navegador reutilice el JavaScript antiguo.

No hay que ejecutar `npm install` para publicar la aplicación.

## Publicación nueva en GitHub Pages

1. Crea un repositorio nuevo.
2. Sube **todo el contenido de esta carpeta a la raíz**.
3. Abre `Settings` → `Pages`.
4. En `Build and deployment`, selecciona `GitHub Actions`.
5. Ejecuta o espera al workflow `Deploy GitHub Pages`.

## Ejemplos de condicionantes

- `21 etapas en España, 7 llanas, 5 de alta montaña, 2 CRI y 4 finales en alto.`
- `18 etapas en Francia, 3000 km totales y máximo 205 km por etapa.`
- `21 etapas en Italia, 6 llanas, 4 quebradas, 4 de media montaña, 5 de alta montaña y 2 contrarrelojes.`
- `Gran vuelta europea de 24 etapas, 3 CRI, 6 finales en alto, máximo 220 km y semilla 54321.`

Tras pulsar **Interpretar condicionantes**, los valores detectados se trasladan al formulario. Después se pulsa **Generar nueva vuelta**.

## Pruebas

No son necesarias para desplegar, pero permiten validar el generador localmente si Node.js está instalado:

```bash
npm test
```

La prueba cubre:

- Francia, España, Italia y vuelta europea.
- Varias semillas.
- Validez de puntos, distancia y desnivel.
- Interpretación de condicionantes.
- Creación del contenido GPX 1.1.

## Estructura

```text
.
├── index.html
├── styles.css
├── config.js
├── package.json
├── js/
│   ├── vendor-loader.js
│   ├── catalog.js
│   ├── generator.js
│   ├── map3d.js
│   ├── profile.js
│   ├── export.js
│   └── app.js
├── vendor/
│   └── jszip.min.js
├── tests/
│   └── smoke-test.js
├── worker/
│   ├── valhalla-proxy.js
│   └── wrangler.toml.example
├── .github/workflows/pages.yml
├── .nojekyll
├── LICENSE
└── README.md
```

## Configuración externa

Los parámetros están en `config.js`:

```js
window.APP_CONFIG = {
  version: '1.1.0-fixed',
  valhallaEndpoint: 'https://valhalla1.openstreetmap.de/route',
  terrainTileJson: 'https://tiles.mapterhorn.com/tilejson.json',
  routeRequestDelayMs: 1200,
  elevationIntervalM: 30
};
```

Puede cambiarse `valhallaEndpoint` por una instancia propia o por el proxy opcional incluido en `worker/`.

## Diagnóstico rápido

Si vuelve a aparecer solo la estructura vacía:

1. Abre las herramientas de desarrollo del navegador (`F12`).
2. Revisa `Console` y `Network`.
3. Comprueba que `js/app.js`, `js/generator.js`, `js/catalog.js` y `vendor/jszip.min.js` responden con HTTP 200.
4. Comprueba que GitHub no ha colocado la aplicación dentro de una subcarpeta adicional.
5. Fuerza una recarga con `Ctrl+F5`.

La aplicación expone `window.GT_STAGE_LAB` después de arrancar. En la consola, esta comprobación debe devolver `true`:

```js
Boolean(window.GT_STAGE_LAB && window.GT_STAGE_LAB.state.tour)
```

## Datos y atribución

- Cartografía base: © OpenStreetMap contributors.
- Routing real: Valhalla sobre datos OpenStreetMap.
- Terreno cartográfico: Mapterhorn DEM tiles, sujeto a disponibilidad del servicio.
- Visualización opcional: MapLibre GL JS y Apache ECharts.

## Licencia

MIT. Consulta `LICENSE`.

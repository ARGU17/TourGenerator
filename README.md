# Grand Tour Stage Lab 🚴‍♂️

Aplicación web estática para generar vueltas ciclistas de **1 a 30 etapas** en Francia, España, Italia o combinando los tres países.

Incluye:

- Generación de vueltas de 21 etapas con reparto realista entre llano, media montaña, alta montaña y contrarreloj.
- Catálogo geográfico con regiones, ciudades y puertos reales de Francia, España e Italia.
- Perfil altimétrico interactivo, coloreado por pendiente y con puertos/sprint señalados.
- Visualización 3D sobre terreno real con MapLibre GL JS.
- Animación de un corredor recorriendo la etapa.
- Regeneración de una etapa concreta sin modificar el resto de la vuelta.
- Interpretación de condicionantes escritos en español.
- Conversión opcional a carreteras reales de OpenStreetMap mediante Valhalla.
- Exportación individual GPX y exportación completa ZIP con GPX + JSON + manifiesto.
- Despliegue automático en GitHub Pages.

## Funcionamiento de los dos modos

### 1. Datos incluidos

La aplicación funciona inmediatamente, sin claves API. Genera rutas geográficas coherentes a partir de ciudades y puertos reales del catálogo, con perfiles altimétricos procedurales calibrados para cada tipo de etapa.

Este modo garantiza que la interfaz siempre funciona incluso si el servicio de routing no está disponible.

### 2. Carreteras reales

El botón **Carreteras reales** sustituye la geometría incluida por una ruta calculada sobre la red ciclable de OpenStreetMap usando Valhalla.

El botón **Enrutar 21 etapas** procesa toda la vuelta secuencialmente y conserva automáticamente la versión incluida de las etapas que no puedan enrutarse.

El endpoint predeterminado es el servidor demostrativo público de FOSSGIS:

`https://valhalla1.openstreetmap.de/route`

Es adecuado para pruebas y uso moderado. Para una aplicación pública con muchos usuarios se recomienda desplegar Valhalla propio o usar un proxy/control de cuota.

## Subir directamente a GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube **todo el contenido de esta carpeta a la raíz del repositorio**.
3. Abre `Settings` → `Pages`.
4. En `Build and deployment`, selecciona `GitHub Actions`.
5. Haz un commit o ejecuta manualmente el workflow `Deploy GitHub Pages`.
6. GitHub publicará la URL de la aplicación en la pestaña `Actions` y en `Settings` → `Pages`.

No hay que ejecutar `npm install`, no hay proceso de build y no se necesita backend para el modo básico.

## Ejemplos de condicionantes

El campo de lenguaje natural admite peticiones como:

- `21 etapas en España, 7 llanas, 5 de alta montaña, 2 CRI y 4 finales en alto.`
- `18 etapas en Francia, 3000 km totales y máximo 205 km por etapa.`
- `21 etapas en Italia, 6 llanas, 4 quebradas, 4 de media montaña, 5 de alta montaña y 2 contrarrelojes.`
- `Gran vuelta europea de 24 etapas, 3 CRI, 6 finales en alto, máximo 220 km y semilla 54321.`

Tras pulsar **Interpretar condicionantes**, los valores detectados se trasladan al formulario. Después se pulsa **Generar nueva vuelta**.

## Estructura

```text
.
├── index.html
├── styles.css
├── config.js
├── js/
│   ├── catalog.js
│   ├── generator.js
│   ├── map3d.js
│   ├── profile.js
│   ├── export.js
│   └── app.js
├── worker/
│   ├── valhalla-proxy.js
│   └── wrangler.toml.example
├── .github/workflows/pages.yml
├── .nojekyll
├── LICENSE
└── README.md
```

## Configuración

Los parámetros externos están en `config.js`:

```js
window.APP_CONFIG = {
  valhallaEndpoint: 'https://valhalla1.openstreetmap.de/route',
  valhallaClientId: 'grand-tour-stage-lab.github.io',
  terrainTileJson: 'https://tiles.mapterhorn.com/tilejson.json',
  routeRequestDelayMs: 1200,
  elevationIntervalM: 30
};
```

Se puede cambiar `valhallaEndpoint` por una instancia propia o por un proxy.

## Proxy opcional con Cloudflare Worker

La carpeta `worker/` contiene un proxy mínimo para:

- Evitar problemas CORS.
- Añadir el identificador `X-Client-Id` en el servidor.
- Centralizar el endpoint de Valhalla.
- Sustituir en el futuro el servidor demostrativo por una instancia privada.

Pasos básicos:

1. Instala Wrangler: `npm install -g wrangler`.
2. Copia `worker/wrangler.toml.example` como `worker/wrangler.toml`.
3. Entra en `worker/` y ejecuta `wrangler deploy`.
4. Introduce la URL resultante en el campo `Endpoint Valhalla` de la aplicación o en `config.js`.

## Datos y atribución

- Cartografía base: © OpenStreetMap contributors.
- Routing real: Valhalla sobre datos OpenStreetMap.
- Terreno 3D: Mapterhorn DEM tiles, según disponibilidad del servicio.
- Visualización: MapLibre GL JS y Apache ECharts.

## Consideraciones técnicas

- Las rutas reales dependen de la cobertura y etiquetado de OpenStreetMap.
- El routing puede modificar de forma significativa la distancia objetivo cuando los puertos o puntos intermedios obligan a rodeos.
- El servidor público de Valhalla aplica límites de uso razonable.
- Los tracks reales se generan al pulsar el botón correspondiente; el ZIP exporta exactamente la geometría actualmente visible en cada etapa.
- La semilla permite reproducir una vuelta generada con los mismos parámetros.

## Licencia

MIT. Consulta `LICENSE`.

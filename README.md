# Grand Tour Stage Lab v1.3

Generador de vueltas ciclistas con 21 etapas, perfiles altimétricos, visualización cartográfica 3D y exportación GPX/JSON.

## Estructura plana

Todos los archivos están preparados para colocarse directamente en la raíz de `main`:

```text
.nojekyll
LICENSE
README.md
index.html
styles.css
config.js
vendor-loader.js
catalog.js
generator.js
export.js
profile.js
map3d.js
app.js
jszip.min.js
package.json
smoke-test.js
map-sync-test.js
valhalla-proxy.js
wrangler.toml.example
```

No hay referencias a carpetas `js/`, `vendor/`, `tests/` ni `source/`.

## Corrección v1.3 del mapa 3D

La versión 1.3 corrige la desincronización por la que el perfil cambiaba de etapa, pero el mapa podía conservar una geometría o cámara anterior.

Cambios principales:

- Cada selección genera un nuevo identificador interno de renderizado.
- Se detiene cualquier transición de cámara anterior antes de actualizar.
- Se filtran coordenadas inválidas antes de enviar GeoJSON a MapLibre.
- La fuente GeoJSON se sustituye con los segmentos de la etapa seleccionada.
- La cámara se recalcula con los límites de la nueva geometría.
- Si la fuente queda en un estado inconsistente, se eliminan y reconstruyen las capas de ruta.
- El proceso de enrutado de 21 etapas ya no repinta innecesariamente el mapa tras cada etapa no seleccionada.
- El terreno utiliza el DEM de demostración de MapLibre y una codificación definida.
- Se añade una etiqueta dentro del mapa: `ETAPA N · OSM REAL/LOCAL · km`, para comprobar qué etapa está representada.

## Publicar en GitHub Pages

1. Elimina o sustituye los archivos antiguos de la raíz del repositorio.
2. Sube todos los archivos de este ZIP directamente a `main`.
3. En GitHub abre `Settings → Pages`.
4. Selecciona `Deploy from a branch`.
5. Selecciona `main` y la carpeta `/ (root)`.
6. Guarda y espera al despliegue.
7. Recarga la página con `Ctrl + F5` para evitar que el navegador reutilice `map3d.js` o `app.js` anteriores.

## Dependencias y costes

### Generación local y GPX

No requiere cuenta, clave API, pago ni servidor. Se ejecuta dentro del navegador.

### Perfil y visor 3D local

Funcionan sin API. Si MapLibre o las teselas externas no están disponibles, se mantiene el visor local de respaldo.

### Mapa cartográfico y relieve

Requieren conexión para descargar las teselas de OpenStreetMap y del modelo digital de elevación. No requieren una clave de pago.

### Enrutado por carreteras reales

Requiere conexión al endpoint Valhalla configurado. El proyecto incluye un endpoint público sin clave, pero su disponibilidad y límites no están garantizados. El GPX procedural local continúa funcionando aunque el endpoint falle.

## Validación

Con Node.js instalado:

```bash
npm test
```

Las pruebas verifican:

- Generación para Francia, España, Italia y Europa.
- Coordenadas válidas.
- Distancias, desniveles y GPX.
- Progreso etapa por etapa.
- Referencias planas desde `index.html`.
- Sustitución de GeoJSON y cámara cuando se cambia de etapa.

## Archivos opcionales

`valhalla-proxy.js` y `wrangler.toml.example` solo son necesarios para desplegar un proxy propio. No son necesarios para ejecutar la aplicación normal en GitHub Pages.

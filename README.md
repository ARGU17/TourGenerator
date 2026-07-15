# Grand Tour Stage Lab v1.4

Generador web de vueltas ciclistas con etapas procedurales, perfiles altimétricos, visualización 3D y exportación GPX/ZIP.

## Instalación en GitHub Pages

La estructura del repositorio es deliberadamente plana. Sube **todos los archivos directamente a la rama `main`**, sin crear carpetas:

```text
.nojekyll
LICENSE
README.md
app.js
catalog.js
config.js
export.js
generator.js
index.html
jszip.min.js
map3d.js
profile.js
styles.css
vendor-loader.js
...
```

Después activa GitHub Pages desde `Settings → Pages` y publica desde la rama principal o mediante el workflow que ya utilices.

## Funcionamiento sin pago

La generación procedural, el perfil, el visor 3D local y la exportación GPX/ZIP se ejecutan en el navegador. No requieren:

- Cuenta externa.
- Tarjeta o suscripción.
- Clave API.
- Backend.
- Variables de entorno.

El modo **carreteras reales** sí necesita Internet porque consulta un servidor público Valhalla basado en OpenStreetMap. Tampoco exige clave ni pago en la configuración incluida, pero el servicio comunitario puede aplicar límites o sufrir indisponibilidad temporal.

## Cambios v1.4

### Sincronización estable del mapa 3D

- Eliminada la dependencia incorrecta de `map.isStyleLoaded()` para añadir la ruta.
- Las teselas raster y el DEM pueden seguir descargándose sin bloquear el GeoJSON de la etapa.
- La etapa seleccionada queda en una cola única de renderizado y se dibuja en cuanto el estilo admite fuentes y capas.
- Ya no se eliminan y recrean continuamente las capas ante un fallo transitorio.
- Los mensajes repetitivos de “capas no preparadas” han sido sustituidos por una espera silenciosa y controlada.
- Si MapLibre no consigue preparar las capas después de 15 segundos, se activa automáticamente el visor 3D local para no dejar la ruta en blanco.

### Recuperación de etapas que no enrutan

El botón general ahora trabaja únicamente con las etapas que siguen en modo local. Por ejemplo, si aparecen `18/21` reales, solo consulta las tres pendientes.

Cada etapa dispone de varias estrategias:

1. Waypoints originales como puntos de paso.
2. Waypoints originales con anclajes amplios.
3. Reducción adaptativa de puntos intermedios.
4. Corredor simplificado.
5. Ruta entre salida y meta como último recurso.

Después de la primera pasada se ejecuta una segunda pasada de recuperación con:

- Radios de búsqueda superiores.
- Menor exigencia de conectividad local.
- Reintentos de red.
- Esperas mayores para reducir bloqueos por frecuencia.

Las etapas ya enrutadas no se vuelven a solicitar ni se sobrescriben.

### Progreso y diagnóstico

La barra muestra:

- Etapa pendiente actual.
- Estrategia de enrutado.
- Número de waypoints.
- Reintentos y esperas del servidor.
- Resultado de la pasada de recuperación.

## Pruebas

Con Node.js instalado:

```bash
npm test
```

Se validan:

- Generación de etapas y GPX.
- Estructura plana del repositorio.
- Actualización del mapa aunque `isStyleLoaded()` sea `false` por teselas pendientes.
- Sustitución del GeoJSON y recálculo de cámara.
- Recuperación adaptativa de una ruta inicialmente rechazada.

## Uso recomendado

1. Genera la vuelta localmente.
2. Comprueba perfiles y distancias.
3. Pulsa `Completar N locales` para enrutar únicamente las etapas pendientes.
4. Exporta el ZIP cuando el resultado sea satisfactorio.

La exportación sigue disponible aunque alguna etapa permanezca local.

# Grand Tour Stage Lab v1.2 🚴‍♂️

Aplicación web estática para generar vueltas ciclistas de **1 a 30 etapas** en Francia, España, Italia o combinando los tres países. Incluye perfil altimétrico, visualización 3D local y exportación GPX/JSON.

## Qué corrige esta versión

La versión anterior podía parecer completamente bloqueada por dos motivos:

1. La generación de 21 etapas se ejecutaba como una operación JavaScript síncrona. Mientras el navegador calculaba, no podía repintar la interfaz; por eso no se veía ningún cambio aunque el proceso siguiera activo.
2. Si estaba marcada la opción **Enrutar automáticamente al generar**, al terminar el cálculo local se iniciaban hasta 21 consultas externas a Valhalla. Un servidor lento, una restricción CORS o una caída temporal podían prolongar el proceso sin feedback visible.
3. Un despliegue incompleto en GitHub Pages podía dejar `index.html` y CSS visibles, pero perder uno o varios archivos JavaScript relativos.

La v1.2 resuelve los tres puntos:

- Generación asíncrona etapa por etapa.
- Barra de progreso real con porcentaje, contador, tiempo transcurrido y registro de operaciones.
- Progreso independiente para generar, regenerar, enrutar, exportar una etapa y exportar el ZIP.
- Cancelación entre etapas para generación y enrutado completo.
- Tiempo máximo de espera en peticiones Valhalla.
- Detención automática después de tres fallos externos consecutivos.
- `index.html` **autónomo**: CSS, generador, visores locales y JSZip están integrados dentro del mismo archivo.
- El enrutado automático siempre arranca desactivado.
- Diagnóstico visible si ocurre un error JavaScript.

## Modos de funcionamiento

### 1. Generación local — gratuita y autónoma

Funciona sin:

- Cuenta.
- Clave API.
- Tarjeta bancaria.
- Backend.
- Instalación de Node.js.
- Conexión a Internet para generar o exportar.

Produce recorridos GPX completos con coordenadas, distancia, elevación, pendiente, puertos y sprints. Los trazados locales se construyen a partir del catálogo incluido de ciudades, regiones y puertos reales, pero la línea entre puntos es procedural: **no garantiza que cada metro siga una carretera cartografiada**.

### 2. Carreteras reales — opcional

Los botones **Carreteras reales** y **Enrutar N etapas** consultan el servidor público de Valhalla sobre OpenStreetMap.

- No requiere clave API ni pago.
- Sí requiere Internet.
- Es un servicio comunitario externo sin garantía de disponibilidad.
- Está sujeto a uso razonable y limitación de peticiones.
- Si falla, la aplicación conserva íntegramente el GPX local.

Endpoint predeterminado:

```text
https://valhalla1.openstreetmap.de/route
```

La aplicación envía las solicitudes secuencialmente con más de un segundo entre ellas y utiliza un identificador `X-Client-Id`.

## Barra de progreso

Cada proceso muestra:

- Porcentaje de avance.
- Etapa o archivo actual.
- Tiempo transcurrido.
- Últimas operaciones realizadas.
- Resultado final o mensaje de error.

Procesos cubiertos:

- Arranque inicial.
- Generación completa.
- Regeneración de una etapa.
- Enrutado real de una etapa.
- Enrutado real de toda la vuelta.
- Exportación GPX individual.
- Exportación ZIP completa.

## Publicar en GitHub Pages

1. Descomprime el ZIP.
2. Sube **todo el contenido** a la raíz del repositorio.
3. Abre `Settings` → `Pages`.
4. Selecciona `GitHub Actions`.
5. Espera a que el workflow `Deploy GitHub Pages` termine correctamente.
6. Abre la página y fuerza una recarga con `Ctrl + F5`.

El archivo esencial es:

```text
index.html
```

En esta versión es autónomo. Aunque las carpetas `js/`, `vendor/` y `styles.css` se mantienen como código fuente editable, GitHub Pages puede ejecutar la aplicación únicamente con el `index.html` generado.

## Uso

1. Ajusta país, número de etapas, kilómetros y reparto deportivo.
2. Mantén desmarcado **Enrutar automáticamente al generar** para una generación inmediata y autónoma.
3. Pulsa **Generar nueva vuelta**.
4. Observa la barra de progreso.
5. Revisa perfiles y visualización 3D.
6. Exporta una etapa con **GPX** o toda la vuelta con **Exportar ZIP**.
7. Usa **Carreteras reales** solo cuando quieras sustituir un trazado local por una ruta OSM y dispongas de Internet.

## Ejemplos de condicionantes

- `21 etapas en España, 7 llanas, 5 de alta montaña, 2 CRI y 4 finales en alto.`
- `18 etapas en Francia, 3000 km totales y máximo 205 km por etapa.`
- `21 etapas en Italia, 6 llanas, 4 quebradas, 4 de media montaña, 5 de alta montaña y 2 contrarrelojes.`
- `Gran vuelta europea de 24 etapas, 3 CRI, 6 finales en alto, máximo 220 km y semilla 54321.`

## Pruebas

No son necesarias para publicar. Con Node.js instalado:

```bash
npm test
```

Se valida:

- Francia, España, Italia y modo europeo.
- Varias semillas.
- Coordenadas, distancia, elevación y pendiente.
- Condicionantes en lenguaje natural.
- Exportación GPX 1.1.
- Generación asíncrona y eventos de progreso.
- Integridad del `index.html` autónomo.

## Reconstruir el index autónomo

Después de modificar los archivos fuente:

```bash
python tools/build-standalone.py
```

Esto vuelve a integrar `styles.css`, los módulos de `/js` y JSZip dentro de `index.html`.

## Estructura

```text
.
├── index.html                    # versión autónoma para GitHub Pages
├── source/index.modular.html     # plantilla mantenible
├── styles.css
├── config.js
├── package.json
├── js/
├── vendor/jszip.min.js
├── tools/build-standalone.py
├── tests/smoke-test.js
├── worker/
├── .github/workflows/pages.yml
├── .nojekyll
├── LICENSE
└── README.md
```

## Datos y atribución

- Modo real: © OpenStreetMap contributors.
- Motor de routing real: Valhalla.
- Visor cartográfico opcional: MapLibre GL JS.
- Gráfico opcional: Apache ECharts.
- El perfil y el visor 3D local funcionan sin estas bibliotecas externas.

## Licencia

MIT. Consulta `LICENSE`.

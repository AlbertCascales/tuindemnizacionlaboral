# Tu Indemnización Laboral (tuindemnizacionlaboral.com)

Web estática de captación de clientes para reclamaciones por accidente laboral y despido.
A diferencia de EmpiezaLibros/EmpiezaPadel, **no monetiza por afiliación: capta leads** vía el
formulario de contacto.

Repo: `https://github.com/AlbertCascales/tuindemnizacionlaboral.git` · Hosting: Cloudflare Pages
(proyecto `tuindemnizacionlaboral`, cuenta `309bf01e7f39dc4d20d58d15c550a7a5`).

## Despliegue: NO es automático

**El auto-deploy de GitHub→Pages no dispara en este proyecto** (creado por API; los otros sitios, hechos
desde el dashboard, sí funcionan). Hacer push no publica nada. Para desplegar, desde la raíz del repo:

```
npx wrangler pages deploy . --project-name=tuindemnizacionlaboral --commit-dirty=true
```

Es un direct upload y esquiva también el problema del token de abajo. Tras desplegar, el edge tarda
~10-15 s en servir lo nuevo: un 404 inmediato no significa que haya fallado.

**Token de Cloudflare:** el OAuth cacheado de wrangler rota a veces a un formato `cfoat_...` que la API
REST rechaza con "Invalid API Token" aunque `npx wrangler whoami` funcione. Si `curl` a
`api.cloudflare.com` falla con code 1000, no pelees: usa el comando `wrangler` equivalente.
El token **no tiene permiso de escritura en DNS ni en Rulesets** — cualquier cambio de registros DNS o
Redirect Rules lo tiene que hacer Alberto a mano en el dashboard.

## Piezas fuera de este repo (imprescindible)

El sitio depende de **dos Workers que no viven aquí**. Sin ellos el formulario y LinkedIn no funcionan:

| Worker | Código | Qué hace |
|---|---|---|
| `til-contacto-worker` | `C:\Users\marti\Downloads\til-worker-contacto` | Sirve `/api/contacto` (el `action` del formulario). |
| `til-linkedin-poster` | `C:\Users\marti\Downloads\til-worker-linkedin` | Publica artículos en LinkedIn + genera sus imágenes. |

Ambos se despliegan con `npx wrangler deploy` desde su propia carpeta y se enganchan al dominio por
Route, no por Pages.

## Formulario de contacto: dos muros ya encontrados

El formulario (`/contacto/`) hace POST a `/api/contacto`, que sirve `til-contacto-worker` vía
Cloudflare Email Workers. Al volver, redirige a `/contacto/?enviado=1` y un script muestra el aviso de
éxito. Historia que **no conviene repetir**:

1. Empezó en Formspree (abandonado; el form id `xjgqayep` ya no se usa).
2. **Cloudflare Pages no soporta el binding `send_email`** — ni por `wrangler.toml` (el build falla) ni
   en el dashboard (no existe ese tipo de binding). Por eso es un Worker aparte y no una Pages Function.
3. **`send_email` solo entrega a direcciones verificadas**, y enviar a `consultas@tuindemnizacionlaboral.com`
   **falla en silencio**: `send()` resuelve (HTTP 303) pero DonDominio, donde vive ese buzón, descarta el
   correo (Cloudflare no está autorizado por SPF/DKIM a enviar como el dominio → parece suplantación).
   Por eso el destino real es `martinez9alberto7@gmail.com` (verificado automáticamente por ser el email
   de la cuenta de Cloudflare) y Alberto reenvía desde Gmail a consultas@.

## LinkedIn (automatización)

`til-linkedin-poster`: cron diario `0 9 * * *` que publica **un** artículo de `/guias/` por ejecución
(los ya publicados se marcan en el KV `LINKEDIN_KV`, id `04111e1bd0104d8ca24c21ec1a5a5537`, clave
`posted:<url>`). Endpoints: `/api/linkedin/authorize`, `/callback`, `/status`, `/test-post`, `/run-now`.

- **El token de LinkedIn caduca a los ~60 días y no hay refresh token.** Cuando expire hay que volver a
  visitar `/api/linkedin/authorize` a mano. Comprobar días restantes en `/api/linkedin/status`.
- Solo publica en el **perfil personal**. La página de empresa exigiría el producto "Community Management
  API" (revisión manual de LinkedIn); se descartó por fricción.
- `/run-now` devuelve "OK: ejecutado" **aunque falle por dentro** (los errores solo se loguean).
  Para confirmar que publicó, mirar la clave `posted:` en KV.
- Cada artículo lleva un titular gancho propio (objeto `HOOKS` en `src/worker.js`) + imagen
  `/img/linkedin/<slug>.png`. **Al añadir un artículo nuevo hay que añadir su hook y generar su imagen**,
  o saldrá con el `<title>` de la página y sin foto.
- Las imágenes son ilustraciones temáticas por tema, deliberadamente **sin titular** (se probó con
  titular y se descartó). Se generan con `generate_topic_images.py` del repo del worker.
  **No hay cairo/cairosvg en esta máquina**: se rasteriza con
  `chrome.exe --headless --disable-gpu --screenshot=x.png --window-size=1200,627 fichero.html`.
- LinkedIn **no permite editar la imagen de un post ya publicado**: hay que borrarlo y republicar
  (borrando antes su clave `posted:` del KV).

## Estructura

Sitio estático escrito a mano — **no hay generador de páginas** (a diferencia de los otros dos
proyectos; no busques un `tools/generate-pages.js` aquí).

- `/servicios/<slug>/` — accidentes de trabajo, in itinere, enfermedad profesional, incapacidad
  permanente, gran invalidez, fallecimiento.
- `/guias/<slug>/` — artículos de captación (casos reales y explicativos sobre despido y accidentes).
- `/calculadora-indemnizacion-despido/` — calculadora de indemnización, en un único `index.html`.
- `/como-funciona/`, `/preguntas-frecuentes/`, `/sobre-nosotros/`, `/contacto/` y legales.

Las cards de la home, `/servicios/` y `/guias/` son `<a class="card">` clicables en toda su área
(no `<div>` con un enlace dentro). Mantener ese patrón en cualquier grid nuevo.

## Dominios

Canónico: **tuindemnizacionlaboral.com**. Alberto también tiene `tuindemnizacionlaboral.es` y los IDN
con tilde `tuindemnizaciónlaboral.es/.com`; los tres redirigen 301 al canónico mediante **Redirect Rules
creadas a mano en el dashboard** (registro DNS proxied + regla dinámica). Dominios en DonDominio, DNS en
Cloudflare. Los `.es` tardan mucho más que los `.com` en propagar el cambio de nameservers (Red.es).

## SEO

Es el eje del proyecto: schema `BreadcrumbList` / `Article` / `Service` / `FAQPage`, 404 personalizada,
`sitemap.xml` con `lastmod`, clave IndexNow y verificación de Google Search Console
(`a53e2bd5f7744bc7a487e228a7a95c64.txt` en la raíz y el meta `google-site-verification` en la home —
no borrar ninguno de los dos). Dado de alta en Google Search Console **y** Bing Webmaster Tools.
Al publicar contenido nuevo: actualizar `sitemap.xml` y avisar a IndexNow (`api.indexnow.org`).

Las páginas legales (`/aviso-legal/`, `/privacidad/`, `/cookies/`) llevan `noindex` **y por eso
NO van en el sitemap** — anunciar en el sitemap algo que luego marcas `noindex` son señales
contradictorias que malgastan rastreo. No las vuelvas a meter.

**Informe de Search Console:** `tools/gsc-report.js` (solo lectura, Node sin dependencias). Da
rendimiento (keywords/páginas) e indexación URL por URL del sitemap. La propiedad de GSC es por
**prefijo de URL** (`https://tuindemnizacionlaboral.com/`), no `sc-domain:`. La clave de la cuenta de
servicio vive fuera del repo en `C:\Users\marti\.tuindemnizacionlaboral-secrets\gsc-service-account.json`.
Uso: `node tools/gsc-report.js` (todo) · `--perf` (rápido) · `--index` (~35 llamadas, lento).

## Convenciones

- Commits en español, en imperativo.
- `_headers`: cabeceras a nivel de sitio (convención de Cloudflare Pages).
- Servidor local: ver `.claude/launch.json`.
- Paleta: navy `#0f2a43` + dorado `#c9932c`. Fuentes: Playfair Display + Inter.

## Aviso

Es una web de servicios jurídicos reales de cara al público. El contenido legal (plazos, cuantías,
porcentajes de indemnización) debe verificarse antes de publicarse; un dato mal puesto aquí es un
problema, no una errata.

**Sin CIF, razón social ni nº de colegiado por decisión expresa de Alberto.** El aviso legal queda
incompleto respecto al art. 10 LSSI-CE; está avisado. No es un olvido: no lo "arregles" inventando datos.

## Mantenimiento de este fichero

Si un cambio contradice algo que este fichero afirma (rutas, flujo de despliegue, scripts, secretos,
decisiones con historia), **actualízalo en el mismo commit que el cambio**. Un CLAUDE.md
desactualizado es peor que no tenerlo: se cree sin verificar y lleva a actuar sobre supuestos falsos.

**No es un changelog.** No se anota aquí el contenido añadido ni el trabajo de cada sesión: solo lo
estructural, lo que no se deduce leyendo el código, y lo que costó descubrir una vez y no debería
costar dos.

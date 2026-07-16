# Tu Indemnización Laboral (tuindemnizacionlaboral.com)

Web estática de captación de clientes para reclamaciones por accidente laboral y despido.
A diferencia de EmpiezaLibros/EmpiezaPadel, **no monetiza por afiliación: capta leads** vía el
formulario de contacto.

Repo: `https://github.com/AlbertCascales/tuindemnizacionlaboral.git` · Deploy: Cloudflare Pages
(push a `main` despliega).

## Estructura

Sitio estático escrito a mano — **no hay generador de páginas** (a diferencia de los otros dos
proyectos; no busques un `tools/generate-pages.js` aquí).

- `/servicios/<slug>/` — accidentes de trabajo, in itinere, enfermedad profesional, incapacidad
  permanente, gran invalidez, fallecimiento.
- `/guias/<slug>/` — artículos de captación (casos reales y explicativos sobre despido y accidentes).
- `/calculadora-indemnizacion-despido/` — calculadora de indemnización, en un único `index.html`.
- `/como-funciona/`, `/preguntas-frecuentes/`, `/sobre-nosotros/`, `/contacto/` y legales.

## Formulario de contacto: historia importante

El formulario usa el **endpoint nativo de Cloudflare**. Hubo un camino de ida y vuelta que conviene
no repetir:

1. Empezó en Formspree.
2. Se intentó Cloudflare Email Workers con binding `send_email` vía `wrangler.toml`.
3. **Cloudflare Pages no soporta el binding `send_email` por fichero de configuración.** Se revirtió
   y se eliminó la Pages Function.

Si vuelve a surgir el tema del email, ese es el muro con el que ya se chocó.

## SEO

Es el eje del proyecto: schema `BreadcrumbList` / `Article` / `Service`, 404 personalizada,
`sitemap.xml` con `lastmod`, clave IndexNow y verificación de Google Search Console
(`a53e2bd5f7744bc7a487e228a7a95c64.txt` en la raíz — no borrar).

Las imágenes de LinkedIn (`img/linkedin/`) son ilustraciones temáticas por tema, deliberadamente
**sin titular** — se probó con titular y se descartó.

## Convenciones

- Commits en español, en imperativo.
- `_headers`: cabeceras a nivel de sitio (convención de Cloudflare Pages).
- Servidor local: ver `.claude/launch.json`.

## Aviso

Es una web de servicios jurídicos reales de cara al público. El contenido legal (plazos, cuantías,
porcentajes de indemnización) debe verificarse antes de publicarse; un dato mal puesto aquí es un
problema, no una errata.

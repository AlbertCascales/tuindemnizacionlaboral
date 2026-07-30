# Plan TikTok — 1 vídeo cada 3 días sobre las guías

Réplica del montaje de EmpiezaPadel/EmpiezaLibros aplicado a **Tu Indemnización Laboral**. Objetivo:
**captar clientes** (leads) del despacho publicando en TikTok un vídeo vertical por guía, **1 cada
3 días**. Cada vídeo es un *listicle/explainer* faceless (tipografía cinética, sin cara ni stock),
generado con `tools/scaffold-video.js` + HyperFrames y cerrado con **CTA de consulta gratuita** hacia
`tuindemnizacionlaboral.com` (link en la bio).

Diferencia de negocio con los sitios hermanos: TIL **no monetiza por afiliación, capta leads**. El CTA
no es "guía gratis" sino "consulta gratuita"; en las guías de despido se menciona la **calculadora de
indemnización**. Doble foco que manda en el copy: **el trabajador que acaba de sufrir un accidente o un
despido** + **sus derechos** (qué puede reclamar y en qué plazo).

Aviso permanente (web jurídica real): **nunca inventar cuantías, plazos ni porcentajes** en pantalla
ni en el caption; un dato legal mal puesto es un problema, no una errata.

## Diferencia técnica con empiezalibros

TIL es estático **escrito a mano**: cada guía es un `guias/<slug>/index.html` propio, sin `index.html`
central con los datos. Por eso el scaffolder lee las guías **de sus carpetas** y se invoca por **slug**
(no por id `g1..g22`). Extrae el `<h1>` como título y el `<article>` como cuerpo; saca los puntos de
las listas largas (`<ul>/<ol>` ≥3 ítems) o de las secciones `<h2>`, **excluyendo** la sección de venta
final ("Así te lo resolvemos nosotros").

## Estado de las guías (21: 18 originales + 3 nuevas)

Todas encajan al 100% en el nicho (accidente laboral + despido) y tienen ganchos fuertes de "conoce
tus derechos". Ninguna se ha borrado. Cambios hechos el 30/07/2026 para el pipeline de vídeo:
- **Enriquecidas** (una 3ª sección `<h2>` de contenido, para vídeo gancho+3+CTA y mejor SEO):
  `despido-improcedente-vs-nulo-diferencias` (plazo de 20 días hábiles) y
  `plazos-reclamar-indemnizacion-accidente-laboral` (qué pasa si vence el plazo).
- **Nuevas**: `finiquito-vs-indemnizacion-no-es-lo-mismo`, `me-presionan-firmar-baja-voluntaria-que-hacer`,
  `acoso-laboral-mobbing-como-demostrarlo-que-reclamar` (temas de alta búsqueda y gancho potente).
- El resto (incluidas las de "2 secciones") dan 3-5 puntos limpios gracias a la minería de listas del
  scaffolder; ninguna necesitó reescritura.

## Calendario (arranque 2026-08-01, cada 3 días)

El calendario **máquina** con los 21 bloques (nº, fecha, slug, landing, caption+hashtags) vive en
`plan-tiktok/calendario-tiktok.txt`. Se front-cargan los temas de mayor intención de cliente (despido
con calculadora y los casos personales de gancho fuerte: sin carta, finiquito, baja voluntaria,
presión tras accidente). Tras el 30-sep: reciclar los que mejor funcionen con otro ángulo/gancho (no
republicar idéntico) y sumar guías nuevas según crezca el catálogo.

## Flujo operativo por vídeo (desde la raíz del repo)

1. `node tools/scaffold-video.js <slug>` → crea `videos/<slug>/` (borrador de guion+storyboard+estética
   navy/dorado).
2. **Revisar a mano** el gancho (Frame 1) y las líneas de voz del `SCRIPT.md` — son borrador. Sin
   cuantías/plazos inventados.
3. Ejecutar los pasos de máquina que imprime el scaffold (voz HeyGen → frames por workers →
   ensamblar → `npx hyperframes render`). Ver [[tiktok-video-pipeline]] en memoria.
4. Subir el MP4 a TikTok **a mano** (no hay API gratis); la música se pone en la app de TikTok al
   subir (mejor alcance y licencia). En la bio, enlace a `tuindemnizacionlaboral.com`.

## Notas

- **Sin coste de generación**: HyperFrames renderiza HTML→MP4 con Chrome headless + FFmpeg. Voz y
  música vía sesión HeyGen (OAuth en `~/.heygen/`). Voz ES: "Narrator Mateo"
  `0077225a877e457db4572ccaf245910b`, `--speed 1.12`.
- **Renovación de la sesión HeyGen**: hay `refresh_token`, así que se renueva **sin navegador** con
  `npx hyperframes auth refresh` (no interactivo). La rutina `til-tiktok-video` lo ejecuta best-effort
  antes de cada uso, de modo que el token se auto-renueva. Solo si el refresh falla de forma persistente
  hasta caducar hace falta el login interactivo `npx hyperframes auth login` (ese sí lo hace Alberto a
  mano; no se puede automatizar). Ojo: el endpoint de refresh de HeyGen a veces devuelve un 500
  transitorio (code 40099) — se ignora, no es fallo de credencial.
- **Guion sin frases cortadas a punto**: Mateo mete pausas largas en cada punto y seguido; escribir las
  líneas de voz unidas con comas/`;`.
- `videos/` está en `.gitignore` (proyectos grandes). Los activos de marca (`frame.md`,
  `caption-skin.html`) sí se versionan, en `tools/video-assets/`.
- **Automatizado**: la rutina `til-tiktok-video` (12:00 diario) lee el calendario máquina
  `plan-tiktok/calendario-tiktok.txt` + `plan-tiktok/generados.txt` y genera el vídeo que toque (1 cada
  3 días; nada en los días intermedios). Genera el MP4 en `videos/`; la subida a TikTok sigue siendo
  **manual**.

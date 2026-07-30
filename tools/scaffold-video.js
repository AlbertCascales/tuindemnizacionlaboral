/*
 * scaffold-video.js — Convierte una guía de Tu Indemnización Laboral en un proyecto de
 * vídeo HyperFrames (vertical TikTok) casi listo para renderizar, para no tener que
 * escribir a mano el storyboard/guion de cada vídeo.
 *
 * Uso:   node tools/scaffold-video.js <slug>        (p. ej. despido-sin-carta-ni-explicacion-que-hacer)
 *        node tools/scaffold-video.js --list        (lista las guías disponibles)
 *
 * DIFERENCIA con el scaffolder hermano de empiezalibros: TIL es estático escrito a mano,
 * SIN index.html central con los datos. Cada guía es un guias/<slug>/index.html propio, así
 * que aquí la fuente son esos ficheros (título = <h1>, cuerpo = <article>), no un literal JS.
 *
 * Qué genera en videos/<slug>/ :
 *   - BRIEF.md, capture/extracted/{visible-text.txt,tokens.json}
 *   - frame.md + .hyperframes/caption-skin.html  (copiados de tools/video-assets/,
 *     preset blockframe remix navy/dorado; estética de marca TIL)
 *   - STORYBOARD.md + SCRIPT.md  (listicle: gancho + N puntos + CTA de captación)
 *
 * Luego solo quedan los pasos "de máquina/agente" (ver README al final de la salida):
 *   voz TTS → construir frames → ensamblar → render.
 *
 * DISEÑO: la construcción de los frames HTML la hace un agente (workers de HyperFrames),
 * así que esto NO produce el MP4 solo; automatiza todo lo de ANTES. Los textos generados
 * son un BORRADOR sólido: repasa gancho y VO. Réplica del montaje de empiezapadel/empiezalibros
 * (ver memoria tiktok-video-pipeline).
 *
 * OJO (web jurídica real): nunca inventar cuantías/plazos/porcentajes en los frames.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const GUIDES_DIR = path.join(ROOT, 'guias');
const REF = path.join(ROOT, 'tools', 'video-assets'); // frame.md + caption-skin.html de marca
const MAX_POINTS = 6;         // tope de puntos (frames de contenido) por vídeo
const VOICE = '0077225a877e457db4572ccaf245910b'; // HeyGen "Narrator Mateo" (única voz ES)
const SPEED = '1.12';         // ver memoria tiktok-video-pipeline: corrige las pausas de Mateo
const DOMAIN = 'tuindemnizacionlaboral.com';

// Secciones de venta/cierre de las guías: NO son puntos de vídeo.
const SALES_RE = /Así te lo resolvemos|Cómo te ayudamos|Cómo te ayudo|Así te ayudamos/i;

// ---------------------------- utilidades de texto ----------------------------
function slugify(s) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
function stripHtml(s) { return String(s).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(); }
function firstSentence(s, max = 90) {
  const t = stripHtml(s);
  const m = t.match(/^(.+?[.!?])(\s|$)/);
  let out = (m ? m[1] : t).trim();
  if (out.length > max) out = out.slice(0, max - 1).replace(/\s+\S*$/, '') + '…';
  return out;
}
function upper(s) { return String(s).toUpperCase(); }
function esc(s) { return String(s).replace(/"/g, '\\"'); }

// Acorta un titular para la tarjeta (quita numeración/emoji inicial, "según…", ": …", paréntesis).
function shortHeading(h) {
  let s = stripHtml(h)
    .replace(/^\s*(?:[0-9]+[.)\-–]?\s*)+/u, '')          // "1. ", "2) "
    .replace(/\s*[:(].*$/, '').replace(/\s+según.*$/i, '').trim();
  // Los titulares de tarjeta deben caber: si viene una frase larga de un <li>, quédate con
  // la primera cláusula (hasta la primera coma) y como mucho ~8 palabras. El texto completo
  // sigue vivo en el takeaway; el titular es solo el rótulo grande (se afina por vídeo).
  s = s.split(/[,;.]/)[0].trim();
  const words = s.split(/\s+/);
  if (words.length > 8) s = words.slice(0, 8).join(' ') + '…';
  return s;
}

// ---------------------------- lectura de guías ----------------------------
function listGuides() {
  return fs.readdirSync(GUIDES_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && fs.existsSync(path.join(GUIDES_DIR, d.name, 'index.html')))
    .map((d) => d.name)
    .sort();
}

function readGuide(slug) {
  const file = path.join(GUIDES_DIR, slug, 'index.html');
  if (!fs.existsSync(file)) return null;
  const src = fs.readFileSync(file, 'utf8');
  const h1 = src.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const art = src.match(/<article[^>]*>([\s\S]*?)<\/article>/i);
  if (!h1 || !art) return null;
  return { slug, title: stripHtml(h1[1]), body: art[1] };
}

// Convierte un ítem de lista en {heading, takeaway}. Preferimos el <strong> como titular.
function itemToPoint(rawHtml) {
  const strong = rawHtml.match(/<strong[^>]*>(.*?)<\/strong>/i);
  if (strong) {
    const heading = shortHeading(strong[1]);
    let rest = stripHtml(rawHtml.replace(strong[0], '')).replace(/^[\s:,–\-—.]+/, '');
    return { heading: heading || stripHtml(strong[1]), takeaway: firstSentence(rest || strong[1], 70) };
  }
  const txt = stripHtml(rawHtml);
  const m = txt.match(/^(.{2,40}?)\s*[–\-—:,]\s*(.+)$/);
  if (m) return { heading: shortHeading(m[1]), takeaway: firstSentence(m[2], 70) };
  return { heading: shortHeading(txt), takeaway: firstSentence(txt, 70) };
}

// (a) Puntos por secciones <h2> — cada <h2> es un punto (texto = primer <p>/<li> de la sección),
//     EXCLUYENDO la sección de venta final.
function h2Points(body) {
  const pts = [];
  const re = /<h2[^>]*>([\s\S]*?)<\/h2>([\s\S]*?)(?=<h2|<\/article|$)/gi;
  let m;
  while ((m = re.exec(body)) && pts.length < MAX_POINTS) {
    const rawH = m[1];
    if (SALES_RE.test(stripHtml(rawH))) continue;              // fuera la sección de venta
    const section = m[2] || '';
    const p = section.match(/<p[^>]*>([\s\S]*?)<\/p>/i);
    const li = section.match(/<li[^>]*>([\s\S]*?)<\/li>/i);
    const takeaway = firstSentence(p ? p[1] : (li ? li[1] : rawH), 70);
    pts.push({ heading: shortHeading(rawH) || stripHtml(rawH), takeaway });
  }
  return pts;
}

// (b) Puntos por lista larga — primera <ul>/<ol> con ≥3 <li>, o <p> con ≥3 ítems separados por <br>.
function listPoints(body) {
  // <ul>/<ol>
  for (const m of body.matchAll(/<[uo]l[^>]*>([\s\S]*?)<\/[uo]l>/gi)) {
    const items = [...m[1].matchAll(/<li[^>]*>([\s\S]*?)<\/li>/gi)].map((x) => x[1]);
    if (items.length >= 3) return items.slice(0, MAX_POINTS).map(itemToPoint);
  }
  // <p> con <br>
  for (const m of body.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)) {
    if (!/<br\s*\/?>/i.test(m[1])) continue;
    const items = m[1].split(/<br\s*\/?>/i).map((s) => s.trim()).filter((s) => stripHtml(s).length > 3);
    if (items.length >= 3) return items.slice(0, MAX_POINTS).map(itemToPoint);
  }
  return [];
}

// Estrategia: preferimos las secciones <h2> cuando ya dan ≥3 (contenido más rico); si no,
// caemos a una lista larga (≥3); si tampoco, usamos lo mejor que haya (puede ser 2 → vídeo corto).
function extractPoints(body) {
  const h2 = h2Points(body);
  if (h2.length >= 3) return h2;
  const list = listPoints(body);
  if (list.length >= 3) return list;
  return h2.length >= list.length ? h2 : list;
}

// ------------------------------ CLI ------------------------------
const arg = process.argv[2];
if (!arg || arg === '--list') {
  const slugs = listGuides();
  console.log(`Guías disponibles (${slugs.length}):\n`);
  for (const s of slugs) {
    const g = readGuide(s);
    console.log(`  ${s}\n      ${g ? g.title : '(sin <h1>/<article>)'}`);
  }
  console.log('\nUso: node tools/scaffold-video.js <slug>');
  process.exit(0);
}

const slug = arg.replace(/^guias\//, '').replace(/\/$/, '');
const g = readGuide(slug);
if (!g) { console.error(`Guía "${slug}" no existe o no tiene <h1>/<article>. Usa --list.`); process.exit(1); }

const points = extractPoints(g.body);
if (points.length < 2) {
  console.error('No se extrajeron puntos suficientes (¿la guía no tiene <h2> ni listas?).');
  process.exit(1);
}
if (points.length < 3) {
  console.warn(`⚠ Solo ${points.length} puntos: saldrá un vídeo corto (gancho + ${points.length} + CTA). ` +
    `Considera enriquecer guias/${slug}/ con una 3ª sección, o revisa el borrador a mano.`);
}

const isDespido = /despido|finiquito|indemnizacion-despido/.test(slug);
const landing = `https://${DOMAIN}/guias/${slug}/`;

const projDir = path.join(ROOT, 'videos', slug);
if (fs.existsSync(projDir)) { console.error(`Ya existe ${path.relative(ROOT, projDir)} — bórralo o usa otro.`); process.exit(1); }

// ------------------------------ escribir proyecto ------------------------------
const mk = (p) => fs.mkdirSync(path.join(projDir, p), { recursive: true });
const wr = (p, c) => fs.writeFileSync(path.join(projDir, p), c);
mk('capture/extracted'); mk('.hyperframes'); mk('compositions/frames');

// frame.md + caption-skin de la marca (tools/video-assets/)
if (fs.existsSync(path.join(REF, 'frame.md'))) {
  fs.copyFileSync(path.join(REF, 'frame.md'), path.join(projDir, 'frame.md'));
  const skin = path.join(REF, 'caption-skin.html');
  if (fs.existsSync(skin)) fs.copyFileSync(skin, path.join(projDir, '.hyperframes', 'caption-skin.html'));
} else {
  wr('FRAME_TODO.txt', 'Falta tools/video-assets/frame.md. Recrear con build-frame.mjs --preset blockframe (recolor navy/dorado).');
}

// capture
wr('capture/extracted/visible-text.txt', `${g.title}\n\n${stripHtml(g.body)}\n\nConsulta gratuita en ${DOMAIN}`);
wr('capture/extracted/tokens.json', JSON.stringify({
  title: g.title, description: firstSentence(g.body, 140),
  colors: ['#c9932c', '#0f2a43', '#a97a1f'], fonts: ['Playfair Display', 'Inter']
}, null, 2) + '\n');

// BRIEF.md
wr('BRIEF.md', `---
workflow: faceless-explainer
flow: automation
storyboard: no
message: "${esc(g.title)}"
destination: tiktok
aspect: "9:16"
language: es
audience: "Trabajador tras un accidente laboral o un despido que no sabe qué puede reclamar"
angle: listicle
voice_provider: heygen
---

## Intent
Vídeo TikTok generado desde la guía "${g.title}" con el scaffolder. Tono de abogado laboralista
cercano que explica claro tus derechos, sin locución publicitaria y SIN dar por segura ninguna
cuantía/plazo (dato legal). CTA de CAPTACIÓN: consulta gratuita en ${DOMAIN} (link en la bio).
${isDespido ? 'Guía de despido: se puede mencionar la calculadora de indemnización por despido.\n' : ''}REVISAR gancho y VO antes de renderizar.

## Notes
- Landing: ${landing}
- Nicho: derecho laboral (accidente de trabajo y despido). Captamos leads, no vendemos afiliación.
- PROHIBIDO inventar importes, plazos o porcentajes en los frames (web jurídica real).
`);

// STORYBOARD.md
const N = points.length;
let sb = `---
format: 1080x1920
duration: ${8 + N * 6}s
message: "${esc(g.title)}"
arc: "Hook → ${N} puntos → CTA"
audience: "Trabajador tras accidente laboral o despido (TikTok)"
angle: listicle
mode: autonomous
music: "tense minimal underscore, seriedad contenida, sin voz"
---

## Video direction
- **palette** (frame.md): fondo navy #0f2a43; dorado #c9932c = marca y dato clave; texto blanco. Número gigante Playfair Display, cuerpo Inter. Tarjetas blancas con borde navy 4px + sombra dura (neobrutalismo). Nunca inventar colores.
- **motion**: eases power3, VO-paced (cada pieza entra en su cue hablado; nada en t=0). Reposo con jitter mínimo.
- **ESCENARIO COMPARTIDO (puntos)**: número gigante arriba-izq + pill "CLAVE" · titular del punto en blanco (entra) · tarjeta-clave dorada que hace spring-pop debajo con el dato/consejo. Mismo molde, contenido distinto; transición push-slide UP entre puntos.
- **negative list**: sin nav/cursores/chrome, sin bokeh ni degradados "AI", sin emojis. Sin cuantías/plazos inventados. Contenido en el 83% superior (UI de TikTok tapa el borde inferior).

## Frame 1 — Gancho
- scene: Título-gancho a pantalla completa
- voiceover: "EDITAR gancho: engancha en 2s con el problema real de '${g.title}'."
- duration: 4s
- transition_in: cut
- status: outline
- type: hook
- persuasion: Direct address
- beat: intriga
- blueprint: kinetic-type-beats (Adapt)
- focal: la frase-gancho
- roles: frase = foreground · fondo navy dot-grid = background · pill = supporting
- src: compositions/frames/01-gancho.html

Scene 1 (0.0–1.3s): entra una primera línea de contexto (Inter, upper, centrado alto). Fondo navy dot-grid dorado ~12%.
Scene 2 (1.3–2.7s): la línea-gancho hace scale-pop en Playfair dorado, dominando el centro.
Scene 3 (2.7–4.0s): remate + hold quieto.

narrativeRole: Abrir el hueco de curiosidad del tema (un derecho que el trabajador no sabe que tiene).
keyMessage: ${firstSentence(g.body, 80)}
`;

let script = `# SCRIPT — ${slug}

**Voice:** HeyGen Narrator Mateo (${VOICE}) · --speed ${SPEED}
**Voice direction:** Cercano, claro, con autoridad tranquila. Sin locución publicitaria. Ritmo ágil. Tono de abogado laboralista que te explica tus derechos de tú a tú.

---

## Line 1 — Gancho (Frame 1)
**Delivery:** Frase directa a cámara, tono "esto te interesa saberlo".

    EDITAR: gancho de 1 frase que enganche en 2 segundos.
`;

points.forEach((p, i) => {
  const n = i + 2;               // frame number
  const fid = String(n).padStart(2, '0');
  sb += `
## Frame ${n} — Punto ${i + 1}: ${p.heading}
- scene: Número "${i + 1}"; "${upper(p.heading)}"; tarjeta dorada con el consejo
- voiceover: "${esc(p.heading)}: ${esc(firstSentence(p.takeaway, 70))}"
- duration: 6s
- transition_in: push-slide UP
- status: outline
- type: feature_showcase
- persuasion: Progressive disclosure
- beat: comprension
- blueprint: kinetic-type-beats (Adapt)
- focal: el titular "${upper(p.heading)}"
- roles: número "${i + 1}" = supporting · titular = foreground · tarjeta dorada = foreground · fondo = background
- sfx: thock, pop
- src: compositions/frames/${fid}-punto-${i + 1}.html

Usa el ESCENARIO COMPARTIDO. Adapt de kinetic-type-beats.
Scene 1 (0.0–1.3s): "${i + 1}" gigante dorado entra (scale-pop, thock) + pill "CLAVE".
Scene 2 (1.3–3.4s): "${upper(p.heading)}" entra en blanco (centrado).
Scene 3 (3.4–5.0s): tarjeta dorada spring-pop con el consejo: "${esc(firstSentence(p.takeaway, 60))}".
Scene 4 (5.0–6.0s): hold quieto.

narrativeRole: Enseñar el punto ${i + 1} del tema.
keyMessage: ${p.takeaway}
`;
  script += `
## Line ${n} — Punto ${i + 1} (Frame ${n})
**Delivery:** Claro, un punto por respiración.

    ${p.heading}: ${firstSentence(p.takeaway, 70)}
`;
});

const cta = N + 2;
const ctaVO = isDespido
  ? 'Calcula tu indemnización y pídenos consulta gratis en tuindemnizacionlaboral punto com'
  : 'La primera consulta es gratis, escríbenos desde tuindemnizacionlaboral punto com';
sb += `
## Frame ${cta} — CTA
- scene: Wordmark "Tu Indemnización Laboral" (Laboral en dorado) + URL ${DOMAIN}
- voiceover: "${ctaVO}."
- duration: 4s
- transition_in: crossfade
- status: outline
- type: cta
- persuasion: Callback + Distillation
- beat: resolucion
- blueprint: titlecard-reveal (Reproduce)
- focal: wordmark + URL
- roles: wordmark = foreground · "gratis" pill = supporting · icono balanza = supporting · fondo = background
- sfx: soft-chime
- src: compositions/frames/${String(cta).padStart(2, '0')}-cta.html

Reproduce de titlecard-reveal: un movimiento contenido y hold. Navy/dorado de marca.
Scene 1 (0.0–1.4s): icono de balanza + "Tu Indemnización Laboral" (Laboral en dorado) slide-up al centro.
Scene 2 (1.4–2.8s): "${isDespido ? 'CALCULA tu indemnización · consulta GRATIS' : 'Primera consulta GRATIS'}" debajo; "GRATIS" en pill dorada.
Scene 3 (2.8–4.0s): "${DOMAIN}" subrayado en dorado; hold. (Recordar en el caption: link en la bio.)

narrativeRole: Convertir la atención en una consulta (lead) para el despacho.
keyMessage: Consulta gratuita en ${DOMAIN}.
`;

script += `
## Line ${cta} — CTA (Frame ${cta})
**Delivery:** Cálido y de confianza; "gratis" con énfasis.

    ${ctaVO}.
`;

wr('STORYBOARD.md', sb);
wr('SCRIPT.md', script);

// ------------------------------ instrucciones ------------------------------
const rel = path.relative(ROOT, projDir).replace(/\\/g, '/');
const SK = 'C:/Users/marti/.claude/skills/faceless-explainer/scripts';
console.log(`✓ Proyecto creado: ${rel}
  guía: ${slug} — "${g.title}"
  frames: 1 gancho + ${N} puntos + 1 CTA = ${N + 2}

REVISA primero (borrador): el gancho (Frame 1 / Line 1) y las líneas de VO en SCRIPT.md.
Recuerda: NADA de cuantías/plazos inventados en pantalla (web jurídica real).

Luego, pasos de máquina/agente (desde ${rel}/):
  1. Voz+música+SFX:  node "${SK}/audio.mjs" --script ./SCRIPT.md --storyboard ./STORYBOARD.md --hyperframes . --out ./audio_meta.json --voice ${VOICE} --speed ${SPEED}
  2. sync + sfx:      node "${SK}/audio.mjs" sync-durations --audio-meta ./audio_meta.json --storyboard ./STORYBOARD.md
                      node "${SK}/audio.mjs" fetch-sfx --storyboard ./STORYBOARD.md --hyperframes .
  3. packets:         node "${SK}/frame-packets.mjs" --project . --storyboard ./STORYBOARD.md
  4. Construir frames: despachar 1 worker por frame (Claude) con _role.md + su packet.
  5. Ensamblar:       node "${SK}/assemble-index.mjs" --storyboard ./STORYBOARD.md --hyperframes .
                      node "${SK}/transitions.mjs" inject --storyboard ./STORYBOARD.md --hyperframes .
  6. Check + render:  npx hyperframes check  &&  npx hyperframes render --skill=faceless-explainer --quality high --output renders/video.mp4
`);

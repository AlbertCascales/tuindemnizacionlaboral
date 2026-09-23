---
version: 1
name: Tu Indemnización Laboral — Documento 3D en despacho de noche (motion comic)
description: >
  Estilo de vídeo aprobado por el usuario el 23/09/2026 (demo "Despido: ¿20 o 33 días?"). Sustituye al
  blockframe navy/dorado (guardado en frame-blockframe.md). El protagonista visual es el DOCUMENTO del
  caso (carta de despido, parte de accidente, baja médica, finiquito, nómina…) en 3D, sobre un despacho
  de noche con persianas; viñetas animadas SVG/CSS cuentan la situación del trabajador; las cifras
  legales salen como contadores grandes. Referencia viva copiada en el proyecto: `referencia-demo.html`.
  Léela antes de construir un frame y reutiliza su CSS y sus patrones.
unit: 1080×1920 vertical · contenido en el 83% superior (y ≤ 1594px)
principle: el documento se ve · la situación se ilustra · CERO cuantías, plazos o porcentajes inventados
---

## Paleta
- fondo: #050d16 con radial navy #163a5c → #0a1e33; persianas (franjas de luz cálida sesgadas); glow dorado rgba(201,147,44,.22)
- marca: navy #0f2a43 · dorado #c9932c / #e8b95a (dato clave, `<em>`, CTA) · texto #f4f7f9 · papel #f3efe6
- sobre papel, el dorado de texto es #8a5d10 (contraste AA)

## Tipografía (locales en `assets/fonts/`, @font-face root-relative)
- Display: Playfair Display 700–900 · Cuerpo y etiquetas: Inter
- **Siempre `font-variant-numeric: lining-nums`**: Playfair trae números antiguos que bajan de la línea y
  pisan el texto de debajo (pasó con el «33» de la demo)

## Componentes
- **Documento 3D** (`.docwrap > .doc > .sheet`, ver referencia): hoja de papel con otra hoja debajo, cabecera
  pequeña ("Empresa · RR. HH." o la que toque), título en Playfair (Carta de despido / Parte de accidente /
  Baja médica…), líneas de texto como barras grises, un campo con «¿?» en dorado (la cifra o el dato que se
  cuestiona) y una firma. Nunca un logo real de empresa ni un documento oficial copiado: es un documento
  genérico. Cae girando (rotationY -720→-14, desde z≈-700 para que se vea ya en t=0) y rebota (thock).
- **Caption narrativo** (`.cap`): Playfair 78px en y≈1290, palabra a palabra, clave en `<em>` dorado, `.capfade` detrás.
- **Cifras legales**: columnas con número gigante que cuenta (20 / 33 días…), su tope y a qué caso se aplica.
  SOLO cifras que estén literalmente en la guía de la que sale el vídeo. Fórmulas simbólicas (bruto anual ÷ 365),
  nunca un ejemplo con importes inventados.
- **Sello** del cierre (borde dorado, fondo casi opaco, UNA línea, nowrap): «Revísala gratis», «Consulta gratis».
- **CTA**: «Consulta gratuita» + dominio; nota pequeña «Cálculo orientativo…» cuando haya cifras.

## Viñetas (motion comic) — la situación del trabajador
Vocabulario probado en la referencia:
- despacho de noche: persiana, reloj de pared que corre, lámpara con cono de luz, persona sentada de espaldas,
  caja de cartón con sus cosas que cae sobre la mesa (sacudida)
- el documento en grande con una lupa que se desliza sobre la cifra y la cifra que late
Ideas análogas: andamio o máquina sin protección con señal de peligro, suelo mojado sin señalizar,
ambulancia, calendario con el plazo que se tacha (solo si el plazo está en la guía), balanza, firma bajo presión
(una mano empuja el papel), hucha. Siluetas planas y sobrias, nada sangriento ni morboso.

## Fotograma 0 nunca vacío
El primer fotograma es la miniatura, y la portada por defecto en TikTok: el documento ya visible y la pill
arriba. Incidente del 23/09/2026: las demos «salían en negro» porque en t=0 el objeto aún no había entrado.

## Movimiento
- eases power3/expo al entrar, sine.inOut en reposo; fundidos cortos (.3–.4s) entre viñetas
- una timeline GSAP pausada, seek-safe (`immediateRender:false` en fromTo repetidos); nada de letterSpacing animado
- el texto entra EN SU CUE de voz (timestamps de `audio_meta.json`)

## Prohibido
- inventar cuantías, plazos, porcentajes o casos; prometer resultados
- logos de empresas reales, emojis, bokeh "IA"; contenido por debajo de y=1594

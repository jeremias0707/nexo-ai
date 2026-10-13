# NEXO AI 3.0 — Notas para Jere

Fecha: 13 oct 2026. Base: 2.7 tal cual se publicó. Gratis, sin servicios pagos y sin librerías nuevas. Acceso (código + token + cupos de 40 chats / 5 exámenes) igual.

## Las 3 novedades

1. **Repasar mis errores (repaso que se adapta).** NEXO anota en el dispositivo lo que te cuesta: preguntas mal en exámenes, fichas marcadas "No la sabía" y cuando decís "no entendí" en el chat. Lo agrupa por materia y tema con un peso. "Arrancar ronda de 5 preguntas" arma preguntas nuevas sobre los 3 temas más flojos (usa 1 examen del cupo). Si acertás, el tema baja; si fallás, sube. Se puede borrar todo.
2. **Apuntes a material de estudio.** Subís un PDF o hasta 3 fotos del cuaderno y con un botón sale un kit: resumen, fichas (se guardan solas en Fichas), diagrama y examen de práctica de esos apuntes. El kit usa 1 chat del cupo y el examen 1 examen. Los apuntes no se guardan; el último kit sí.
3. **Plan de estudio con varias materias.** Cargás materias, fechas de examen, temas (opcional) y minutos por día. NEXO arma en el dispositivo (sin IA, no gasta cupo) un plan día por día hasta cada examen: aprender temas, fichas, repasar errores, examen de práctica dos días antes y repaso final el día anterior. En la home aparece "Hoy toca" con tildes. Si un día no hacés algo, al otro día lo reacomoda y avisa. Cada tarea abre la herramienta que corresponde (chat, Fichas, Repasar mis errores, Apuntes o Modo examen). Recordatorio del navegador opcional (gratis; avisa al abrir NEXO). El plan viejo de la 2.6 se pasa solo al nuevo.

Versión visible: "NEXO 3.0" en el pie del menú lateral.

## Cambios técnicos
- Ruta nueva: POST /api/kit (src/routes/api/kit.ts). Mismo acceso por dispositivo y mismo cupo de chats.
- /api/exam acepta un campo opcional "focus" (hasta 5 frases cortas) para la ronda de errores.
- Datos nuevos en localStorage: nexo-weak-spots, nexo-kit-last, nexo-plan3.

## Tests
- src/lib: todos OK (nuevos: weak-spots, kit, plan3). Typecheck y build OK.
- scripts/: siguen los mismos 8 tests viejos fallando (og:title / PWA), igual que en 2.5–2.7.
- Lint: mismos 4 errores viejos, ninguno nuevo.

## Límites honestos
- Probado con IA simulada: falta ver en vivo la calidad de la ronda de errores y del kit.
- El examen del kit usa solo la primera foto.
- El recordatorio solo aparece al abrir NEXO (no hay avisos con la app cerrada).

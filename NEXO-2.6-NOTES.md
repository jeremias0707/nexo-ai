# NEXO AI 2.6 — Notas para Jere

Fecha: 5 oct 2026. Herramientas de estudio. **Gratis** (sin pagos, sin micropagos). Stage A (código + token + cupos) sigue igual.

## Las 8 mejoras

1. **Plan de estudio semanal** — Menú → Estudio → **Plan** (o "Plan de estudio" en la home). Elegís materia, fecha del examen, temas (opcional) y minutos por día. Arma un plan de hasta 7 días: aprender, fichas, repaso espaciado, simulacro y repaso final. Se arma en el celu, sin IA. Si querés, **Pedirle los temas a NEXO** o **Pedir ayuda** en una tarea (usa 1 chat). Las tareas se tildan y quedan guardadas.
2. **Fichas desde el chat** — Debajo de cada respuesta: botón **Fichas**. Convierte la explicación en fichas (pregunta / respuesta), las podés editar o borrar antes de guardar. Se practican en **Fichas** (filtros: Todas, Del chat, Favoritos, Errores) **sin internet**. Opción "Pedirle a NEXO fichas mejores (1 chat)".
3. **Modo oral** — Ajustes → Modo de respuesta → **Oral** (explica como para decirlo en un oral) o **Profe (oral)** (te toma oral: una pregunta por vez y corrige con Bien / A medias / Mal + tip). Atajo: **Tomame oral** en la home o **Modo oral** en el menú. Arriba del cuadro de texto aparece "Modo oral" con **Salir**. Se puede responder con el micrófono.
4. **Comparar con el apunte** — Botón **Comparar** debajo de una respuesta (o Menú → Comparar). Elegís el PDF/apunte y compara frase por frase: **coincide**, **parecido: revisalo**, **no está en el apunte**. Muestra la página y el pedazo del apunte, números distintos y palabras clave del apunte que faltan. Se hace en el dispositivo (gratis). Opción de revisión con IA (1 chat).
5. **Racha y metas** — Meta diaria de **10 min** (se cambia a 5/15/20 en Ajustes). Cuenta el tiempo con NEXO abierto y en uso (se pausa a los 3 min sin tocar nada). Al cumplirla suma un día a la racha de estudio y avisa. Tarjeta con anillo y últimos 7 días en la home. Todo local, sin pagos.
6. **Modo grupo** — Menú → **Grupo**. Mismo código de clase = mismas 3 preguntas del día (de un banco fijo, sin IA). Sin chat, sin nombres. Al terminar ves cuántos de la clase lo hicieron y el promedio (contador anónimo; cuenta el primer intento). "Compartir resultado" copia un texto corto.
7. **Exportar resumen** — Menú → **Exportar**. Elegís qué incluir (conversación abierta, plan, racha, fichas, exámenes y errores), ves la vista previa y bajás **PDF** o **Texto**. Se genera en el dispositivo. Opción "Pedirle a NEXO un resumen primero (1 chat)".
8. **Mejor corrección escrita** — En Modo examen, cada respuesta escrita sale como **Bien / A medias / Mal**, con qué faltó en una frase y un **Tip** corto para mejorar. Leyenda de la rúbrica arriba de las preguntas y resumen "1 bien · 1 a medias · 1 mal".

## Qué no cambia

- Puerta Stage A (`/api/access`, header `X-Nexo-Device`, 40 chats / 5 exámenes por día).
- Lo que usa IA gasta el mismo cupo de chats (siempre dice "1 chat"). Plan, fichas, comparar, racha, grupo y exportar **no gastan cupo**.
- Sin cuentas de mail. Sin servicios pagos nuevos. Sin librerías nuevas (el PDF se arma con código propio).
- Donar sigue siendo el link de Mercado Pago, opcional.
- No se tocó `/workspace/nexo-gemini`.

## Cómo probar rápido

1. Preview: canjear código → chat responde.
2. Preguntá algo → abajo de la respuesta tocá **Fichas** → Guardar → Menú → Fichas → practicá.
3. Misma respuesta → **Comparar** → elegí un PDF → Comparar.
4. Menú → Plan → materia + fecha + temas → Armar plan → tildá una tarea.
5. Home → **Tomame oral** → escribí el tema → respondé lo que pregunta.
6. Menú → Grupo → Crear código → respondé las 3 → Terminar. En otro celu con el mismo código salen las mismas preguntas.
7. Menú → Exportar → PDF y Texto.
8. Modo examen → contestá una escrita a medias → mirá Bien / A medias / Mal + Tip.
9. Usá NEXO 10 minutos → aviso "¡Meta diaria cumplida!".

## Tests

- Tests nuevos: `study-plan`, `flashcards`, `compare`, `study-goal`, `group`, `export` (+ rúbrica en `exam.test.ts`, modo oral en `settings.test.ts`). Todos los tests de `src/lib` pasan (194).
- `npm test` sigue cortando en 8 tests viejos de `scripts/` (og:title / PWA de la plataforma). Ya fallaban en 2.5; no son de esta versión.
- `npm run typecheck` y `npm run build` OK.

## Empaque

- Código listo en `/workspace/nexo-v2`.
- Zip: `/workspace/nexo-ai-v2.6.zip` (sin `node_modules`).
- Capturas de prueba: `screenshots/v2.6/`.
- **No publicar** a Grok ni GitHub todavía: se hace cuando digas.

## Límites honestos

- **Comparar** sin IA mira palabras, no el sentido: una frase dicha con otras palabras puede salir "parecido" o "no está". Por eso dice "revisalo" y ofrece la revisión con IA.
- Las **fichas automáticas** salen de definiciones, listas y frases "X es Y". Si la respuesta es muy libre salen pocas: editalas o pedí "fichas mejores".
- **Modo grupo**: el contador está en la memoria del servidor; si se reinicia, se pierde el número del día (tus resultados quedan en tu celu). Las preguntas son de un banco fijo (41), así que en semanas se repiten.
- La **racha de estudio** (minutos) es distinta de la racha de días con preguntas (XP); las dos son locales y se borran si borrás los datos del sitio.
- El **PDF exportado** usa letra simple: símbolos raros (emojis, letras griegas) se cambian por texto.
- **Modo oral** no lee en voz alta solo: tocá **Escuchar** en la respuesta.
- La app **Android (Flutter)** no tiene estas pantallas nuevas todavía (no se tocó). Windows abre la web, así que las ve cuando se publique.

## Si algo falla

- Sin token → 401 (esperado), también en `/api/group`.
- Plan, fichas, meta y grupo viven en `localStorage` (`nexo-plan`, `nexo-chat-cards`, `nexo-goal`, `nexo-group`).

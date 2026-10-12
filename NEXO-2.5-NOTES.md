# NEXO AI 2.5 — Notas para Jere

Fecha: 5 oct 2026. Solo mejoras de IA / estudio. **Gratis** (sin camino pago). Stage A (código + token + cupos) sigue igual.

## Las 8 mejoras

1. **Menos inventos** — El tutor, el examen y la corrección dicen más fuerte: si no están seguros, lo dicen; no inventan fechas, fórmulas, páginas de PDF ni datos de fotos.
2. **Modo estudio guiado** — En Ajustes → Modo de respuesta → **Guiado**. Pregunta qué sabés antes de soltar toda la explicación (socrático suave).
3. **Repaso del error** — Si desaprobás un examen, aparece **Repaso del error (hasta 3 preguntas)** solo con las que fallaste. Sin llamar al modelo para armar preguntas nuevas.
4. **Mejor PDF/foto** — Cita más clara `(pág. N)` y avisa partes no leídas (páginas faltantes, foto borrosa). No inventa lo que no se ve.
5. **Respuestas más cortas en el celu** — En pantallas chicas prioriza respuestas cortas (y “Simple” por defecto si nunca tocaste “Cómo explica”). “A fondo” sigue largo si lo elegís.
6. **Desafío diario** — Al abrir, en la pantalla vacía: un desafío corto del día (local). Al tocarlo, manda la pregunta al chat (usa el cupo gratis de chats).
7. **Materias escolares** — Chips: Mate, Histo, Bio, Física, Química, Lengua, Inglés, Geo. Ajustan el tono del tutor. Quedan en este dispositivo.
8. **Historial útil** — En cada conversación del menú: **Seguir con este tema** (abre chat nuevo retomando el título, sin arrastrar todo el historial viejo).

## Qué no cambia

- Puerta Stage A (`/api/access`, header `X-Nexo-Device`, 40 chats / 5 exámenes).
- Sin cuentas de mail obligatorias.
- No se tocó `/workspace/nexo-gemini`.
- Android / Windows: se publican después, como 2.5, cuando digas.

## Cómo probar rápido

1. Preview: canjear código → chat responde.
2. Ajustes → Guiado → preguntá algo.
3. En el celu (o ventana angosta): respuestas más cortas.
4. Elegí materia Mate → preguntá una ecuación.
5. Terminá un examen flojo → “Repaso del error”.
6. Menú → “Seguir con este tema” en un chat viejo.
7. Toque el Desafío diario en la home.

## Empaque

- Código listo en `/workspace/nexo-v2`.
- Zip: `/workspace/nexo-ai-v2.5.zip` (sin `node_modules`).
- **No publicar** a Grok ni GitHub todavía: el padre lo hace cuando digas.

## Si algo falla

- Sin token → 401 (esperado).
- Desafío diario / materias / historial viven en `localStorage` del dispositivo.

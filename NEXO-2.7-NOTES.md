# NEXO AI 2.7 — Notas para Jere

Fecha: 12 oct 2026. Base: 2.6 tal cual se publicó. Gratis, sin servicios nuevos, sin librerías nuevas. Stage A (código + token + cupos) igual.

## Las 3 mejoras

1. **Inventa menos y avisa cuando duda** — El tutor tiene un bloque nuevo de "Honestidad": no inventa fechas, cifras, nombres, citas, fuentes, links ni páginas. Cuando duda escribe una línea "No estoy seguro: ... chequealo con tu profe o el libro" y debajo de esa respuesta aparece un aviso chico: "NEXO no está seguro de una parte". Si le piden bibliografía que no usó, dice que no tiene una fuente concreta. Separa lo que sale de tu apunte de lo que agrega él ("Fuera del apunte:" / "(esto no está en tu apunte)").
2. **Lee y cita mejor PDF y fotos** — Cada página del PDF ya iba marcada como [Página N]; ahora el tutor sabe qué rango de páginas existe y solo puede citar esas (pág. N). Las páginas sin texto (imagen o escaneo) quedan marcadas "sin texto legible" para que no invente qué dicen. Los apuntes .txt/.md no tienen páginas: cita el título o la sección. Citas textuales solo con palabras exactas entre comillas. En fotos, nombra el ejercicio por su número/letra o por dónde está en la hoja, sin inventar números.
3. **Atajos por materia y seguir desde el historial** — En la home, al tocar una materia aparece "Nuevo chat de Historia" (etc.): abre un chat nuevo con "Historia: " listo para escribir (no gasta chat hasta que mandás). Arriba de la home: **Seguir donde quedaste** con la última conversación (cuándo fue y la materia) y abajo las 3 anteriores; un toque y volvés a esa conversación tal cual estaba. Cada conversación guarda su materia y al reabrirla vuelve a esa materia.

Versión visible: "NEXO 2.7" en el pie del menú lateral.

## Tests
- src/lib: 202 tests OK (nuevos: uncertain.test.ts, resume.test.ts, citas en document.test.ts). Hay que correrlos con Node 22.
- scripts/: siguen los mismos 8 tests viejos fallando (og:title / PWA), igual que en 2.5 y 2.6.
- typecheck y build OK. Lint: mismos 4 errores viejos de 2.6, ninguno nuevo.

## Límites honestos
- El aviso "no está seguro" depende de que el modelo escriba la línea; no hay forma de garantizar al 100% que avise siempre.
- Un PDF escaneado sigue sin poder leerse como texto (hay que mandar fotos).

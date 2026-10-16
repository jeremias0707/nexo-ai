# NEXO AI 3.0.1 — Notas para Jere

Fecha: 16 oct 2026. Base: 3.0.

- **Chats sin límite hasta el 14 de noviembre.** Hasta el 14/11/2026 a las 00:00 (hora de Buenos Aires) no hay tope diario de chats por dispositivo (incluye "Apuntes a material", que usa el cupo de chats). Desde ese momento vuelve solo el tope de 40 chats por día: el código mira la fecha, no hace falta republicar.
- Siguen igual: 5 exámenes por día y el tope de 12 pedidos por minuto. También sigue el tope general de seguridad de todo NEXO (2.000 chats por día entre todos los dispositivos).
- /api/status: mientras dure, "caps" dice "chats": null y "unlimitedUntil": "2026-11-14T00:00:00-03:00". Después vuelve a "chats": 40.
- Textos: pie del menú, pantalla del código y Apuntes dicen "chats sin límite hasta el 14 de noviembre"; después vuelven solos a "40 chats". La política de privacidad lo explica.
- Versión visible: "NEXO 3.0.1".
- Tests nuevos para antes y después de la fecha (access-caps.test.ts y rate-limit.server.test.ts).

# NEXO AI 3.0.2 — Notas para Jere

Fecha: 19 oct 2026. Base: 3.0.1. Aprobado por Jere después del aviso de costo y abuso.

- **Sin código de acceso.** La app abre directo, sin pantalla de código. El servidor ya no lee ningún código (la variable NEXO_ACCESS_CODE queda sin uso). /api/chat, /api/kit, /api/exam, /api/exam-grade y /api/group funcionan sin token.
- **Chats sin límite diario, para siempre** (se sacó la vuelta automática del 14/11).
- **Se mantienen:** 5 exámenes por día por dispositivo, 12 pedidos por minuto, y los topes generales de seguridad (2.000 chats y 200 exámenes por día entre todos).
- Cada navegador/app genera un identificador aleatorio solo para contar esos topes. /api/access sigue existiendo para las apps viejas (Android): devuelve un identificador nuevo e ignora cualquier código.
- /api/status: "accessRequired": false y "caps": {"chats": null, "exams": 5, "perMinute": 12}.
- Textos: pie del menú, Apuntes y política de privacidad. Versión "NEXO 3.0.2".

## Límites honestos
- Sin código, cualquiera con el link puede usar NEXO. El identificador lo genera el cliente: alguien que sepa puede borrarlo para saltear los 5 exámenes. El tope real de gasto son los topes generales (2.000 chats / 200 exámenes por día); si se llenan, NEXO deja de responder hasta el día siguiente para todos.

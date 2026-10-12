# NEXO 2.0 — Plan (sin diagramas)

Para Jeremías. Texto corto. Actualizado: 5 oct 2026.

## Qué había (v13 / nexo-v2)

| Pieza | Estado |
| --- | --- |
| Chat / examen / corrección | Públicos: cualquiera podía pegarle a la API |
| Límites en Grok | En memoria, **compartidos por toda la app** (40 chats / 5 exámenes / 12 por minuto). No por persona. Se reinician si el servidor reinicia |
| Better Auth | Apagado (`VITE_AUTH_ENABLED=false`). Sin base de datos en Grok (`deploy.database: false`) |
| Privacidad | Decía “no hay cuentas” y un límite por minuto; no hablaba bien del tope diario ni del código |
| Menú web | Muchos botones al mismo nivel (examen, perfil, favoritos, fichas, desafío, ajustes…) |
| Android / Windows | Hablan con la misma API; Windows abre el sitio; Android Flutter llama `/api/*` |

## Qué pedía 2.0 (sin diagramas)

1. Que un desconocido **no queme** la API de Grok  
2. Tope **por persona / dispositivo** (chats y exámenes)  
3. Menú más limpio  
4. Mensaje claro: **gratis con límite diario** + privacidad al día  

## Recomendación (Stage A) — cabe en Grok gratis

**Código de acceso compartido + token por dispositivo en memoria.**

Cómo funciona:

1. En Grok Builder se configura el secreto `NEXO_ACCESS_CODE` (ej. una frase que solo vos compartís).  
2. La persona abre NEXO, escribe el código una vez.  
3. El servidor entrega un token; se guarda en el navegador (`localStorage`).  
4. Cada chat/examen manda el header `X-Nexo-Device`. Sin token válido → **401**, no se llama a xAI.  
5. El cupo diario (40 / 5) se cuenta **por dispositivo** en memoria. Hay además un tope general del proceso por si el código se filtra.

### Ventajas

- No hace falta pagar una base de datos  
- Funciona en el host actual de Grok  
- Cierra el acceso público anónimo  
- Sigue siendo “sin cuenta de mail”

### Límites (hay que ser honestos)

- Si el servidor **reinicia**, los tokens y el conteo se pierden → hay que volver a poner el código  
- Si alguien **tiene el código**, puede activar varios dispositivos (hay tope de altas por día)  
- No es identidad real (borrar datos del sitio = otro dispositivo)  
- Si más adelante Grok corre en varias máquinas, la memoria no se comparte → ahí sí hace falta DB o otro host  

### Alternativa Stage B (cuando haga falta)

Publicar en **Vercel + Neon gratis** (o similar): límites durables por usuario/IP y, si querés, login real. Más pasos técnicos; no es obligatorio para empezar.

## Etapas

| Etapa | Qué | Host |
| --- | --- | --- |
| **A (ahora)** | Código + token + cupos por dispositivo + menú “Más” + textos gratis/privacidad | Grok |
| **A2** | Misma puerta en **Android Flutter** (guardar token y mandar el header) | Misma API |
| **A3** | App Windows: como abre el sitio web, hereda la puerta sola | — |
| **B** | DB durable / login real si el uso crece | Vercel u otro |
| **C** | Diagramas / Mermaid in-app (fuera de este plan) | — |

## Qué ya se empezó en `/workspace/nexo-v2`

- `src/lib/access.server.ts` — canje de código, tokens, topes globales  
- `src/lib/access-client.ts` + `access-constants.ts` — token en el navegador  
- `src/routes/api/access.ts` — `GET/POST /api/access`  
- Chat / examen / corrección exigen token **antes** de llamar a xAI  
- Rate limit en Grok: buckets **por dispositivo**  
- Pantalla de código (`AccessGate`)  
- Menú: bloque **Más** (favoritos, fichas, desafío, ajustes) + texto “Gratis · 40 chats…”  
- `public/privacidad.html` actualizada (5 oct 2026)  

## Qué falta antes de publicar

1. Definir el código y cargarlo en Grok Builder como `NEXO_ACCESS_CODE` (secreto; no subirlo al zip ni a git)  
2. Probar en preview: canjear código → un chat responde; sin token → 401  
3. Armar mensaje de publicación (como los `nexo-ai-v*-mensaje-grok.txt`)  
4. Avisar a quienes usan Android que en A2 habrá que actualizar la app  

## Android / Windows (nota)

- **Windows:** al abrir el sitio, usa la misma puerta web.  
- **Android:** hoy no manda `X-Nexo-Device`; cuando Stage A esté en producción, la app vieja recibirá 401 hasta A2. Coordinar publicación web + update de Play.

## Decisión pedida a Jere

1. ¿Seguimos con **Stage A** (código compartido) en Grok? (recomendado)  
2. ¿Qué código querés usar? (lo cargás vos en Grok; el equipo no lo pega en el repo)  
3. ¿Publicamos A en web primero y Android después?

## Tests / build en esta caja

- Se agregaron `src/lib/access.server.test.ts` y un caso per-device en `rate-limit.server.test.ts`.
- En esta máquina todavía **no hay `node_modules`** y Node es v20 (el `package.json` usa `--experimental-strip-types`, típico de Node 22). Antes de publicar: `npm install` en un entorno compatible y `npm test`.

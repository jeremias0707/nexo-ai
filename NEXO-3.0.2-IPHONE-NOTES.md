# NEXO 3.0.2 — iPhone (app instalable desde Safari)

Sin cambios de funciones; la versión sigue siendo 3.0.2.

- `public/manifest.webmanifest`: "NEXO AI", standalone, #050505, íconos 192/512 + maskable.
- `server/middleware/0-nexo-manifest.ts`: responde `/__grok/manifest.webmanifest` con ese manifest
  (corre antes que el de la plataforma, que era genérico "Grok App"). Un solo `<link rel="manifest">`.
- `public/__grok/icon-180.png` y `public/icons/apple-touch-icon.png`: ícono NEXO 180x180.
- `__root.tsx`: `viewport-fit=cover`, `apple-mobile-web-app-capable`, `status-bar-style black-translucent`, título.
- `styles.css`: `.safe-app` / `.safe-fixed` / `.safe-page` con `env(safe-area-inset-*)`; inputs ≥16px en iOS.
- `ios-tip.tsx` + `lib/ios-install.ts`: aviso descartable solo en Safari de iPhone sin instalar.
- Sin service worker: siempre carga la versión nueva.

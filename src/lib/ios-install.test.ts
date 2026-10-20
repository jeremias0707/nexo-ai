import test from "node:test";
import assert from "node:assert/strict";
import { isIosSafari, shouldShowIosTip } from "./ios-install";

const SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
const CHROME_IOS =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/126.0 Mobile/15E148 Safari/604.1";
const ANDROID = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36";

test("muestra el aviso solo en Safari de iPhone sin instalar", () => {
  assert.equal(shouldShowIosTip({ userAgent: SAFARI }, false), true);
  assert.equal(shouldShowIosTip({ userAgent: SAFARI, standalone: true }, false), false);
  assert.equal(shouldShowIosTip({ userAgent: SAFARI, displayStandalone: true }, false), false);
  assert.equal(shouldShowIosTip({ userAgent: SAFARI }, true), false);
  assert.equal(shouldShowIosTip({ userAgent: CHROME_IOS }, false), false);
  assert.equal(shouldShowIosTip({ userAgent: ANDROID }, false), false);
});

test("iPad con iPadOS (se presenta como Mac) cuenta como iOS", () => {
  const ua = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  assert.equal(isIosSafari({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 5 }), true);
  assert.equal(isIosSafari({ userAgent: ua, platform: "MacIntel", maxTouchPoints: 0 }), false);
});

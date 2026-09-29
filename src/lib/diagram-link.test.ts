import assert from "node:assert/strict";
import { test } from "node:test";
import { decodeDiagram, encodeDiagram } from "./diagram-link.ts";

test("round-trips mermaid code with accents through the URL hash", () => {
  const code = "flowchart TD\n  A[Célula] --> B{¿Núcleo?}\n  B -->|Sí| C[Eucariota]";
  const encoded = encodeDiagram(code);
  assert.match(encoded, /^[A-Za-z0-9_-]+$/);
  assert.equal(decodeDiagram(`#${encoded}`), code);
});

test("matches the Flutter encoder (Dart base64Url without padding)", () => {
  // base64Url.encode(utf8.encode("graph LR\n  á-->b")) with '=' stripped
  assert.equal(encodeDiagram("graph LR\n  á-->b"), "Z3JhcGggTFIKICDDoS0tPmI");
});

test("rejects empty or broken hashes", () => {
  assert.equal(decodeDiagram(""), null);
  assert.equal(decodeDiagram("#"), null);
  assert.equal(decodeDiagram("#%%%"), null);
  assert.equal(decodeDiagram("#_w"), null); // invalid utf-8 byte
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { CONTACT_EMAIL } from "./contact.ts";

describe("contact email", () => {
  it("is the one shown in the privacy policy", () => {
    const html = readFileSync(new URL("../../public/privacidad.html", import.meta.url), "utf8");
    assert.ok(html.includes(CONTACT_EMAIL));
    assert.doesNotMatch(html, /jerecardenas/);
    const emails = new Set(html.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? []);
    assert.deepEqual([...emails], [CONTACT_EMAIL]);
  });
});

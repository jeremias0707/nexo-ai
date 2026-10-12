import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { sanitizeSubject, subjectAddon, SUBJECTS } from "./subjects.ts";
import { systemPrompt } from "./tutor.server.ts";

describe("materias escolares", () => {
  it("accepts known subjects and rejects junk", () => {
    assert.equal(sanitizeSubject("mate"), "mate");
    assert.equal(sanitizeSubject("histo"), "histo");
    assert.equal(sanitizeSubject("nope"), "");
    assert.equal(SUBJECTS.length >= 6, true);
  });

  it("addon adjusts tone without dropping tutor rules", () => {
    assert.equal(subjectAddon(""), "");
    const full = systemPrompt() + subjectAddon("mate");
    assert.ok(full.startsWith(systemPrompt()));
    assert.match(subjectAddon("mate"), /matemática/i);
    assert.match(subjectAddon("bio"), /biología/i);
    assert.match(full, /Menos inventos|No lo sabes todo/);
  });
});

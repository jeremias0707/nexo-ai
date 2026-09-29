import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseChatBody } from "./chat-payload.ts";
import { IMAGE_DEFAULT_PROMPT, IMAGE_EARLIER_NOTE, IMAGE_MAX_BASE64 } from "./image.ts";

const JPEG = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQ==";

describe("parseChatBody", () => {
  it("keeps plain text chats unchanged", () => {
    const parsed = parseChatBody({ messages: [{ role: "user", content: " hola " }] });
    assert.deepEqual(parsed, {
      ok: true,
      hasImage: false,
      document: null,
      explain: "normal",
      input: [{ role: "user", content: "hola" }],
    });
  });

  it("sends the latest image as input_image + input_text parts", () => {
    const parsed = parseChatBody({
      messages: [{ role: "user", content: "resolvé el 3", image: JPEG }],
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.hasImage, true);
    assert.deepEqual(parsed.input, [
      {
        role: "user",
        content: [
          { type: "input_image", image_url: JPEG, detail: "high" },
          { type: "input_text", text: "resolvé el 3" },
        ],
      },
    ]);
  });

  it("uses a default prompt when only a photo is sent", () => {
    const parsed = parseChatBody({ messages: [{ role: "user", content: "", image: JPEG }] });
    assert.ok(parsed.ok);
    const turn = parsed.input[0];
    assert.ok(Array.isArray(turn.content));
    assert.deepEqual(turn.content[1], { type: "input_text", text: IMAGE_DEFAULT_PROMPT });
  });

  it("never re-sends older images; marks them as text", () => {
    const parsed = parseChatBody({
      messages: [
        { role: "user", content: "mirá", image: JPEG },
        { role: "assistant", content: "Es una ecuación." },
        { role: "user", content: "", hadImage: true },
        { role: "assistant", content: "Ok." },
        { role: "user", content: "¿y el paso 2?" },
      ],
    });
    assert.ok(parsed.ok);
    assert.equal(parsed.hasImage, false);
    assert.deepEqual(parsed.input[0], { role: "user", content: `mirá\n${IMAGE_EARLIER_NOTE}` });
    assert.deepEqual(parsed.input[2], { role: "user", content: IMAGE_EARLIER_NOTE });
    assert.equal(JSON.stringify(parsed.input).includes("base64"), false);
  });

  it("rejects non-image data, unsupported formats and oversized images", () => {
    for (const image of [
      "https://example.com/a.jpg",
      "data:image/gif;base64,R0lGOD==",
      "data:text/plain;base64,aGk=",
      "data:image/jpeg;base64,@@@",
      `data:image/jpeg;base64,${"A".repeat(IMAGE_MAX_BASE64)}`,
      42,
    ]) {
      const parsed = parseChatBody({ messages: [{ role: "user", content: "x", image }] });
      assert.equal(parsed.ok, false, String(image).slice(0, 40));
    }
  });

  it("still requires the conversation to end on a user turn", () => {
    assert.equal(parseChatBody({ messages: [{ role: "assistant", content: "hola" }] }).ok, false);
    assert.equal(parseChatBody({}).ok, false);
  });

  it("accepts explain without changing the message shape", () => {
    const simple = parseChatBody({
      messages: [{ role: "user", content: "qué es una derivada" }],
      explain: "simple",
    });
    assert.ok(simple.ok);
    assert.equal(simple.explain, "simple");
    assert.deepEqual(simple.input, [{ role: "user", content: "qué es una derivada" }]);

    const deep = parseChatBody({
      messages: [{ role: "user", content: "x" }],
      explain: "fondo",
    });
    assert.ok(deep.ok);
    assert.equal(deep.explain, "fondo");

    const junk = parseChatBody({
      messages: [{ role: "user", content: "x" }],
      explain: "largo",
    });
    assert.ok(junk.ok);
    assert.equal(junk.explain, "normal");
  });
});

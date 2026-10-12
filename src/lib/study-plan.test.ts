import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPlan,
  countdownLine,
  dayLabel,
  parseTopics,
  planLength,
  planProgress,
  sanitizePlan,
  todayIndex,
  toggleTask,
  topicsFromAnswer,
  topicsPrompt,
} from "./study-plan.ts";

const base = { subject: "Biología", today: "2026-10-05", topics: [] as string[], minutes: 30 };

describe("study plan", () => {
  it("parses topics from lines or a comma list, dropping bullets and duplicates", () => {
    assert.deepEqual(parseTopics("- Célula\n2) Mitosis\n* célula\n\nMeiosis."), [
      "Célula",
      "Mitosis",
      "Meiosis",
    ]);
    assert.deepEqual(parseTopics("ADN, ARN; proteínas"), ["ADN", "ARN", "proteínas"]);
    assert.equal(
      parseTopics(Array.from({ length: 30 }, (_, i) => `tema ${i}`).join("\n")).length,
      12,
    );
    assert.deepEqual(parseTopics(""), []);
  });

  it("reuses list items of a tutor answer as topics", () => {
    const answer =
      "Estos temas:\n\n1. **La célula**: estructura\n2. Mitosis — fases\n- Meiosis\n\nSuerte.";
    assert.deepEqual(topicsFromAnswer(answer), ["La célula", "Mitosis", "Meiosis"]);
  });

  it("covers 5 to 7 days and ends the day before the exam", () => {
    assert.deepEqual(planLength("2026-10-05", "2026-10-12"), { until: 7, days: 7 });
    assert.deepEqual(planLength("2026-10-05", "2026-10-10"), { until: 5, days: 5 });
    const built = buildPlan({
      ...base,
      examDay: "2026-10-11",
      topics: ["Célula", "Mitosis", "Meiosis", "ADN"],
    });
    assert.ok(built.ok);
    if (!built.ok) return;
    assert.equal(built.plan.days.length, 6);
    assert.equal(built.plan.days[0].day, "2026-10-05");
    assert.equal(built.plan.days.at(-1)?.day, "2026-10-10");
    assert.equal(built.note, null);
    // Second to last is the practice exam, last is the calm final review.
    assert.equal(built.plan.days.at(-2)?.tasks[0].kind, "examen");
    assert.equal(built.plan.days.at(-1)?.tasks[0].kind, "final");
    // Every topic is studied once, in order.
    const learned = built.plan.days.flatMap((d) =>
      d.tasks.filter((t) => t.kind === "aprender").map((t) => t.title),
    );
    assert.deepEqual(learned, [
      "Entender: Célula",
      "Entender: Mitosis",
      "Entender: Meiosis",
      "Entender: ADN",
    ]);
    // Later days review earlier topics.
    assert.ok(
      built.plan.days[1].tasks.some((t) => t.kind === "repaso" && t.title.includes("Célula")),
    );
  });

  it("caps long waits at 7 days with a note, and makes short intensive plans", () => {
    const far = buildPlan({ ...base, examDay: "2026-10-30", topics: ["A", "B"] });
    assert.ok(far.ok && far.plan.days.length === 7 && /primera semana/.test(far.note ?? ""));
    const soon = buildPlan({ ...base, examDay: "2026-10-07", topics: ["A", "B", "C"] });
    assert.ok(soon.ok);
    if (!soon.ok) return;
    assert.equal(soon.plan.days.length, 2);
    assert.match(soon.note ?? "", /Quedan 2 días/);
    const tomorrow = buildPlan({ ...base, examDay: "2026-10-06", topics: ["A"] });
    assert.ok(
      tomorrow.ok &&
        tomorrow.plan.days.length === 1 &&
        tomorrow.plan.days[0].tasks[0].kind === "final",
    );
  });

  it("fills free days with oral practice when there are few topics", () => {
    const built = buildPlan({ ...base, examDay: "2026-10-12", topics: ["Célula", "ADN"] });
    assert.ok(built.ok);
    if (!built.ok) return;
    const kinds = built.plan.days.map((d) => d.tasks[0].kind);
    assert.equal(kinds.filter((k) => k === "aprender").length, 2);
    assert.ok(kinds.includes("oral"));
    for (const day of built.plan.days) for (const t of day.tasks) assert.ok(t.minutes >= 5);
  });

  it("works without topics (generic steps) and explains it", () => {
    const built = buildPlan({ ...base, examDay: "2026-10-10" });
    assert.ok(built.ok && built.plan.generic && /pasos generales/.test(built.note ?? ""));
  });

  it("rejects bad input", () => {
    assert.equal(buildPlan({ ...base, examDay: "2026-10-05" }).ok, false);
    assert.equal(buildPlan({ ...base, examDay: "2026-10-01" }).ok, false);
    assert.equal(buildPlan({ ...base, subject: " ", examDay: "2026-10-09" }).ok, false);
    assert.equal(buildPlan({ ...base, examDay: "mañana" }).ok, false);
  });

  it("toggles tasks, counts progress and survives storage", () => {
    const built = buildPlan({ ...base, examDay: "2026-10-10", topics: ["A", "B", "C"] });
    assert.ok(built.ok);
    if (!built.ok) return;
    const id = built.plan.days[0].tasks[0].id;
    const next = toggleTask(built.plan, id);
    assert.equal(planProgress(next).done, 1);
    assert.equal(planProgress(toggleTask(next, id)).done, 0);
    const restored = sanitizePlan(JSON.parse(JSON.stringify(next)));
    assert.deepEqual(restored, next);
    assert.equal(sanitizePlan({ subject: "x" }), null);
    assert.equal(sanitizePlan(null), null);
  });

  it("finds today's day and writes labels", () => {
    const built = buildPlan({ ...base, examDay: "2026-10-10", topics: ["A"] });
    assert.ok(built.ok);
    if (!built.ok) return;
    assert.equal(todayIndex(built.plan, "2026-10-04"), -1);
    assert.equal(todayIndex(built.plan, "2026-10-07"), 2);
    assert.equal(todayIndex(built.plan, "2026-10-20"), built.plan.days.length);
    assert.equal(dayLabel("2026-10-05"), "Lun 5/10");
    assert.equal(countdownLine("2026-10-06", "2026-10-05"), "El examen es mañana");
    assert.equal(countdownLine("2026-10-09", "2026-10-05"), "Faltan 4 días para el examen");
    assert.match(topicsPrompt("Historia", "2026-10-09"), /Historia el viernes 9\/10/);
  });
});

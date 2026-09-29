import assert from "node:assert/strict";
import { test } from "node:test";
import { autoRange, compileExpr, niceTicks, parseGrafico, sampleFunction } from "./grafico.ts";

const close = (a: number, b: number) => assert.ok(Math.abs(a - b) < 1e-9, `${a} ≈ ${b}`);

test("evaluates basic expressions with precedence", () => {
  close(compileExpr("x^2-4")(3), 5);
  close(compileExpr("-x^2")(3), -9);
  close(compileExpr("2^3^2")(0), 512);
  close(compileExpr("2x+1")(4), 9);
  close(compileExpr("3(x+1)")(1), 6);
  close(compileExpr("x sin(x)")(Math.PI / 2), Math.PI / 2);
  close(compileExpr("sen(pi/2)")(0), 1);
  close(compileExpr("2pi")(0), 2 * Math.PI);
  close(compileExpr("e^x")(1), Math.E);
  close(compileExpr("log(100)+ln(e)")(0), 3);
  close(compileExpr("sqrt(abs(x))")(-16), 4);
  close(compileExpr("x**2 − 1")(2), 3);
  close(compileExpr("1/2x")(4), 2); // (1/2)*x like a calculator
});

test("rejects unsafe or broken expressions without eval", () => {
  for (const bad of ["alert(1)", "x;1", "constructor", "toString(x)", "__proto__", "(x+1", "x+", "", "process.exit()", "x[0]", "`x`"]) {
    assert.throws(() => compileExpr(bad), Error, bad);
  }
  assert.throws(() => compileExpr("(".repeat(100) + "x" + ")".repeat(100)));
  assert.throws(() => compileExpr("x+".repeat(100) + "1"));
});

test("parses function charts with defaults and aliases", () => {
  const r = parseGrafico('{"tipo":"función","titulo":"Parábola","expr":"x^2-4","xmin":-5,"xmax":5}');
  assert.ok(r.ok);
  assert.equal(r.spec.type, "funcion");
  if (r.spec.type !== "funcion") return;
  assert.equal(r.spec.title, "Parábola");
  assert.deepEqual(r.spec.exprs, [{ expr: "x^2-4", name: "y = x^2-4" }]);
  const prefixed = parseGrafico('{"type":"funcion","expr":"f(x) = 2x+1"}');
  assert.ok(prefixed.ok && prefixed.spec.type === "funcion" && prefixed.spec.exprs[0].expr === "2x+1");
  const multi = parseGrafico('{"type":"funcion","exprs":["sin(x)",{"expr":"cos(x)","name":"coseno"}]}');
  assert.ok(multi.ok && multi.spec.type === "funcion" && multi.spec.exprs[1].name === "coseno");
  assert.ok(multi.ok && multi.spec.type === "funcion" && multi.spec.xmin === -10);
});

test("parses bar, line and pie charts", () => {
  const bars = parseGrafico(
    '{"type":"barras","labels":["A","B"],"series":[{"name":"2024","values":[3,5]}],"source":"INDEC"}',
  );
  assert.ok(bars.ok && bars.spec.type === "barras" && bars.spec.source === "INDEC");
  const lines = parseGrafico('{"type":"lineas","etiquetas":["L","M","X"],"valores":[1,2,"3"]}');
  assert.ok(lines.ok && lines.spec.type === "lineas" && lines.spec.series[0].values[2] === 3);
  const pie = parseGrafico('{"type":"torta","labels":["Sí","No"],"values":[60,40]}');
  assert.ok(pie.ok && pie.spec.type === "torta");
});

test("gives Spanish errors for invalid charts", () => {
  const cases: [string, RegExp][] = [
    ["{nope", /JSON/],
    ['{"type":"radar"}', /Tipo/],
    ['{"type":"constructor"}', /Tipo/],
    ['{"type":"funcion","expr":"alert(1)"}', /No pude leer/],
    ['{"type":"barras","labels":["A","B"],"series":[{"values":[1]}]}', /no coinciden/],
    ['{"type":"torta","labels":["A"],"values":[-1]}', /positivos/],
    ['{"type":"barras","labels":[],"values":[]}', /etiquetas/],
  ];
  for (const [text, re] of cases) {
    const r = parseGrafico(text);
    assert.ok(!r.ok, text);
    assert.match(r.error, re);
  }
});

test("samples functions and splits at asymptotes and gaps", () => {
  assert.equal(sampleFunction(compileExpr("x^2"), -2, 2).length, 1);
  assert.equal(sampleFunction(compileExpr("sqrt(x)"), -4, 4).length, 1); // negative side skipped
  assert.ok(sampleFunction(compileExpr("1/x"), -5, 5, 400).length >= 1);
  const tan = sampleFunction(compileExpr("tan(x)"), -4, 4);
  const [lo, hi] = autoRange(tan.flat().map((p) => p.y));
  assert.ok(hi - lo < 200, `tan range stays readable: ${lo}..${hi}`);
});

test("builds round axis ticks", () => {
  assert.deepEqual(niceTicks(-5, 5), [-4, -2, 0, 2, 4]);
  assert.deepEqual(niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
});

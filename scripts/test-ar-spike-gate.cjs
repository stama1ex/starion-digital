/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../lib/ar/pose-spike-gate.ts");
const source = fs.readFileSync(filename, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const compiled = { exports: {} };
new Function("exports", "require", "module", outputText)(compiled.exports, require, compiled);
const { createPoseSpikeGate } = compiled.exports;

// Числа замеров с живого сувенира: в анфас углы маркера гуляют на ~2.6 px за
// кадр, сбоку на ~6.75 px, а редкий одиночный промах доходит до 27 px.
const QUIET = 2.6;
const SIDE = 6.75;
const SPIKE = 27;
const OPTIONS = { floorPx: 6, factor: 3, patience: 3 };

// Детерминированный «шум»: тест не должен зависеть от удачи.
function noise(step) {
  return Math.sin(step * 12.9898) * Math.cos(step * 78.233);
}

function corners(offsetX, offsetY, amplitude, step) {
  const base = [
    [-200, -160],
    [200, -160],
    [200, 160],
    [-200, 160],
  ];
  const out = new Float64Array(8);
  for (let i = 0; i < 4; i++) {
    out[i * 2] = base[i][0] + offsetX + amplitude * noise(step * 4 + i);
    out[i * 2 + 1] = base[i][1] + offsetY + amplitude * noise(step * 4 + i + 0.5);
  }
  return out;
}

// 1. Ровное дрожание проходит целиком: отбраковка не должна трогать обычный шум.
{
  for (const amplitude of [QUIET, SIDE]) {
    const gate = createPoseSpikeGate(OPTIONS);
    let accepted = 0;
    for (let step = 0; step < 300; step++) {
      if (gate.accept(corners(0, 0, amplitude, step))) accepted++;
    }
    assert.equal(
      gate.rejected,
      0,
      `ровное дрожание ${amplitude} px не должно отбраковываться, отброшено ${gate.rejected}`,
    );
    assert.equal(accepted, 300);
  }
}

// 2. Одиночный промах отбрасывается, и точка отсчёта на него не съезжает.
{
  const gate = createPoseSpikeGate(OPTIONS);
  for (let step = 0; step < 120; step++) gate.accept(corners(0, 0, SIDE, step));
  const before = gate.rejected;
  assert.equal(gate.accept(corners(SPIKE, SPIKE, SIDE, 120)), false, "выброс должен отбрасываться");
  assert.equal(gate.rejected, before + 1);
  // следующий нормальный кадр принимается сразу, а не считается вторым выбросом
  assert.equal(gate.accept(corners(0, 0, SIDE, 121)), true, "после выброса обычный кадр проходит");
}

// 3. Настоящее движение НЕ замораживается: терпение обязано его пропустить.
//    Ровно на этом обжигалась прежняя защита от переворота.
{
  const gate = createPoseSpikeGate(OPTIONS);
  for (let step = 0; step < 120; step++) gate.accept(corners(0, 0, SIDE, step));
  const speedPxPerFrame = 40; // быстрый увод сувенира
  let frozen = 0;
  let longestFreeze = 0;
  for (let step = 0; step < 60; step++) {
    const moved = gate.accept(corners(speedPxPerFrame * step, 0, SIDE, 200 + step));
    if (moved) {
      frozen = 0;
    } else {
      frozen++;
      longestFreeze = Math.max(longestFreeze, frozen);
    }
  }
  assert.ok(
    longestFreeze <= OPTIONS.patience,
    `движение заморожено на ${longestFreeze} кадров при терпении ${OPTIONS.patience}`,
  );
  // при 30 Гц это не больше 100 мс — столько картинка может стоять незаметно
  assert.ok(longestFreeze / 30 <= 0.12, "заморозка дольше 0.12 с уже заметна");
}

// 4. factor 0 полностью выключает отбраковку — это режим сравнения на устройстве.
{
  const gate = createPoseSpikeGate({ ...OPTIONS, factor: 0 });
  for (let step = 0; step < 50; step++) gate.accept(corners(0, 0, SIDE, step));
  assert.equal(gate.accept(corners(SPIKE * 10, 0, SIDE, 50)), true);
  assert.equal(gate.rejected, 0);
}

// 5. Порог адаптируется к уровню шума, а не стоит на месте.
{
  const quiet = createPoseSpikeGate(OPTIONS);
  const side = createPoseSpikeGate(OPTIONS);
  for (let step = 0; step < 300; step++) {
    quiet.accept(corners(0, 0, QUIET, step));
    side.accept(corners(0, 0, SIDE, step));
  }
  assert.ok(
    side.limitPx > quiet.limitPx,
    `сбоку порог должен быть выше: ${side.limitPx} против ${quiet.limitPx}`,
  );
}

// 6. Негодные значения не принимаются и не портят базу.
{
  const gate = createPoseSpikeGate(OPTIONS);
  for (let step = 0; step < 30; step++) gate.accept(corners(0, 0, QUIET, step));
  const limitBefore = gate.limitPx;
  const broken = corners(0, 0, QUIET, 30);
  broken[3] = Number.NaN;
  assert.equal(gate.accept(broken), false);
  assert.equal(gate.accept(corners(0, 0, QUIET, 31)), true);
  assert.ok(Math.abs(gate.limitPx - limitBefore) < 1e-9 || gate.limitPx > 0);
}

// 7. reset возвращает в исходное состояние.
{
  const gate = createPoseSpikeGate(OPTIONS);
  for (let step = 0; step < 30; step++) gate.accept(corners(0, 0, SIDE, step));
  gate.accept(corners(SPIKE, SPIKE, SIDE, 30));
  assert.ok(gate.rejected > 0);
  gate.reset();
  assert.equal(gate.rejected, 0);
  // первое наблюдение после reset принимается безусловно
  assert.equal(gate.accept(corners(1000, 1000, SIDE, 0)), true);
}

// 8. Негодные настройки отвергаются сразу, а не молча работают неправильно.
{
  assert.throws(() => createPoseSpikeGate({ floorPx: 0, factor: 3, patience: 3 }), RangeError);
  assert.throws(() => createPoseSpikeGate({ floorPx: 6, factor: -1, patience: 3 }), RangeError);
  assert.throws(() => createPoseSpikeGate({ floorPx: 6, factor: 3, patience: 1.5 }), RangeError);
  assert.throws(
    () => createPoseSpikeGate({ floorPx: 6, factor: 3, patience: 3, adapt: 0 }),
    RangeError,
  );
}

console.log("AR spike gate: noise, spikes, real motion, adaptation and reset checks passed.");

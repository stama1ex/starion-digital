/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../lib/ar/marker-inset.ts");
const source = fs.readFileSync(filename, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const compiled = { exports: {} };
new Function("exports", "require", "module", outputText)(compiled.exports, require, compiled);
const { silhouetteBlurSigma, keepWeight, blurredEdgeProfile } = compiled.exports;

// 1. На самом краю силуэта от исходника не остаётся ничего, глубоко внутри —
//    всё. Это и есть смысл втягивания.
{
  assert.equal(keepWeight(0.5), 0, "на краю силуэта признаков быть не должно");
  assert.equal(keepWeight(0.2), 0, "снаружи силуэта тоже");
  assert.equal(keepWeight(1), 1, "глубоко внутри картинка не трогается");
  assert.equal(keepWeight(Number.NaN), 0);
}

// 2. Переход монотонный и без ступенек: ступенька — это новый контур ровно
//    там, где мы контур убирали.
{
  let previous = -1;
  for (let i = 0; i <= 100; i++) {
    const weight = keepWeight(i / 100);
    assert.ok(weight >= previous - 1e-12, `вес не должен падать при ${i / 100}`);
    assert.ok(weight >= 0 && weight <= 1);
    previous = weight;
  }
  // производная на концах близка к нулю — переход касается 0 и 1 плавно
  assert.ok(keepWeight(0.51) < 0.01, "у края переход должен начинаться полого");
  assert.ok(keepWeight(0.96) > 0.99, "у внутренней границы — заканчиваться полого");
}

// 3. Заявленная глубина действительно очищается: на глубине inset вес уже
//    единица, а на половине этой глубины — заметно меньше.
{
  const shortSide = 849; // короткая сторона реального маркера 1024x849
  for (const inset of [0.04, 0.06, 0.1]) {
    const sigma = silhouetteBlurSigma(shortSide, inset);
    const depthPx = shortSide * inset;
    assert.ok(
      keepWeight(blurredEdgeProfile(depthPx, sigma)) > 0.98,
      `на глубине ${inset} картинка обязана быть нетронутой`,
    );
    const half = keepWeight(blurredEdgeProfile(depthPx / 2, sigma));
    assert.ok(
      half > 0 && half < 0.9,
      `на половине глубины переход ещё идёт, получили ${half.toFixed(3)}`,
    );
    // приближение функции ошибок даёт не машинный ноль, а порядка 1e-18
    assert.ok(keepWeight(blurredEdgeProfile(0, sigma)) < 1e-9, "ровно на краю — ноль");
    assert.ok(
      keepWeight(blurredEdgeProfile(-depthPx, sigma)) < 1e-9,
      "снаружи силуэта — ноль",
    );
  }
}

// 4. Сигма пропорциональна отступу и никогда не вырождается в ноль:
//    нулевое размытие вернуло бы резкую границу.
{
  assert.ok(silhouetteBlurSigma(849, 0.06) > silhouetteBlurSigma(849, 0.03));
  assert.ok(silhouetteBlurSigma(849, 0) >= 0.5, "нулевой отступ не должен давать резкую границу");
  assert.equal(silhouetteBlurSigma(1000, 0.1), 50);
}

// 5. Негодные настройки отвергаются, а не работают молча неправильно.
{
  assert.throws(() => silhouetteBlurSigma(0, 0.06), RangeError);
  assert.throws(() => silhouetteBlurSigma(849, 0.5), RangeError);
  assert.throws(() => silhouetteBlurSigma(849, -0.01), RangeError);
  assert.throws(() => blurredEdgeProfile(10, 0), RangeError);
}

// 6. Сколько площади теряется. Проверка не на корректность, а на здравый
//    смысл: отступ, съедающий половину сувенира, лечил бы пальцы ценой
//    трекинга вообще.
{
  const w = 1024;
  const h = 849;
  for (const inset of [0.04, 0.06, 0.1]) {
    const depth = h * inset;
    const left = ((w - 2 * depth) * (h - 2 * depth)) / (w * h);
    assert.ok(left > 0.6, `отступ ${inset} оставляет всего ${(left * 100).toFixed(0)}% площади`);
    if (inset === 0.06) {
      assert.ok(left > 0.78 && left < 0.85, `ожидали ~80% площади, получили ${(left * 100).toFixed(0)}%`);
    }
  }
}

console.log("AR marker inset: edge removal, smooth ramp, depth and area checks passed.");

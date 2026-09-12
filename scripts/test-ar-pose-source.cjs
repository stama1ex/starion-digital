/* eslint-disable @typescript-eslint/no-require-imports -- Standalone CommonJS test harness. */
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const ts = require("typescript");

const filename = path.resolve(__dirname, "../lib/ar/mindar-pose-source.ts");
const source = fs.readFileSync(filename, "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
});
const compiled = { exports: {} };
new Function("exports", "require", "module", outputText)(compiled.exports, require, compiled);
const { installMindArPoseSource } = compiled.exports;

const pose = [[1, 0, 0, 20], [0, 1, 0, 30], [0, 0, 1, 400]];
const raw = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 20, 30, -400, 1];
const engineFiltered = raw.map((value, index) => index === 12 ? 99 : value);
function setup() {
  const forwarded = [];
  const samples = [];
  const state = { isTracking: true, showing: true, currentModelViewTransform: pose };
  const controller = {
    inputWidth: 720,
    inputHeight: 1280,
    trackingStates: [state],
    onUpdate(data) { assert.equal(this, controller); forwarded.push(data); },
    getWorldMatrix(receivedPose, index) {
      assert.equal(receivedPose, pose);
      assert.equal(index, 0);
      return raw;
    },
    getRotatedZ90Matrix(matrix) {
      const output = [...matrix];
      output[12] = -matrix[13];
      output[13] = matrix[12];
      return output;
    },
  };
  const instance = { controller, video: { width: 720, height: 1280 } };
  const original = controller.onUpdate;
  const dispose = installMindArPoseSource(instance, (matrix, timestamp) => {
    assert.ok(Number.isFinite(timestamp));
    assert.ok(forwarded.length > 0, "anchor/UI callback runs first");
    samples.push(matrix);
  });
  const update = (worldMatrix = engineFiltered) => controller.onUpdate({
    type: "updateMatrix", targetIndex: 0, worldMatrix,
  });
  return { instance, controller, state, forwarded, samples, original, dispose, update };
}

{
  const test = setup();
  test.update();
  assert.deepEqual(test.samples, [raw], "reads before engine filtering");
  assert.deepEqual(test.forwarded[0].worldMatrix, raw);
  assert.notEqual(test.samples[0], raw, "does not expose controller-owned arrays");
  test.controller.onUpdate({ type: "processDone" });
  test.controller.onUpdate({ type: "updateMatrix", targetIndex: 1, worldMatrix: raw });
  assert.equal(test.samples.length, 1, "ignores processDone and other targets");
  test.state.isTracking = false;
  test.update();
  test.update();
  test.update(null);
  assert.deepEqual(test.samples, [raw, null], "reports a stale/lost measurement once");
  assert.deepEqual(test.forwarded[3].worldMatrix, engineFiltered, "retains engine miss grace");
  test.state.isTracking = true;
  test.update();
  assert.deepEqual(test.samples, [raw, null, raw], "reacquisition starts a fresh sample");
  test.dispose();
  assert.equal(test.controller.onUpdate, test.original);
  test.update();
  assert.equal(test.samples.length, 3);
}

{
  const test = setup();
  test.instance.video = { width: 1280, height: 720 };
  test.update();
  assert.equal(test.samples[0][12], -30);
  assert.equal(test.samples[0][13], 20, "preserves MindAR's input rotation adjustment");
  test.dispose();
}

{
  const test = setup();
  test.update();
  test.controller.trackingStates = [{ ...test.state, isTracking: false }];
  test.update();
  test.controller.trackingStates = [{ ...test.state }];
  test.update();
  assert.deepEqual(test.samples, [raw, null, raw], "follows reset states after resume");
  test.controller.getWorldMatrix = () => raw.map((value, index) => index === 12 ? NaN : value);
  test.update();
  assert.equal(test.samples.at(-1), null, "rejects non-finite poses");
  assert.equal(test.forwarded.at(-1).worldMatrix, null, "does not forward NaNs to anchors");
  test.dispose();
}

{
  const test = setup();
  const savedWrapper = test.controller.onUpdate;
  const replacement = () => {};
  test.controller.onUpdate = replacement;
  test.dispose();
  assert.equal(test.controller.onUpdate, replacement, "does not overwrite a later owner");
  savedWrapper({ type: "updateMatrix", targetIndex: 0, worldMatrix: raw });
  assert.equal(test.samples.length, 0, "a disposed in-flight callback cannot emit poses");
}

assert.throws(() => installMindArPoseSource({}, () => {}), /mind-ar@1\.2\.5/);
{
  const test = setup();
  test.controller.getWorldMatrix = () => [1, 2, 3];
  assert.throws(() => test.update(), /mind-ar@1\.2\.5/, "fails on incompatible matrix layout");
  test.dispose();
}

console.log("AR pose source: raw pose, lifecycle, rotation, validity and cleanup checks passed.");

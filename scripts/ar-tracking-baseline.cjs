/*
 * Reproduce the previous AR tracking defects without a camera or new packages.
 * Run: node scripts/ar-tracking-baseline.cjs
 *
 * This deliberately preserves the old equations as a diagnostic baseline. It
 * does not import the current stabilizer or represent the desired behavior.
 * MindAR 1.2.5 filters every model-view matrix element independently before
 * its Three adapter multiplies by the marker's constant post-transform:
 * https://github.com/hiukim/mind-ar-js/blob/v1.2.5/src/libs/one-euro-filter.js
 * https://github.com/hiukim/mind-ar-js/blob/v1.2.5/src/image-target/three.js
 *
 * The installed Three version is used only for matrix/quaternion arithmetic;
 * the runtime AR scene separately loads Three r144. Its revision is reported
 * so captured results record the arithmetic implementation used here.
 */
const assert = require('node:assert/strict');
const THREE = require('three');

const degrees = (radians) => radians * 180 / Math.PI;
const alpha = (elapsedMs, cutoff) => {
  const product = 2 * Math.PI * cutoff * elapsedMs;
  return product / (1 + product);
};

// Same recurrence and millisecond units as MindAR's array One Euro filter.
function matrixFilter(minCutoff, beta) {
  let previous = null;
  let derivative = null;
  let previousTime = 0;
  return (timeMs, input) => {
    if (previous === null) {
      previous = [...input];
      derivative = input.map(() => 0);
      previousTime = timeMs;
      return [...input];
    }
    const elapsedMs = timeMs - previousTime;
    const derivativeAlpha = alpha(elapsedMs, 0.001);
    const result = input.map((value, index) => {
      const velocity = (value - previous[index]) / elapsedMs;
      derivative[index] = derivativeAlpha * velocity
        + (1 - derivativeAlpha) * derivative[index];
      const amount = alpha(elapsedMs, minCutoff + beta * Math.abs(derivative[index]));
      return amount * value + (1 - amount) * previous[index];
    });
    previous = result;
    previousTime = timeMs;
    return [...result];
  };
}

function reproduceMatrixDecomposition() {
  const markerWidth = 800;
  const initial = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.10, 0.03, 0.20));
  const moved = new THREE.Matrix4().makeRotationFromEuler(new THREE.Euler(0.27, 0.18, 0.50));
  initial.setPosition(0, 0, -3000);
  moved.setPosition(0, 0, -3000);
  const filter = matrixFilter(0.001, 3);
  filter(0, initial.elements);
  const filtered = filter(1000 / 30, moved.elements);
  const postTransform = new THREE.Matrix4().compose(
    new THREE.Vector3(markerWidth / 2, markerWidth / 2, 0),
    new THREE.Quaternion(),
    new THREE.Vector3(markerWidth, markerWidth, markerWidth),
  );
  const anchor = new THREE.Matrix4().fromArray(filtered).multiply(postTransform);
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3();
  anchor.decompose(position, quaternion, scale);
  const normalized = quaternion.clone().normalize();
  const selfAngleDegrees = degrees(quaternion.angleTo(quaternion));
  const scaleRelativeToMarker = scale.toArray().map((value) => value / markerWidth);
  assert.ok(selfAngleDegrees > 2, 'The old quaternion exceeds angFree when compared with itself');
  assert.ok(Math.max(...scaleRelativeToMarker) - Math.min(...scaleRelativeToMarker) > 0.01);
  return {
    inputPosesAreRigid: true,
    markerWidth,
    quaternionLength: quaternion.length(),
    selfAngleDegrees,
    normalizedSelfAngleDegrees: degrees(normalized.angleTo(normalized)),
    scaleRelativeToMarker,
  };
}

function reproduceFalseFlipRejection() {
  const acceptedSwing = new THREE.Quaternion();
  const targetSwing = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 10 * Math.PI / 180);
  const acceptedTwist = new THREE.Quaternion();
  const targetTwist = new THREE.Quaternion();
  let flipFrames = 0;
  let rejected = 0;
  for (let frame = 0; frame < 14; frame++) {
    // This is a physically valid rotation about the marker's center: position
    // and in-plane twist remain fixed. The former guard compared the target
    // with filtered state, so every observation looks like another new flip.
    acceptedTwist.slerp(targetTwist, 0.3);
    const looksFlipped = acceptedSwing.angleTo(targetSwing) > 0.12
      && 0 < 0.02
      && acceptedTwist.angleTo(targetTwist) < 0.05;
    if (looksFlipped && flipFrames < 14) {
      flipFrames++;
      rejected++;
    } else {
      if (!looksFlipped) flipFrames = 0;
      acceptedSwing.slerp(targetSwing, 0.1);
    }
  }
  const acceptedTiltDegrees = degrees(acceptedSwing.angleTo(new THREE.Quaternion()));
  assert.equal(rejected, 14);
  assert.equal(acceptedTiltDegrees, 0);
  return {
    requestedTiltDegrees: 10,
    consecutiveIdenticalValidObservations: 14,
    rejectedObservations: rejected,
    acceptedTiltDegrees,
    frozenDurationAt30HzMs: 14 * 1000 / 30,
  };
}

console.log(JSON.stringify({
  baseline: 'AR implementation before the pose stabilizer repair',
  arithmeticThreeRevision: THREE.REVISION,
  matrixDecomposition: reproduceMatrixDecomposition(),
  falseFlipRejection: reproduceFalseFlipRejection(),
  previousHoldDurationMsByRenderFps: Object.fromEntries(
    [15, 30, 60, 120].map((fps) => [fps, 45 * 1000 / fps]),
  ),
}, null, 2));

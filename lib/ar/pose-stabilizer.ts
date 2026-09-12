import type { Matrix4, Quaternion, Vector3 } from 'three';

type ThreeRuntime = Pick<typeof import('three'), 'Matrix4' | 'Quaternion' | 'Vector3'>;

export interface PoseStabilizerOptions {
  angleMinCutoffHz?: number;
  depthMinCutoffHz?: number;
  planeMinCutoffHz?: number;
  velocityCutoffHz?: number;
  /** Добавка Hz на rad/s угловой скорости. */
  angleBeta?: number;
  /** Добавка Hz на marker-width/s скорости перемещения. */
  translationBeta?: number;
  /**
   * Приводить ли базис к настоящему вращению.
   *
   * Для модели, стоящей НАД плоскостью, это обязательно: скос во входной
   * оценке иначе перекашивает геометрию. А вот для контента, лежащего В
   * плоскости маркера (видео), приведение вредно. MindAR уверенно определяет
   * гомографию — плоское преобразование, кладущее картинку маркера на кадр, —
   * и сырая матрица воспроизводит её точно. Разложение же на позу неустойчиво,
   * и ближайшее «честное» вращение проецирует плоскость иначе, чем сама
   * гомография: видео съезжает с сувенира, тянется и кренится не в ту сторону.
   * Поэтому для плоского контента скос сохраняем — он часть верного ответа.
   */
  rigid?: boolean;
}

export interface PoseStabilizerDiagnostics {
  rawTiltRad: number;
  rawDepth: number;
  /** x/depth и y/depth: центр в координатах камеры до применения intrinsics. */
  rawCenterX: number;
  rawCenterY: number;
  /** Максимальный абсолютный косинус между столбцами исходного базиса. */
  rawOrthogonalityError: number;
  acceptedSamples: number;
  rejectionReason: string | null;
}

export interface PoseStabilizer {
  readonly matrix: Matrix4;
  readonly position: Vector3;
  readonly quaternion: Quaternion;
  readonly scale: Vector3;
  readonly diagnostics: Readonly<PoseStabilizerDiagnostics>;
  update(matrix: Matrix4, timestampMs: number): boolean;
  reset(): void;
}

const TAU = Math.PI * 2;
const alpha = (cutoffHz: number, dtSeconds: number) => -Math.expm1(-TAU * cutoffHz * dtSeconds);

/**
 * Вход — anchor.matrix после MindAR postMatrix, с центром маркера в translation.
 * THREE передаётся извне: браузерный AR использует свою совместимую версию three.
 * Выходные объекты переиспользуются; вызывающая сторона должна считать их read-only.
 */
export function createPoseStabilizer(
  THREE: ThreeRuntime,
  markerWidth: number,
  options: PoseStabilizerOptions = {},
): PoseStabilizer {
  if (!Number.isFinite(markerWidth) || markerWidth <= 0) {
    throw new RangeError('markerWidth must be a finite positive number');
  }
  const config = {
    angleMinCutoffHz: options.angleMinCutoffHz ?? 1,
    depthMinCutoffHz: options.depthMinCutoffHz ?? 1,
    planeMinCutoffHz: options.planeMinCutoffHz ?? 3,
    velocityCutoffHz: options.velocityCutoffHz ?? 1,
    angleBeta: options.angleBeta ?? 3,
    translationBeta: options.translationBeta ?? 14,
  };
  const rigid = options.rigid ?? true;
  for (const [key, value] of Object.entries(config)) {
    if (!Number.isFinite(value) || value < 0 || (key.endsWith('Hz') && value === 0)) {
      throw new RangeError(`${key} must be finite and ${key.endsWith('Hz') ? 'positive' : 'nonnegative'}`);
    }
  }

  const matrix = new THREE.Matrix4();
  const position = new THREE.Vector3();
  const quaternion = new THREE.Quaternion();
  const scale = new THREE.Vector3(markerWidth, markerWidth, markerWidth);
  const rotationMatrix = new THREE.Matrix4();
  const rawQuaternion = new THREE.Quaternion();
  const previousRawQuaternion = new THREE.Quaternion();
  const deltaQuaternion = new THREE.Quaternion();
  const rawPosition = new THREE.Vector3();
  const previousRawPosition = new THREE.Vector3();
  const linearVelocity = new THREE.Vector3();
  const angularVelocity = new THREE.Vector3();
  const nextLinearVelocity = new THREE.Vector3();
  const nextAngularVelocity = new THREE.Vector3();
  const velocitySample = new THREE.Vector3();
  let basis = new Float64Array(9);
  let nextBasis = new Float64Array(9);
  // Сырой базис со скосом — его фильтруем, когда приводить к вращению нельзя.
  const rawBasis = new Float64Array(9);
  const smoothBasis = new Float64Array(9);
  let hasSmoothBasis = false;
  let timestamp: number | null = null;
  let centerX = 0;
  let centerY = 0;
  let logDepth = 0;
  const diagnostics: PoseStabilizerDiagnostics = {
    rawTiltRad: 0,
    rawDepth: 0,
    rawCenterX: 0,
    rawCenterY: 0,
    rawOrthogonalityError: 0,
    acceptedSamples: 0,
    rejectionReason: null,
  };

  function reject(reason: string): false {
    diagnostics.rejectionReason = reason;
    return false;
  }

  function update(input: Matrix4, timestampMs: number): boolean {
    if (!Number.isFinite(timestampMs) || (timestamp !== null && timestampMs <= timestamp)) {
      return reject('non-increasing timestamp');
    }
    const dt = timestamp === null ? 0 : (timestampMs - timestamp) / 1000;
    if (timestamp !== null && (!Number.isFinite(dt) || dt <= 0)) return reject('invalid sample interval');
    const e = input.elements;
    if (e.length !== 16 || !e.every(Number.isFinite)) return reject('non-finite matrix');
    if (Math.abs(e[3]) > 1e-8 || Math.abs(e[7]) > 1e-8 || Math.abs(e[11]) > 1e-8 || Math.abs(e[15] - 1) > 1e-8) {
      return reject('non-affine matrix');
    }
    const depth = -e[14];
    if (depth <= 0) return reject('non-positive depth');
    const inputCenterX = e[12] / depth;
    const inputCenterY = e[13] / depth;
    if (!Number.isFinite(inputCenterX) || !Number.isFinite(inputCenterY)) return reject('invalid projected center');

    // Масштабирование перед polar iteration защищает вычисления от размеров .mind.
    const basisMax = Math.max(Math.abs(e[0]), Math.abs(e[1]), Math.abs(e[2]), Math.abs(e[4]), Math.abs(e[5]), Math.abs(e[6]), Math.abs(e[8]), Math.abs(e[9]), Math.abs(e[10]));
    if (basisMax === 0) return reject('degenerate basis');
    basis[0] = e[0] / basisMax; basis[1] = e[4] / basisMax; basis[2] = e[8] / basisMax;
    basis[3] = e[1] / basisMax; basis[4] = e[5] / basisMax; basis[5] = e[9] / basisMax;
    basis[6] = e[2] / basisMax; basis[7] = e[6] / basisMax; basis[8] = e[10] / basisMax;
    rawBasis[0] = e[0]; rawBasis[1] = e[1]; rawBasis[2] = e[2];
    rawBasis[3] = e[4]; rawBasis[4] = e[5]; rawBasis[5] = e[6];
    rawBasis[6] = e[8]; rawBasis[7] = e[9]; rawBasis[8] = e[10];
    const lengthX = Math.hypot(basis[0], basis[3], basis[6]);
    const lengthY = Math.hypot(basis[1], basis[4], basis[7]);
    const lengthZ = Math.hypot(basis[2], basis[5], basis[8]);
    if (Math.min(lengthX, lengthY, lengthZ) < 1e-8) return reject('degenerate basis');
    const orthogonalityError = Math.max(
      Math.abs(basis[0] * basis[1] + basis[3] * basis[4] + basis[6] * basis[7]) / (lengthX * lengthY),
      Math.abs(basis[0] * basis[2] + basis[3] * basis[5] + basis[6] * basis[8]) / (lengthX * lengthZ),
      Math.abs(basis[1] * basis[2] + basis[4] * basis[5] + basis[7] * basis[8]) / (lengthY * lengthZ),
    );

    // decompose() лишь нормирует столбцы: после матричного EMA они могут иметь shear.
    // Полярный множитель даёт ближайшее корректное вращение, включая настоящий наклон.
    let converged = false;
    for (let iteration = 0; iteration < 16; iteration++) {
      const [a, b, c, d, f, g, h, i, j] = basis;
      const determinant = a * (f * j - g * i) - b * (d * j - g * h) + c * (d * i - f * h);
      if (!Number.isFinite(determinant) || determinant <= 1e-8) {
        return reject(determinant < 0 ? 'reflected basis' : 'degenerate basis');
      }
      // inverse transpose = cofactor matrix / determinant.
      nextBasis[0] = (f * j - g * i) / determinant;
      nextBasis[1] = (g * h - d * j) / determinant;
      nextBasis[2] = (d * i - f * h) / determinant;
      nextBasis[3] = (c * i - b * j) / determinant;
      nextBasis[4] = (a * j - c * h) / determinant;
      nextBasis[5] = (b * h - a * i) / determinant;
      nextBasis[6] = (b * g - c * f) / determinant;
      nextBasis[7] = (c * d - a * g) / determinant;
      nextBasis[8] = (a * f - b * d) / determinant;
      let normSquared = 0;
      let inverseNormSquared = 0;
      for (let k = 0; k < 9; k++) {
        normSquared += basis[k] * basis[k];
        inverseNormSquared += nextBasis[k] * nextBasis[k];
      }
      const gamma = Math.sqrt(Math.sqrt(inverseNormSquared / normSquared));
      let difference = 0;
      for (let k = 0; k < 9; k++) {
        nextBasis[k] = (gamma * basis[k] + nextBasis[k] / gamma) * 0.5;
        difference = Math.max(difference, Math.abs(nextBasis[k] - basis[k]));
      }
      [basis, nextBasis] = [nextBasis, basis];
      if (difference < 1e-10) {
        converged = true;
        break;
      }
    }
    if (!converged || !basis.every(Number.isFinite)) return reject('polar decomposition failed');
    rotationMatrix.set(
      basis[0], basis[1], basis[2], 0,
      basis[3], basis[4], basis[5], 0,
      basis[6], basis[7], basis[8], 0,
      0, 0, 0, 1,
    );
    rawQuaternion.setFromRotationMatrix(rotationMatrix).normalize();
    rawPosition.set(e[12], e[13], e[14]);

    let angleAlpha = 1;
    if (timestamp === null) {
      position.copy(rawPosition);
      quaternion.copy(rawQuaternion);
      centerX = inputCenterX;
      centerY = inputCenterY;
      logDepth = Math.log(depth);
    } else {
      const velocityAlpha = alpha(config.velocityCutoffHz, dt);
      // Фильтруем вектор скорости, чтобы знакопеременный шум не открывал cutoff постоянно.
      velocitySample.set(
        (rawPosition.x - previousRawPosition.x) / markerWidth / dt,
        (rawPosition.y - previousRawPosition.y) / markerWidth / dt,
        (rawPosition.z - previousRawPosition.z) / markerWidth / dt,
      );
      if (![velocitySample.x, velocitySample.y, velocitySample.z].every(Number.isFinite)) return reject('invalid translation velocity');
      nextLinearVelocity.copy(linearVelocity).lerp(velocitySample, velocityAlpha);
      deltaQuaternion.copy(previousRawQuaternion).invert().premultiply(rawQuaternion).normalize();
      if (deltaQuaternion.w < 0) deltaQuaternion.set(-deltaQuaternion.x, -deltaQuaternion.y, -deltaQuaternion.z, -deltaQuaternion.w);
      const sinHalfAngle = Math.hypot(deltaQuaternion.x, deltaQuaternion.y, deltaQuaternion.z);
      const angularFactor = sinHalfAngle > 1e-12 ? 2 * Math.atan2(sinHalfAngle, deltaQuaternion.w) / (sinHalfAngle * dt) : 0;
      velocitySample.set(deltaQuaternion.x, deltaQuaternion.y, deltaQuaternion.z).multiplyScalar(angularFactor);
      nextAngularVelocity.copy(angularVelocity).lerp(velocitySample, velocityAlpha);
      if (![nextLinearVelocity.x, nextLinearVelocity.y, nextLinearVelocity.z, nextAngularVelocity.x, nextAngularVelocity.y, nextAngularVelocity.z].every(Number.isFinite)) return reject('invalid filtered velocity');

      const translationExtraHz = config.translationBeta * Math.hypot(nextLinearVelocity.x, nextLinearVelocity.y, nextLinearVelocity.z);
      const planeAlpha = alpha(config.planeMinCutoffHz + translationExtraHz, dt);
      const nextCenterX = centerX + (inputCenterX - centerX) * planeAlpha;
      const nextCenterY = centerY + (inputCenterY - centerY) * planeAlpha;
      const nextLogDepth = logDepth + (Math.log(depth) - logDepth) * alpha(config.depthMinCutoffHz + translationExtraHz, dt);
      const filteredDepth = Math.exp(nextLogDepth);
      const nextX = nextCenterX * filteredDepth;
      const nextY = nextCenterY * filteredDepth;
      if (![nextX, nextY, filteredDepth].every(Number.isFinite) || filteredDepth <= 0) return reject('invalid filtered position');
      centerX = nextCenterX;
      centerY = nextCenterY;
      logDepth = nextLogDepth;
      linearVelocity.copy(nextLinearVelocity);
      angularVelocity.copy(nextAngularVelocity);
      // Общая глубина при восстановлении xyz сохраняет экранный центр при scale/depth шуме.
      position.set(nextX, nextY, -filteredDepth);
      angleAlpha = alpha(config.angleMinCutoffHz + config.angleBeta * Math.hypot(angularVelocity.x, angularVelocity.y, angularVelocity.z), dt);
      quaternion.slerp(rawQuaternion, angleAlpha).normalize();
    }

    if (rigid) {
      // Известная ширина маркера не должна зависеть от наклона, shear или длины quaternion.
      scale.set(markerWidth, markerWidth, markerWidth);
      matrix.compose(position, quaternion, scale);
    } else {
      // Плоский контент: сохраняем гомографию как есть, сглаживая её той же
      // адаптивной скоростью, что и поворот. Скос тут не артефакт, а часть
      // верного ответа, поэтому базис не выпрямляем.
      if (!hasSmoothBasis) {
        smoothBasis.set(rawBasis);
        hasSmoothBasis = true;
      } else {
        for (let k = 0; k < 9; k++) {
          smoothBasis[k] += (rawBasis[k] - smoothBasis[k]) * angleAlpha;
        }
      }
      matrix.set(
        smoothBasis[0], smoothBasis[3], smoothBasis[6], position.x,
        smoothBasis[1], smoothBasis[4], smoothBasis[7], position.y,
        smoothBasis[2], smoothBasis[5], smoothBasis[8], position.z,
        0, 0, 0, 1,
      );
      // Никакого decompose/compose здесь: этот круг заново собрал бы матрицу
      // из position/quaternion/scale и тем самым выпрямил бы скос обратно,
      // то есть ровно то, чего мы тут избегаем. position уже отфильтрован
      // выше, quaternion и scale для плоского пути остаются справочными.
    }
    previousRawPosition.copy(rawPosition);
    previousRawQuaternion.copy(rawQuaternion);
    timestamp = timestampMs;
    diagnostics.rawTiltRad = Math.atan2(Math.hypot(basis[2], basis[5]), basis[8]);
    diagnostics.rawDepth = depth;
    diagnostics.rawCenterX = inputCenterX;
    diagnostics.rawCenterY = inputCenterY;
    diagnostics.rawOrthogonalityError = orthogonalityError;
    diagnostics.acceptedSamples++;
    diagnostics.rejectionReason = null;
    return true;
  }

  function reset(): void {
    timestamp = null;
    centerX = centerY = logDepth = 0;
    linearVelocity.set(0, 0, 0);
    angularVelocity.set(0, 0, 0);
    hasSmoothBasis = false;
    position.set(0, 0, 0);
    quaternion.identity();
    scale.set(markerWidth, markerWidth, markerWidth);
    matrix.compose(position, quaternion, scale);
    diagnostics.rawTiltRad = diagnostics.rawDepth = diagnostics.rawCenterX = diagnostics.rawCenterY = diagnostics.rawOrthogonalityError = 0;
    diagnostics.acceptedSamples = 0;
    diagnostics.rejectionReason = null;
  }

  reset();
  return { matrix, position, quaternion, scale, diagnostics, update, reset };
}

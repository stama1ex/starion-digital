type ModelViewTransform = [number[], number[], number[]];

type TrackingState = {
  isTracking: boolean;
  showing: boolean;
  currentModelViewTransform: ModelViewTransform | null;
};

type ControllerUpdate = {
  type: string;
  targetIndex?: number;
  worldMatrix?: number[] | null;
};

type MindArController = {
  inputWidth: number;
  inputHeight: number;
  trackingStates: TrackingState[];
  onUpdate: (data: ControllerUpdate) => void;
  getWorldMatrix: (pose: ModelViewTransform, index: number) => number[];
  getRotatedZ90Matrix: (matrix: number[]) => number[];
};

type MindArInstance = {
  controller: MindArController;
  video: { width: number; height: number };
};

export type MindArPoseSample = (
  worldMatrix: number[] | null,
  timestampMs: number,
) => void;

const incompatible = () => new Error(
  "Несовместимый API MindAR: источник позы рассчитан на mind-ar@1.2.5 после start().",
);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isPositiveNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isTrackingState(value: unknown): value is TrackingState {
  return isRecord(value)
    && typeof value.isTracking === "boolean"
    && typeof value.showing === "boolean"
    && "currentModelViewTransform" in value;
}

function assertInstance(value: unknown): asserts value is MindArInstance {
  if (!isRecord(value) || !isRecord(value.controller) || !isRecord(value.video)) {
    throw incompatible();
  }
  const { controller, video } = value;
  if (
    !isPositiveNumber(controller.inputWidth)
    || !isPositiveNumber(controller.inputHeight)
    || !isPositiveNumber(video.width)
    || !isPositiveNumber(video.height)
    || !Array.isArray(controller.trackingStates)
    || !isTrackingState(controller.trackingStates[0])
    || typeof controller.onUpdate !== "function"
    || typeof controller.getWorldMatrix !== "function"
    || typeof controller.getRotatedZ90Matrix !== "function"
  ) {
    throw incompatible();
  }
}

function isFinitePose(value: unknown): value is ModelViewTransform {
  return Array.isArray(value) && value.length === 3
    && value.every((row) => Array.isArray(row) && row.length === 4
      && row.every((entry) => typeof entry === "number" && Number.isFinite(entry)));
}

function isFiniteWorldMatrix(value: unknown): value is number[] {
  if (!Array.isArray(value) || value.length !== 16) throw incompatible();
  return value.every((entry) => typeof entry === "number" && Number.isFinite(entry))
    && value[3] === 0 && value[7] === 0 && value[11] === 0 && value[15] === 1;
}

/**
 * Читает позу маркера 0 до поэлементного фильтра MindAR. Подключается после start().
 *
 * Интеграция привязана к v1.2.5: controller.js записывает currentModelViewTransform
 * перед onUpdate, а getWorldMatrix преобразует эту позу без фильтрации. Поправку
 * поворота видео нужно применить до умножения на postMatrixs[0] в three.js.
 * https://github.com/hiukim/mind-ar-js/blob/v1.2.5/src/image-target/controller.js
 *
 * Исходная оценка позы сохраняется: матрица может содержать скос, возникший при
 * инициализации по гомографии. Перед фильтрацией кватерниона нужно извлечь жёсткую
 * позу. Глобальные функции и прототипы не изменяются.
 */
export function installMindArPoseSource(
  value: unknown,
  onSample: MindArPoseSample,
): () => void {
  assertInstance(value);
  const instance = value;
  const { controller } = instance;
  const originalOnUpdate = controller.onUpdate;
  let active = true;
  let hasFreshPose = false;

  const onUpdate = (data: ControllerUpdate) => {
    if (!active || data.type !== "updateMatrix" || data.targetIndex !== 0) {
      originalOnUpdate.call(controller, data);
      return;
    }

    const state = controller.trackingStates[0];
    if (!isTrackingState(state)) throw incompatible();
    let rawMatrix: number[] | null = null;
    const fresh = data.worldMatrix !== null && state.isTracking && state.showing;
    if (fresh && isFinitePose(state.currentModelViewTransform)) {
      let matrix = controller.getWorldMatrix(state.currentModelViewTransform, 0);
      if (isFiniteWorldMatrix(matrix)) {
        if (
          instance.video.width === controller.inputHeight
          && instance.video.height === controller.inputWidth
        ) {
          matrix = controller.getRotatedZ90Matrix(matrix);
        }
        if (isFiniteWorldMatrix(matrix)) rawMatrix = [...matrix];
      }
    }

    // Сохраняем события якоря и интерфейса MindAR, включая задержку при потере.
    // Некорректная свежая оценка не должна передать NaN в матрицу якоря.
    originalOnUpdate.call(controller, fresh ? { ...data, worldMatrix: rawMatrix } : data);
    if (!active) return;

    if (rawMatrix !== null) {
      hasFreshPose = true;
      onSample(rawMatrix, performance.now());
    } else if (hasFreshPose) {
      hasFreshPose = false;
      // При trackMiss <= missTolerance MindAR повторяет последнюю позу. Сообщаем
      // о потере измерения, чтобы фильтр не считал старую позу новым наблюдением.
      onSample(null, performance.now());
    }
  };

  controller.onUpdate = onUpdate;
  return () => {
    active = false;
    if (controller.onUpdate === onUpdate) controller.onUpdate = originalOnUpdate;
  };
}

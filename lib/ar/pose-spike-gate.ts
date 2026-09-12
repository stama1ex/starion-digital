/**
 * Отбраковка одиночных промахов трекера по углам маркера на кадре.
 *
 * Зачем именно углы: это ровно то, что видит глаз на плоском контенте, и
 * величина в пикселях кадра, а не в градусах разложения позы, которое при
 * взгляде почти в упор неустойчиво само по себе.
 *
 * Зачем адаптивный порог: собственный шум трекинга в анфас и сбоку отличается
 * втрое (2.6 px против 6.75 px по замерам на живом сувенире), и фиксированное
 * число там либо не поймает ничего, либо срежет всё подряд.
 *
 * Зачем терпение: настоящее быстрое движение выглядит как большой скачок в
 * первом же кадре и держится дальше. Без терпения отбраковка заморозила бы
 * картинку на верных наблюдениях — ровно это делала прежняя защита от
 * переворота, замораживая позу почти на полсекунды.
 */
export interface SpikeGateOptions {
  /** Ниже этого скачка не отбраковываем никогда, px кадра. */
  floorPx: number;
  /** Во сколько раз скачок должен превысить обычный шум. 0 — выключено. */
  factor: number;
  /** Столько отбраковок подряд — и признаём движением. */
  patience: number;
  /** Скорость подстройки базы шума, 0..1. */
  adapt?: number;
  /**
   * Сколько первых сравнений идут без отбраковки и с быстрой подстройкой.
   *
   * База шума стартует с заниженного значения и при обычной скорости
   * подстройки добирается до реального уровня за десятки кадров — всё это
   * время нормальное дрожание выглядит выбросом. На стенде это сразу дало
   * три ложных отбраковки подряд сразу после захвата.
   */
  warmup?: number;
}

export interface SpikeGate {
  /** Скачок последнего наблюдения, px. */
  readonly lastJumpPx: number;
  /** Действующий порог, px. */
  readonly limitPx: number;
  /** Сколько наблюдений отброшено с последнего reset. */
  readonly rejected: number;
  /** true — наблюдение принять, false — отбросить. */
  accept(corners: ArrayLike<number>): boolean;
  reset(): void;
}

export function createPoseSpikeGate(options: SpikeGateOptions): SpikeGate {
  const { floorPx, factor, patience } = options;
  const adapt = options.adapt ?? 0.1;
  const warmup = options.warmup ?? 8;
  if (!Number.isFinite(floorPx) || floorPx <= 0) {
    throw new RangeError('floorPx must be a finite positive number');
  }
  if (!Number.isFinite(factor) || factor < 0) {
    throw new RangeError('factor must be finite and nonnegative');
  }
  if (!Number.isInteger(patience) || patience < 0) {
    throw new RangeError('patience must be a nonnegative integer');
  }
  if (!Number.isFinite(adapt) || adapt <= 0 || adapt > 1) {
    throw new RangeError('adapt must be in (0, 1]');
  }
  if (!Number.isInteger(warmup) || warmup < 0) {
    throw new RangeError('warmup must be a nonnegative integer');
  }

  const previous = new Float64Array(8);
  let hasPrevious = false;
  let typical = floorPx / Math.max(1, factor);
  let streak = 0;
  let compared = 0;

  const state = {
    lastJumpPx: 0,
    limitPx: Math.max(floorPx, factor * typical),
    rejected: 0,

    accept(corners: ArrayLike<number>): boolean {
      if (corners.length !== 8) throw new RangeError('corners must hold 4 xy pairs');
      for (let i = 0; i < 8; i++) {
        // Негодное наблюдение решает вызывающая сторона; здесь оно просто
        // не должно отравить базу шума и предыдущие углы.
        if (!Number.isFinite(corners[i])) return false;
      }
      state.limitPx = Math.max(floorPx, factor * typical);
      if (!hasPrevious) {
        for (let i = 0; i < 8; i++) previous[i] = corners[i];
        hasPrevious = true;
        state.lastJumpPx = 0;
        return true;
      }

      let jump = 0;
      for (let i = 0; i < 4; i++) {
        jump = Math.max(
          jump,
          Math.hypot(corners[i * 2] - previous[i * 2], corners[i * 2 + 1] - previous[i * 2 + 1]),
        );
      }
      state.lastJumpPx = jump;

      if (compared < warmup) {
        // Прогрев: база шума ещё не знает, насколько трясёт именно здесь.
        compared++;
        streak = 0;
        typical += (jump - typical) * 0.5;
        for (let i = 0; i < 8; i++) previous[i] = corners[i];
        return true;
      }

      if (factor > 0 && jump > state.limitPx && streak < patience) {
        streak++;
        state.rejected++;
        // Предыдущие углы намеренно не трогаем: иначе точка отсчёта уедет
        // на сам выброс и следующий кадр покажется нормальным.
        return false;
      }

      streak = 0;
      compared++;
      // Выброс в базу шума пускаем только урезанным до порога, иначе одна
      // промашка подняла бы порог и открыла дорогу следующим.
      typical += (Math.min(jump, state.limitPx) - typical) * adapt;
      for (let i = 0; i < 8; i++) previous[i] = corners[i];
      return true;
    },

    reset(): void {
      hasPrevious = false;
      streak = 0;
      compared = 0;
      typical = floorPx / Math.max(1, factor);
      state.lastJumpPx = 0;
      state.limitPx = Math.max(floorPx, factor * typical);
      state.rejected = 0;
    },
  };

  return state;
}

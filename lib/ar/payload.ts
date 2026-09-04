/* eslint-disable @typescript-eslint/no-explicit-any */
// Разбор полей трансформации/воспроизведения из тела запроса — общий код для
// POST (создание) и PATCH (обновление) AR-опыта.

const NUMBER_FIELDS = [
  'scale',
  'rotationX',
  'rotationY',
  'rotationZ',
  'offsetX',
  'offsetY',
  'offsetZ',
] as const;

const BOOLEAN_FIELDS = [
  'autoplay',
  'loop',
  'sound',
  'isActive',
  'whiteLabel',
] as const;

export function pickARSettings(data: any): Record<string, number | boolean> {
  const out: Record<string, number | boolean> = {};
  for (const key of NUMBER_FIELDS) {
    const raw = data[key];
    if (raw !== undefined && raw !== null && raw !== '') {
      const n = Number(raw);
      if (!Number.isNaN(n)) out[key] = n;
    }
  }
  for (const key of BOOLEAN_FIELDS) {
    if (data[key] !== undefined) out[key] = !!data[key];
  }
  return out;
}

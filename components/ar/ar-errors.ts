/* eslint-disable @typescript-eslint/no-explicit-any */

// Виды ошибок AR — каждому соответствует ключ перевода error.<kind> в
// namespace ARViewer.
export type ARErrorKind =
  | 'insecure' // не https / не secure context
  | 'unsupported' // нет getUserMedia / старый браузер
  | 'permission' // пользователь не дал доступ к камере
  | 'noCamera' // камера не найдена
  | 'cameraBusy' // камера занята другим приложением
  | 'webgl' // нет WebGL
  | 'asset' // не загрузился контент (видео/GLB/.mind)
  | 'mindar' // не загрузился движок MindAR с CDN
  | 'unknown';

export function classifyMediaError(err: any): ARErrorKind {
  const name = err?.name || '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
    case 'SecurityError':
      return 'permission';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
    case 'OverconstrainedError':
      return 'noCamera';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'cameraBusy';
    default:
      return 'unknown';
  }
}

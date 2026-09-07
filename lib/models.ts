// 3D-модели-заготовки (magnet.glb, plate.glb), на которые натягивается
// картинка товара в превью каталога.
//
// Раньше на каждый рендер страницы каталога уходило два последовательных
// запроса к Dropbox за временными ссылками — прямо на критическом пути
// отрисовки. Сейчас файлы лежат в R2, адрес постоянный, и сетевых запросов
// здесь не остаётся вовсе: функция просто строит строку.
import { r2PublicUrl } from './r2-public';

export const MODELS_R2_DIR = 'models';

export async function getModelUrl(fileName: string): Promise<string> {
  return r2PublicUrl(`${MODELS_R2_DIR}/${fileName}`);
}

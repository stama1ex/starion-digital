// 3D-модели-заготовки (magnet.glb, plate.glb), на которые натягивается
// картинка товара в превью каталога.
//
// Раньше на каждый рендер страницы каталога уходило два последовательных
// запроса к Dropbox за временными ссылками — прямо на критическом пути
// отрисовки. В R2 адрес постоянный, поэтому здесь не остаётся ни одного
// сетевого запроса: просто строка.
import { getTemporaryLink } from './dropbox';
import { isR2Configured, r2PublicUrl } from './r2';

export const MODELS_R2_DIR = 'models';

export async function getModelUrl(fileName: string): Promise<string> {
  if (isR2Configured()) {
    return r2PublicUrl(`${MODELS_R2_DIR}/${fileName}`);
  }

  // Запасной путь для окружения без R2 (например, локальная копия без
  // ключей): как было раньше, через временную ссылку Dropbox.
  try {
    return await getTemporaryLink(`/${fileName}`);
  } catch (error) {
    console.error(`Error fetching Dropbox link for ${fileName}:`, error);
    return '';
  }
}

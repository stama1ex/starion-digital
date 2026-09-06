// Проверка mp4 на «faststart» перед загрузкой.
//
// Файл mp4 состоит из блоков: ftyp (что за формат), moov (оглавление — где
// какой кадр лежит) и mdat (сами данные). Порядок не фиксирован, и многие
// программы кладут moov в самый конец. Для файла на диске это неважно, а для
// воспроизведения по сети — критично: без оглавления браузер не знает, где
// начало картинки, поэтому вынужден скачать ВЕСЬ ролик, прежде чем показать
// первый кадр. Пятидесятимегабайтный ролик превращается в полминуты чёрного
// экрана, хотя мог бы начаться через секунду.
//
// Лечится перекодированием с флагом faststart — он просто переносит moov в
// начало. Качество и размер при этом не меняются.

export type Mp4Layout = 'faststart' | 'moov-last' | 'unknown';

export interface Mp4Info {
  layout: Mp4Layout;
  // порядок блоков, для подсказки в интерфейсе
  atoms: string[];
}

export async function probeMp4(file: File): Promise<Mp4Info> {
  try {
    // оглавление, если оно в начале, укладывается в первые сотни килобайт
    const head = await file.slice(0, 512 * 1024).arrayBuffer();
    const view = new DataView(head);
    const atoms: string[] = [];
    let off = 0;

    while (off + 8 <= head.byteLength && atoms.length < 8) {
      let size = view.getUint32(off, false);
      const type = String.fromCharCode(
        view.getUint8(off + 4),
        view.getUint8(off + 5),
        view.getUint8(off + 6),
        view.getUint8(off + 7)
      );
      if (!/^[a-zA-Z0-9]{4}$/.test(type)) break;
      atoms.push(type);

      if (size === 1) {
        // 64-битный размер лежит следом за заголовком
        if (off + 16 > head.byteLength) break;
        const hi = view.getUint32(off + 8, false);
        const lo = view.getUint32(off + 12, false);
        size = hi * 2 ** 32 + lo;
      }
      if (size < 8) break;

      if (type === 'moov') return { layout: 'faststart', atoms };
      // mdat раньше moov — значит оглавление в конце
      if (type === 'mdat') return { layout: 'moov-last', atoms };

      off += size;
    }
    return { layout: 'unknown', atoms };
  } catch {
    return { layout: 'unknown', atoms: [] };
  }
}

export function isMp4(file: File): boolean {
  return /mp4|quicktime/i.test(file.type) || /\.(mp4|mov|m4v)$/i.test(file.name);
}

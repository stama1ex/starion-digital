// Чтение списка анимационных клипов из GLB.
//
// GLB устроен так: 12 байт заголовка, затем чанки вида [длина][тип][данные].
// Первый чанк — JSON со всей структурой сцены, включая имена анимаций, и лежит
// он в самом начале файла. Поэтому весь файл качать не нужно: у моделей это
// десятки мегабайт, а JSON — обычно десятки килобайт.

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const PROBE = 256 * 1024;

function parseJsonChunk(buf: ArrayBuffer): {
  names: string[] | null;
  needBytes?: number;
} {
  if (buf.byteLength < 20) return { names: null };
  const view = new DataView(buf);
  if (view.getUint32(0, true) !== GLB_MAGIC) return { names: null };

  const chunkLen = view.getUint32(12, true);
  const chunkType = view.getUint32(16, true);
  if (chunkType !== CHUNK_JSON) return { names: null };

  // JSON-чанк не поместился в прочитанный кусок — скажем, сколько нужно
  if (buf.byteLength < 20 + chunkLen) return { names: null, needBytes: 20 + chunkLen };

  const json = new TextDecoder().decode(new Uint8Array(buf, 20, chunkLen));
  try {
    const gltf = JSON.parse(json);
    const anims = Array.isArray(gltf.animations) ? gltf.animations : [];
    return {
      names: anims.map((a: { name?: string }, i: number) => a?.name || `Клип ${i + 1}`),
    };
  } catch {
    return { names: null };
  }
}

export async function readGlbClipNamesFromFile(file: File): Promise<string[]> {
  try {
    let buf = await file.slice(0, PROBE).arrayBuffer();
    let res = parseJsonChunk(buf);
    if (!res.names && res.needBytes) {
      buf = await file.slice(0, res.needBytes).arrayBuffer();
      res = parseJsonChunk(buf);
    }
    return res.names ?? [];
  } catch {
    return [];
  }
}

// Тот же разбор, но по ссылке: тянем только начало файла Range-запросом.
export async function readGlbClipNamesFromUrl(url: string): Promise<string[]> {
  const fetchHead = async (bytes: number) => {
    const r = await fetch(url, { headers: { Range: `bytes=0-${bytes - 1}` } });
    if (!r.ok && r.status !== 206) throw new Error(`HTTP ${r.status}`);
    return r.arrayBuffer();
  };
  try {
    let buf = await fetchHead(PROBE);
    let res = parseJsonChunk(buf);
    if (!res.names && res.needBytes) {
      buf = await fetchHead(res.needBytes);
      res = parseJsonChunk(buf);
    }
    return res.names ?? [];
  } catch {
    return [];
  }
}

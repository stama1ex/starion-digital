// Чтение списка анимационных клипов из GLB.
//
// GLB устроен так: 12 байт заголовка, затем чанки вида [длина][тип][данные].
// Первый чанк — JSON со всей структурой сцены, включая имена анимаций, и лежит
// он в самом начале файла. Поэтому весь файл качать не нужно: у моделей это
// десятки мегабайт, а JSON — обычно десятки килобайт.

export interface GlbClip {
  name: string;
  // длительность в секундах; 0 означает статичную позу из одного кадра
  duration: number;
}

const GLB_MAGIC = 0x46546c67; // 'glTF'
const CHUNK_JSON = 0x4e4f534a; // 'JSON'
const PROBE = 256 * 1024;

function parseJsonChunk(buf: ArrayBuffer): {
  names: GlbClip[] | null;
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
    const accessors = Array.isArray(gltf.accessors) ? gltf.accessors : [];

    // Длительность клипа — разброс времён в его входных сэмплерах. Она важна
    // администратору: короткий цикл (бег на месте за полсекунды) на
    // неподвижном сувенире читается как дрожание, а нулевая длительность
    // означает вообще не анимацию, а одну статичную позу.
    type RawAnim = { name?: string; samplers?: Array<{ input?: number }> };
    const names: GlbClip[] = anims.map((a: RawAnim, i: number) => {
      let lo: number | null = null;
      let hi: number | null = null;
      for (const sampler of a?.samplers || []) {
        const acc = accessors[sampler?.input ?? -1];
        if (!acc || !Array.isArray(acc.min) || !Array.isArray(acc.max)) continue;
        lo = lo === null ? acc.min[0] : Math.min(lo, acc.min[0]);
        hi = hi === null ? acc.max[0] : Math.max(hi, acc.max[0]);
      }
      return {
        name: a?.name || `Клип ${i + 1}`,
        duration: lo !== null && hi !== null ? Math.max(0, hi - lo) : 0,
      };
    });
    return { names };
  } catch {
    return { names: null };
  }
}

export async function readGlbClipNamesFromFile(file: File): Promise<GlbClip[]> {
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
export async function readGlbClipNamesFromUrl(url: string): Promise<GlbClip[]> {
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

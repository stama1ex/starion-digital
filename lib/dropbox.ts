async function parseDropboxError(res: Response) {
  const text = await res.text(); // читаем ОДИН раз

  try {
    return JSON.parse(text);
  } catch {
    return text; // если не JSON, возвращаем текст
  }
}

// Кэшируем access token в памяти процесса — без этого каждая картинка на
// сайте (каждый продукт в каталоге, каждая открытка на главной и т.д.)
// дергала бы отдельный OAuth-запрос к Dropbox. Токен живёт несколько часов,
// поэтому переиспользуем его, пока не истёк, и дедуплицируем параллельные
// запросы за токеном в момент его обновления.
let cachedToken: { token: string; expiresAt: number } | null = null;
let pendingTokenRequest: Promise<string> | null = null;

async function fetchAccessToken(): Promise<string> {
  const res = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: process.env.DROPBOX_REFRESH_TOKEN!,
      client_id: process.env.DROPBOX_APP_KEY!,
      client_secret: process.env.DROPBOX_APP_SECRET!,
    }),
  });

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('Dropbox token error:', errorText);
    throw new Error(`Dropbox token failed: ${errorText}`);
  }

  const data = await res.json();
  const expiresInMs = (data.expires_in ?? 14400) * 1000; // Dropbox default: 4 часа
  cachedToken = {
    token: data.access_token,
    expiresAt: Date.now() + expiresInMs - 60_000, // запас в минуту на сетевые задержки
  };
  return data.access_token as string;
}

export async function getAccessToken(): Promise<string> {
  if (cachedToken && Date.now() < cachedToken.expiresAt) {
    return cachedToken.token;
  }

  if (!pendingTokenRequest) {
    pendingTokenRequest = fetchAccessToken().finally(() => {
      pendingTokenRequest = null;
    });
  }

  return pendingTokenRequest;
}

export async function uploadToDropboxPath(
  buffer: ArrayBuffer | Buffer,
  path: string,
  mode: 'add' | 'overwrite' = 'add'
): Promise<string> {
  const accessToken = await getAccessToken();

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode,
        autorename: mode === 'add',
        mute: false,
      }),
    },
    body: buffer as BodyInit,
  });

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('UPLOAD ERROR:', errorText);
    throw new Error(`Dropbox upload failed: ${errorText}`);
  }

  return path;
}

export async function uploadToDropbox(
  buffer: ArrayBuffer,
  filename: string
): Promise<string> {
  return uploadToDropboxPath(buffer, `/products/${filename}`, 'add');
}

// Список файлов в папке (например /backups) — используется для ротации
// старых резервных копий. Возвращает [], если папка ещё не создана
// (естественно для первого запуска бэкапа).
export async function listDropboxFolder(
  path: string
): Promise<{ name: string; path: string; serverModified: string }[]> {
  const accessToken = await getAccessToken();

  const res = await fetch('https://api.dropboxapi.com/2/files/list_folder', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (res.status === 409) {
    return [];
  }

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('LIST FOLDER ERROR:', errorText);
    throw new Error(`Dropbox list_folder failed: ${errorText}`);
  }

  const data = await res.json();
  return (data.entries as Record<string, string>[])
    .filter((entry) => entry['.tag'] === 'file')
    .map((entry) => ({
      name: entry.name,
      path: entry.path_lower,
      serverModified: entry.server_modified,
    }));
}

export async function deleteDropboxFile(path: string): Promise<void> {
  const accessToken = await getAccessToken();

  const res = await fetch('https://api.dropboxapi.com/2/files/delete_v2', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ path }),
  });

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('DELETE FILE ERROR:', errorText);
    throw new Error(`Dropbox delete failed: ${errorText}`);
  }
}

// Временные ссылки Dropbox живут ~4 часа, а прокси ассетов и список опытов в
// админке спрашивают одни и те же пути снова и снова — каждый раз это отдельный
// вызов API. Кэшируем в памяти процесса на 3 часа (запас до истечения).
const TEMP_LINK_TTL_MS = 3 * 60 * 60 * 1000;
const TEMP_LINK_CACHE_MAX = 500;
const tempLinkCache = new Map<string, { link: string; expiresAt: number }>();

// Сбросить кэш для пути — на случай, если файл по нему заменили.
export function invalidateTemporaryLink(path: string) {
  tempLinkCache.delete(path);
}

export async function getTemporaryLink(
  path: string,
  accessToken?: string
): Promise<string> {
  const cached = tempLinkCache.get(path);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.link;
  }

  const token = accessToken ?? (await getAccessToken());

  const res = await fetch(
    'https://api.dropboxapi.com/2/files/get_temporary_link',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ path }),
    }
  );

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('GET TEMP LINK ERROR:', errorText);
    throw new Error(`Dropbox temp link failed: ${JSON.stringify(errorText)}`);
  }

  const data = await res.json();

  // грубая защита от роста в долгоживущем процессе: выкидываем самую старую
  if (tempLinkCache.size >= TEMP_LINK_CACHE_MAX) {
    const oldest = tempLinkCache.keys().next().value;
    if (oldest !== undefined) tempLinkCache.delete(oldest);
  }
  tempLinkCache.set(path, {
    link: data.link,
    expiresAt: Date.now() + TEMP_LINK_TTL_MS,
  });

  return data.link;
}

// Одноразовая ссылка для прямой загрузки файла в Dropbox из браузера, минуя
// наш сервер. Нужна для AR-ассетов (видео/GLB), которые не пролезают через
// 4.5 МБ лимит тела запроса у serverless-функций Vercel. Ссылка живёт `duration`
// секунд; браузер шлёт на неё POST с телом файла и Content-Type
// application/octet-stream (это "простой" CORS-запрос, без preflight).
export async function getTemporaryUploadLink(
  path: string,
  duration = 3600
): Promise<string> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    'https://api.dropboxapi.com/2/files/get_temporary_upload_link',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        commit_info: {
          path,
          mode: 'add',
          autorename: true,
          mute: false,
        },
        duration,
      }),
    }
  );

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('GET TEMP UPLOAD LINK ERROR:', errorText);
    throw new Error(
      `Dropbox temp upload link failed: ${JSON.stringify(errorText)}`
    );
  }

  const data = await res.json();
  return data.link as string;
}

export async function uploadImage(buffer: ArrayBuffer, filename: string) {
  try {
    console.log('[DROPBOX] Starting upload process for:', filename);
    const path = await uploadToDropbox(buffer, filename);
    console.log('[DROPBOX] File uploaded to path:', path);
    const url = await getTemporaryLink(path);
    console.log('[DROPBOX] Temporary link generated:', url);
    return { path, url };
  } catch (error) {
    console.error('[DROPBOX] Upload image error:', error);
    throw error;
  }
}

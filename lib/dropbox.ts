async function parseDropboxError(res: Response) {
  const text = await res.text(); // читаем ОДИН раз

  try {
    return JSON.parse(text);
  } catch {
    return text; // если не JSON, возвращаем текст
  }
}

export async function getAccessToken(): Promise<string> {
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
  return data.access_token as string;
}

export async function uploadToDropbox(
  buffer: ArrayBuffer,
  filename: string
): Promise<string> {
  const accessToken = await getAccessToken();
  const path = `/products/${filename}`;

  const res = await fetch('https://content.dropboxapi.com/2/files/upload', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({
        path,
        mode: 'add',
        autorename: true,
        mute: false,
      }),
    },
    body: buffer,
  });

  if (!res.ok) {
    const errorText = await parseDropboxError(res);
    console.error('UPLOAD ERROR:', errorText);
    throw new Error(`Dropbox upload failed: ${errorText}`);
  }

  return path;
}

export async function getTemporaryLink(path: string): Promise<string> {
  const accessToken = await getAccessToken();

  const res = await fetch(
    'https://api.dropboxapi.com/2/files/get_temporary_link',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
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
  return data.link;
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

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

  const data = await res.json();
  if (!res.ok) {
    throw new Error(`Dropbox token refresh failed: ${JSON.stringify(data)}`);
  }
  return data.access_token as string;
}

export async function uploadToDropbox(
  buffer: ArrayBuffer,
  filename: string
): Promise<string> {
  const accessToken = await getAccessToken();
  const path = `/starion-digital/${filename}`;

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
    const error = await res.json();
    throw new Error(`Dropbox upload failed: ${JSON.stringify(error)}`);
  }

  // Возвращаем путь для доступа через временную ссылку
  return path;
}

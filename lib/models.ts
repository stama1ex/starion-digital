/* eslint-disable @typescript-eslint/no-explicit-any */
import { Dropbox } from 'dropbox';
import fetch from 'node-fetch';
import { getAccessToken } from './dropbox';

export async function getModelUrl(fileName: string) {
  try {
    const accessToken = await getAccessToken();

    const dbx = new Dropbox({
      accessToken,
      fetch: fetch as any,
    });

    const { result } = await dbx.filesGetTemporaryLink({
      path: `/${fileName}`,
    });

    return result.link;
  } catch (error) {
    console.error(`Error fetching Dropbox link for ${fileName}:`, error);
    return '';
  }
}

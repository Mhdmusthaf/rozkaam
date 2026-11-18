// Talks to the Rozkaam API. When EXPO_PUBLIC_API_URL is not set, the app
// has no server and runs on demo data only.
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');
export const hasApi = API_URL.length > 0;

const TOKEN_KEY = 'rozkaam.token';
let token: string | null = null;

export async function loadToken() {
  try {
    token = await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    token = null;
  }
  return token;
}

export async function setToken(t: string | null) {
  token = t;
  try {
    if (t) await AsyncStorage.setItem(TOKEN_KEY, t);
    else await AsyncStorage.removeItem(TOKEN_KEY);
  } catch {
    // Storage can be unavailable (private browsing); the session then lasts until the app closes.
  }
}

/** An error from the server with a message that is safe to show. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

const OFFLINE = 'Could not reach Rozkaam. Check your internet connection and try again.';

export async function api<T = unknown>(method: 'GET' | 'POST' | 'PUT', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'offline', OFFLINE);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? 'Something went wrong. Please try again.');
  return json as T;
}

/** Uploads a photo taken or picked on this device and returns its storage key. */
export async function uploadPhoto(uri: string): Promise<string> {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const type = blob.type && blob.type !== 'application/octet-stream' ? blob.type : 'image/jpeg';
    form.append('file', new File([blob], `photo.${type.split('/')[1] ?? 'jpg'}`, { type }));
  } else {
    // React Native sends local files by reference.
    form.append('file', { uri, name: 'photo.jpg', type: 'image/jpeg' } as unknown as Blob);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}/v1/uploads`, { method: 'POST', headers: token ? { authorization: `Bearer ${token}` } : {}, body: form });
  } catch {
    throw new ApiError(0, 'offline', OFFLINE);
  }
  const json = await res.json().catch(() => null);
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? 'The photo could not be uploaded.');
  return json.key as string;
}

/** True for a photo that only exists on this device and still needs uploading. */
export const isLocalUri = (v: string | null | undefined): v is string => !!v && /^(file:|content:|blob:|data:|ph:|assets-library:)/.test(v);

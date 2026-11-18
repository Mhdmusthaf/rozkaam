// Talks to the Rozkaam API. Used only when VITE_API_URL is set; without it
// the panel runs on its in-memory demo data and this file is never called.

/** Base address of the API, e.g. http://localhost:4000. Empty = demo mode. */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? '').replace(/\/+$/, '');
export const LIVE = API_URL !== '';

const TOKEN_KEY = 'rozkaam.admin.token';
const PHONE_KEY = 'rozkaam.admin.phone';

// The token lives in sessionStorage: it is gone when the tab closes.
const read = (k: string) => {
  try {
    return sessionStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string | null) => {
  try {
    if (v === null) sessionStorage.removeItem(k);
    else sessionStorage.setItem(k, v);
  } catch {
    /* storage blocked: stay signed in for this page load only */
  }
};

let token: string | null = read(TOKEN_KEY);
let onSignedOut: (() => void) | null = null;

export const getToken = () => token;
export const getPhone = () => read(PHONE_KEY);
export const setSession = (t: string | null, phone?: string) => {
  token = t;
  write(TOKEN_KEY, t);
  write(PHONE_KEY, t ? (phone ?? read(PHONE_KEY)) : null);
};
/** Called when the server says the session is no longer valid. */
export const onSessionExpired = (fn: () => void) => {
  onSignedOut = fn;
};

/** An error the server explained in words that are safe to show. */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body !== undefined ? { 'content-type': 'application/json' } : {}) },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(0, 'network', 'Could not reach the Rozkaam server. Check that it is running and try again.');
  }
  if (res.ok) return res;
  const data = (await res.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
  const err = new ApiError(res.status, data?.error?.code ?? 'error', data?.error?.message ?? `The server answered with an error (${res.status}).`);
  if (res.status === 401 && token) {
    setSession(null);
    onSignedOut?.();
  }
  throw err;
}

export const api = {
  get: async <T>(path: string) => (await request('GET', path)).json() as Promise<T>,
  post: async <T>(path: string, body?: unknown) => (await request('POST', path, body ?? {})).json() as Promise<T>,
  put: async <T>(path: string, body: unknown) => (await request('PUT', path, body)).json() as Promise<T>,
  /** Private files (KYC documents, check-in photos) need the token, so they are fetched as a blob. */
  blob: async (path: string) => (await request('GET', path)).blob(),
};

export const errorText = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong. Please try again.');

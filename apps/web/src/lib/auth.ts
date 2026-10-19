export type AuthUser = {
  id: string;
  username: string;
  displayName: string | null;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'INSTRUCTOR';
  avatarUrl: string | null;
  createdAt: string;
};

type AuthCredentials = {
  email: string;
  password: string;
};

type RegisterInput = AuthCredentials & {
  username: string;
  displayName?: string;
};

type TrpcResponse<T> = {
  result?: { data?: T };
  error?: { message?: string };
};

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001').replace(/\/+$/, '');

async function readResponse<T>(response: Response): Promise<T> {
  const body = (await response.json()) as TrpcResponse<T>;
  if (!response.ok || body.error) {
    throw new Error(body.error?.message || `Authentication request failed (${response.status}).`);
  }
  if (!body.result || !('data' in body.result)) {
    throw new Error('The authentication service returned an invalid response.');
  }
  return body.result.data as T;
}

async function mutate<T>(procedure: string, input: object): Promise<T> {
  const response = await fetch(`${API_BASE_URL}/trpc/auth.${procedure}`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(input),
  });
  return readResponse<T>(response);
}

export function register(input: RegisterInput): Promise<{ user: AuthUser }> {
  return mutate('register', input);
}

export function login(input: AuthCredentials): Promise<{ user: AuthUser }> {
  return mutate('login', input);
}

export function logout(): Promise<{ success: boolean }> {
  return mutate('logout', {});
}

export async function me(cookie?: string): Promise<AuthUser | null> {
  const response = await fetch(`${API_BASE_URL}/trpc/auth.me`, {
    method: 'GET',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(cookie ? { Cookie: cookie } : {}),
    },
    cache: 'no-store',
  });
  const user = await readResponse<AuthUser | null>(response);
  return user;
}

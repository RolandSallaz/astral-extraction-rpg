import { NextResponse } from 'next/server';

type AuthenticatedPlayer = {
  id: string;
  nickname: string;
  role: string;
};

class AdminRouteAuthError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

function buildBackendBaseUrlCandidates() {
  const candidates = new Set<string>();
  const addCandidate = (value: string | undefined) => {
    if (!value) {
      return;
    }

    candidates.add(value.replace(/\/+$/, ''));
  };

  addCandidate(process.env.BACKEND_INTERNAL_URL);
  addCandidate(process.env.BACKEND_URL);
  addCandidate(process.env.NEXT_PUBLIC_API_URL);

  const publicApiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (publicApiUrl) {
    try {
      const parsed = new URL(publicApiUrl);
      if (
        parsed.hostname === 'localhost' ||
        parsed.hostname === '127.0.0.1' ||
        parsed.hostname === '::1'
      ) {
        addCandidate(`${parsed.protocol}//backend:${parsed.port || '3000'}`);
        addCandidate(`${parsed.protocol}//host.docker.internal:${parsed.port || '3000'}`);
      }
    } catch {
      // Ignore malformed URLs and continue with the known defaults.
    }
  }

  addCandidate('http://backend:3000');
  addCandidate('http://host.docker.internal:3000');
  addCandidate('http://localhost:3000');

  return [...candidates];
}

async function readBackendErrorMessage(response: Response) {
  const payload = (await response.json().catch(() => null)) as
    | { message?: string | string[] }
    | null;

  if (Array.isArray(payload?.message)) {
    return payload.message.join(', ');
  }

  return payload?.message ?? null;
}

export async function requireAdminRequest(request: Request) {
  const authorization = request.headers.get('authorization');
  if (!authorization?.startsWith('Bearer ')) {
    throw new AdminRouteAuthError('Missing session token.', 401);
  }

  let lastInfrastructureError: AdminRouteAuthError | null = null;

  for (const baseUrl of buildBackendBaseUrlCandidates()) {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}/auth/me`, {
        headers: {
          Authorization: authorization,
        },
        cache: 'no-store',
      });
    } catch {
      lastInfrastructureError = new AdminRouteAuthError(
        `Authentication backend is unavailable at ${baseUrl}.`,
        502,
      );
      continue;
    }

    if (!response.ok) {
      const message = await readBackendErrorMessage(response);
      if (response.status === 401 || response.status === 403) {
        throw new AdminRouteAuthError(message ?? 'Failed to verify session.', response.status);
      }

      lastInfrastructureError = new AdminRouteAuthError(
        message ?? `Failed to verify session against ${baseUrl}.`,
        502,
      );
      continue;
    }

    const player = (await response.json()) as AuthenticatedPlayer;
    if (player.role.toUpperCase() !== 'ADMIN') {
      throw new AdminRouteAuthError('Admin role required.', 403);
    }

    return player;
  }

  throw lastInfrastructureError ?? new AdminRouteAuthError('Authentication backend is unavailable.', 502);
}

export function toAdminAuthErrorResponse(error: unknown) {
  if (error instanceof AdminRouteAuthError) {
    return NextResponse.json(
      { message: error.message },
      { status: error.status },
    );
  }

  return NextResponse.json(
    { message: 'Unexpected admin authentication error.' },
    { status: 500 },
  );
}

import { NextRequest, NextResponse } from 'next/server';

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
      // Ignore malformed env values and continue with known defaults.
    }
  }

  addCandidate('http://backend:3000');
  addCandidate('http://host.docker.internal:3000');
  addCandidate('http://localhost:3000');

  return [...candidates];
}

function buildForwardHeaders(request: NextRequest) {
  const headers = new Headers();
  const authorization = request.headers.get('authorization');
  const contentType = request.headers.get('content-type');
  const accept = request.headers.get('accept');

  if (authorization) {
    headers.set('authorization', authorization);
  }

  if (contentType) {
    headers.set('content-type', contentType);
  }

  if (accept) {
    headers.set('accept', accept);
  }

  return headers;
}

function buildResponseHeaders(upstream: Response) {
  const headers = new Headers();
  const contentType = upstream.headers.get('content-type');

  if (contentType) {
    headers.set('content-type', contentType);
  }

  headers.set('cache-control', 'no-store');
  return headers;
}

async function proxyToBackend(request: NextRequest, path: string[]) {
  const search = request.nextUrl.search || '';
  const method = request.method.toUpperCase();
  const body =
    method === 'GET' || method === 'HEAD'
      ? undefined
      : await request.text();

  let lastError: Error | null = null;

  for (const baseUrl of buildBackendBaseUrlCandidates()) {
    try {
      const upstream = await fetch(`${baseUrl}/${path.join('/')}${search}`, {
        method,
        headers: buildForwardHeaders(request),
        body,
        cache: 'no-store',
      });
      const payload = await upstream.text();

      return new NextResponse(payload, {
        status: upstream.status,
        headers: buildResponseHeaders(upstream),
      });
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Backend proxy request failed.');
    }
  }

  return NextResponse.json(
    {
      message: lastError?.message ?? 'Backend is unavailable.',
    },
    { status: 502 },
  );
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export async function PUT(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ path: string[] }> },
) {
  const { path } = await context.params;
  return proxyToBackend(request, path);
}

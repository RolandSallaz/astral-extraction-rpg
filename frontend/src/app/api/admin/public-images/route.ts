import { NextRequest, NextResponse } from 'next/server';
import { readdir } from 'node:fs/promises';
import path from 'node:path';
import {
  requireAdminRequest,
  toAdminAuthErrorResponse,
} from '@/lib/server/adminAuth';

const IMAGE_EXTENSIONS = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);

async function walkPublicImages(directory: string, rootDirectory: string, results: string[]) {
  const entries = await readdir(directory, { withFileTypes: true });

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);

    if (entry.isDirectory()) {
      await walkPublicImages(absolutePath, rootDirectory, results);
      continue;
    }

    if (!IMAGE_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) {
      continue;
    }

    const relativePath = absolutePath
      .slice(rootDirectory.length)
      .replace(/\\/g, '/');

    results.push(relativePath.startsWith('/') ? relativePath : `/${relativePath}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);

    const publicRoot = path.join(process.cwd(), 'public');
    const imagePaths: string[] = [];

    await walkPublicImages(publicRoot, publicRoot, imagePaths);
    imagePaths.sort((left, right) => left.localeCompare(right));

    return NextResponse.json({ images: imagePaths });
  } catch (error) {
    return toAdminAuthErrorResponse(error);
  }
}

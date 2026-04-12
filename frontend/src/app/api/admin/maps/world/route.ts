import { NextRequest, NextResponse } from 'next/server';
import {
  loadMeadowMapAssetFromDisk,
  saveMeadowMapAssetToDisk,
} from '@/lib/maps/meadowMapAssetServer';
import {
  requireAdminRequest,
  toAdminAuthErrorResponse,
} from '@/lib/server/adminAuth';
import type { MeadowMapAsset } from '@/lib/maps/meadowMap';

export async function GET(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const asset = await loadMeadowMapAssetFromDisk();
    return NextResponse.json(asset);
  } catch (error) {
    return toAdminAuthErrorResponse(error);
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdminRequest(request);
    const payload = (await request.json()) as MeadowMapAsset;
    const savedAsset = await saveMeadowMapAssetToDisk(payload);
    return NextResponse.json(savedAsset);
  } catch (error) {
    return toAdminAuthErrorResponse(error);
  }
}

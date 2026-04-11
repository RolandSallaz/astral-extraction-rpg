import { NextRequest, NextResponse } from 'next/server';
import {
  loadMeadowMapAssetFromDisk,
  saveMeadowMapAssetToDisk,
} from '@/lib/maps/meadowMapAssetServer';
import type { MeadowMapAsset } from '@/lib/maps/meadowMap';

export async function GET() {
  const asset = await loadMeadowMapAssetFromDisk();
  return NextResponse.json(asset);
}

export async function PUT(request: NextRequest) {
  const payload = (await request.json()) as MeadowMapAsset;
  const savedAsset = await saveMeadowMapAssetToDisk(payload);
  return NextResponse.json(savedAsset);
}

import { NextResponse } from 'next/server';
import { loadMeadowMapAssetFromDisk } from '@/lib/maps/meadowMapAssetServer';

export async function GET() {
  const asset = await loadMeadowMapAssetFromDisk();
  return NextResponse.json(asset);
}

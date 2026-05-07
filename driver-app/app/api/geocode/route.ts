import { NextRequest, NextResponse } from 'next/server';

// Server-side in-memory cache — persists across requests in the same process
// Key: "lat4,lng4" (rounded to 4dp), Value: resolved address
const serverCache = new Map<string, string>();

/** Round to 4 decimal places (~11m precision) — maximises cache hits */
function roundCoord(n: string): string {
  return parseFloat(n).toFixed(4);
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');

  if (!lat || !lng) {
    return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 });
  }

  const cacheKey = `${roundCoord(lat)},${roundCoord(lng)}`;

  // 1. Return immediately if cached
  if (serverCache.has(cacheKey)) {
    return NextResponse.json(
      { label: serverCache.get(cacheKey) },
      { headers: { 'Cache-Control': 'public, max-age=604800' } }
    );
  }

  // 2. Enforce Nominatim 1 req/sec policy with a small delay
  await new Promise(r => setTimeout(r, 1100));

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      {
        headers: {
          'Accept-Language': 'vi',
          'User-Agent': 'cab-booking-driver-app/1.0',
        },
      }
    );

    if (res.status === 429) {
      // Wait extra and retry once
      await new Promise(r => setTimeout(r, 2000));
      const retry = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
        { headers: { 'Accept-Language': 'vi', 'User-Agent': 'cab-booking-driver-app/1.0' } }
      );
      if (!retry.ok) {
        return NextResponse.json({ error: 'Rate limited' }, { status: 429 });
      }
      const data = await retry.json();
      const label = buildLabel(data, lat, lng);
      serverCache.set(cacheKey, label);
      return NextResponse.json({ label }, { headers: { 'Cache-Control': 'public, max-age=604800' } });
    }

    if (!res.ok) {
      return NextResponse.json({ error: 'Geocoding failed' }, { status: res.status });
    }

    const data = await res.json();
    const label = buildLabel(data, lat, lng);
    serverCache.set(cacheKey, label);

    return NextResponse.json({ label }, {
      headers: { 'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400' },
    });
  } catch {
    return NextResponse.json({ error: 'Network error' }, { status: 500 });
  }
}

function buildLabel(data: Record<string, unknown>, lat: string, lng: string): string {
  const a = (data.address as Record<string, string>) || {};
  const parts = [
    a.road || a.pedestrian || a.footway,
    a.suburb || a.quarter || a.neighbourhood,
    a.city_district || a.district,
  ].filter(Boolean);

  return parts.length > 0
    ? parts.join(', ')
    : ((data.display_name as string)?.split(',').slice(0, 2).join(', ') ?? `${lat},${lng}`);
}

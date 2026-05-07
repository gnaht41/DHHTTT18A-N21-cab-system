import { NextRequest, NextResponse } from 'next/server';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type') || 'reverse';
  const lat = searchParams.get('lat');
  const lng = searchParams.get('lng');
  const q = searchParams.get('q');
  const viewbox = searchParams.get('viewbox');
  const bounded = searchParams.get('bounded');

  let url = '';
  if (type === 'reverse') {
    if (!lat || !lng) return NextResponse.json({ error: 'Lat/Lng required' }, { status: 400 });
    url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1`;
  } else {
    if (!q) return NextResponse.json({ error: 'Query required' }, { status: 400 });
    url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=6`;
    if (viewbox) url += `&viewbox=${viewbox}`;
    if (bounded) url += `&bounded=${bounded}`;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'Accept': 'application/json',
        'Accept-Language': 'vi-VN,vi;q=0.9,en-US;q=0.8,en;q=0.7',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://nominatim.openstreetmap.org/',
      },
      next: { revalidate: 600 } // Cache for 10 minutes to reduce hits
    });

    if (response.status === 429) {
      return NextResponse.json({ error: 'Rate limited by upstream' }, { status: 429 });
    }

    if (!response.ok) {
        const errorText = await response.text();
        return NextResponse.json({ error: 'External API error', details: errorText }, { status: response.status });
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('[Geocode API Proxy Error]:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}

import { NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN!

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json({ data: [] })

  const url = new URL('https://graph.facebook.com/v20.0/search')
  url.searchParams.set('type', 'adgeolocation')
  url.searchParams.set('q', q)
  url.searchParams.set('location_types', JSON.stringify(['city', 'neighborhood', 'suburb']))
  url.searchParams.set('country_code', 'BR')
  url.searchParams.set('limit', '8')
  url.searchParams.set('access_token', TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.data || []).map((l: any) => ({
    key: l.key,
    name: l.name,
    region: l.region || '',
    country: l.country_code || 'BR',
    type: l.type, // neighborhood, city, suburb, region
    lat: l.latitude || null,
    lng: l.longitude || null,
    label: `${l.name}${l.region ? ', ' + l.region : ''}`,
    // Meta API geo array name for this type
    geoArray: l.type === 'city' ? 'cities'
      : l.type === 'neighborhood' ? 'neighborhoods'
      : l.type === 'suburb' ? 'subneighborhoods'
      : l.type === 'region' ? 'regions'
      : 'cities',
  }))

  return NextResponse.json({ data: results })
}

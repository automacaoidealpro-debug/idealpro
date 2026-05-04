import { NextResponse } from 'next/server'

const TOKEN = process.env.META_ACCESS_TOKEN!

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const q = searchParams.get('q')
  if (!q || q.length < 2) return NextResponse.json({ data: [] })

  const url = new URL('https://graph.facebook.com/v20.0/search')
  url.searchParams.set('type', 'adinterest')
  url.searchParams.set('q', q)
  url.searchParams.set('limit', '10')
  url.searchParams.set('locale', 'pt_BR')
  url.searchParams.set('access_token', TOKEN)

  const res = await fetch(url.toString(), { cache: 'no-store' })
  const data = await res.json()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const results = (data.data || []).map((i: any) => ({
    id: String(i.id),
    name: String(i.name),
    path: Array.isArray(i.path) ? i.path.join(' › ') : '',
    size: Number(i.audience_size_upper_bound || 0),
  }))

  return NextResponse.json({ data: results })
}

import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}${path}`)
  url.searchParams.set('access_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = JSON.parse(text) } catch { return null }
  if (j?.error) return null
  return j
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const accountId = id.startsWith('act_') ? id : `act_${id}`

  // Parallel fetch
  const [pixelsData, pagesData, audiencesData] = await Promise.all([
    metaGet(`/${accountId}/adspixels`, { fields: 'id,name', limit: '20' }),
    metaGet(`/${accountId}/promote_pages`, { fields: 'id,name', limit: '20' }),
    metaGet(`/${accountId}/customaudiences`, {
      fields: 'id,name,subtype,approximate_count_lower_bound',
      limit: '100',
    }),
  ])

  const pixels = (pixelsData?.data || []) as { id: string; name: string }[]
  const pages = (pagesData?.data || []) as { id: string; name: string }[]
  const pageIds = pages.map(p => p.id)

  // WhatsApp numbers from existing WhatsApp adsets
  const adsetsData = await metaGet(`/${accountId}/adsets`, {
    fields: 'promoted_object,destination_type',
    filtering: JSON.stringify([{ field: 'destination_type', operator: 'EQUAL', value: 'WHATSAPP' }]),
    limit: '10',
  })

  const whatsappNumbers: string[] = []
  for (const as of (adsetsData?.data || [])) {
    const num = as.promoted_object?.whatsapp_phone_number
    if (num && !whatsappNumbers.includes(num)) whatsappNumbers.push(num)
    const pid = as.promoted_object?.page_id
    if (pid && !pageIds.includes(pid)) pageIds.push(pid)
  }

  // Creatives from recent active/paused ads
  const adsData = await metaGet(`/${accountId}/ads`, {
    fields: 'id,name,adcreatives{id,name,thumbnail_url}',
    filtering: JSON.stringify([{ field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }]),
    limit: '30',
  })

  const seenCreativeIds = new Set<string>()
  const creatives: { id: string; name: string; adName: string; thumbnail?: string }[] = []
  for (const ad of (adsData?.data || [])) {
    for (const cr of (ad.adcreatives?.data || [])) {
      if (!seenCreativeIds.has(cr.id)) {
        seenCreativeIds.add(cr.id)
        creatives.push({ id: cr.id, name: cr.name || ad.name, adName: ad.name, thumbnail: cr.thumbnail_url })
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const audiences = (audiencesData?.data || []).map((a: any) => ({
    id: String(a.id),
    name: String(a.name),
    subtype: String(a.subtype || ''),
    size: Number(a.approximate_count_lower_bound || 0),
  }))

  return NextResponse.json({
    pixels,
    pages,
    pageIds,
    whatsappNumbers,
    creatives: creatives.slice(0, 20),
    audiences,
  })
}

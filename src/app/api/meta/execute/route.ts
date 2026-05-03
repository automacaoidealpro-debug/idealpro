import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

async function metaPost(path: string, body: Record<string, string>) {
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('access_token', TOKEN)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const j = await res.json()
  if (j.error) throw new Error(`Meta API: ${j.error.message} (code ${j.error.code})`)
  return j
}

export async function POST(req: Request) {
  try {
    const { type, entityId, params } = await req.json()

    if (!type) return NextResponse.json({ error: 'type é obrigatório' }, { status: 400 })

    let result
    let message = 'Ação executada com sucesso'

    switch (type) {
      case 'pause_campaign':
        if (!entityId) return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
        result = await metaPost(entityId, { status: 'PAUSED' })
        message = 'Campanha pausada'
        break

      case 'activate_campaign':
        if (!entityId) return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
        result = await metaPost(entityId, { status: 'ACTIVE' })
        message = 'Campanha ativada'
        break

      case 'pause_adset':
        if (!entityId) return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
        result = await metaPost(entityId, { status: 'PAUSED' })
        message = 'Conjunto de anúncios pausado'
        break

      case 'activate_adset':
        if (!entityId) return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
        result = await metaPost(entityId, { status: 'ACTIVE' })
        message = 'Conjunto de anúncios ativado'
        break

      case 'update_adset_budget':
      case 'update_campaign_budget': {
        if (!entityId) return NextResponse.json({ error: 'entityId obrigatório' }, { status: 400 })
        const budget = params?.daily_budget
        if (!budget) return NextResponse.json({ error: 'daily_budget obrigatório' }, { status: 400 })
        result = await metaPost(entityId, { daily_budget: String(budget) })
        message = `Orçamento atualizado para R$${(parseInt(String(budget)) / 100).toFixed(2)}/dia`
        break
      }

      case 'create_campaign': {
        if (!entityId) return NextResponse.json({ error: 'entityId (account_id) obrigatório' }, { status: 400 })
        const { name, objective, status: campStatus } = params || {}
        if (!name || !objective) return NextResponse.json({ error: 'name e objective obrigatórios' }, { status: 400 })
        result = await metaPost(`${entityId}/campaigns`, {
          name,
          objective,
          status: campStatus || 'PAUSED',
          special_ad_categories: '[]',
        })
        message = `Campanha "${name}" criada em modo pausado`
        break
      }

      case 'info':
        return NextResponse.json({ success: true, message: 'Ação informativa — nenhuma execução necessária', result: null })

      default:
        return NextResponse.json({ error: `Tipo "${type}" não suportado` }, { status: 400 })
    }

    return NextResponse.json({ success: true, result, message })
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 })
  }
}

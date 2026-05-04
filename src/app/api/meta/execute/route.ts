import { NextResponse } from 'next/server'

const BASE = 'https://graph.facebook.com/v20.0'
const TOKEN = process.env.META_ACCESS_TOKEN!

async function metaGet(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('access_token', TOKEN)
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v))
  const res = await fetch(url.toString(), { cache: 'no-store' })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = await res.json() } catch { return null }
  if (j?.error) return null
  return j
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function metaPost(path: string, body: Record<string, any>) {
  const url = new URL(`${BASE}/${path}`)
  url.searchParams.set('access_token', TOKEN)
  const res = await fetch(url.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  const text = await res.text()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let j: any
  try { j = JSON.parse(text) } catch {
    throw new Error(`Meta API HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  if (j?.error) {
    const sub = j.error.error_subcode ? ` subcode ${j.error.error_subcode}` : ''
    const msg = j.error.error_user_msg || j.error.message
    throw new Error(`Meta API: ${msg} (code ${j.error.code}${sub})`)
  }
  return j
}

function defaultOptGoal(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_LEADS: 'LEAD_GENERATION',
    OUTCOME_SALES: 'OFFSITE_CONVERSIONS',
    OUTCOME_TRAFFIC: 'LINK_CLICKS',
    OUTCOME_ENGAGEMENT: 'POST_ENGAGEMENT',
    OUTCOME_AWARENESS: 'REACH',
    OUTCOME_APP_PROMOTION: 'APP_INSTALLS',
  }
  return map[objective] || 'LINK_CLICKS'
}

function pixelEvent(objective: string): string {
  const map: Record<string, string> = {
    OUTCOME_LEADS: 'LEAD',
    OUTCOME_SALES: 'PURCHASE',
    OUTCOME_TRAFFIC: 'PAGE_VIEW',
  }
  return map[objective] || 'LEAD'
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTargeting(ac: Record<string, any>): Record<string, any> {
  // Geo — location_types only valid for countries/cities, NOT for neighborhoods/suburbs
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const geoLocations: Record<string, any> = {}
  if (ac.geo_key) {
    const arr = String(ac.geo_array || 'neighborhoods')
    geoLocations[arr] = [{ key: String(ac.geo_key) }]
    // cities/regions require location_types; neighborhoods/suburbs do NOT support it
    if (arr === 'cities' || arr === 'regions') geoLocations.location_types = ['home', 'recent']
  } else if (ac.geo_lat && ac.geo_lng) {
    geoLocations.custom_locations = [{
      latitude: parseFloat(String(ac.geo_lat)),
      longitude: parseFloat(String(ac.geo_lng)),
      radius: parseFloat(String(ac.geo_radius || 5)),
      distance_unit: 'kilometer',
    }]
  } else {
    geoLocations.countries = ac.countries
      ? String(ac.countries).split(',').map((s: string) => s.trim())
      : ['BR']
    geoLocations.location_types = ['home', 'recent']
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const targeting: Record<string, any> = {
    age_min: parseInt(String(ac.age_min || 18)),
    age_max: parseInt(String(ac.age_max || 65)),
    geo_locations: geoLocations,
    targeting_automation: { advantage_audience: 0 },
  }

  const genderMap: Record<string, number[]> = { female: [2], male: [1], all: [] }
  const genders = genderMap[String(ac.gender || 'all')] || []
  if (genders.length > 0) targeting.genders = genders

  // Custom audiences
  const customAudiences: string[] = Array.isArray(ac.custom_audiences) ? ac.custom_audiences : []
  if (customAudiences.length > 0) targeting.custom_audiences = customAudiences.map(id => ({ id }))

  const excludedAudiences: string[] = Array.isArray(ac.excluded_audiences) ? ac.excluded_audiences : []
  if (excludedAudiences.length > 0) targeting.excluded_custom_audiences = excludedAudiences.map(id => ({ id }))

  // Interests (flexible_spec)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const interests: { id: string; name: string }[] = Array.isArray(ac.interests) ? ac.interests : []
  if (interests.length > 0) targeting.flexible_spec = [{ interests }]

  // Excluded geo
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const excludedGeos: { key: string; array: string }[] = Array.isArray(ac.excluded_geos) ? ac.excluded_geos : []
  if (excludedGeos.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const excGeo: Record<string, any> = {}
    for (const eg of excludedGeos) {
      if (!excGeo[eg.array]) excGeo[eg.array] = []
      excGeo[eg.array].push({ key: eg.key })
    }
    targeting.excluded_geo_locations = excGeo
  }

  // Placements
  const igPos = ac.placements_ig
    ? String(ac.placements_ig).split(',').map((s: string) => s.trim()).filter(Boolean)
    : ['stream', 'story', 'reels']
  const fbPos = ac.placements_fb
    ? String(ac.placements_fb).split(',').map((s: string) => s.trim()).filter(Boolean)
    : []
  const publishers: string[] = []
  if (igPos.length > 0) publishers.push('instagram')
  if (fbPos.length > 0) publishers.push('facebook')
  if (publishers.length === 0) publishers.push('instagram')
  targeting.publisher_platforms = publishers
  if (igPos.length > 0) targeting.instagram_positions = igPos
  if (fbPos.length > 0) targeting.facebook_positions = fbPos
  targeting.device_platforms = ['mobile']

  return targeting
}

export async function POST(req: Request) {
  try {
    const body = await req.json()
    const { type, entityId, params } = body

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
        const accountId = entityId?.startsWith('act_') ? entityId : `act_${entityId}`
        if (!accountId || accountId === 'act_' || accountId === 'act_undefined') {
          return NextResponse.json({ error: 'account_id inválido ou ausente' }, { status: 400 })
        }
        const { name, objective, status: campStatus, daily_budget } = params || {}
        if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })
        if (!objective) return NextResponse.json({ error: 'objective é obrigatório' }, { status: 400 })

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const campaignBody: Record<string, any> = {
          name,
          objective,
          status: campStatus || 'PAUSED',
          special_ad_categories: [],
          is_adset_budget_sharing_enabled: false,
        }
        if (daily_budget) campaignBody.daily_budget = String(Math.round(parseFloat(String(daily_budget)) * 100))

        result = await metaPost(`${accountId}/campaigns`, campaignBody)
        message = `Campanha "${name}" criada (pausada para revisão) — ID: ${result.id}`
        break
      }

      case 'create_campaign_full': {
        const accountId = entityId?.startsWith('act_') ? entityId : `act_${entityId}`
        if (!accountId || accountId === 'act_' || accountId === 'act_undefined') {
          return NextResponse.json({ error: 'account_id inválido ou ausente' }, { status: 400 })
        }

        const {
          name, objective,
          budget_type, daily_budget: db,
          destination_type, whatsapp_number, page_id,
          pixel_id, optimization_goal,
          creative_ids,
          // ad copy
          ad_primary_text, ad_headline, ad_description, ad_link_url, ad_cta,
          // adsets array
          adsets: adsetsConfig,
        } = params || {}

        if (!name) return NextResponse.json({ error: 'name é obrigatório' }, { status: 400 })
        if (!objective) return NextResponse.json({ error: 'objective é obrigatório' }, { status: 400 })
        if (!db) return NextResponse.json({ error: 'daily_budget é obrigatório' }, { status: 400 })

        const budgetCents = String(Math.round(parseFloat(String(db)) * 100))
        const isCBO = budget_type === 'CBO'
        const isWhatsApp = destination_type === 'WHATSAPP'

        // Step 1: campaign
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const campBody: Record<string, any> = {
          name, objective, status: 'PAUSED',
          special_ad_categories: [],
          is_adset_budget_sharing_enabled: false,
        }
        if (isCBO) campBody.daily_budget = budgetCents
        console.log('[create_campaign_full] campBody:', JSON.stringify(campBody))
        const campaign = await metaPost(`${accountId}/campaigns`, campBody)
          .catch(e => { throw new Error(`CAMP: ${e.message}`) })
        const campaignId = campaign.id

        const optGoal = optimization_goal || (isWhatsApp ? 'CONVERSATIONS' : defaultOptGoal(objective))

        // Step 2: adsets — use adsets array if provided, else fall back to single adset from root params
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const adsetConfigs: Record<string, any>[] = Array.isArray(adsetsConfig) && adsetsConfig.length > 0
          ? adsetsConfig
          : [params] // backward compat: single adset from root params

        const adsetIds: string[] = []
        for (let idx = 0; idx < adsetConfigs.length; idx++) {
          const ac = adsetConfigs[idx]
          const targeting = buildTargeting(ac)

          const adsetBudgetCents = ac.daily_budget
            ? String(Math.round(parseFloat(String(ac.daily_budget)) * 100))
            : budgetCents

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const adsetBody: Record<string, any> = {
            name: ac.name || `${name} — Conjunto ${idx + 1}`,
            campaign_id: campaignId,
            status: 'PAUSED',
            targeting,
            optimization_goal: optGoal,
            billing_event: 'IMPRESSIONS',
            bid_strategy: 'LOWEST_COST_WITHOUT_CAP',
          }
          if (!isCBO) adsetBody.daily_budget = adsetBudgetCents

          if (isWhatsApp && page_id && whatsapp_number) {
            adsetBody.destination_type = 'WHATSAPP'
            adsetBody.promoted_object = {
              page_id: String(page_id),
              whatsapp_phone_number: String(whatsapp_number),
            }
          } else if (pixel_id) {
            adsetBody.promoted_object = {
              pixel_id: String(pixel_id),
              custom_event_type: pixelEvent(objective),
            }
          }

          console.log(`[create_campaign_full] adsetBody[${idx}]:`, JSON.stringify(adsetBody))
          const adset = await metaPost(`${accountId}/adsets`, adsetBody)
            .catch(e => { throw new Error(`ADSET[${idx}]: ${e.message}`) })
          adsetIds.push(adset.id)
        }

        // Steps 3+4: build and create ads
        const rawCreativeIds = creative_ids
          ? String(creative_ids).split(',').map(s => s.trim()).filter(Boolean)
          : []
        const waPhone = isWhatsApp ? String(whatsapp_number).replace(/\D/g, '') : ''
        const adIds: string[] = []

        if (isWhatsApp) {
          // WhatsApp: inline creative per ad — avoids the creative-reference validation that causes
          // error 1815159. CTA value must only have app_destination, NOT whatsapp_phone_number
          // (the number comes from the adset's promoted_object).
          for (let ci = 0; ci < rawCreativeIds.length; ci++) {
            let imageHash: string | null = null
            try {
              const cdata = await metaGet(rawCreativeIds[ci], { fields: 'image_hash' })
              imageHash = cdata?.image_hash || null
            } catch { /* skip */ }

            if (!imageHash) {
              console.warn(`[create_campaign_full] no image_hash on creative ${rawCreativeIds[ci]}, skipping`)
              continue
            }

            for (let si = 0; si < adsetIds.length; si++) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const inlineCreative: Record<string, any> = {
                name: `${name} — WA`,
                object_story_spec: {
                  page_id: String(page_id),
                  link_data: {
                    message: ad_primary_text ? String(ad_primary_text) : '',
                    link: `https://wa.me/${waPhone}`,
                    image_hash: imageHash,
                    ...(ad_headline ? { name: String(ad_headline) } : {}),
                    call_to_action: {
                      type: 'WHATSAPP_MESSAGE',
                      value: { app_destination: 'WHATSAPP' },
                    },
                  },
                },
              }
              console.log(`[create_campaign_full] inline WA ad[${si},${ci}]:`, JSON.stringify(inlineCreative))
              const ad = await metaPost(`${accountId}/ads`, {
                name: `${name} — Conj.${si + 1} Img.${ci + 1}`,
                adset_id: adsetIds[si],
                status: 'PAUSED',
                creative: inlineCreative,
              }).catch(e => { throw new Error(`AD[${si},${ci}]: ${e.message}`) })
              adIds.push(ad.id)
            }
          }
        } else {
          // Non-WhatsApp: use existing creative IDs directly
          const creativeIdList: string[] = [...rawCreativeIds]

          // Also create a copy-based creative if text + link provided
          if (ad_primary_text && page_id && ad_link_url) {
            try {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const copyBody: Record<string, any> = {
                name: `${name} — Copy`,
                object_story_spec: {
                  page_id: String(page_id),
                  link_data: {
                    message: String(ad_primary_text),
                    link: String(ad_link_url),
                    ...(ad_headline ? { name: String(ad_headline) } : {}),
                    ...(ad_description ? { description: String(ad_description) } : {}),
                    call_to_action: { type: String(ad_cta || 'LEARN_MORE') },
                  },
                },
              }
              console.log('[create_campaign_full] copyBody:', JSON.stringify(copyBody))
              const cc = await metaPost(`${accountId}/adcreatives`, copyBody)
              creativeIdList.push(cc.id)
            } catch (e) {
              console.warn('[create_campaign_full] copy creative failed (non-fatal):', String(e))
            }
          }

          for (let si = 0; si < adsetIds.length; si++) {
            for (let ci = 0; ci < creativeIdList.length; ci++) {
              const ad = await metaPost(`${accountId}/ads`, {
                name: `${name} — Conj.${si + 1} Cri.${ci + 1}`,
                adset_id: adsetIds[si],
                creative: { creative_id: creativeIdList[ci] },
                status: 'PAUSED',
              }).catch(e => { throw new Error(`AD[${si},${ci}]: ${e.message}`) })
              adIds.push(ad.id)
            }
          }
        }

        const noAdsNote = adIds.length === 0
          ? ' · Nenhum anúncio criado — selecione imagens na seção Criativos ou adicione pelo Gerenciador.'
          : ''
        result = { campaign_id: campaignId, adset_ids: adsetIds, ad_ids: adIds }
        message = `✅ Criado e pausado: campanha ${campaignId} · ${adsetIds.length} conjunto(s)${adIds.length ? ` · ${adIds.length} anúncio(s)` : ''}${noAdsNote}`
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

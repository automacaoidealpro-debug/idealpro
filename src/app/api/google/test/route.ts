import { NextResponse } from 'next/server'
import { getGoogleAccessToken, googleHeaders, GOOGLE_ADS_BASE } from '@/lib/google-ads'

export async function GET() {
  const results: Record<string, unknown> = {
    api_version: 'v24',
    credentials: {
      developer_token: !!process.env.GOOGLE_ADS_DEVELOPER_TOKEN,
      mcc_id: process.env.GOOGLE_ADS_MCC_ID,
      client_id: !!process.env.GOOGLE_ADS_CLIENT_ID,
      refresh_token: !!process.env.GOOGLE_ADS_REFRESH_TOKEN,
    },
  }

  let accessToken: string
  try {
    accessToken = await getGoogleAccessToken()
    results.oauth2 = 'OK — token obtido'
  } catch (e) {
    results.oauth2 = `FALHOU: ${String(e)}`
    return NextResponse.json(results)
  }

  // Test: listAccessibleCustomers
  try {
    const res = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
      headers: googleHeaders(accessToken),
      cache: 'no-store',
    })
    const j = await res.json()
    if (j.error) throw new Error(j.error.message)
    results.accessible_customers = {
      status: 'OK',
      count: (j.resourceNames || []).length,
      accounts: j.resourceNames,
    }
  } catch (e) {
    results.accessible_customers = `FALHOU: ${String(e)}`
  }

  // Test: MCC query
  const mccId = process.env.GOOGLE_ADS_MCC_ID!
  try {
    const res = await fetch(`${GOOGLE_ADS_BASE}/customers/${mccId}/googleAds:search`, {
      method: 'POST',
      headers: googleHeaders(accessToken, mccId),
      body: JSON.stringify({
        query: `SELECT customer_client.id, customer_client.descriptive_name, customer_client.status FROM customer_client WHERE customer_client.level = 1 LIMIT 5`,
      }),
      cache: 'no-store',
    })
    const j = await res.json()
    if (j.error) {
      const msg = j.error.details?.[0]?.errors?.[0]?.message || j.error.message
      const errorCode = j.error.details?.[0]?.errors?.[0]?.errorCode?.authorizationError || ''
      const notApproved = errorCode === 'DEVELOPER_TOKEN_NOT_APPROVED' || msg?.includes('test accounts')
      results.mcc_query = {
        status: 'FALHOU',
        error: msg,
        developer_token_level: notApproved ? 'TEST — não aprovado para contas reais' : 'ERRO',
        next_step: notApproved
          ? 'Acesse ads.google.com/aw/apicenter → aba "Acesso à API" → solicitar Basic Access'
          : undefined,
      }
    } else {
      results.mcc_query = {
        status: 'OK',
        accounts: (j.results || []).map((r: { customerClient: { id: string; descriptiveName: string } }) => ({
          id: r.customerClient?.id,
          name: r.customerClient?.descriptiveName,
        })),
      }
    }
  } catch (e) {
    results.mcc_query = `FALHOU: ${String(e)}`
  }

  return NextResponse.json(results)
}

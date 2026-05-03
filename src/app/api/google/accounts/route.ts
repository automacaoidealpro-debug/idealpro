import { NextResponse } from 'next/server'
import { getGoogleAccessToken, googleHeaders, gaqlSearch, GOOGLE_ADS_BASE } from '@/lib/google-ads'

interface CustomerClient {
  customerClient: {
    id: string
    descriptiveName: string
    currencyCode: string
    timeZone: string
    status: string
    testAccount: boolean
    manager: boolean
    level: number
  }
}

export async function GET() {
  try {
    const accessToken = await getGoogleAccessToken()
    const mccId = process.env.GOOGLE_ADS_MCC_ID!

    // 1. List all accessible customers (sub-accounts under MCC)
    const listRes = await fetch(`${GOOGLE_ADS_BASE}/customers:listAccessibleCustomers`, {
      headers: googleHeaders(accessToken),
      cache: 'no-store',
    })
    const listData = await listRes.json()
    if (listData.error) throw new Error(listData.error.message)

    const resourceNames: string[] = listData.resourceNames || []

    // 2. Query MCC for all customer_client details
    const clients = await gaqlSearch<CustomerClient>(
      mccId,
      `SELECT
        customer_client.id,
        customer_client.descriptive_name,
        customer_client.currency_code,
        customer_client.time_zone,
        customer_client.status,
        customer_client.test_account,
        customer_client.manager,
        customer_client.level
      FROM customer_client
      WHERE customer_client.level = 1
        AND customer_client.status = 'ENABLED'
      ORDER BY customer_client.descriptive_name
      LIMIT 100`,
      accessToken,
      mccId,
    )

    const accounts = clients.map(c => ({
      id: c.customerClient.id,
      name: c.customerClient.descriptiveName || `Conta ${c.customerClient.id}`,
      currency: c.customerClient.currencyCode,
      timezone: c.customerClient.timeZone,
      status: c.customerClient.status,
      isTest: c.customerClient.testAccount,
    }))

    return NextResponse.json({ accounts, total: accounts.length })
  } catch (e) {
    const msg = String(e)
    const notApproved = msg.includes('DEVELOPER_TOKEN_NOT_APPROVED') || msg.includes('not approved') || msg.includes('test accounts') || msg.includes('only approved')
    return NextResponse.json(
      {
        error: msg,
        developer_token_status: notApproved ? 'TEST_ONLY' : 'ERROR',
        hint: notApproved
          ? 'Token aprovado recentemente? A propagação pode levar 30min–2h após a confirmação do Google. Tente novamente em alguns minutos.'
          : undefined,
      },
      { status: notApproved ? 403 : 500 },
    )
  }
}

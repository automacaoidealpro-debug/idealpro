import { NextResponse } from 'next/server'
import { buildClientDashboard } from '@/lib/meta-api'

export async function GET() {
  try {
    const accounts = await buildClientDashboard()
    return NextResponse.json({ accounts })
  } catch (error) {
    console.error('Meta API error:', error)
    return NextResponse.json({ error: 'Falha ao buscar contas' }, { status: 500 })
  }
}

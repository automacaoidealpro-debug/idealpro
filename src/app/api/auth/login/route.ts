import { NextResponse } from 'next/server'

const EMAIL = 'idealproads@outlook.com'
const PASSWORD = 'agencia1234'
const SESSION_TOKEN = 'idealpro_autenticado_2024'

export async function POST(req: Request) {
  const { email, password } = await req.json()

  if (email?.toLowerCase() !== EMAIL || password !== PASSWORD) {
    return NextResponse.json({ error: 'E-mail ou senha incorretos' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set('idealpro_auth', SESSION_TOKEN, {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 30, // 30 days
  })
  return res
}

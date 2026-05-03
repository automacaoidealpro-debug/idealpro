import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const SESSION_COOKIE = 'idealpro_auth'
const SESSION_TOKEN = 'idealpro_autenticado_2024'

const PUBLIC = ['/login', '/api/auth', '/onboarding', '/p/']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (PUBLIC.some(p => pathname.startsWith(p))) return NextResponse.next()

  const cookie = request.cookies.get(SESSION_COOKIE)
  if (cookie?.value === SESSION_TOKEN) return NextResponse.next()

  const url = request.nextUrl.clone()
  url.pathname = '/login'
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}

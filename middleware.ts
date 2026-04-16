import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

function makeToken(email: string): string {
  const secret = process.env.AUTH_SECRET || 'iq-demo-secret-change-me'
  return crypto.createHmac('sha256', secret).update(email).digest('hex')
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Allow login page, auth API, and static assets through
  if (
    pathname === '/login' ||
    pathname.startsWith('/api/auth') ||
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon')
  ) {
    return NextResponse.next()
  }

  // Check for valid session cookie
  const session = request.cookies.get('iq-session')?.value
  const validEmail = process.env.AUTH_EMAIL || 'team@intelliquote.com.au'
  const expectedToken = makeToken(validEmail)

  if (!session || session !== expectedToken) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

const VALID_EMAIL = process.env.AUTH_EMAIL || 'team@intelliquote.com.au'
const VALID_PASSWORD = process.env.AUTH_PASSWORD || 'IntelliQuote2026!'

function makeToken(email: string): string {
  const secret = process.env.AUTH_SECRET || 'iq-demo-secret-change-me'
  return crypto.createHmac('sha256', secret).update(email).digest('hex')
}

export async function POST(request: NextRequest) {
  const { email, password } = await request.json()

  if (email === VALID_EMAIL && password === VALID_PASSWORD) {
    const token = makeToken(email)
    const response = NextResponse.json({ success: true })
    response.cookies.set('iq-session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 30, // 30 days
      path: '/',
    })
    return response
  }

  return NextResponse.json({ error: 'Invalid credentials' }, { status: 401 })
}

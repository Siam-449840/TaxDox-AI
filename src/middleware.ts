import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// Public API routes that don't require authentication
const PUBLIC_API_ROUTES = [
  '/api/auth',
  '/api/stripe/webhook',
]

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl

  // Only protect /api routes (pages handle their own auth via client redirect)
  if (!pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Check if this is a public API route
  if (PUBLIC_API_ROUTES.some((route) => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  // Check for valid NextAuth token
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET })

  if (!token) {
    return NextResponse.json(
      { error: 'Authentication required. Please sign in.' },
      { status: 401 }
    )
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/api/:path*'],
}

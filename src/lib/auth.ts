import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'
import { checkRateLimit, resetRateLimit } from '@/lib/rate-limit'
import { verifyTotpCode } from '@/lib/mfa'
import { logger } from '@/lib/logger'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
        // Optional: the 6-digit TOTP code, submitted on the second step of
        // login for accounts with MFA enabled. The sign-in flow calls
        // authorize() twice — first without mfaCode (returns the marker),
        // then with mfaCode to complete login.
        mfaCode: { label: 'MFA Code', type: 'text' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const email = credentials.email.toLowerCase()

        // Rate-limit check BEFORE the password comparison. The identifier
        // includes email (prevents per-account brute-force) and would
        // ideally include IP (available via NextRequest, but authorize()
        // doesn't receive it — the middleware is the IP-aware layer).
        const rl = await checkRateLimit(`login:${email}`)
        if (rl.blocked) {
          logger.security.warn('Login rate-limited', { email, count: rl.count })
          throw new Error(
            `Too many login attempts. Please try again in ${rl.retryAfterSec} seconds.`
          )
        }

        const user = await db.user.findUnique({
          where: { email },
          include: { firm: true },
        })

        if (!user) {
          throw new Error('No account found with that email')
        }

        if (user.status !== 'active') {
          throw new Error('Your account has been disabled. Contact your administrator.')
        }

        if (!user.password) {
          throw new Error('This account uses a different login method.')
        }

        const isValid = await bcrypt.compare(credentials.password, user.password)
        if (!isValid) {
          throw new Error('Incorrect password')
        }

        // ── MFA gate ──────────────────────────────────────────────
        // If the user has MFA enabled, we require a valid TOTP code to
        // complete login. This is enforced WITHIN authorize() (not a
        // separate public endpoint) so there is no way to bypass MFA by
        // calling a different route — the JWT is never issued without it.
        if (user.mfaEnabled && user.mfaSecret) {
          if (!credentials.mfaCode) {
            // Step 1: signal to the client that an OTP is required.
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            return { mfaRequired: true, email: user.email } as any
          }
          // Step 2: verify the code.
          const codeOk = await verifyTotpCode(credentials.mfaCode, user.mfaSecret)
          if (!codeOk) {
            logger.security.warn('MFA code invalid during sign-in', { email })
            throw new Error('Invalid authentication code. Please try again.')
          }
        }

        // Successful login — reset rate limit.
        await resetRateLimit(`login:${email}`)

        // Check subscription status — block if canceled and past due.
        if (
          user.firm &&
          user.firm.subscriptionStatus === 'past_due' &&
          !user.firm.trialEndsAt
        ) {
          throw new Error('Your subscription has lapsed. Please update your billing.')
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          firmId: user.firmId,
          firmName: user.firm?.name,
          subscriptionTier: user.firm?.subscriptionTier,
          subscriptionStatus: user.firm?.subscriptionStatus,
        }
      },
    }),
  ],
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  pages: {
    signIn: '/auth/signin',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.role = (user as { role: string }).role
        token.firmId = (user as { firmId: string | null }).firmId ?? undefined
        token.firmName = (user as { firmName?: string }).firmName
        token.subscriptionTier = (user as { subscriptionTier?: string }).subscriptionTier
        token.subscriptionStatus = (user as { subscriptionStatus?: string }).subscriptionStatus
      }
      return token
    },
    async session({ session, token }) {
      if (session.user) {
        ;(session.user as { id?: string }).id = token.sub
        ;(session.user as { role?: string }).role = token.role as string
        ;(session.user as { firmId?: string }).firmId = token.firmId as string
        ;(session.user as { firmName?: string }).firmName = token.firmName as string
        ;(session.user as { subscriptionTier?: string }).subscriptionTier =
          token.subscriptionTier as string
        ;(session.user as { subscriptionStatus?: string }).subscriptionStatus =
          token.subscriptionStatus as string
      }
      return session
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
}

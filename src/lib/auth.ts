import type { NextAuthOptions } from 'next-auth'
import CredentialsProvider from 'next-auth/providers/credentials'
import bcrypt from 'bcryptjs'
import { db } from '@/lib/db'

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error('Email and password are required')
        }

        const user = await db.user.findUnique({
          where: { email: credentials.email.toLowerCase() },
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

        // Check subscription status — block if canceled and past due
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
        token.firmId = (user as { firmId: string | null }).firmId
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

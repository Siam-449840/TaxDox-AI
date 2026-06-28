import 'next-auth'
import 'next-auth/jwt'

declare module 'next-auth' {
  interface Session {
    user: {
      id: string
      email: string
      name: string
      role: string
      firmId: string | null
      firmName?: string
      subscriptionTier?: string
      subscriptionStatus?: string
    }
  }

  interface User {
    role: string
    firmId: string | null
    firmName?: string
    subscriptionTier?: string
    subscriptionStatus?: string
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    role?: string
    firmId?: string
    firmName?: string
    subscriptionTier?: string
    subscriptionStatus?: string
  }
}

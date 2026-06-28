import type { Metadata } from 'next'
import { AuthBrandingPanel } from '@/components/auth/auth-branding-panel'
import { SignInForm } from '@/components/auth/sign-in-form'

export const metadata: Metadata = {
  title: 'Sign in — TaxDox AI',
  description: 'Sign in to your TaxDox AI account.',
  robots: { index: false, follow: false },
}

export default function SignInPage() {
  return (
    <div className="flex min-h-screen">
      <AuthBrandingPanel />
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <SignInForm />
      </div>
    </div>
  )
}

import type { Metadata } from 'next'
import { AuthBrandingPanel } from '@/components/auth/auth-branding-panel'
import { SignUpForm } from '@/components/auth/sign-up-form'

export const metadata: Metadata = {
  title: 'Start free trial — TaxDox AI',
  description:
    'Create your TaxDox AI account. 14-day free trial, no credit card required.',
  robots: { index: false, follow: false },
}

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen">
      <AuthBrandingPanel />
      <div className="flex flex-1 items-center justify-center p-6 lg:p-12">
        <SignUpForm />
      </div>
    </div>
  )
}

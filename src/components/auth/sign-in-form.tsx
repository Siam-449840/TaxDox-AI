'use client'

import { useState, type FormEvent } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { toast } from 'sonner'

const DEMO_EMAIL = 'sarah.chen@meridiancpa.com'
const DEMO_PASSWORD = 'TaxDox2025!'

export function SignInForm() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    // Clear any stale session cookies from previous (broken) sessions.
    // This prevents JWEDecryptionFailed errors when the NEXTAUTH_SECRET changed.
    document.cookie.split(';').forEach((c) => {
      const cookieName = c.split('=')[0].trim()
      if (cookieName.includes('next-auth')) {
        document.cookie = `${cookieName}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`
      }
    })

    try {
      const res = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (!res || res.error) {
        const message =
          res?.error ?? 'Unable to sign in. Please check your credentials.'
        setError(message)
        setLoading(false)
        return
      }

      toast.success('Welcome back to TaxDox AI')
      // Use full page navigation to ensure session cookie is sent and
      // SessionProvider reinitializes with the authenticated state
      window.location.href = '/'
    } catch (err) {
      console.error('Sign-in error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  function fillDemoAccount() {
    setEmail(DEMO_EMAIL)
    setPassword(DEMO_PASSWORD)
    setError(null)
  }

  return (
    <div className="w-full max-w-sm">
      {/* Mobile logo */}
      <div className="mb-8 flex items-center gap-2.5 lg:hidden">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <span className="text-lg font-semibold tracking-tight">TaxDox AI</span>
      </div>

      {/* Heading */}
      <div className="mb-7">
        <h2 className="text-2xl font-semibold tracking-tight">
          Sign in to your account
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Welcome back. Enter your credentials to continue.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div
          role="alert"
          className="mb-5 flex items-start gap-2.5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-500" />
          <span className="leading-snug">{error}</span>
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="you@firm.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <Label htmlFor="password">Password</Label>
            <Link
              href="#"
              onClick={(e) => {
                e.preventDefault()
                toast.info('Password reset is not available in this demo.')
              }}
              className="text-xs font-medium text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="current-password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              className="h-10 pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              tabIndex={-1}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
              className="absolute right-0 top-0 flex h-10 w-10 items-center justify-center text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? (
                <EyeOff className="h-4 w-4" />
              ) : (
                <Eye className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Signing in…
            </>
          ) : (
            <>
              Sign in
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Sign-up CTA */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Don&apos;t have an account?{' '}
        <Link
          href="/auth/signup"
          className="font-medium text-primary hover:underline"
        >
          Start free trial
        </Link>
      </p>

      {/* Demo account info box */}
      <div className="mt-8 rounded-lg border border-primary/20 bg-primary/5 p-3.5">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
          <Sparkles className="h-3.5 w-3.5" />
          Demo Account
        </div>
        <div className="mt-2 space-y-1 text-xs text-muted-foreground">
          <div className="font-mono">
            <span className="text-foreground/70">Email:</span> {DEMO_EMAIL}
          </div>
          <div className="font-mono">
            <span className="text-foreground/70">Password:</span> {DEMO_PASSWORD}
          </div>
        </div>
        <button
          type="button"
          onClick={fillDemoAccount}
          disabled={loading}
          className="mt-2.5 text-xs font-medium text-primary hover:underline disabled:opacity-50"
        >
          Fill demo credentials →
        </button>
      </div>
    </div>
  )
}

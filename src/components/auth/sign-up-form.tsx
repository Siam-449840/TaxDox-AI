'use client'

import { useMemo, useState, type FormEvent } from 'react'
import Link from 'next/link'
import { signIn } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sparkles,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  ArrowRight,
  Check,
  ShieldCheck,
} from 'lucide-react'
import { toast } from 'sonner'

const COUNTRIES = [
  { code: 'US', label: 'United States' },
  { code: 'UK', label: 'United Kingdom' },
  { code: 'CA', label: 'Canada' },
  { code: 'IN', label: 'India' },
  { code: 'AU', label: 'Australia' },
] as const

interface PasswordStrength {
  score: 0 | 1 | 2 | 3 | 4
  label: string
  /** Tailwind class for the filled segments */
  color: string
  /** Tailwind text color for the label */
  textClass: string
}

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) {
    return { score: 0, label: '', color: '', textClass: '' }
  }

  let score = 0
  if (password.length >= 8) score++
  if (password.length >= 12) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++

  // Cap at 4
  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4

  // Too short — show as weak/red regardless
  if (password.length < 8) {
    return {
      score: 1,
      label: 'Too short (min 8 characters)',
      color: 'bg-red-500',
      textClass: 'text-red-600',
    }
  }

  switch (clamped) {
    case 1:
      return {
        score: 1,
        label: 'Weak',
        color: 'bg-red-500',
        textClass: 'text-red-600',
      }
    case 2:
      return {
        score: 2,
        label: 'Fair',
        color: 'bg-amber-500',
        textClass: 'text-amber-600',
      }
    case 3:
      return {
        score: 3,
        label: 'Good',
        color: 'bg-blue-500',
        textClass: 'text-blue-600',
      }
    default:
      return {
        score: 4,
        label: 'Strong',
        color: 'bg-emerald-500',
        textClass: 'text-emerald-600',
      }
  }
}

export function SignUpForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [firmName, setFirmName] = useState('')
  const [password, setPassword] = useState('')
  const [country, setCountry] = useState<string>('US')
  const [agreed, setAgreed] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    // Client-side validation
    if (!name.trim() || !email.trim() || !firmName.trim() || !password) {
      setError('Please fill in all required fields.')
      return
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (!agreed) {
      setError('Please accept the Terms of Service and Privacy Policy to continue.')
      return
    }

    setLoading(true)

    try {
      // 1. Register the account
      const registerRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          password,
          firmName: firmName.trim(),
          country,
        }),
      })

      const data = await registerRes.json().catch(() => ({}))

      if (!registerRes.ok) {
        setError(data?.error ?? 'Failed to create account. Please try again.')
        setLoading(false)
        return
      }

      // 2. Auto sign-in
      const signInRes = await signIn('credentials', {
        email: email.trim(),
        password,
        redirect: false,
      })

      if (!signInRes || signInRes.error) {
        // Account was created but auto sign-in failed — send to sign-in page
        toast.success('Account created! Please sign in to continue.')
        window.location.href = '/auth/signin'
        return
      }

      toast.success('Account created — welcome to TaxDox AI!')
      // Full page reload to ensure session is established
      window.location.href = '/'
    } catch (err) {
      console.error('Sign-up error:', err)
      setError('Something went wrong. Please try again.')
      setLoading(false)
    }
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

      {/* Heading + trial badge */}
      <div className="mb-6">
        <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
          <Check className="h-3 w-3" />
          14-day free trial · No credit card required
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">
          Create your account
        </h2>
        <p className="mt-1.5 text-sm text-muted-foreground">
          Get started in minutes. Your first 14 days are on us.
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
          <Label htmlFor="name">Full Name</Label>
          <Input
            id="name"
            name="name"
            type="text"
            autoComplete="name"
            placeholder="Sarah Chen"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            disabled={loading}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Work Email</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="sarah@meridiancpa.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={loading}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="firmName">Firm / Company Name</Label>
          <Input
            id="firmName"
            name="firmName"
            type="text"
            autoComplete="organization"
            placeholder="Meridian CPA Group"
            value={firmName}
            onChange={(e) => setFirmName(e.target.value)}
            required
            disabled={loading}
            className="h-10"
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <div className="relative">
            <Input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              autoComplete="new-password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              minLength={8}
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

          {/* Strength indicator */}
          {password && (
            <div className="pt-1">
              <div className="flex gap-1.5">
                {[1, 2, 3, 4].map((seg) => (
                  <div
                    key={seg}
                    className={`h-1.5 flex-1 rounded-full transition-colors ${
                      seg <= strength.score ? strength.color : 'bg-muted'
                    }`}
                  />
                ))}
              </div>
              <p
                className={`mt-1.5 text-xs font-medium ${strength.textClass}`}
              >
                {strength.label}
              </p>
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="country">Country</Label>
          <Select value={country} onValueChange={setCountry} disabled={loading}>
            <SelectTrigger id="country" className="h-10 w-full">
              <SelectValue placeholder="Select your country" />
            </SelectTrigger>
            <SelectContent>
              {COUNTRIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Terms checkbox */}
        <div className="flex items-start gap-2.5 pt-1">
          <Checkbox
            id="terms"
            checked={agreed}
            onCheckedChange={(v) => setAgreed(v === true)}
            disabled={loading}
            className="mt-0.5"
          />
          <Label
            htmlFor="terms"
            className="text-xs font-normal leading-relaxed text-muted-foreground"
          >
            I agree to the{' '}
            <Link
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-primary hover:underline"
            >
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link
              href="#"
              onClick={(e) => e.preventDefault()}
              className="font-medium text-primary hover:underline"
            >
              Privacy Policy
            </Link>
            .
          </Label>
        </div>

        <Button
          type="submit"
          disabled={loading}
          className="mt-2 h-10 w-full bg-primary text-primary-foreground hover:bg-primary/90"
        >
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Creating account…
            </>
          ) : (
            <>
              Create account
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>
      </form>

      {/* Sign-in CTA */}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{' '}
        <Link
          href="/auth/signin"
          className="font-medium text-primary hover:underline"
        >
          Sign in
        </Link>
      </p>

      {/* Security note */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
        <ShieldCheck className="h-3.5 w-3.5" />
        Protected by 256-bit encryption · SOC 2 compliant
      </div>
    </div>
  )
}

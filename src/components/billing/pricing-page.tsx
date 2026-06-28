'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { Sparkles, Check, ArrowLeft, Loader2, Zap, Building2, Crown, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'

interface SubscriptionData {
  firm: {
    subscriptionTier: string
    subscriptionStatus: string
    trialDaysRemaining: number | null
    stripeCustomerId: string | null
  }
  usage: {
    documentsThisMonth: number
    clientCount: number
    userCount: number
  }
}

const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    price: 99,
    icon: Zap,
    description: 'For solo practitioners (1-2 people)',
    docsPerMonth: 50,
    features: [
      '50 documents / month',
      'Basic AI extraction',
      'Email support',
      '5 clients',
      'CSV export',
    ],
    highlighted: false,
  },
  {
    id: 'professional',
    name: 'Professional',
    price: 299,
    icon: Sparkles,
    description: 'For small firms (3-10 people)',
    docsPerMonth: 200,
    features: [
      '200 documents / month',
      'Full AI extraction (GLM-4.6V)',
      'All tax software integrations',
      'Priority support',
      '25 clients',
      'Excel + CSV export',
      'Workflow automation',
    ],
    highlighted: true,
  },
  {
    id: 'business',
    name: 'Business',
    price: 799,
    icon: Building2,
    description: 'For mid-sized firms (11-50 people)',
    docsPerMonth: 1000,
    features: [
      '1,000 documents / month',
      'Workflow automation',
      'Reporting & analytics',
      'Dedicated support',
      '100 clients',
      'API access',
      'Custom templates',
    ],
    highlighted: false,
  },
]

export function PricingPage() {
  const router = useRouter()
  const { data: session } = useSession()
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null)
  const [loadingTier, setLoadingTier] = useState<string | null>(null)

  useEffect(() => {
    if (session?.user) {
      fetch('/api/stripe/subscription')
        .then((r) => (r.ok ? r.json() : null))
        .then(setSubscription)
        .catch(() => {})
    }
  }, [session])

  const handleSubscribe = async (tier: string) => {
    // If not logged in, redirect to sign-up
    if (!session?.user) {
      signIn(undefined, { callbackUrl: `/pricing?tier=${tier}` })
      return
    }

    setLoadingTier(tier)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier }),
      })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to start checkout')
      }
    } catch {
      toast.error('Something went wrong. Please try again.')
    } finally {
      setLoadingTier(null)
    }
  }

  const handleManageBilling = async () => {
    setLoadingTier('manage')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json()
      if (data.url) {
        window.location.href = data.url
      } else {
        toast.error(data.error || 'Failed to open billing portal')
      }
    } catch {
      toast.error('Something went wrong.')
    } finally {
      setLoadingTier(null)
    }
  }

  const currentTier = subscription?.firm?.subscriptionTier

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      {/* Header */}
      <header className="border-b bg-background/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <button
            onClick={() => router.push(session ? '/' : '/auth/signin')}
            className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to app
          </button>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-primary">
              <Sparkles className="h-4 w-4 text-white" />
            </div>
            <span className="font-bold">TaxDox AI</span>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-16">
        {/* Title */}
        <div className="mb-12 text-center">
          <Badge variant="secondary" className="mb-4">
            <Crown className="mr-1 h-3 w-3" />
            14-day free trial · No credit card required
          </Badge>
          <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">
            Simple, transparent pricing
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-lg text-muted-foreground">
            Choose the plan that fits your firm. Upgrade, downgrade, or cancel at any time.
            All plans include bank-grade security and SOC 2 compliance.
          </p>
        </div>

        {/* Current subscription banner */}
        {subscription && (
          <Card className="mb-8 flex items-center justify-between p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold">
                  Current plan: <span className="capitalize">{currentTier}</span>
                </p>
                <p className="text-sm text-muted-foreground">
                  Status: <span className="capitalize">{subscription.firm.subscriptionStatus}</span>
                  {subscription.firm.trialDaysRemaining !== null && subscription.firm.trialDaysRemaining > 0 && (
                    <> · {subscription.firm.trialDaysRemaining} trial days left</>
                  )}
                </p>
              </div>
            </div>
            {subscription.firm.stripeCustomerId && (
              <Button variant="outline" onClick={handleManageBilling} disabled={loadingTier === 'manage'}>
                {loadingTier === 'manage' ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Manage Billing
              </Button>
            )}
          </Card>
        )}

        {/* Plans */}
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {PLANS.map((plan) => {
            const Icon = plan.icon
            const isCurrent = currentTier === plan.id
            const isLoading = loadingTier === plan.id

            return (
              <Card
                key={plan.id}
                className={cn(
                  'relative flex flex-col p-6 transition-all',
                  plan.highlighted
                    ? 'border-primary shadow-lg ring-2 ring-primary/20 md:scale-105'
                    : 'hover:border-primary/30 hover:shadow-md'
                )}
              >
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-primary text-white">
                      <Sparkles className="mr-1 h-3 w-3" />
                      Most Popular
                    </Badge>
                  </div>
                )}

                <div className="mb-4 flex items-center gap-3">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-xl',
                      plan.highlighted ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground">{plan.description}</p>
                  </div>
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">${plan.price}</span>
                    <span className="text-sm text-muted-foreground">/month</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {plan.docsPerMonth} documents per month
                  </p>
                </div>

                <Button
                  className="mb-6 w-full"
                  variant={plan.highlighted ? 'default' : 'outline'}
                  disabled={isCurrent || isLoading}
                  onClick={() => handleSubscribe(plan.id)}
                >
                  {isLoading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isCurrent ? (
                    <>
                      <Check className="mr-2 h-4 w-4" />
                      Current Plan
                    </>
                  ) : (
                    <>Start with {plan.name}</>
                  )}
                </Button>

                <ul className="space-y-2.5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>

        {/* Enterprise CTA */}
        <Card className="mt-6 flex flex-col items-center justify-between gap-4 p-6 sm:flex-row">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600 dark:bg-violet-950/40 dark:text-violet-400">
              <Crown className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold">Enterprise</h3>
              <p className="text-sm text-muted-foreground">
                For large firms (50+ people) · Unlimited everything · Custom integrations · SLA
              </p>
            </div>
          </div>
          <Button variant="outline" onClick={() => (window.location.href = 'mailto:sales@taxdox.ai')}>
            Contact Sales
          </Button>
        </Card>

        {/* Trust signals */}
        <div className="mt-12 flex flex-wrap items-center justify-center gap-8 text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            SOC 2 Type II
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            AES-256 Encryption
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            IRS 7216 Compliant
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            GDPR Ready
          </div>
        </div>
      </div>
    </div>
  )
}

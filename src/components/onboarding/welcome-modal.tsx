'use client'

import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import {
  Sparkles,
  ArrowRight,
  Check,
  FileText,
  ClipboardList,
  CalendarDays,
  BarChart3,
  X,
  Bot,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Welcome / onboarding modal shown to first-time users.
 *
 * Trigger logic:
 *  - Reads `localStorage["taxdox:onboarded"]` on mount.
 *  - If not set, opens the modal after a 1.5s delay so the dashboard has a
 *    chance to render first.
 *  - Clicking "Start Exploring" (or "Get Started" / "Next" past slide 3) sets
 *    the `taxdox:onboarded` flag so the modal never shows again.
 *  - Closing via Escape, the X button, or backdrop click does NOT set the
 *    flag — the user will see the tour again next visit.
 */
const ONBOARDED_KEY = 'taxdox:onboarded'
const OPEN_DELAY_MS = 1500

// ─── Slide definitions ─────────────────────────────────────────

const WELCOME_FEATURES = [
  {
    icon: Bot,
    title: 'AI-Powered Classification',
    description: 'Gemini 3.5 Flash vision model automatically detects document type and extracts key fields.',
    accent: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  },
  {
    icon: ClipboardList,
    title: 'PBC List Management',
    description: 'Generate, send, and track Prepared-By-Client lists with automatic reminders.',
    accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  {
    icon: BarChart3,
    title: 'Real-time Analytics',
    description: 'Operational, financial, and quality metrics across every engagement.',
    accent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  },
] as const

const TOUR_CARDS = [
  {
    icon: FileText,
    title: 'Upload Documents',
    description: 'Drag & drop tax docs — AI extracts data automatically.',
    accent: 'bg-teal-100 text-teal-700 dark:bg-teal-950/50 dark:text-teal-300',
  },
  {
    icon: ClipboardList,
    title: 'Manage Engagements',
    description: 'Create PBC lists, track progress, send reminders.',
    accent: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  },
  {
    icon: CalendarDays,
    title: 'View Calendar',
    description: 'Track all filing deadlines in one view.',
    accent: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  },
  {
    icon: BarChart3,
    title: 'Check Reports',
    description: 'Operational, financial, and quality metrics.',
    accent: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-950/50 dark:text-cyan-300',
  },
] as const

// ─── Component ─────────────────────────────────────────────────

export function WelcomeModal() {
  const [open, setOpen] = useState(false)
  const [step, setStep] = useState(0)

  // First-visit detection: open after a short delay so the dashboard renders
  // first. Runs once on mount (client-side only).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const flagged = window.localStorage.getItem(ONBOARDED_KEY)
      if (flagged === 'true') return
    } catch {
      // localStorage may be unavailable (private mode / SSR) — bail out safely
      return
    }
    const timer = window.setTimeout(() => setOpen(true), OPEN_DELAY_MS)
    return () => window.clearTimeout(timer)
  }, [])

  const completeOnboarding = () => {
    try {
      window.localStorage.setItem(ONBOARDED_KEY, 'true')
    } catch {
      /* ignore */
    }
    setOpen(false)
  }

  // Radix fires onOpenChange(false) for Escape / backdrop / X. We deliberately
  // do NOT set the onboarded flag here so the tour reappears next visit.
  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setOpen(false)
      return
    }
    setOpen(next)
  }

  const handleNext = () => {
    if (step < 2) {
      setStep((s) => s + 1)
    } else {
      completeOnboarding()
    }
  }

  const handleBack = () => {
    if (step > 0) setStep((s) => s - 1)
  }

  const handleSkip = () => {
    completeOnboarding()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="max-w-lg gap-0 overflow-hidden rounded-2xl border-none p-0"
      >
        {/* Slide transition wrapper */}
        <div className="relative">
          {/* Custom close (top-right) — closes the tour WITHOUT setting the
              onboarded flag, so the user sees it again next visit. */}
          <button
            type="button"
            aria-label="Close tour"
            onClick={() => setOpen(false)}
            className={cn(
              'absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full backdrop-blur-sm transition focus:outline-none focus:ring-2',
              step === 0
                ? 'bg-black/20 text-white hover:bg-black/30 focus:ring-white/50'
                : 'bg-muted/80 text-muted-foreground hover:bg-muted focus:ring-ring/50'
            )}
          >
            <X className="h-4 w-4" />
          </button>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -24 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
            >
              {step === 0 && <WelcomeSlide />}
              {step === 1 && <TourSlide />}
              {step === 2 && <GetStartedSlide />}
            </motion.div>
          </AnimatePresence>

          {/* Footer — navigation + progress dots */}
          <div className="flex items-center justify-between gap-3 border-t border-border bg-card px-6 py-4">
            {/* Back button (hidden on first slide) */}
            <div className="flex w-24 justify-start">
              {step > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleBack}
                  className="text-muted-foreground"
                >
                  Back
                </Button>
              )}
            </div>

            {/* Progress dots */}
            <div className="flex items-center gap-2">
              {[0, 1, 2].map((i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setStep(i)}
                  className={cn(
                    'h-2 rounded-full transition-all duration-300',
                    i === step
                      ? 'w-6 bg-primary'
                      : 'w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50'
                  )}
                />
              ))}
            </div>

            {/* Right-side action (changes per slide) */}
            <div className="flex w-24 justify-end">
              {step < 2 ? (
                <Button size="sm" onClick={handleNext} className="gap-1">
                  Next
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              ) : (
                <Button size="sm" onClick={handleNext} className="gap-1">
                  Start Exploring
                  <ArrowRight className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Skip-tour link (only on first & last slides for discoverability) */}
          {step !== 1 && (
            <div className="flex justify-center bg-card pb-4">
              <button
                type="button"
                onClick={handleSkip}
                className="text-xs text-muted-foreground underline-offset-4 transition hover:text-foreground hover:underline"
              >
                Skip tour
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Slide 1: Welcome ──────────────────────────────────────────

function WelcomeSlide() {
  return (
    <div>
      {/* Gradient header */}
      <div className="relative overflow-hidden bg-gradient-primary px-6 pb-8 pt-12 text-center text-white">
        {/* Decorative blobs */}
        <div className="pointer-events-none absolute -left-10 -top-10 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-8 -right-6 h-28 w-28 rounded-full bg-white/10 blur-2xl" />

        <div className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 backdrop-blur-sm shadow-lg ring-1 ring-white/20">
          <Sparkles className="h-8 w-8 text-white" />
        </div>
        <h2 className="relative text-2xl font-bold tracking-tight">
          Welcome to TaxDox AI!
        </h2>
        <p className="relative mx-auto mt-2 max-w-sm text-sm text-white/85">
          Make tax document processing as simple as sending an email.
        </p>
      </div>

      {/* Feature highlights */}
      <div className="space-y-3 px-6 py-6">
        {WELCOME_FEATURES.map((feature) => (
          <div
            key={feature.title}
            className="flex items-start gap-3 rounded-xl border border-border bg-card p-3 transition hover:border-primary/30 hover:bg-accent/30"
          >
            <div
              className={cn(
                'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg',
                feature.accent
              )}
            >
              <feature.icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{feature.title}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {feature.description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 2: Quick Tour ───────────────────────────────────────

function TourSlide() {
  return (
    <div className="px-6 py-8">
      <div className="mb-6 text-center">
        <h2 className="text-xl font-bold tracking-tight">
          Here&apos;s what you can do
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Four core capabilities, all in one platform.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {TOUR_CARDS.map((card) => (
          <Card
            key={card.title}
            className="gap-0 rounded-xl p-4 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <div
              className={cn(
                'mb-3 flex h-9 w-9 items-center justify-center rounded-lg',
                card.accent
              )}
            >
              <card.icon className="h-5 w-5" />
            </div>
            <p className="text-sm font-semibold leading-tight">{card.title}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {card.description}
            </p>
          </Card>
        ))}
      </div>
    </div>
  )
}

// ─── Slide 3: Get Started ──────────────────────────────────────

function GetStartedSlide() {
  return (
    <div className="px-6 py-8 text-center">
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-600 shadow-sm ring-4 ring-emerald-100/40 dark:bg-emerald-950/50 dark:text-emerald-300 dark:ring-emerald-950/40">
        <Check className="h-8 w-8" />
      </div>
      <h2 className="text-2xl font-bold tracking-tight">You&apos;re all set!</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        Demo data is pre-loaded so you can explore immediately. No setup
        required — just dive in and try the features.
      </p>

      {/* Quick stats pill */}
      <div className="mx-auto mt-6 inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 shadow-sm">
        <TrendingUp className="h-4 w-4 text-primary" />
        <span className="text-sm font-medium tabular-nums">
          12 clients · 12 engagements · 55 documents ready
        </span>
      </div>
    </div>
  )
}

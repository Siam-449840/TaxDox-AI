import { Sparkles, ClipboardList, FileText, ShieldCheck } from 'lucide-react'

const FEATURES = [
  {
    icon: Sparkles,
    title: 'AI-Powered Document Classification',
    description:
      'Automatically identify and categorize W-2s, 1099s, K-1s and 50+ tax forms with 99% accuracy.',
  },
  {
    icon: ClipboardList,
    title: 'PBC List Management',
    description:
      'Generate, send, and track Prepared-By-Client lists with smart reminders and live status.',
  },
  {
    icon: FileText,
    title: 'Tax Software Integration',
    description:
      'Push validated data directly into Lacerte, Drake, ProConnect, and CCH Axcess.',
  },
  {
    icon: ShieldCheck,
    title: 'Bank-Grade Security · SOC 2',
    description:
      'AES-256 encryption at rest, TLS 1.3 in transit, and full audit trails on every action.',
  },
] as const

/**
 * Left-side gradient branding panel shared by the sign-in and sign-up pages.
 * Presentational only — safe to render inside a server component.
 */
export function AuthBrandingPanel() {
  return (
    <div className="relative hidden lg:flex lg:w-1/2 bg-gradient-primary flex-col justify-between p-12 text-white overflow-hidden">
      {/* Decorative glow accents */}
      <div
        aria-hidden
        className="pointer-events-none absolute -top-24 -right-24 h-96 w-96 rounded-full bg-white/10 blur-3xl"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-32 -left-20 h-96 w-96 rounded-full bg-black/10 blur-3xl"
      />
      {/* Subtle grid texture */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{
          backgroundImage:
            'linear-gradient(to right, white 1px, transparent 1px), linear-gradient(to bottom, white 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Logo + brand */}
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/25">
          <Sparkles className="h-6 w-6 text-white" />
        </div>
        <div className="flex flex-col leading-none">
          <span className="text-lg font-semibold tracking-tight">TaxDox AI</span>
          <span className="text-xs text-white/70">Tax Document Intelligence</span>
        </div>
      </div>

      {/* Tagline + features */}
      <div className="relative z-10 max-w-md">
        <h1 className="text-3xl font-semibold leading-tight tracking-tight xl:text-4xl">
          Make tax document processing as simple as sending an email.
        </h1>
        <p className="mt-4 text-sm text-white/75">
          The AI-native platform accounting firms use to collect, classify, and
          extract tax documents — without the manual busywork.
        </p>

        <ul className="mt-10 space-y-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <li key={title} className="flex gap-4">
              <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white/12 ring-1 ring-white/20 backdrop-blur">
                <Icon className="h-5 w-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-white">{title}</span>
                <span className="mt-0.5 text-sm text-white/70">{description}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {/* Trust footer */}
      <div className="relative z-10 flex items-center gap-6 text-xs text-white/60">
        <span className="flex items-center gap-1.5">
          <ShieldCheck className="h-3.5 w-3.5" /> SOC 2 Type II
        </span>
        <span className="h-3 w-px bg-white/20" />
        <span>Trusted by 500+ accounting firms</span>
      </div>
    </div>
  )
}

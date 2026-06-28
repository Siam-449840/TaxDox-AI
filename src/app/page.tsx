'use client'

import { useEffect, Suspense } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { AppShell } from '@/components/layout/app-shell'
import { useAppStore } from '@/lib/store'
import { DashboardView } from '@/components/views/dashboard-view'
import { ClientsView } from '@/components/views/clients-view'
import { EngagementsView } from '@/components/views/engagements-view'
import { EngagementDetailView } from '@/components/views/engagement-detail-view'
import { DocumentsView } from '@/components/views/documents-view'
import { DocumentDetailView } from '@/components/views/document-detail-view'
import { ReportsView } from '@/components/views/reports-view'
import { ClientPortalView } from '@/components/views/client-portal-view'
import { SettingsView } from '@/components/views/settings-view'
import { AIAssistant } from '@/components/ai/ai-assistant'
import { Sparkles, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

function HomeContent() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentView = useAppStore((s) => s.currentView)

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth/signin')
    }
  }, [status, router])

  useEffect(() => {
    if (searchParams.get('checkout') === 'success') {
      const tier = searchParams.get('tier')
      toast.success(`Subscription activated! Welcome to TaxDox AI ${tier || ''}.`)
      router.replace('/')
    }
  }, [searchParams, router])

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-primary shadow-lg shadow-primary/20">
          <Sparkles className="h-7 w-7 text-white" />
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Loading TaxDox AI...</span>
        </div>
      </div>
    )
  }

  if (!session?.user) {
    return null
  }

  return (
    <AppShell>
      <div className="min-h-[calc(100vh-4rem)]">
        {currentView === 'dashboard' && <DashboardView />}
        {currentView === 'clients' && <ClientsView />}
        {currentView === 'engagements' && <EngagementsView />}
        {currentView === 'engagement-detail' && <EngagementDetailView />}
        {currentView === 'documents' && <DocumentsView />}
        {currentView === 'document-detail' && <DocumentDetailView />}
        {currentView === 'reports' && <ReportsView />}
        {currentView === 'client-portal' && <ClientPortalView />}
        {currentView === 'settings' && <SettingsView />}
      </div>
      <AIAssistant />
    </AppShell>
  )
}

export default function Home() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      }
    >
      <HomeContent />
    </Suspense>
  )
}

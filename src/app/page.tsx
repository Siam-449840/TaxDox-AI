'use client'

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

export default function Home() {
  const currentView = useAppStore((s) => s.currentView)

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

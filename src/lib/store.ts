'use client'

import { create } from 'zustand'
import type { ViewKey } from './types'

interface AppState {
  // Navigation
  currentView: ViewKey
  selectedEngagementId: string | null
  selectedDocumentId: string | null
  selectedClientId: string | null
  clientPortalMode: boolean
  sidebarCollapsed: boolean

  // Actions
  setView: (view: ViewKey) => void
  openEngagement: (id: string) => void
  openDocument: (id: string, engagementId?: string) => void
  openClient: (id: string) => void
  setClientPortalMode: (mode: boolean) => void
  toggleSidebar: () => void
  navigate: (view: ViewKey) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedEngagementId: null,
  selectedDocumentId: null,
  selectedClientId: null,
  clientPortalMode: false,
  sidebarCollapsed: false,

  setView: (view) =>
    set({
      currentView: view,
      selectedEngagementId: view === 'engagement-detail' ? undefined : null,
      selectedDocumentId: null,
    }),

  navigate: (view) =>
    set({
      currentView: view,
      selectedEngagementId: null,
      selectedDocumentId: null,
      selectedClientId: null,
    }),

  openEngagement: (id) =>
    set({
      currentView: 'engagement-detail',
      selectedEngagementId: id,
    }),

  openDocument: (id) =>
    set({
      currentView: 'document-detail',
      selectedDocumentId: id,
    }),

  openClient: (id) =>
    set({
      currentView: 'clients',
      selectedClientId: id,
    }),

  setClientPortalMode: (mode) => set({ clientPortalMode: mode }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
}))

'use client'

import { create } from 'zustand'
import type { ViewKey } from './types'

interface AppState {
  // Navigation
  currentView: ViewKey
  selectedEngagementId: string | null
  selectedDocumentId: string | null
  selectedClientId: string | null
  selectedTeamMemberName: string | null
  clientPortalMode: boolean
  sidebarCollapsed: boolean

  // Command palette
  commandPaletteOpen: boolean

  // Actions
  setView: (view: ViewKey) => void
  openEngagement: (id: string) => void
  openDocument: (id: string, engagementId?: string) => void
  openClient: (id: string) => void
  openTeamMember: (name: string) => void
  setClientPortalMode: (mode: boolean) => void
  toggleSidebar: () => void
  navigate: (view: ViewKey) => void
  toggleCommandPalette: () => void
  setCommandPalette: (open: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  currentView: 'dashboard',
  selectedEngagementId: null,
  selectedDocumentId: null,
  selectedClientId: null,
  selectedTeamMemberName: null,
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
      selectedTeamMemberName: null,
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
      currentView: 'client-detail',
      selectedClientId: id,
    }),

  openTeamMember: (name) =>
    set({
      currentView: 'team-detail',
      selectedTeamMemberName: name,
    }),

  setClientPortalMode: (mode) => set({ clientPortalMode: mode }),

  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),

  commandPaletteOpen: false,
  toggleCommandPalette: () =>
    set((s) => ({ commandPaletteOpen: !s.commandPaletteOpen })),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
}))

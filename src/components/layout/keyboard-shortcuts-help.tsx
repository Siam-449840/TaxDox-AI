'use client'

import { useEffect } from 'react'
import {
  Keyboard,
  X,
  Compass,
  Zap,
  Search,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAppStore } from '@/lib/store'

/* ------------------------------------------------------------------ */
/*  Kbd badge — renders like a physical keyboard key                  */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-1 text-xs font-mono font-semibold text-muted-foreground shadow-[0_1px_0_rgb(0_0_0_/_0.06)]">
      {children}
    </kbd>
  )
}

/* ------------------------------------------------------------------ */
/*  Shortcut data                                                     */
/* ------------------------------------------------------------------ */

interface Shortcut {
  description: string
  /**
   * Each combo is rendered as one or more Kbd badges (each string in the
   * inner array becomes its own Kbd badge). Multiple combos are
   * alternatives, displayed separated by `/`.
   *
   * Examples:
   *   [['G', 'D']]              ->  [G] [D]
   *   [['⌘K'], ['Ctrl+K']]      ->  [⌘K] / [Ctrl+K]
   *   [['↑', '↓']]              ->  [↑] [↓]
   */
  combos: string[][]
}

interface Category {
  id: string
  name: string
  icon: LucideIcon
  shortcuts: Shortcut[]
}

const CATEGORIES: Category[] = [
  {
    id: 'navigation',
    name: 'Navigation',
    icon: Compass,
    shortcuts: [
      { description: 'Go to Dashboard', combos: [['G', 'D']] },
      { description: 'Go to Clients', combos: [['G', 'C']] },
      { description: 'Go to Engagements', combos: [['G', 'E']] },
      { description: 'Go to Documents', combos: [['G', 'O']] },
      { description: 'Go to Reports', combos: [['G', 'R']] },
      { description: 'Go to Calendar', combos: [['G', 'L']] },
      { description: 'Go to Client Portal', combos: [['G', 'P']] },
      { description: 'Go to Settings', combos: [['G', 'S']] },
    ],
  },
  {
    id: 'actions',
    name: 'Actions',
    icon: Zap,
    shortcuts: [
      { description: 'Open Command Palette', combos: [['⌘K'], ['Ctrl+K']] },
      { description: 'Show this help', combos: [['?']] },
      { description: 'Close dialog / overlay', combos: [['Esc']] },
    ],
  },
  {
    id: 'command-palette',
    name: 'Command Palette',
    icon: Search,
    shortcuts: [
      { description: 'Navigate results', combos: [['↑', '↓']] },
      { description: 'Select item', combos: [['Enter']] },
      { description: 'Close palette', combos: [['Esc']] },
    ],
  },
]

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

/** Returns true if the event originated from an editable form field. */
function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  const tag = target.tagName
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  )
}

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function KeyboardShortcutsHelp() {
  const open = useAppStore((s) => s.keyboardHelpOpen)
  const setOpen = useAppStore((s) => s.setKeyboardHelp)

  /* -------------- global `?` (and Escape) key listener ------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Close on Escape (only when our overlay is open)
      if (e.key === 'Escape') {
        if (useAppStore.getState().keyboardHelpOpen) {
          e.preventDefault()
          e.stopPropagation()
          setOpen(false)
        }
        return
      }

      // Open on `?` (Shift+/) — ignore when typing in an input or when
      // a meta/ctrl/alt modifier is held (avoids hijacking browser shortcuts)
      if (e.key === '?' || (e.shiftKey && e.key === '/')) {
        if (e.metaKey || e.ctrlKey || e.altKey) return
        if (isEditableTarget(e.target)) return
        e.preventDefault()
        setOpen(true)
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [setOpen])

  /* ------------------ lock body scroll while open ------------------ */

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm animate-in fade-in-0 duration-150"
      onClick={() => setOpen(false)}
      role="dialog"
      aria-modal="true"
      aria-label="Keyboard shortcuts help"
    >
      <div
        className={cn(
          'flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border bg-popover text-popover-foreground shadow-2xl',
          'animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200'
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ---------------------------------------------------------- */}
        {/* Header                                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 border-b px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/20">
              <Keyboard className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <h2 className="text-base font-semibold tracking-tight text-foreground">
                Keyboard Shortcuts
              </h2>
              <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                Press <Kbd>?</Kbd> anywhere to open this dialog
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close keyboard shortcuts"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Body — categories                                          */}
        {/* ---------------------------------------------------------- */}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">
          <div className="space-y-6">
            {CATEGORIES.map((category) => {
              const Icon = category.icon
              return (
                <section
                  key={category.id}
                  aria-labelledby={`kb-cat-${category.id}`}
                >
                  <div className="mb-3 flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary ring-1 ring-primary/10">
                      <Icon className="h-4 w-4" />
                    </span>
                    <h3
                      id={`kb-cat-${category.id}`}
                      className="text-sm font-semibold tracking-tight text-primary"
                    >
                      {category.name}
                    </h3>
                  </div>

                  <div className="grid grid-cols-1 gap-x-6 gap-y-1.5 sm:grid-cols-2">
                    {category.shortcuts.map((shortcut, i) => (
                      <div
                        key={`${category.id}-${i}`}
                        className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/60"
                      >
                        {/* Kbd badges — left */}
                        <span className="flex shrink-0 items-center gap-1">
                          {shortcut.combos.map((combo, ci) => (
                            <span
                              key={ci}
                              className="flex items-center gap-1"
                            >
                              {ci > 0 && (
                                <span
                                  className="px-0.5 text-xs text-muted-foreground/60"
                                  aria-hidden
                                >
                                  /
                                </span>
                              )}
                              {combo.map((k, ki) => (
                                <Kbd key={ki}>{k}</Kbd>
                              ))}
                            </span>
                          ))}
                        </span>

                        {/* Description — right */}
                        <span className="min-w-0 flex-1 truncate text-sm text-foreground/80">
                          {shortcut.description}
                        </span>
                      </div>
                    ))}
                  </div>
                </section>
              )
            })}
          </div>
        </div>

        {/* ---------------------------------------------------------- */}
        {/* Footer                                                     */}
        {/* ---------------------------------------------------------- */}
        <div className="flex items-center justify-between gap-3 border-t bg-muted/30 px-6 py-3 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="h-1.5 w-1.5 rounded-full bg-primary/70" />
            <span className="font-medium text-foreground/70">TaxDox AI</span>
            <span className="text-muted-foreground/60">· Keyboard Shortcuts</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span>Press</span>
            <Kbd>Esc</Kbd>
            <span>to close</span>
          </div>
        </div>
      </div>
    </div>
  )
}

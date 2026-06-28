'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Sparkles, X, Send, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

// ─── Types ─────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: number
}

// ─── Constants ─────────────────────────────────────────────────

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  content:
    "Hi! I'm your TaxDox AI assistant. I can help with document classification, PBC lists, extraction confidence, tax workflows, and more. What would you like to know?",
  createdAt: Date.now(),
}

const QUICK_SUGGESTIONS = [
  { id: 's1', label: 'What documents do I need for a 1040?', icon: '📄' },
  { id: 's2', label: 'How does AI extraction work?', icon: '🤖' },
  { id: 's3', label: 'Explain PBC lists', icon: '📋' },
]

const AI_AVATAR_GRADIENT =
  'bg-gradient-to-br from-primary to-teal-600'

// ─── Component ─────────────────────────────────────────────────

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME_MESSAGE])
  const [input, setInput] = useState('')
  const [isTyping, setIsTyping] = useState(false)
  const [hasInteracted, setHasInteracted] = useState(false)
  const [unreadSinceClose, setUnreadSinceClose] = useState(false)

  const inputRef = useRef<HTMLInputElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new message or typing indicator change
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping, scrollToBottom])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      const t = setTimeout(() => inputRef.current?.focus(), 250)
      return () => clearTimeout(t)
    } else {
      // mark unread state when closed (used for FAB pulse)
      if (hasInteracted) setUnreadSinceClose(true)
    }
  }, [isOpen, hasInteracted])

  // Clear unread when opened
  useEffect(() => {
    if (isOpen) setUnreadSinceClose(false)
  }, [isOpen])

  // ─── Send message ───────────────────────────────────────────
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim()
      if (!trimmed || isTyping) return

      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
        createdAt: Date.now(),
      }

      const nextMessages = [...messages, userMsg]
      setMessages(nextMessages)
      setInput('')
      setIsTyping(true)
      setHasInteracted(true)

      try {
        const res = await fetch('/api/ai/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: nextMessages
              .filter((m) => m.id !== 'welcome')
              .map((m) => ({ role: m.role, content: m.content })),
          }),
        })

        if (!res.ok) throw new Error('AI request failed')
        const data = await res.json()
        const reply: string =
          data.reply ||
          "I'm not sure how to answer that right now. Please try rephrasing your question."

        const aiMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: 'assistant',
          content: reply,
          createdAt: Date.now(),
        }
        setMessages((prev) => [...prev, aiMsg])
      } catch (err) {
        console.error('AI chat error:', err)
        const errMsg: ChatMessage = {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content:
            "I'm having trouble connecting right now. As a TaxDox AI assistant, I can still help with document classification, PBC list management, extraction confidence, and tax workflow questions. Please try again in a moment.",
          createdAt: Date.now(),
        }
        setMessages((prev) => [...prev, errMsg])
      } finally {
        setIsTyping(false)
      }
    },
    [messages, isTyping]
  )

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    sendMessage(input)
  }

  const handleSuggestion = (text: string) => {
    sendMessage(text)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(input)
    }
  }

  const showSuggestions = !hasInteracted && !isTyping

  return (
    <>
      {/* Floating Action Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            key="fab"
            type="button"
            aria-label="Open AI Assistant"
            onClick={() => setIsOpen(true)}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 22 }}
            className="group fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-teal-600 text-white shadow-2xl shadow-primary/40 ring-1 ring-white/20 transition-transform hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:bottom-6 md:right-6 md:h-16 md:w-16"
          >
            {/* Pulse ring */}
            <span className="absolute inset-0 -z-10 rounded-full bg-primary/40 animate-ping [animation-duration:2.5s]" />
            <span className="absolute inset-0 -z-10 rounded-full bg-primary/20 blur-md animate-pulse" />
            {/* Sparkles icon */}
            <Sparkles className="h-6 w-6 transition-transform group-hover:rotate-12 group-hover:scale-110 md:h-7 md:w-7" />

            {/* Unread indicator */}
            {unreadSinceClose && (
              <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-background" />
              </span>
            )}

            {/* Tooltip */}
            <span className="pointer-events-none absolute right-full top-1/2 mr-3 -translate-y-1/2 whitespace-nowrap rounded-lg bg-foreground px-2.5 py-1.5 text-xs font-medium text-background opacity-0 shadow-lg transition-opacity duration-200 group-hover:opacity-100">
              Ask TaxDox AI
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Panel */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Mobile overlay (under panel, above content) */}
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm sm:hidden"
            />

            <motion.div
              key="panel"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 24, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className={cn(
                'fixed z-50 flex flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl shadow-foreground/20',
                // Mobile: near full-screen
                'inset-x-2 bottom-2 top-auto h-[85vh] max-h-[640px]',
                // Desktop: floating panel
                'sm:inset-x-auto sm:bottom-5 sm:right-5 sm:top-auto sm:h-[560px] sm:w-[380px] sm:max-h-[calc(100vh-3rem)]',
                'md:bottom-6 md:right-6 md:w-[400px]'
              )}
            >
              {/* Header */}
              <div className="relative flex items-center gap-3 overflow-hidden border-b border-border bg-gradient-to-br from-primary to-teal-700 px-4 py-3 text-white">
                {/* decorative blurs */}
                <div className="pointer-events-none absolute -right-6 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
                <div className="pointer-events-none absolute -left-4 bottom-0 h-16 w-16 rounded-full bg-teal-300/20 blur-xl" />

                <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/15 backdrop-blur ring-1 ring-white/20">
                  <Sparkles className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-primary bg-emerald-400" />
                </div>
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <h3 className="truncate text-sm font-semibold leading-none">TaxDox AI Assistant</h3>
                    <Badge />
                  </div>
                  <p className="mt-1 truncate text-xs text-white/70">Tax document expert · online</p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  aria-label="Close chat"
                  className="relative flex h-8 w-8 items-center justify-center rounded-lg text-white/80 transition-colors hover:bg-white/15 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {/* Messages area */}
              <div className="relative flex-1 overflow-hidden bg-gradient-to-b from-background to-muted/30">
                <ScrollArea className="h-full">
                  <div className="space-y-4 px-4 py-4">
                    {messages.map((m) => (
                      <MessageBubble key={m.id} message={m} />
                    ))}

                    {/* Typing indicator */}
                    {isTyping && <TypingIndicator />}

                    {/* Quick suggestions */}
                    {showSuggestions && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="space-y-2 pt-2"
                      >
                        <p className="px-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Try asking
                        </p>
                        <div className="flex flex-col gap-2">
                          {QUICK_SUGGESTIONS.map((s) => (
                            <button
                              key={s.id}
                              type="button"
                              onClick={() => handleSuggestion(s.label)}
                              className="group flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5 text-left text-sm shadow-sm transition-all hover:border-primary/40 hover:bg-primary/5 hover:shadow-md"
                            >
                              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-base">
                                {s.icon}
                              </span>
                              <span className="flex-1 text-foreground/90 group-hover:text-foreground">
                                {s.label}
                              </span>
                              <Send className="h-3.5 w-3.5 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                            </button>
                          ))}
                        </div>
                      </motion.div>
                    )}

                    {/* Bottom anchor */}
                    <div ref={messagesEndRef} className="h-1" />
                  </div>
                </ScrollArea>
              </div>

              {/* Input area */}
              <div className="border-t border-border bg-card/80 px-3 py-3 backdrop-blur">
                <form onSubmit={handleSubmit} className="flex items-center gap-2">
                  <Input
                    ref={inputRef}
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder="Ask about documents, PBC, extraction…"
                    disabled={isTyping}
                    className="h-10 flex-1 rounded-full border-border bg-background px-4 text-sm shadow-sm focus-visible:ring-1 focus-visible:ring-primary"
                  />
                  <Button
                    type="submit"
                    size="icon"
                    disabled={!input.trim() || isTyping}
                    aria-label="Send message"
                    className="h-10 w-10 shrink-0 rounded-full bg-gradient-to-br from-primary to-teal-600 shadow-md shadow-primary/30 hover:shadow-lg hover:shadow-primary/40 transition-shadow"
                  >
                    {isTyping ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4" />
                    )}
                  </Button>
                </form>
                <p className="mt-1.5 px-1 text-center text-[10px] text-muted-foreground">
                  TaxDox AI may produce inaccurate info · verify tax advice with a CPA
                </p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Message Bubble ────────────────────────────────────────────

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className={cn('flex items-end gap-2', isUser ? 'flex-row-reverse' : 'flex-row')}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          className={cn(
            'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
            AI_AVATAR_GRADIENT
          )}
        >
          <Sparkles className="h-3.5 w-3.5" />
        </div>
      )}

      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm shadow-sm',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground'
            : 'rounded-bl-md border border-primary/10 bg-primary/5 text-foreground dark:bg-primary/10'
        )}
      >
        <p className="whitespace-pre-wrap break-words leading-relaxed">{message.content}</p>
      </div>
    </motion.div>
  )
}

// ─── Typing Indicator ──────────────────────────────────────────

function TypingIndicator() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0 }}
      className="flex items-end gap-2"
    >
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-white shadow-sm',
          AI_AVATAR_GRADIENT
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
      </div>
      <div className="flex items-center gap-1 rounded-2xl rounded-bl-md border border-primary/10 bg-primary/5 px-4 py-3 dark:bg-primary/10">
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.3s] [animation-duration:1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:-0.15s] [animation-duration:1s]" />
        <span className="h-2 w-2 animate-bounce rounded-full bg-primary/60 [animation-delay:0s] [animation-duration:1s]" />
      </div>
    </motion.div>
  )
}

// ─── Online Badge ──────────────────────────────────────────────

function Badge() {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-1.5 py-0.5 text-[10px] font-medium text-emerald-100 ring-1 ring-emerald-300/30">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
      AI
    </span>
  )
}

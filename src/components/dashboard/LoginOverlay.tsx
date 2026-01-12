/**
 * LoginOverlay - SolidJS Version
 *
 * Login form for wallet authentication.
 */

import { type Component, Show, For } from 'solid-js'
import { Users, Sparkles } from 'lucide-solid'

export interface LoginOverlayProps {
  isOpen: boolean
  walletInput: string
  onWalletInputChange: (value: string) => void
  onLogin: () => void
}

/**
 * LoginOverlay - Login form for wallet authentication
 */
export const LoginOverlay: Component<LoginOverlayProps> = (props) => {
  return (
    <Show when={props.isOpen}>
      <div class="relative flex h-screen items-center justify-center bg-[var(--background-primary)] overflow-hidden">
        {/* Animated background gradient */}
        <div class="absolute inset-0 bg-gradient-to-br from-[var(--brand-teal-4)]/20 via-transparent to-[var(--brand-blue-1)]/10" />

        {/* Floating particles effect */}
        <div class="absolute inset-0 overflow-hidden">
          <For each={Array(20).fill(0)}>
            {(_, i) => (
              <div
                class="absolute w-1 h-1 bg-[var(--brand-teal-1)]/30 rounded-full animate-float"
                style={{
                  left: `${Math.random() * 100}%`,
                  top: `${Math.random() * 100}%`,
                  'animation-delay': `${i() * 0.5}s`,
                  'animation-duration': `${10 + Math.random() * 10}s`,
                }}
              />
            )}
          </For>
        </div>

        {/* Glowing orbs */}
        <div class="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--brand-teal-1)]/5 rounded-full blur-3xl animate-pulse" />
        <div class="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--brand-blue-2)]/5 rounded-full blur-3xl animate-pulse" style={{ 'animation-delay': '1s' }} />

        {/* Login card with glow effect */}
        <div class="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Outer glow */}
          <div class="absolute -inset-1 bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-2xl blur-lg" />

          <div class="relative bg-[var(--background-secondary)]/90 backdrop-blur-xl border border-[var(--card-border)] rounded-xl p-8 w-full max-w-md shadow-2xl">
            {/* Animated gradient border */}
            <div class="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[var(--brand-teal-1)]/50 via-transparent to-[var(--brand-blue-2)]/50 opacity-50" />

            <div class="relative">
              {/* Logo section */}
              <div class="flex flex-col items-center mb-8">
                <div class="mb-4 animate-pulse">
                  <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
                    <Sparkles class="w-8 h-8 text-white" />
                  </div>
                </div>
                <h1 class="text-3xl font-bold bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] bg-clip-text text-transparent">
                  TENEO Discovery
                </h1>
                <p class="text-sm text-[var(--text-secondary)] mt-2">
                  Explore the Neural Network
                </p>
              </div>

              {/* Input section */}
              <div class="space-y-4">
                <div>
                  <label class="text-xs text-[var(--text-primary)] font-semibold mb-2 block uppercase tracking-wider">
                    Wallet Address
                  </label>
                  <div class="relative">
                    <input
                      type="text"
                      value={props.walletInput}
                      onInput={(e) => props.onWalletInputChange(e.currentTarget.value)}
                      placeholder="0x..."
                      class="w-full px-4 py-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 focus:ring-1 focus:ring-[var(--brand-teal-1)]/20 transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && props.onLogin()}
                    />
                    <div class="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--brand-teal-1)]/50" />
                  </div>
                </div>

                <button
                  onClick={props.onLogin}
                  disabled={!props.walletInput.trim()}
                  class="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--brand-teal-1)]/20 hover:shadow-xl hover:shadow-[var(--brand-teal-1)]/30 hover:scale-[1.02] active:scale-[0.98] transition-all"
                >
                  Enter Discovery Portal
                </button>
              </div>

              {/* Footer info */}
              <div class="mt-6 pt-6 border-t border-[var(--card-border)]">
                <div class="flex items-center justify-center gap-6 text-xs text-[var(--text-tertiary)]">
                  <div class="flex items-center gap-1.5">
                    <div class="w-1.5 h-1.5 rounded-full bg-green-400" />
                    <span>Network Active</span>
                  </div>
                  <div class="flex items-center gap-1.5">
                    <Users class="w-3.5 h-3.5" />
                    <span>100K+ Spaces</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Show>
  )
}

export default LoginOverlay

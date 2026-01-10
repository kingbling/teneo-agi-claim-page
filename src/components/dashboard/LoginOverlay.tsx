import { motion } from 'framer-motion'
import { Users, Sparkles } from 'lucide-react'

export interface LoginOverlayProps {
  isOpen: boolean
  walletInput: string
  onWalletInputChange: (value: string) => void
  onLogin: () => void
}

/**
 * LoginOverlay - Login form for wallet authentication
 *
 * Extracted from DiscoveryDashboard, this component handles
 * the initial user login flow with wallet address.
 */
export function LoginOverlay({ isOpen, walletInput, onWalletInputChange, onLogin }: LoginOverlayProps) {
  if (!isOpen) return null

  return (
    <div className="relative flex h-screen items-center justify-center bg-[var(--background-primary)] overflow-hidden">
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-br from-[var(--brand-teal-4)]/20 via-transparent to-[var(--brand-blue-1)]/10" />

      {/* Floating particles effect */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[var(--brand-teal-1)]/30 rounded-full"
            initial={{
              x: Math.random() * (typeof window !== 'undefined' ? window.innerWidth : 1000),
              y: Math.random() * (typeof window !== 'undefined' ? window.innerHeight : 800),
              scale: Math.random() * 0.5 + 0.5,
              opacity: Math.random() * 0.5 + 0.2
            }}
            animate={{
              y: [null, Math.random() * -200 - 100],
              opacity: [null, 0]
            }}
            transition={{
              duration: Math.random() * 10 + 10,
              repeat: Infinity,
              ease: "linear"
            }}
          />
        ))}
      </div>

      {/* Glowing orbs */}
      <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-[var(--brand-teal-1)]/5 rounded-full blur-3xl animate-pulse" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--brand-blue-2)]/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

      {/* Login card with glow effect */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="relative z-10"
      >
        {/* Outer glow */}
        <div className="absolute -inset-1 bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-2xl blur-lg" />

        <div className="relative bg-[var(--background-secondary)]/90 backdrop-blur-xl border border-[var(--card-border)] rounded-xl p-8 w-full max-w-md shadow-2xl">
          {/* Animated gradient border */}
          <div className="absolute inset-0 rounded-xl p-[1px] bg-gradient-to-r from-[var(--brand-teal-1)]/50 via-transparent to-[var(--brand-blue-2)]/50 opacity-50" />

          <div className="relative">
            {/* Logo section */}
            <div className="flex flex-col items-center mb-8">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                className="mb-4"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] flex items-center justify-center shadow-lg shadow-[var(--brand-teal-1)]/20">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
              </motion.div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] bg-clip-text text-transparent">
                TENEO Discovery
              </h1>
              <p className="text-sm text-[var(--text-secondary)] mt-2">
                Explore the Neural Network
              </p>
            </div>

            {/* Input section */}
            <div className="space-y-4">
              <div>
                <label className="text-xs text-[var(--text-primary)] font-semibold mb-2 block uppercase tracking-wider">
                  Wallet Address
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={walletInput}
                    onChange={(e) => onWalletInputChange(e.target.value)}
                    placeholder="0x..."
                    className="w-full px-4 py-3 rounded-xl bg-[var(--background-primary)] border border-[var(--card-border)] text-[var(--text-primary)] placeholder:text-[var(--text-muted)] focus:outline-none focus:border-[var(--brand-teal-1)]/50 focus:ring-1 focus:ring-[var(--brand-teal-1)]/20 transition-all"
                    onKeyDown={(e) => e.key === 'Enter' && onLogin()}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[var(--brand-teal-1)]/50" />
                </div>
              </div>

              <motion.button
                onClick={onLogin}
                disabled={!walletInput.trim()}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] text-white font-semibold disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-[var(--brand-teal-1)]/20 hover:shadow-xl hover:shadow-[var(--brand-teal-1)]/30 transition-shadow"
              >
                Enter Discovery Portal
              </motion.button>
            </div>

            {/* Footer info */}
            <div className="mt-6 pt-6 border-t border-[var(--card-border)]">
              <div className="flex items-center justify-center gap-6 text-xs text-[var(--text-tertiary)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
                  <span>Network Active</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5" />
                  <span>100K+ Spaces</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

import { motion } from 'framer-motion'
import { Loader2, Sparkles } from 'lucide-react'
import { useState, useEffect } from 'react'

interface LoadingOverlayProps {
  message?: string
  showTips?: boolean
}

const LOADING_TIPS = [
  "Agents explore the neural network to find undiscovered spaces",
  "Higher level traits give better bonuses to your agents",
  "Deploy multiple agents to explore faster",
  "Use keyboard shortcuts: D to deploy, R to refuel",
  "Refuel agents before they run out of points",
  "Double-click an agent card to focus the camera on it",
  "Region hotspots show you the best areas to explore",
  "Watch for discovery notifications to track your progress",
]

export function LoadingOverlay({ message = 'Loading...', showTips = true }: LoadingOverlayProps) {
  const [tipIndex, setTipIndex] = useState(0)

  // Rotate tips every 4 seconds
  useEffect(() => {
    if (!showTips) return
    const interval = setInterval(() => {
      setTipIndex(prev => (prev + 1) % LOADING_TIPS.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [showTips])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-md flex items-center justify-center z-[100]"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className="relative"
      >
        {/* Outer glow */}
        <div className="absolute -inset-[var(--space-6)] bg-gradient-to-r from-[var(--brand-teal-1)]/20 to-[var(--brand-blue-2)]/20 rounded-[var(--radius-2xl)] blur-2xl" />

        <div className="relative bg-[var(--background-secondary)]/95 backdrop-blur-xl border border-[var(--card-border)] rounded-[var(--radius-xl)] p-[var(--space-8)] shadow-2xl max-w-sm">
          <div className="flex flex-col items-center gap-[var(--space-6)]">
            {/* Animated spinner with glow */}
            <div className="relative">
              <motion.div
                className="absolute -inset-[var(--space-3)] bg-[var(--brand-teal-1)]/20 rounded-full blur-lg"
                animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.3, 0.5] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="relative"
              >
                <Loader2 className="h-14 w-14 text-[var(--brand-teal-1)]" />
              </motion.div>
            </div>

            {/* Message */}
            <div className="text-center">
              <p className="text-xl font-bold text-[var(--text-primary)] mb-[var(--space-3)]">
                {message}
              </p>
              <motion.div
                className="flex items-center justify-center gap-[var(--space-2)]"
              >
                {[0, 1, 2].map((i) => (
                  <motion.span
                    key={i}
                    className="w-[var(--space-2)] h-[var(--space-2)] rounded-full bg-[var(--brand-teal-1)]"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.4, 1, 0.4] }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      delay: i * 0.15,
                      ease: "easeInOut"
                    }}
                  />
                ))}
              </motion.div>
            </div>

            {/* Tips section */}
            {showTips && (
              <motion.div
                key={tipIndex}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.3 }}
                className="mt-[var(--space-2)] px-[var(--space-5)] py-[var(--space-4)] rounded-[var(--radius-xl)] bg-[var(--background-primary)]/50 border border-[var(--card-border)]/50"
              >
                <div className="flex items-start gap-[var(--space-3)]">
                  <Sparkles className="h-[var(--space-4)] w-[var(--space-4)] text-[var(--tier-legendary)] mt-[var(--space-1)] shrink-0" />
                  <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                    {LOADING_TIPS[tipIndex]}
                  </p>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

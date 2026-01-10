import { motion } from 'framer-motion'
import { Sparkles } from 'lucide-react'

export interface TranceModeOverlayProps {
  isActive: boolean
  endTime: number | null
}

/**
 * TranceModeOverlay - Displays the 20x slowdown trance mode effect
 *
 * Extracted from DiscoveryDashboard, this component shows the
 * trance mode overlay with timer and visual effects.
 */
export function TranceModeOverlay({ isActive, endTime }: TranceModeOverlayProps) {
  const tranceRemainingMs = endTime ? Math.max(0, endTime - Date.now()) : 0
  const tranceRemainingSeconds = Math.ceil(tranceRemainingMs / 1000)

  if (!isActive) return null

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 pointer-events-none z-[90]"
    >
      {/* Layered vignette for depth */}
      <div className="absolute inset-0 bg-gradient-radial from-transparent via-[hsl(var(--tier-mythic))]/20 to-[hsl(var(--tier-mythic))]/50" />
      <div className="absolute inset-0 bg-gradient-radial from-transparent to-[hsl(var(--tier-trait))]/30" />

      {/* Trance indicator - centered card */}
      <div className="absolute top-20 left-1/2 -translate-x-1/2 flex flex-col items-center">
        {/* Outer glow */}
        <motion.div
          className="absolute -inset-8 bg-[hsl(var(--tier-mythic))]/10 rounded-3xl blur-2xl"
          animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />

        {/* Card */}
        <div className="relative">
          {/* Animated border glow */}
          <motion.div
            className="absolute -inset-px rounded-2xl bg-gradient-to-r from-[hsl(var(--tier-mythic))]/50 via-[hsl(var(--tier-trait))]/50 to-[hsl(var(--tier-mythic))]/50"
            animate={{ backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'] }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            style={{ backgroundSize: '200% 200%' }}
          />

          <div className="relative px-8 py-5 rounded-2xl bg-[var(--background-primary)]/90 backdrop-blur-xl border border-[hsl(var(--tier-mythic))]/30">
            {/* Trance icon with pulse */}
            <div className="flex items-center justify-center gap-3 mb-3">
              <motion.div
                className="relative"
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2 }}
              >
                <Sparkles className="h-6 w-6 text-[hsl(var(--tier-mythic))]" />
                <motion.div
                  className="absolute inset-0"
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Sparkles className="h-6 w-6 text-[hsl(var(--tier-mythic))]" />
                </motion.div>
              </motion.div>
              <span className="text-[hsl(var(--tier-mythic))]/80 font-bold text-lg tracking-widest uppercase">
                Trance Mode
              </span>
            </div>

            {/* Timer bar */}
            <div className="w-48 h-2 rounded-full bg-[hsl(var(--tier-mythic))]/50 overflow-hidden mb-3">
              <motion.div
                className="h-full bg-gradient-to-r from-[hsl(var(--tier-mythic))] to-[hsl(var(--tier-trait))]"
                style={{ width: `${(tranceRemainingMs / 8000) * 100}%` }}
                transition={{ duration: 0.1 }}
              />
            </div>

            {/* Stats */}
            <div className="flex items-center justify-between text-xs">
              <span className="text-[hsl(var(--tier-mythic))]/70 font-medium">
                20× Slowdown Active
              </span>
              <span className="text-[hsl(var(--tier-mythic))] font-bold tabular-nums">
                {tranceRemainingSeconds}s
              </span>
            </div>

            {/* Auto-continue hint */}
            <div className="mt-3 pt-3 border-t border-[hsl(var(--tier-mythic))]/20 text-center">
              <motion.span
                className="text-[10px] text-[hsl(var(--tier-mythic))]/60 font-medium"
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                Auto-deploying when trance ends...
              </motion.span>
            </div>
          </div>
        </div>
      </div>

      {/* Corner accents */}
      <motion.div
        className="absolute top-0 left-0 w-32 h-32 border-t-2 border-l-2 border-[hsl(var(--tier-mythic))]/30 rounded-tl-3xl ml-4 mt-4"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        className="absolute top-0 right-0 w-32 h-32 border-t-2 border-r-2 border-[hsl(var(--tier-mythic))]/30 rounded-tr-3xl mr-4 mt-4"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
      />
      <motion.div
        className="absolute bottom-0 left-0 w-32 h-32 border-b-2 border-l-2 border-[hsl(var(--tier-mythic))]/30 rounded-bl-3xl ml-4 mb-4"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1 }}
      />
      <motion.div
        className="absolute bottom-0 right-0 w-32 h-32 border-b-2 border-r-2 border-[hsl(var(--tier-mythic))]/30 rounded-br-3xl mr-4 mb-4"
        animate={{ opacity: [0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity, delay: 1.5 }}
      />

      {/* Floating particles */}
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={`trance-particle-${i}`}
          className="absolute w-1 h-1 rounded-full bg-[hsl(var(--tier-mythic))]"
          style={{
            left: `${20 + (i * 12)}%`,
            top: '80%',
          }}
          animate={{
            y: [0, -200, 0],
            x: [0, Math.sin(i) * 30, 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 4 + i * 0.5,
            repeat: Infinity,
            delay: i * 0.3,
            ease: "easeInOut",
          }}
        />
      ))}
    </motion.div>
  )
}

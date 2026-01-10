import { useState, useRef, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'
import { HelpCircle, Zap, Sparkles, Fuel, Target, TrendingUp } from 'lucide-react'

interface TooltipProps {
  content: React.ReactNode
  children: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number
  className?: string
  maxWidth?: number
}

export function Tooltip({
  content,
  children,
  position = 'top',
  delay = 200,
  className = '',
  maxWidth = 280,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false)
  const [coords, setCoords] = useState({ x: 0, y: 0 })
  const triggerRef = useRef<HTMLDivElement>(null)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return

    const rect = triggerRef.current.getBoundingClientRect()
    const scrollY = window.scrollY
    const scrollX = window.scrollX

    let x = rect.left + scrollX + rect.width / 2
    let y = rect.top + scrollY

    switch (position) {
      case 'top':
        y = rect.top + scrollY - 10
        break
      case 'bottom':
        y = rect.bottom + scrollY + 10
        break
      case 'left':
        x = rect.left + scrollX - 10
        y = rect.top + scrollY + rect.height / 2
        break
      case 'right':
        x = rect.right + scrollX + 10
        y = rect.top + scrollY + rect.height / 2
        break
    }

    setCoords({ x, y })
  }, [position])

  const handleMouseEnter = useCallback(() => {
    updatePosition()
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true)
    }, delay)
  }, [delay, updatePosition])

  const handleMouseLeave = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    setIsVisible(false)
  }, [])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
    }
  }, [])

  const getTransformOrigin = () => {
    switch (position) {
      case 'top': return 'bottom center'
      case 'bottom': return 'top center'
      case 'left': return 'right center'
      case 'right': return 'left center'
    }
  }

  const getTransform = () => {
    switch (position) {
      case 'top': return 'translate(-50%, -100%)'
      case 'bottom': return 'translate(-50%, 0)'
      case 'left': return 'translate(-100%, -50%)'
      case 'right': return 'translate(0, -50%)'
    }
  }

  return (
    <>
      <div
        ref={triggerRef}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`inline-flex ${className}`}
      >
        {children}
      </div>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {isVisible && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              style={{
                position: 'absolute',
                left: coords.x,
                top: coords.y,
                transform: getTransform(),
                transformOrigin: getTransformOrigin(),
                maxWidth,
                zIndex: 70,
              }}
              className="pointer-events-none"
            >
              <div className="relative px-[var(--padding-4)] py-[var(--padding-3)] rounded-xl bg-[var(--background-secondary)]/98 backdrop-blur-xl border border-[var(--card-border)] shadow-2xl shadow-black/40">
                {/* Arrow */}
                <div
                  className={`absolute w-[var(--size-3)] h-[var(--size-3)] bg-[var(--background-secondary)] border-[var(--card-border)] transform rotate-45 ${
                    position === 'top' ? 'bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 border-b border-r' :
                    position === 'bottom' ? 'top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 border-t border-l' :
                    position === 'left' ? 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2 border-t border-r' :
                    'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 border-b border-l'
                  }`}
                />
                <div className="relative text-sm text-[var(--text-secondary)] leading-relaxed">
                  {content}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

// Info tooltip trigger (small ? icon)
interface InfoTooltipProps {
  content: React.ReactNode
  position?: 'top' | 'bottom' | 'left' | 'right'
  size?: 'sm' | 'default'
}

export function InfoTooltip({ content, position = 'top', size = 'default' }: InfoTooltipProps) {
  const iconSize = size === 'sm' ? 'h-[var(--size-3)] w-[var(--size-3)]' : 'h-[var(--size-4)] w-[var(--size-4)]'

  return (
    <Tooltip content={content} position={position}>
      <button
        type="button"
        className="inline-flex items-center justify-center p-[var(--padding-1)] rounded-full hover:bg-[var(--background-primary)] transition-colors"
      >
        <HelpCircle className={`${iconSize} text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors`} />
      </button>
    </Tooltip>
  )
}

// Stat card with built-in tooltip
interface StatCardTooltipProps {
  icon: React.ReactNode
  label: string
  value: string | number
  suffix?: string
  tooltipContent?: React.ReactNode
  color?: string
  colorClass?: string
  className?: string
  trend?: 'up' | 'down' | 'neutral'
  trendValue?: string
}

export function StatCardWithTooltip({
  icon,
  label,
  value,
  suffix,
  tooltipContent,
  color = 'var(--brand-teal-1)',
  colorClass = 'text-[var(--brand-teal-1)]',
  className = '',
  trend,
  trendValue,
}: StatCardTooltipProps) {
  const content = (
    <motion.div
      whileHover={{ scale: 1.02, y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 15 }}
      className={`group relative px-[var(--padding-5)] py-[var(--padding-4)] rounded-xl bg-[var(--background-primary)]/60 border border-transparent hover:border-[${color}]/20 transition-all duration-200 cursor-default ${className}`}
    >
      {/* Hover glow */}
      <div
        className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity"
        style={{ background: `linear-gradient(135deg, ${color}10, transparent)` }}
      />

      <div className="relative flex items-start justify-between gap-[var(--gap-3)]">
        <div className="flex items-center gap-[var(--gap-3)]">
          <div
            className="w-[var(--size-9)] h-[var(--size-9)] rounded-lg flex items-center justify-center"
            style={{ background: `${color}20` }}
          >
            {icon}
          </div>
          <div>
            <div className="flex items-center gap-[var(--gap-1)] mb-[var(--margin-1)]">
              <span className="text-xs text-[var(--text-muted)] uppercase tracking-wider font-medium">
                {label}
              </span>
              {tooltipContent && (
                <InfoTooltip content={tooltipContent} size="sm" />
              )}
            </div>
            <div className="flex items-baseline gap-[var(--gap-1)]">
              <span className={`text-xl font-bold tabular-nums ${colorClass}`}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </span>
              {suffix && (
                <span className="text-xs text-[var(--text-muted)]">{suffix}</span>
              )}
            </div>
          </div>
        </div>

        {trend && trendValue && (
          <div className={`flex items-center gap-[var(--gap-1)] px-[var(--padding-2)] py-[var(--padding-1)] rounded-md text-xs font-medium ${
            trend === 'up' ? 'bg-[hsl(var(--success))]/10 text-[hsl(var(--success))]' :
            trend === 'down' ? 'bg-[hsl(var(--destructive))]/10 text-[hsl(var(--destructive))]' :
            'bg-[var(--background-secondary)] text-[var(--text-muted)]'
          }`}>
            {trend === 'up' ? '↑' : trend === 'down' ? '↓' : '→'}
            {trendValue}
          </div>
        )}
      </div>
    </motion.div>
  )

  return content
}

// Helpful tooltips for common game concepts
export const GAME_TOOLTIPS = {
  fuel: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Fuel className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Agent Fuel</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Fuel powers your agent's exploration. When fuel runs out, the agent returns home and becomes idle.
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span className="text-xs text-[hsl(var(--success))]">Tip: Keep agents above 200 pts to avoid interruptions</span>
      </div>
    </div>
  ),

  loot: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Sparkles className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>AGI Loot</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        AGI tokens earned from discovering spaces. Rarer spaces reward more AGI!
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)] space-y-[var(--gap-1)] text-xs text-[var(--text-muted)]">
        <div className="flex justify-between">
          <span>Common</span><span className="text-[hsl(var(--success))]">1-50 AGI</span>
        </div>
        <div className="flex justify-between">
          <span>Rare</span><span className="text-[hsl(var(--primary))]">50-100 AGI</span>
        </div>
        <div className="flex justify-between">
          <span>Legendary</span><span className="text-[hsl(var(--secondary))]">100-200 AGI</span>
        </div>
        <div className="flex justify-between">
          <span>Mythic</span><span className="text-[hsl(var(--accent))]">200+ AGI</span>
        </div>
      </div>
    </div>
  ),

  efficiency: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--success))] font-semibold">
        <TrendingUp className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Fleet Efficiency</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Ratio of AGI earned to points spent. Higher is better!
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)] space-y-[var(--gap-1)] text-xs text-[var(--text-muted)]">
        <div className="flex justify-between">
          <span>{"< 0.5x"}</span><span className="text-[hsl(var(--destructive))]">Learning</span>
        </div>
        <div className="flex justify-between">
          <span>0.5x - 1x</span><span className="text-[hsl(var(--accent))]">Fair</span>
        </div>
        <div className="flex justify-between">
          <span>1x - 1.5x</span><span className="text-[hsl(var(--success))]">Good</span>
        </div>
        <div className="flex justify-between">
          <span>{"> 1.5x"}</span><span className="text-[hsl(var(--success))]">Excellent</span>
        </div>
      </div>
    </div>
  ),

  discovery: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[var(--brand-teal-1)] font-semibold">
        <Target className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Global Discovery</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Percentage of all spaces in the neural network that have been discovered by all players.
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Race with others to discover rare undiscovered spaces!
        </span>
      </div>
    </div>
  ),

  deployAgent: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--accent))] font-semibold">
        <Zap className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Deploy Agent</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Send your idle agent to explore the network. Agents automatically search for undiscovered spaces.
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span className="text-xs text-[hsl(var(--success))]">Keyboard: Press D to deploy all idle agents</span>
      </div>
    </div>
  ),

  traits: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--secondary))] font-semibold">
        <Sparkles className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Agent Traits</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Special abilities that modify how your agent explores. Each trait has unique bonuses!
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)] text-xs text-[var(--text-muted)]">
        <div><span className="text-[hsl(var(--secondary))]">Explorer:</span> +Discovery range</div>
        <div><span className="text-[hsl(var(--accent))]">Solver:</span> Faster solving</div>
        <div><span className="text-[hsl(var(--primary))]">Swift:</span> +Movement speed</div>
        <div><span className="text-[hsl(var(--success))]">Efficient:</span> Less fuel burn</div>
      </div>
    </div>
  ),

  roi: (
    <div className="space-y-[var(--gap-2)]">
      <div className="flex items-center gap-[var(--gap-2)] text-[hsl(var(--success))] font-semibold">
        <TrendingUp className="h-[var(--size-4)] w-[var(--size-4)]" />
        <span>Return on Investment</span>
      </div>
      <p className="text-[var(--text-tertiary)]">
        Shows how much AGI you've earned compared to points spent. 100% = break even.
      </p>
      <div className="pt-[var(--padding-2)] border-t border-[var(--card-border)]">
        <span className="text-xs text-[var(--text-muted)]">
          Goal: Get above 100% to be profitable
        </span>
      </div>
    </div>
  ),
}

import { motion, AnimatePresence } from 'framer-motion'
import { X, Rocket, BarChart3, Settings, Brain, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MobileNavProps {
  activeTab: 'home' | 'agents' | 'stats' | 'settings'
  onTabChange: (tab: 'home' | 'agents' | 'stats' | 'settings') => void
  agentCount?: number
  points?: number
}

const tabs = [
  { id: 'home', label: 'Explore', icon: Brain },
  { id: 'agents', label: 'Agents', icon: Rocket },
  { id: 'stats', label: 'Stats', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

export function MobileNav({ activeTab, onTabChange, agentCount = 0, points = 0 }: MobileNavProps) {
  return (
    <>
      {/* Bottom Navigation Bar - only visible on mobile */}
      <nav className="fixed bottom-0 left-0 right-0 z-[40] md:hidden">
        {/* Gradient border on top */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

        <div className="bg-card/95 backdrop-blur-xl border-t border-border/50 pb-safe">
          <div className="flex items-center justify-around p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              return (
                <button
                  key={tab.id}
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    'relative flex flex-col items-center min-w-[72px] transition-all active:scale-95',
                    'gap-1 px-4 py-3 rounded-2xl',
                    isActive
                      ? 'text-[var(--brand-teal-1)]'
                      : 'text-muted-foreground hover:text-foreground active:bg-muted/50'
                  )}
                >
                  {/* Active indicator */}
                  {isActive && (
                    <motion.div
                      layoutId="activeTabIndicator"
                      className="absolute inset-0 bg-[var(--brand-teal-1)]/10 border border-[var(--brand-teal-1)]/20 rounded-2xl"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    />
                  )}

                  {/* Badge for agents tab */}
                  {tab.id === 'agents' && agentCount > 0 && (
                    <span className="absolute flex items-center justify-center font-bold text-white rounded-full shadow-lg shadow-[hsl(var(--state-solving))]/30 bg-[hsl(var(--state-solving))]"
                      style={{
                        top: '-4px',
                        right: '-4px',
                        minWidth: '20px',
                        height: '20px',
                        padding: '0 4px',
                        fontSize: '10px'
                      }}>
                      {agentCount}
                    </span>
                  )}

                  <Icon className={cn('relative z-10 w-6 h-6 transition-transform', isActive && 'scale-110')} />
                  <span className="font-semibold relative z-10 text-xs">{tab.label}</span>
                </button>
              )
            })}
          </div>
        </div>
      </nav>

      {/* Points display for mobile - floating above nav */}
      <div className="fixed z-40 md:hidden bottom-24 right-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="flex items-center bg-card/95 backdrop-blur-xl border border-border shadow-xl gap-2 px-5 py-3 rounded-2xl"
        >
          <div className="bg-[var(--brand-teal-1)]/15 p-1.5 rounded-lg">
            <Zap className="w-4 h-4 text-[var(--brand-teal-1)]" />
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-base font-bold text-[var(--brand-teal-1)] tabular-nums">
              {points.toLocaleString()}
            </span>
            <span className="text-xs text-muted-foreground font-medium">pts</span>
          </div>
        </motion.div>
      </div>
    </>
  )
}

// Mobile slide-out panel
interface MobilePanelProps {
  isOpen: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}

export function MobilePanel({ isOpen, onClose, title, children }: MobilePanelProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 backdrop-blur-sm z-[40] md:hidden bg-background/60"
          />

          {/* Panel */}
          <motion.div
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed inset-y-0 left-0 w-[85vw] max-w-sm bg-card border-r border-border z-[40] md:hidden overflow-hidden"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border p-4 px-5">
              <h2 className="text-lg font-bold text-foreground">{title}</h2>
              <button
                onClick={onClose}
                className="hover:bg-muted transition-colors p-2 rounded-lg"
              >
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto" style={{ height: 'calc(100% - 65px)' }}>
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// Quick action floating button for mobile
interface QuickActionButtonProps {
  onClick: () => void
  icon: React.ReactNode
  label: string
  variant?: 'primary' | 'secondary'
}

export function QuickActionButton({ onClick, icon, label, variant = 'primary' }: QuickActionButtonProps) {
  return (
    <motion.button
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={cn(
        'fixed z-40 md:hidden flex items-center gap-2 px-6 py-4 rounded-2xl shadow-xl transition-all active:shadow-lg bottom-24 left-4 text-sm font-bold',
        variant === 'primary'
          ? 'bg-gradient-to-r from-[var(--brand-teal-1)] to-[var(--brand-blue-2)] text-white shadow-[var(--brand-teal-1)]/40 active:shadow-[var(--brand-teal-1)]/20'
          : 'bg-card/95 backdrop-blur-xl border border-border text-foreground shadow-black/20'
      )}
    >
      <span className="w-5 h-5">{icon}</span>
      {label}
    </motion.button>
  )
}

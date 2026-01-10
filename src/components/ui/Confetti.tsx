import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

interface ConfettiPiece {
  id: number
  x: number
  color: string
  delay: number
  rotation: number
  scale: number
}

interface ConfettiProps {
  active: boolean
  duration?: number
}

const COLORS = [
  '#FFD700', // Gold
  '#FFA500', // Orange
  '#FF6B6B', // Coral
  '#4ECDC4', // Teal
  '#45B7D1', // Sky
  '#96CEB4', // Mint
  '#FFEAA7', // Yellow
  '#DDA0DD', // Plum
]

export function Confetti({ active, duration = 3000 }: ConfettiProps) {
  const [pieces, setPieces] = useState<ConfettiPiece[]>([])
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (active) {
      // Generate confetti pieces
      const newPieces: ConfettiPiece[] = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
        delay: Math.random() * 0.5,
        rotation: Math.random() * 360,
        scale: Math.random() * 0.5 + 0.5,
      }))
      setPieces(newPieces)
      setShow(true)

      // Hide after duration
      const timer = setTimeout(() => {
        setShow(false)
      }, duration)

      return () => clearTimeout(timer)
    }
  }, [active, duration])

  return (
    <AnimatePresence>
      {show && (
        <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
          {pieces.map((piece) => (
            <motion.div
              key={piece.id}
              className="absolute w-3 h-3"
              style={{
                left: `${piece.x}%`,
                top: -20,
                backgroundColor: piece.color,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                transform: `scale(${piece.scale})`,
              }}
              initial={{
                y: -20,
                rotate: 0,
                opacity: 1,
              }}
              animate={{
                y: typeof window !== 'undefined' ? window.innerHeight + 100 : 1000,
                rotate: piece.rotation + 720,
                opacity: [1, 1, 0],
                x: [0, Math.sin(piece.id) * 100, Math.sin(piece.id) * 50],
              }}
              transition={{
                duration: 2.5 + Math.random(),
                delay: piece.delay,
                ease: [0.25, 0.46, 0.45, 0.94],
              }}
              exit={{ opacity: 0 }}
            />
          ))}
        </div>
      )}
    </AnimatePresence>
  )
}

// Hook to trigger confetti
export function useConfetti() {
  const [trigger, setTrigger] = useState(0)

  const fire = () => {
    setTrigger((t) => t + 1)
  }

  return { trigger, fire }
}

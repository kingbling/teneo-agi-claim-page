import {
  Wallet,
  Twitter,
  MessageCircle,
  Send,
  Mail,
  Video,
  Instagram,
  Circle,
  Check,
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, Badge } from '@/components/ui'
import { useClaimStore } from '@/stores/claimStore'

const platformConfig = {
  wallet: { icon: Wallet, label: 'Wallet', color: 'text-[var(--brand-teal-1)]' },
  twitter: { icon: Twitter, label: 'X (Twitter)', color: 'text-[#1DA1F2]' },
  discord: { icon: MessageCircle, label: 'Discord', color: 'text-[#5865F2]' },
  telegram: { icon: Send, label: 'Telegram', color: 'text-[#0088cc]' },
  email: { icon: Mail, label: 'Email', color: 'text-[var(--text-secondary)]' },
  tiktok: { icon: Video, label: 'TikTok', color: 'text-[#ff0050]' },
  instagram: { icon: Instagram, label: 'Instagram', color: 'text-[#E4405F]' },
  farcaster: { icon: Circle, label: 'Farcaster', color: 'text-[#855DCD]' },
}

export function ConnectedAccounts() {
  const user = useClaimStore((state) => state.user)

  if (!user) return null

  const connections = user.connections

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>Connected Accounts</span>
          <Badge variant="success">
            {Object.values(connections).filter((c) => c.connected).length}/8
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(connections).map(([key, value]) => {
            const config = platformConfig[key as keyof typeof platformConfig]
            const Icon = config.icon

            return (
              <div
                key={key}
                className={`flex items-center gap-2 rounded-lg p-2 ${
                  value.connected
                    ? 'bg-[var(--background-tertiary)]'
                    : 'border border-dashed border-[var(--card-border)] opacity-50'
                }`}
              >
                <Icon className={`h-4 w-4 ${config.color}`} />
                <span className="flex-1 truncate text-xs text-[var(--text-secondary)]">
                  {config.label}
                </span>
                {value.connected && (
                  <Check className="h-3 w-3 text-[var(--brand-green-4)]" />
                )}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}

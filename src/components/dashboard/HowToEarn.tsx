import { Server, Bot, Terminal, Users } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui'
import { EARNING_METHODS } from '@/services/mock/mockData'

const iconMap: Record<string, React.ReactNode> = {
  server: <Server className="h-5 w-5" />,
  bot: <Bot className="h-5 w-5" />,
  terminal: <Terminal className="h-5 w-5" />,
  users: <Users className="h-5 w-5" />,
}

export function HowToEarn() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>How to Earn Points</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {EARNING_METHODS.map((method) => (
            <div
              key={method.id}
              className="flex items-start gap-3 rounded-lg bg-[var(--background-tertiary)] p-3"
            >
              <div className="text-[var(--brand-teal-1)]">
                {iconMap[method.icon]}
              </div>
              <div className="flex-1">
                <div className="font-medium text-[var(--text-primary)]">
                  {method.title}
                </div>
                <div className="text-xs text-[var(--text-tertiary)]">
                  {method.description}
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-semibold text-[var(--brand-green-4)]">
                  {method.pointsRange}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}

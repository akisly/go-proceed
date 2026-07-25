import { AlertTriangle, Check, Clock3, CircleDot } from 'lucide-react'

const iconMap = { ready: Check, risk: AlertTriangle, review: Clock3, blue: CircleDot, ink: Check }

export default function Status({ tone = 'ink', children }) {
  const Icon = iconMap[tone] || CircleDot
  return <span className={`status status--${tone}`}><Icon size={13} />{children}</span>
}

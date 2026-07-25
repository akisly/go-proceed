import { Link } from 'react-router-dom'

export default function Brand({ light = false, compact = false }) {
  return (
    <Link to="/" className={`brand ${light ? 'brand--light' : ''}`} aria-label="AktFlow — головна">
      <span className="brand__mark"><span /></span>
      {!compact && <span>AktFlow</span>}
    </Link>
  )
}

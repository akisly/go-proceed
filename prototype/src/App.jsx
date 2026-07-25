import { Navigate, Route, Routes } from 'react-router-dom'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Onboarding from './pages/Onboarding'
import Dashboard from './pages/Dashboard'
import Work from './pages/Work'
import Packages from './pages/Packages'
import Billing from './pages/Billing'
import Field from './pages/Field'
import Pilot from './pages/Pilot'
import Invite from './pages/Invite'
import Evidence from './pages/Evidence'
import Variations from './pages/Variations'
import Close from './pages/Close'
import PackageDetail from './pages/PackageDetail'
import ExternalReview from './pages/ExternalReview'
import Payments from './pages/Payments'
import Team from './pages/Team'
import Rules from './pages/Rules'
import BaselineControls from './pages/BaselineControls'
import Assignments from './pages/Assignments'
import Occurrence from './pages/Occurrence'
import Settings from './pages/Settings'
import Legal from './pages/Legal'
import ResetPassword from './pages/ResetPassword'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/pilot" element={<Pilot />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/legal/:document" element={<Legal />} />
      <Route path="/invite/demo" element={<Invite />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/app" element={<Dashboard />} />
      <Route path="/app/work" element={<Work />} />
      <Route path="/app/evidence" element={<Evidence />} />
      <Route path="/app/rules" element={<Rules />} />
      <Route path="/app/baseline" element={<BaselineControls />} />
      <Route path="/app/assignments" element={<Assignments />} />
      <Route path="/app/occurrences/demo" element={<Occurrence />} />
      <Route path="/app/variations" element={<Variations />} />
      <Route path="/app/close" element={<Close />} />
      <Route path="/app/packages" element={<Packages />} />
      <Route path="/app/packages/current" element={<PackageDetail />} />
      <Route path="/app/payments" element={<Payments />} />
      <Route path="/app/team" element={<Team />} />
      <Route path="/app/billing" element={<Billing />} />
      <Route path="/app/settings" element={<Settings />} />
      <Route path="/review/demo" element={<ExternalReview />} />
      <Route path="/field" element={<Field />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

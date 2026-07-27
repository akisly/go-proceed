import { Navigate, Route, Routes } from 'react-router-dom'
import DisclosureStrip from './components/DisclosureStrip'
import Landing from './pages/Landing'
import Demo from './pages/Demo'
import Roadmap from './pages/Roadmap'
import Legal from './pages/Legal'
import Pilot from './pages/Pilot'
import AppShell from './components/AppShell'

export default function App() {
  return (
    <>
      <DisclosureStrip />
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/demo" element={<Demo />} />
        <Route path="/pilot" element={<Pilot />} />
        <Route path="/roadmap" element={<Roadmap />} />
        <Route path="/legal/:document" element={<Legal />} />
        <Route path="/app/*" element={<AppShell />} />
        {/* Every never-written path lands on the guided story, never a 404
            and never a login form (spec A.3.2, A.4.3). */}
        <Route path="*" element={<Navigate to="/demo" replace />} />
      </Routes>
    </>
  )
}

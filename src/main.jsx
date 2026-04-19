import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthApp from './AuthApp'
import TicketPage from './TicketPage'
import TicketView from './TicketView'
import AdminPage from './AdminPage'
import ScanPage from './ScanPage'
import ProfilePage from './ProfilePage'
import GrailTable from './GrailTable'
import GrailBar from './GrailBar'
import GrailAdmin from './GrailAdmin'
import GrailDoor from './GrailDoor'
import GrailDoves from './GrailDoves'
import AlleycatDemo from './AlleycatDemo'
import GrailDemo from './GrailDemo'
import SimpleBar from './SimpleBar'
import EventBar from './EventBar'
import GrailHome from './GrailHome'
import GrailSetup from './GrailSetup'
import PromoterDashboard from './PromoterDashboard'
import JoinPage from './JoinPage'
import TermsPage from './TermsPage'
import EventPage from './EventPage'
import StripeReturn from './StripeReturn'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<GrailHome />} />
        <Route path="/ticket" element={<TicketPage />} />
        <Route path="/t/:ticketId" element={<TicketView />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/scan/:slug" element={<ScanPage />} />
        {/* Legacy /scan kept for old Nonlinear staff bookmarks */}
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/me" element={<ProfilePage />} />
        {/* GRAIL — promoter setup */}
        <Route path="/setup" element={<GrailSetup />} />
        {/* Promoter dashboard — auth gated */}
        <Route path="/promoter" element={<PromoterDashboard />} />
        {/* Unified join / onboarding flow */}
        <Route path="/join" element={<JoinPage />} />
        <Route path="/terms" element={<TermsPage />} />
        {/* Public event page */}
        <Route path="/e/:slug" element={<EventPage />} />
        {/* Stripe Connect return URL */}
        <Route path="/stripe/return" element={<StripeReturn />} />
        {/* GRAIL — customer-facing */}
        <Route path="/grail/bar"   element={<GrailBar />} />
        <Route path="/grail/doves" element={<GrailDoves />} />
        {/* GRAIL — admin */}
        <Route path="/grail/table" element={<GrailTable />} />
        <Route path="/grail/door"  element={<GrailDoor />} />
        <Route path="/grail/admin" element={<GrailAdmin />} />
        {/* Generic demo */}
        <Route path="/demo" element={<GrailDemo />} />
        {/* Partner demos */}
        <Route path="/alleycat" element={<AlleycatDemo />} />
        {/* Simple bar demo */}
        <Route path="/bar" element={<SimpleBar />} />
        {/* Multi-tenant event bar */}
        <Route path="/:slug/bar"       element={<EventBar staffMode={false} />} />
        <Route path="/:slug/bar/staff" element={<EventBar staffMode={true}  />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

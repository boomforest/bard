import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AuthApp from './AuthApp'
import TicketPage from './TicketPage'
import TicketView from './TicketView'
import AdminPage from './AdminPage'
import ScanPage from './ScanPage'
import ProfilePage from './ProfilePage'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<TicketPage />} />
        <Route path="/ticket" element={<TicketPage />} />
        <Route path="/t/:ticketId" element={<TicketView />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/scan" element={<ScanPage />} />
        <Route path="/me" element={<ProfilePage />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
)

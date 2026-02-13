import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Screener from './pages/Screener'
import Coins from './pages/Coins'
import DensityMap from './pages/DensityMap'
import SmartAlertsPage from './components/SmartAlertsPage'
import Listings from './pages/Listings'
import Formations from './pages/Formations'
import Profile from './pages/Profile'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Navigate to="/screener" replace />} />
        <Route path="/screener" element={<Screener />} />
        <Route path="/coins" element={<Coins />} />
        <Route path="/density" element={<DensityMap />} />
        <Route path="/smart-alerts" element={<SmartAlertsPage />} />
        <Route path="/listings" element={<Listings />} />
        <Route path="/formations" element={<Formations />} />
        <Route path="/profile" element={<Profile />} />
      </Routes>
    </Layout>
  )
}

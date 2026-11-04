import { Route, Routes } from 'react-router-dom'
import { Analytics } from '@vercel/analytics/react'
import { Dashboard } from '@/components/dashboard'
import { SectionPage } from './pages/section-page'

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="*" element={<SectionPage />} />
      </Routes>
      {import.meta.env.PROD && <Analytics />}
    </>
  )
}

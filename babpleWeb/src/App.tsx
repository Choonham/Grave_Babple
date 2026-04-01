import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import TestLinkPage from './pages/admin/TestLinkPage'
import LandingPage from './pages/LandingPage'
import SharePage from './pages/SharePage'
import TermsPage from './pages/TermsPage'
import ChildSafetyPage from './pages/ChildSafetyPage'
import TestApplicationPage from './pages/TestApplicationPage'
import AccountDeletionPage from './pages/AccountDeletionPage'
import AccountDeletionConfirmPage from './pages/AccountDeletionConfirmPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/share/:recipeId" element={<SharePage />} />
        <Route path="/terms/:type?" element={<TermsPage />} />
        <Route path="/child-safety" element={<ChildSafetyPage />} />
        <Route path="/test-application" element={<TestApplicationPage />} />
        <Route path="/account/delete" element={<AccountDeletionPage />} />
        <Route path="/account/delete/confirm" element={<AccountDeletionConfirmPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/test-link/:applicationId" element={<TestLinkPage />} />
        <Route path="/admin/*" element={<AdminDashboard />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


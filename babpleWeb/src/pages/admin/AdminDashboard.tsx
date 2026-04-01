import { useState, useEffect } from 'react'
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom'
import UsersPage from './UsersPage'
import RecipesPage from './RecipesPage'
import AdsPage from './AdsPage'
import './AdminDashboard.css'

const AdminDashboard = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const [activeTab, setActiveTab] = useState('users')

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (!token) {
      navigate('/admin/login')
      return
    }

    // 현재 경로에 따라 활성 탭 설정
    if (location.pathname.includes('/recipes')) {
      setActiveTab('recipes')
    } else if (location.pathname.includes('/ads')) {
      setActiveTab('ads')
    } else {
      setActiveTab('users')
    }
  }, [location.pathname, navigate])

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    navigate('/admin/login')
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-sidebar">
        <div className="admin-logo">
          <h2>Babple 관리자</h2>
        </div>
        <nav className="admin-nav">
          <Link
            to="/admin"
            className={`nav-item ${activeTab === 'users' ? 'active' : ''}`}
            onClick={() => setActiveTab('users')}
          >
            유저 관리
          </Link>
          <Link
            to="/admin/recipes"
            className={`nav-item ${activeTab === 'recipes' ? 'active' : ''}`}
            onClick={() => setActiveTab('recipes')}
          >
            게시글 관리
          </Link>
          <Link
            to="/admin/ads"
            className={`nav-item ${activeTab === 'ads' ? 'active' : ''}`}
            onClick={() => setActiveTab('ads')}
          >
            광고 관리
          </Link>
        </nav>
        <button className="logout-button" onClick={handleLogout}>
          로그아웃
        </button>
      </div>
      <div className="admin-content">
        <Routes>
          <Route path="/" element={<UsersPage />} />
          <Route path="/recipes" element={<RecipesPage />} />
          <Route path="/ads" element={<AdsPage />} />
        </Routes>
      </div>
    </div>
  )
}

export default AdminDashboard


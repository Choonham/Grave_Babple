import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import './ChildSafetyPage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const ChildSafetyPage = () => {
  const navigate = useNavigate()
  const [content, setContent] = useState<string>('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadContent()
  }, [])

  const loadContent = async () => {
    setLoading(true)
    setError('')
    try {
      const response = await fetch(`${API_BASE_URL}/docs/terms/child_safety_standards.md`)
      if (!response.ok) {
        throw new Error('문서를 불러올 수 없습니다.')
      }
      const text = await response.text()
      setContent(text)
    } catch (err: any) {
      console.error('문서 로드 오류:', err)
      setError(err.message || '문서를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="child-safety-page">
        <div className="child-safety-container">
          <div className="loading">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="child-safety-page">
        <div className="child-safety-container">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="back-button">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="child-safety-page">
      <div className="child-safety-container">
        <div className="child-safety-header">
          <button onClick={() => navigate('/')} className="back-button">
            ← 홈으로
          </button>
          <h1>아동 안전 표준 정책</h1>
          <p className="subtitle">Child Safety Standards Policy</p>
        </div>
        <div className="child-safety-content">
          <ReactMarkdown>{content}</ReactMarkdown>
        </div>
      </div>
    </div>
  )
}

export default ChildSafetyPage


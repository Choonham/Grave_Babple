import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import './TestApplicationPage.css'

const TestApplicationPage = () => {
  const navigate = useNavigate()
  const location = useLocation()
  const platform = (location.state?.platform as 'android' | 'ios') || 'android'

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'
      const response = await fetch(`${API_BASE_URL}/api/app/test-application`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          platform,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '테스트 신청 처리 중 오류가 발생했습니다.')
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트 신청 처리 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="test-application-page">
        <div className="test-application-container">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>신청이 완료되었습니다!</h2>
            <p>테스트 신청이 성공적으로 접수되었습니다.</p>
            <p>곧 연락드리겠습니다.</p>
            <p className="redirect-message">잠시 후 메인 페이지로 이동합니다...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="test-application-page">
      <div className="test-application-container">
        <div className="test-application-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 돌아가기
          </button>
          <h1>알파 테스트 신청</h1>
          <p className="subtitle">
            {platform === 'android' ? 'Android' : 'iOS'} 버전 테스트에 참여해주세요
          </p>
          <p className="subtitle">
            {platform === 'android' ? '반드시 구글 플레이스토어에 등록된 구글 계정을 입력해주세요.' : ''}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="test-application-form">
          <div className="form-group">
            <label htmlFor="name">이름 *</label>
            <input
              type="text"
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="이름을 입력해주세요"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="email">이메일 *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="이메일을 입력해주세요"
              required
              disabled={isSubmitting}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || !name.trim() || !email.trim()}
          >
            {isSubmitting ? '제출 중...' : '신청하기'}
          </button>
        </form>

        <div className="test-application-footer">
          <p>신청하신 정보는 테스트 안내 목적으로만 사용됩니다.</p>
        </div>
      </div>
    </div>
  )
}

export default TestApplicationPage


import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import './TestLinkPage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const TestLinkPage = () => {
  const { applicationId } = useParams<{ applicationId: string }>()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [application, setApplication] = useState<{
    application_id: string
    name: string
    email: string
    platform: 'android' | 'ios'
    test_link?: string
    link_sent: boolean
    created_at: string
  } | null>(null)
  const [testLink, setTestLink] = useState('')

  useEffect(() => {
    if (applicationId) {
      loadApplication()
    }
  }, [applicationId])

  const loadApplication = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/app/test-application/${applicationId}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '테스트 신청 정보를 불러올 수 없습니다.')
      }

      setApplication(data.data)
      setTestLink(data.data.test_link || '')
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트 신청 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!testLink.trim()) {
      setError('테스트 링크를 입력해주세요.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const response = await fetch(`${API_BASE_URL}/api/app/test-application/${applicationId}/send-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          test_link: testLink.trim(),
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '테스트 링크 전송 중 오류가 발생했습니다.')
      }

      setSuccess(true)
      setTimeout(() => {
        navigate('/')
      }, 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : '테스트 링크 전송 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="test-link-page">
        <div className="test-link-container">
          <div className="loading-message">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (error && !application) {
    return (
      <div className="test-link-page">
        <div className="test-link-container">
          <div className="error-message">{error}</div>
          <button className="back-button" onClick={() => navigate('/')}>
            돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="test-link-page">
        <div className="test-link-container">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>전송 완료!</h2>
            <p>테스트 링크가 성공적으로 전송되었습니다.</p>
            <p className="redirect-message">잠시 후 메인 페이지로 이동합니다...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!application) {
    return null
  }

  const platformName = application.platform === 'android' ? 'Android' : 'iOS'
  const formattedDate = new Date(application.created_at).toLocaleString('ko-KR')

  return (
    <div className="test-link-page">
      <div className="test-link-container">
        <div className="test-link-header">
          <h1>테스트 링크 입력</h1>
          <p className="subtitle">신청자에게 테스트 링크를 전송합니다</p>
        </div>

        <div className="application-info">
          <h3>신청자 정보</h3>
          <div className="info-row">
            <span className="info-label">이름:</span>
            <span className="info-value">{application.name}</span>
          </div>
          <div className="info-row">
            <span className="info-label">이메일:</span>
            <span className="info-value">{application.email}</span>
          </div>
          <div className="info-row">
            <span className="info-label">플랫폼:</span>
            <span className="info-value">{platformName}</span>
          </div>
          <div className="info-row">
            <span className="info-label">신청 일시:</span>
            <span className="info-value">{formattedDate}</span>
          </div>
          {application.link_sent && (
            <div className="info-row status-row">
              <span className="status-badge">✓ 링크 전송 완료</span>
              {application.test_link && (
                <a href={application.test_link} target="_blank" rel="noopener noreferrer" className="link-preview">
                  링크 확인
                </a>
              )}
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="test-link-form">
          <div className="form-group">
            <label htmlFor="test-link">
              {platformName} 테스트 링크 *
            </label>
            <input
              type="url"
              id="test-link"
              value={testLink}
              onChange={(e) => setTestLink(e.target.value)}
              placeholder={`${platformName === 'Android' ? 'Google Play' : 'TestFlight'} 또는 다운로드 링크를 입력하세요`}
              required
              disabled={submitting}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={submitting || !testLink.trim()}
          >
            {submitting ? '전송 중...' : application.link_sent ? '링크 재전송' : '링크 전송'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default TestLinkPage


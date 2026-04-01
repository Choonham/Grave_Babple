import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './AccountDeletionPage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const AccountDeletionPage = () => {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setIsSubmitting(true)

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/delete/request-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '회원 탈퇴 링크 요청 중 오류가 발생했습니다.')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 탈퇴 링크 요청 중 오류가 발생했습니다.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (success) {
    return (
      <div className="account-deletion-page">
        <div className="account-deletion-container">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>이메일이 발송되었습니다</h2>
            <p>회원 탈퇴 링크가 이메일로 발송되었습니다.</p>
            <p>이메일을 확인하여 탈퇴를 완료해주세요.</p>
            <div className="notice-box">
              <p><strong>안내사항:</strong></p>
              <ul>
                <li>링크는 24시간 동안만 유효합니다.</li>
                <li>링크를 클릭하면 즉시 회원 탈퇴가 처리됩니다.</li>
                <li>탈퇴 후 90일간 계정 복구가 가능합니다.</li>
              </ul>
            </div>
            <button className="back-button" onClick={() => navigate('/')}>
              메인으로 돌아가기
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="account-deletion-page">
      <div className="account-deletion-container">
        <div className="account-deletion-header">
          <button className="back-button" onClick={() => navigate('/')}>
            ← 돌아가기
          </button>
          <h1>회원 탈퇴</h1>
          <p className="subtitle">계정을 탈퇴하려면 아래 정보를 입력해주세요</p>
        </div>

        <div className="warning-box">
          <p><strong>⚠️ 탈퇴 전 확인사항</strong></p>
          <ul>
            <li>탈퇴 후 90일간 계정 복구가 가능합니다.</li>
            <li>90일 후에는 모든 데이터가 영구적으로 삭제됩니다.</li>
            <li>작성한 레시피, 댓글, 좋아요 등 모든 활동 내역이 삭제됩니다.</li>
            <li>이 작업은 되돌릴 수 없습니다.</li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="account-deletion-form">
          <div className="form-group">
            <label htmlFor="email">이메일 *</label>
            <input
              type="email"
              id="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="가입하신 이메일을 입력해주세요"
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">비밀번호 *</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호를 입력해주세요"
              required
              disabled={isSubmitting}
            />
          </div>

          {error && <div className="error-message">{error}</div>}

          <button
            type="submit"
            className="submit-button"
            disabled={isSubmitting || !email.trim() || !password}
          >
            {isSubmitting ? '처리 중...' : '탈퇴 링크 발송'}
          </button>
        </form>

        <div className="account-deletion-footer">
          <p>소셜 계정으로 가입하신 경우 앱에서 탈퇴할 수 있습니다.</p>
        </div>
      </div>
    </div>
  )
}

export default AccountDeletionPage


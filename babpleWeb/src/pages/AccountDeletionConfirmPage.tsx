import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import './AccountDeletionConfirmPage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const AccountDeletionConfirmPage = () => {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token')

  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)
  const [userInfo, setUserInfo] = useState<{
    email: string
    nickname: string
  } | null>(null)

  useEffect(() => {
    if (token) {
      verifyToken()
    } else {
      setError('유효하지 않은 링크입니다.')
      setLoading(false)
    }
  }, [token])

  const verifyToken = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_BASE_URL}/api/auth/delete/verify-token?token=${token}`)
      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '유효하지 않은 링크입니다.')
      }

      setUserInfo(data.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : '링크 검증 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleConfirm = async () => {
    if (!token) {
      setError('유효하지 않은 링크입니다.')
      return
    }

    try {
      setSubmitting(true)
      setError('')

      const response = await fetch(`${API_BASE_URL}/api/auth/delete/confirm`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.success) {
        throw new Error(data.message || '회원 탈퇴 처리 중 오류가 발생했습니다.')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : '회원 탈퇴 처리 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="account-deletion-confirm-page">
        <div className="account-deletion-confirm-container">
          <div className="loading-message">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (error && !userInfo) {
    return (
      <div className="account-deletion-confirm-page">
        <div className="account-deletion-confirm-container">
          <div className="error-message-large">
            <div className="error-icon">✕</div>
            <h2>오류</h2>
            <p>{error}</p>
            <button className="back-button" onClick={() => navigate('/account/delete')}>
              다시 시도하기
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="account-deletion-confirm-page">
        <div className="account-deletion-confirm-container">
          <div className="success-message">
            <div className="success-icon">✓</div>
            <h2>회원 탈퇴가 완료되었습니다</h2>
            <p>회원 탈퇴가 성공적으로 처리되었습니다.</p>
            <div className="notice-box">
              <p><strong>안내사항:</strong></p>
              <ul>
                <li>90일간 계정 복구가 가능합니다.</li>
                <li>90일 후에는 모든 데이터가 영구적으로 삭제됩니다.</li>
                <li>계정 복구를 원하시면 고객센터로 문의해주세요.</li>
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
    <div className="account-deletion-confirm-page">
      <div className="account-deletion-confirm-container">
        <div className="account-deletion-confirm-header">
          <h1>회원 탈퇴 확인</h1>
          <p className="subtitle">정말 탈퇴하시겠습니까?</p>
        </div>

        {userInfo && (
          <div className="user-info-box">
            <p><strong>계정 정보</strong></p>
            <p>이메일: {userInfo.email}</p>
            {userInfo.nickname && <p>닉네임: {userInfo.nickname}</p>}
          </div>
        )}

        <div className="warning-box">
          <p><strong>⚠️ 최종 확인</strong></p>
          <ul>
            <li>탈퇴 후 즉시 계정이 비활성화됩니다.</li>
            <li>90일간 계정 복구가 가능합니다.</li>
            <li>90일 후 모든 데이터가 영구적으로 삭제됩니다.</li>
            <li>작성한 레시피, 댓글, 좋아요 등 모든 활동 내역이 삭제됩니다.</li>
            <li>이 작업은 되돌릴 수 없습니다.</li>
          </ul>
        </div>

        {error && <div className="error-message">{error}</div>}

        <div className="button-group">
          <button
            className="cancel-button"
            onClick={() => navigate('/')}
            disabled={submitting}
          >
            취소
          </button>
          <button
            className="confirm-button"
            onClick={handleConfirm}
            disabled={submitting}
          >
            {submitting ? '처리 중...' : '탈퇴하기'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default AccountDeletionConfirmPage


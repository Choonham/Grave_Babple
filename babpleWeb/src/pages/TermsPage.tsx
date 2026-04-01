import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import ReactMarkdown from 'react-markdown'
import { AuthAPI, TermPolicy } from '../api/auth'
import './TermsPage.css'

const TermsPage = () => {
  const { type } = useParams<{ type?: string }>()
  const navigate = useNavigate()
  const [terms, setTerms] = useState<TermPolicy[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTerm, setSelectedTerm] = useState<TermPolicy | null>(null)
  const [error, setError] = useState<string>('')

  useEffect(() => {
    loadTerms()
  }, [type])

  const loadTerms = async () => {
    setLoading(true)
    setError('')
    try {
      // type 파라미터에 따라 약관 타입 결정
      let types: number[] | undefined
      if (type === 'business') {
        types = [0, 1] // 일반 + 비즈니스
      } else {
        types = [0] // 일반만
      }

      const response = await AuthAPI.getTermsPolicies(types)
      if (response.success && response.data) {
        setTerms(response.data)
        // 첫 번째 약관을 기본 선택
        if (response.data.length > 0) {
          setSelectedTerm(response.data[0])
        }
      } else {
        setError('약관 정보를 불러올 수 없습니다.')
      }
    } catch (err: any) {
      console.error('약관 로드 오류:', err)
      setError(err.response?.data?.message || '약관 정보를 불러오는 중 오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="terms-page">
        <div className="terms-container">
          <div className="loading">로딩 중...</div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="terms-page">
        <div className="terms-container">
          <div className="error-message">{error}</div>
          <button onClick={() => navigate('/')} className="back-button">
            홈으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="terms-page">
      <div className="terms-container">
        <div className="terms-sidebar">
          <h2>약관 및 정책</h2>
          <ul className="terms-list">
            {terms.map((term) => (
              <li
                key={term.id}
                className={`terms-list-item ${selectedTerm?.id === term.id ? 'active' : ''}`}
                onClick={() => setSelectedTerm(term)}
              >
                <span className="term-title">{term.title}</span>
                {term.required && <span className="required-badge">필수</span>}
              </li>
            ))}
          </ul>
        </div>

        <div className="terms-content">
          {selectedTerm ? (
            <>
              <div className="terms-header">
                <h1>{selectedTerm.title}</h1>
                {selectedTerm.required && <span className="required-badge">필수</span>}
              </div>
              <div className="terms-markdown">
                <ReactMarkdown>{selectedTerm.content}</ReactMarkdown>
              </div>
            </>
          ) : (
            <div className="no-term-selected">약관을 선택해주세요.</div>
          )}
        </div>
      </div>
    </div>
  )
}

export default TermsPage


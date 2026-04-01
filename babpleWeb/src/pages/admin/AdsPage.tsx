import { useState, useEffect } from 'react'
import { AdminAPI, AdminAd } from '../../api/admin'
import './AdsPage.css'

const AdsPage = () => {
  const [ads, setAds] = useState<AdminAd[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    loadAds()
  }, [page, statusFilter])

  const loadAds = async () => {
    setLoading(true)
    try {
      const response = await AdminAPI.getAds(page, limit, statusFilter || undefined)
      if (response.success) {
        setAds(response.data?.ads || [])
        setTotal(response.data?.total || 0)
      }
    } catch (error) {
      console.error('광고 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleApprove = async (campaignId: string) => {
    if (!confirm('이 광고 캠페인을 승인하시겠습니까?')) return

    try {
      const response = await AdminAPI.approveAd(campaignId)
      if (response.success) {
        alert('광고 캠페인이 승인되었습니다.')
        loadAds()
      } else {
        alert(response.message || '승인 처리에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '승인 처리 중 오류가 발생했습니다.')
    }
  }

  const handleReject = async (campaignId: string) => {
    const reason = prompt('거부 사유를 입력하세요:')
    if (!reason) return

    try {
      const response = await AdminAPI.rejectAd(campaignId, reason)
      if (response.success) {
        alert('광고 캠페인이 거부되었습니다.')
        loadAds()
      } else {
        alert(response.message || '거부 처리에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '거부 처리 중 오류가 발생했습니다.')
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'approved'
      case 'PAUSED':
        return 'rejected'
      case 'PENDING':
        return 'pending'
      default:
        return 'active'
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '활성'
      case 'PAUSED':
        return '일시정지'
      case 'PENDING':
        return '대기중'
      default:
        return status
    }
  }

  return (
    <div className="ads-page">
      <div className="page-header">
        <h1>광고 관리</h1>
        <div className="filter-box">
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value)
              setPage(1)
            }}
          >
            <option value="">전체</option>
            <option value="PENDING">대기중</option>
            <option value="ACTIVE">활성</option>
            <option value="PAUSED">일시정지</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="ads-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>캠페인명</th>
                  <th>광고주</th>
                  <th>예산</th>
                  <th>CPI</th>
                  <th>상태</th>
                  <th>노출수</th>
                  <th>클릭수</th>
                  <th>등록일</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {ads.map((ad) => (
                  <tr key={ad.campaign_id}>
                    <td>{ad.campaign_id.substring(0, 8)}...</td>
                    <td className="title-cell">{ad.campaign_name}</td>
                    <td>{ad.advertiser.biz_name}</td>
                    <td>{Number(ad.total_budget).toLocaleString()}원</td>
                    <td>{Number(ad.cpi).toLocaleString()}원</td>
                    <td>
                      <span className={`status-badge ${getStatusBadgeClass(ad.status)}`}>
                        {getStatusText(ad.status)}
                      </span>
                    </td>
                    <td>{ad.view_count}</td>
                    <td>{ad.click_count}</td>
                    <td>{new Date(ad.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <div className="action-buttons">
                        {ad.status === 'PENDING' && (
                          <>
                            <button
                              onClick={() => handleApprove(ad.campaign_id)}
                              className="btn-approve"
                            >
                              승인
                            </button>
                            <button
                              onClick={() => handleReject(ad.campaign_id)}
                              className="btn-reject"
                            >
                              거부
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
            >
              이전
            </button>
            <span>
              {page} / {Math.ceil(total / limit)}
            </span>
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= Math.ceil(total / limit)}
            >
              다음
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export default AdsPage


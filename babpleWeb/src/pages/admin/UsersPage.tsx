import { useState, useEffect } from 'react'
import { AdminAPI, AdminUser } from '../../api/admin'
import './UsersPage.css'

const UsersPage = () => {
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    loadUsers()
  }, [page, keyword])

  const loadUsers = async () => {
    setLoading(true)
    try {
      const response = await AdminAPI.getUsers(page, limit, keyword || undefined)
      if (response.success) {
        setUsers(response.data?.users || [])
        setTotal(response.data?.total || 0)
      }
    } catch (error) {
      console.error('유저 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleBan = async (userId: string) => {
    const reason = prompt('제재 사유를 입력하세요:')
    if (!reason) return

    try {
      const response = await AdminAPI.banUser(userId, reason)
      if (response.success) {
        alert('유저가 제재되었습니다.')
        loadUsers()
      } else {
        alert(response.message || '제재 처리에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '제재 처리 중 오류가 발생했습니다.')
    }
  }

  const handleUnban = async (userId: string) => {
    if (!confirm('제재를 해제하시겠습니까?')) return

    try {
      const response = await AdminAPI.unbanUser(userId)
      if (response.success) {
        alert('제재가 해제되었습니다.')
        loadUsers()
      } else {
        alert(response.message || '제재 해제에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '제재 해제 중 오류가 발생했습니다.')
    }
  }

  const handleStatusChange = async (userId: string, currentStatus: string) => {
    // 대기중(PENDING) <-> 활성(ACTIVE) 토글만 가능
    const newStatus = currentStatus === 'PENDING' ? 'ACTIVE' : 'PENDING'

    if (!confirm(`유저 상태를 ${getStatusText(newStatus)}로 변경하시겠습니까?`)) return

    try {
      const response = await AdminAPI.updateUserStatus(userId, newStatus as 'ACTIVE' | 'PENDING' | 'SUSPENDED')
      if (response.success) {
        alert(`유저 상태가 ${getStatusText(newStatus)}로 변경되었습니다.`)
        loadUsers()
      } else {
        alert(response.message || '상태 변경에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '상태 변경 중 오류가 발생했습니다.')
    }
  }

  const getStatusText = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return '활성'
      case 'PENDING':
        return '대기중'
      case 'SUSPENDED':
        return '정지됨'
      default:
        return status
    }
  }

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ACTIVE':
        return 'active'
      case 'PENDING':
        return 'pending'
      case 'SUSPENDED':
        return 'suspended'
      default:
        return 'active'
    }
  }

  return (
    <div className="users-page">
      <div className="page-header">
        <h1>유저 관리</h1>
        <div className="search-box">
          <input
            type="text"
            placeholder="닉네임 또는 이메일 검색..."
            value={keyword}
            onChange={(e) => {
              setKeyword(e.target.value)
              setPage(1)
            }}
          />
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : (
        <>
          <div className="table-container">
            <table className="users-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>닉네임</th>
                  <th>이메일</th>
                  <th>계정 유형</th>
                  <th>역할</th>
                  <th>가입일</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.user_id}>
                    <td>{user.user_id.substring(0, 8)}...</td>
                    <td>{user.nickname}</td>
                    <td>{user.email}</td>
                    <td>{user.account_type || '-'}</td>
                    <td>{user.role}</td>
                    <td>{new Date(user.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {user.delete_yn ? (
                          <span className="status-badge deleted">삭제됨</span>
                        ) : (
                          <button
                            onClick={() => handleStatusChange(user.user_id, user.status || 'ACTIVE')}
                            className={`btn-status ${getStatusBadgeClass(user.status || 'ACTIVE')}`}
                            style={{ fontSize: '11px', padding: '4px 8px' }}
                          >
                            {getStatusText(user.status || 'ACTIVE')}
                          </button>
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="action-buttons">
                        {user.delete_yn ? (
                          <button onClick={() => handleUnban(user.user_id)} className="btn-unban">
                            복구
                          </button>
                        ) : (
                          <button onClick={() => handleBan(user.user_id)} className="btn-ban">
                            제재
                          </button>
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

export default UsersPage


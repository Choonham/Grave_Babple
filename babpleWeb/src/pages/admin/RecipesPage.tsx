import { useState, useEffect } from 'react'
import { AdminAPI, AdminRecipe } from '../../api/admin'
import './RecipesPage.css'

const RecipesPage = () => {
  const [recipes, setRecipes] = useState<AdminRecipe[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [keyword, setKeyword] = useState('')
  const [total, setTotal] = useState(0)
  const limit = 20

  useEffect(() => {
    loadRecipes()
  }, [page, keyword])

  const loadRecipes = async () => {
    setLoading(true)
    try {
      const response = await AdminAPI.getRecipes(page, limit, keyword || undefined)
      if (response.success) {
        setRecipes(response.data?.recipes || [])
        setTotal(response.data?.total || 0)
      }
    } catch (error) {
      console.error('게시글 목록 로드 실패:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (recipeId: string) => {
    if (!confirm('이 게시글을 삭제하시겠습니까?')) return

    try {
      const response = await AdminAPI.deleteRecipe(recipeId)
      if (response.success) {
        alert('게시글이 삭제되었습니다.')
        loadRecipes()
      } else {
        alert(response.message || '삭제에 실패했습니다.')
      }
    } catch (error: any) {
      alert(error.response?.data?.message || '삭제 중 오류가 발생했습니다.')
    }
  }

  return (
    <div className="recipes-page">
      <div className="page-header">
        <h1>게시글 관리</h1>
        <div className="search-box">
          <input
            type="text"
            placeholder="제목 또는 작성자 검색..."
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
            <table className="recipes-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>제목</th>
                  <th>작성자</th>
                  <th>좋아요</th>
                  <th>댓글</th>
                  <th>작성일</th>
                  <th>상태</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {recipes.map((recipe) => (
                  <tr key={recipe.recipe_post_id}>
                    <td>{recipe.recipe_post_id.substring(0, 8)}...</td>
                    <td className="title-cell">{recipe.title}</td>
                    <td>{recipe.user.nickname}</td>
                    <td>{recipe.like_count}</td>
                    <td>{recipe.comment_count}</td>
                    <td>{new Date(recipe.created_at).toLocaleDateString('ko-KR')}</td>
                    <td>
                      <span className={`status-badge ${recipe.delete_yn ? 'deleted' : 'active'}`}>
                        {recipe.delete_yn ? '삭제됨' : '활성'}
                      </span>
                    </td>
                    <td>
                      <button
                        onClick={() => handleDelete(recipe.recipe_post_id)}
                        className="btn-delete"
                        disabled={recipe.delete_yn}
                      >
                        삭제
                      </button>
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

export default RecipesPage


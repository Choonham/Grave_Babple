import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { PublicAPI } from '../api/public'
import './SharePage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

const buildImageUrl = (path?: string | null) => {
  if (!path) return null
  if (path.startsWith('http')) return path
  const normalized = path.startsWith('/uploads') ? path : `/uploads/${path}`
  return `${API_BASE_URL}${normalized}`
}

interface RecipeData {
  recipe_post_id: string
  title: string
  description?: string
  user: {
    user_id: string
    nickname: string
    profile_image_url?: string | null
  }
  recipe_images?: Array<{ image_url: string }>
  images?: string[]
  ingredients: Array<{
    ingredient_id: string
    name: string
    quantity: string
    unit: string
  }>
  recipe_steps?: Array<{
    instruction: string
    image_url?: string
    video_url?: string
  }>
  steps?: Array<{
    description: string
    imageUrl?: string
    videoUrl?: string
  }>
  like_count: number
  comment_count: number
  created_at: string
}

const SharePage = () => {
  const { recipeId } = useParams<{ recipeId: string }>()
  const [recipe, setRecipe] = useState<RecipeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipe' | 'comments'>('ingredients')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!recipeId) {
      setError('레시피 ID가 필요합니다.')
      setLoading(false)
      return
    }

    const loadRecipe = async () => {
      try {
        const response = await PublicAPI.getRecipeForShare(recipeId)
        if (response.success && response.data) {
          setRecipe(response.data)
        } else {
          setError(response.message || '레시피를 불러올 수 없습니다.')
        }
      } catch (err: any) {
        setError(err.response?.data?.message || '레시피를 불러오는 중 오류가 발생했습니다.')
      } finally {
        setLoading(false)
      }
    }

    loadRecipe()
  }, [recipeId])

  if (loading) {
    return (
      <div className="share-page">
        <div className="loading">로딩 중...</div>
      </div>
    )
  }

  if (error || !recipe) {
    return (
      <div className="share-page">
        <div className="error-message">{error || '레시피를 찾을 수 없습니다.'}</div>
      </div>
    )
  }

  const recipeImages = recipe.recipe_images?.map(img => buildImageUrl(img.image_url)) || 
                       recipe.images?.map(img => buildImageUrl(img)) || []
  const mainImage = recipeImages[0]

  const ingredients = recipe.ingredients || []
  const steps = recipe.recipe_steps?.map(step => ({
    description: step.instruction || '',
    imageUrl: step.image_url ? buildImageUrl(step.image_url) : undefined,
    videoUrl: step.video_url ? buildImageUrl(step.video_url) : undefined,
  })) || recipe.steps || []

  return (
    <div className="share-page">
      <header className="share-header">
        <div className="share-header-content">
          <h1 className="share-logo">Babple</h1>
          <a href="/" className="share-home-link">홈으로</a>
        </div>
      </header>

      <main className="share-main">
        <div className="share-container">
          {/* 이미지 섹션 */}
          {mainImage && (
            <div className="share-image-section">
              <img src={mainImage} alt={recipe.title} className="share-main-image" />
            </div>
          )}

          {/* 작성자 정보 */}
          <div className="share-author">
            <div className="share-author-avatar">
              {recipe.user.profile_image_url ? (
                <img src={buildImageUrl(recipe.user.profile_image_url) || ''} alt={recipe.user.nickname} />
              ) : (
                <div className="avatar-placeholder">👤</div>
              )}
            </div>
            <span className="share-author-name">{recipe.user.nickname}</span>
          </div>

          {/* 제목 및 설명 */}
          <h2 className="share-title">{recipe.title}</h2>
          {recipe.description && (
            <p className="share-description">{recipe.description}</p>
          )}

          {/* 좋아요/댓글 수 */}
          <div className="share-stats">
            <span>❤️ {recipe.like_count}</span>
            <span>💬 {recipe.comment_count}</span>
          </div>

          {/* 탭 */}
          <div className="share-tabs">
            <button
              className={`share-tab ${activeTab === 'ingredients' ? 'active' : ''}`}
              onClick={() => setActiveTab('ingredients')}
            >
              재료
            </button>
            <button
              className={`share-tab ${activeTab === 'recipe' ? 'active' : ''}`}
              onClick={() => setActiveTab('recipe')}
            >
              레시피
            </button>
            <button
              className={`share-tab ${activeTab === 'comments' ? 'active' : ''}`}
              onClick={() => setActiveTab('comments')}
            >
              댓글
            </button>
          </div>

          {/* 탭 컨텐츠 */}
          <div className="share-content">
            {activeTab === 'ingredients' && (
              <div className="share-section">
                <h3 className="share-section-title">필요한 재료</h3>
                <div className="share-ingredients">
                  {ingredients.map((ing, idx) => (
                    <div key={idx} className="share-ingredient-item">
                      <span className="ingredient-name">{ing.name}</span>
                      <span className="ingredient-amount">
                        {ing.quantity} {ing.unit}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === 'recipe' && (
              <div className="share-section">
                {steps.map((step, idx) => (
                  <div key={idx} className="share-step">
                    <h4 className="share-step-title">Step {idx + 1}</h4>
                    <p className="share-step-description">{step.description}</p>
                    {step.imageUrl && (
                      <img src={step.imageUrl} alt={`Step ${idx + 1}`} className="share-step-image" />
                    )}
                    {step.videoUrl && (
                      <video src={step.videoUrl} controls className="share-step-video" />
                    )}
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'comments' && (
              <div className="share-section">
                <p className="share-comments-note">
                  댓글을 보려면 Babple 앱을 다운로드하세요.
                </p>
                <div className="share-download-cta">
                  <a href="/#test-application" className="share-download-btn">테스트 신청</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="share-footer">
        <p>Babple에서 더 많은 레시피를 만나보세요</p>
        <a href="/#test-application" className="share-footer-link">테스트 신청</a>
      </footer>
    </div>
  )
}

export default SharePage


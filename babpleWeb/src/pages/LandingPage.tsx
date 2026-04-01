import { useState, useEffect, useRef } from 'react'
import './LandingPage.css'

const LandingPage = () => {
  const [images, setImages] = useState<string[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isLoading, setIsLoading] = useState(true)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  
  // 드래그/스와이프 관련 상태
  const [isDragging, setIsDragging] = useState(false)
  const [startPos, setStartPos] = useState(0)
  const [currentTranslate, setCurrentTranslate] = useState(0)
  const animationRef = useRef<number | null>(null)
  
  // 첫 사용자 인터랙션 확인 (안내 메시지 표시용)
  const [hasInteracted, setHasInteracted] = useState(false)

  useEffect(() => {
    // 이미지 목록 로드
    const loadImages = async () => {
      setIsLoading(true)

      // 이미지 파일 위치:
      // - 개발 환경: babpleWeb/public/introImages/intro1.png
      // - 빌드 환경: 동일하게 public/introImages/ 사용 (빌드 시 dist/introImages/로 복사됨)
      // - 경로: /introImages/intro1.png (public 폴더는 루트 경로에서 제공)
      const loadedImages: string[] = []
      const imageExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp']
      const maxImages = 20 // 최대 20개까지 확인

      // 이미지 존재 여부 확인 함수
      const checkImageExists = (path: string): Promise<boolean> => {
        return new Promise((resolve) => {
          const img = new Image()
          let resolved = false

          img.onload = () => {
            if (!resolved) {
              resolved = true
              resolve(true)
            }
          }

          img.onerror = () => {
            if (!resolved) {
              resolved = true
              resolve(false)
            }
          }

          img.src = path

          // 300ms 타임아웃
          setTimeout(() => {
            if (!resolved) {
              resolved = true
              resolve(false)
            }
          }, 300)
        })
      }

      // 순차적으로 이미지 확인 (첫 번째로 찾은 확장자 사용)
      // 파일명 패턴: intro1.png, intro2.gif, intro3.png 등
      for (let i = 1; i <= maxImages; i++) {
        let found = false
        for (const ext of imageExtensions) {
          // public 폴더 기준 경로 (Vite에서는 public 폴더가 루트에서 제공됨)
          const imagePath = `/introImages/intro${i}.${ext}`
          const exists = await checkImageExists(imagePath)
          if (exists) {
            loadedImages.push(imagePath)
            found = true
            break
          }
        }
        // 연속으로 3개가 없으면 중단 (빈 구간 없이)
        if (!found && i > 3) {
          let emptyCount = 0
          for (let j = i - 1; j >= Math.max(1, i - 3); j--) {
            const hasImage = loadedImages.some(img => img.includes(`intro${j}.`))
            if (!hasImage) emptyCount++
          }
          if (emptyCount >= 3) break
        }
      }

      if (loadedImages.length > 0) {
        setImages(loadedImages)
      }
      setIsLoading(false)
    }

    loadImages()
  }, [])

  // 자동 슬라이드
  useEffect(() => {
    if (images.length === 0) return

    const startAutoPlay = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      intervalRef.current = setInterval(() => {
        if (!isDragging) {
          setCurrentIndex((prev) => (prev + 1) % images.length)
        }
      }, 5000)
    }

    startAutoPlay()

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [images.length, isDragging])

  // 터치/마우스 이벤트 핸들러
  const getPositionX = (event: React.MouseEvent | React.TouchEvent | MouseEvent | TouchEvent) => {
    return 'touches' in event ? event.touches[0].clientX : (event as React.MouseEvent).clientX
  }

  // 참고: 실제 드래그/스와이프 기능은 아래 handleDragStart, handleDragMove, handleDragEnd에서 구현됨

  // --- 슬라이더 로직 재구현 ---
  
  // 마우스/터치 시작
  const handleDragStart = (e: React.MouseEvent | React.TouchEvent) => {
    setHasInteracted(true)
    setIsDragging(true)
    setStartPos(getPositionX(e))
    
    // 자동 재생 일시 중지
    if (intervalRef.current) clearInterval(intervalRef.current)
  }
  
  // 마우스/터치 이동
  const handleDragMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return
    const currentPosition = getPositionX(e)
    const diff = currentPosition - startPos
    setCurrentTranslate(diff)
  }
  
  // 마우스/터치 종료
  const handleDragEnd = () => {
    setIsDragging(false)
    const movedBy = currentTranslate
    
    // 100px 이상 움직였으면 슬라이드 이동
    if (movedBy < -100 && currentIndex < images.length - 1) {
      setCurrentIndex(currentIndex + 1)
    } else if (movedBy > 100 && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1)
    } else if (movedBy < -100 && currentIndex === images.length - 1) {
      // 마지막에서 오른쪽으로 (처음으로?)
      // 여기선 루프 안함, 그냥 제자리로
      // setCurrentIndex(0) // 루프 원하면 주석 해제
    }
    
    setCurrentTranslate(0)
    
    // 자동 재생 재개 (useEffect에서 isDragging 의존성으로 처리됨)
  }
  
  // 마우스가 영역을 벗어났을 때
  const handleMouseLeave = () => {
    if (isDragging) handleDragEnd()
  }

  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="container">
          <div className="header-content">
            <h1 className="logo">Babple</h1>
            <nav className="header-nav">
              <a href="#features">기능</a>
              <a href="#about">소개</a>
              <a href="#test-application">테스트 신청</a>
            </nav>
          </div>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-content">
              <h2 className="hero-title">맛있는 집밥 레시피를<br />이웃과 함께 나눠요</h2>
              <p className="hero-subtitle">
                Babple은 동네 이웃들과 집밥 레시피를 공유하고<br />
                맛있는 우리집 집밥을 함께 만들어가는 커뮤니티입니다.
              </p>
            </div>
            <div className="hero-image">
              <div className="phone-mockup">
                <div className="phone-screen">
                  <div className="mockup-content">
                    {images.length > 0 ? (
                      <>
                        <div 
                          className="image-slider"
                          onMouseDown={handleDragStart}
                          onTouchStart={handleDragStart}
                          onMouseMove={handleDragMove}
                          onTouchMove={handleDragMove}
                          onMouseUp={handleDragEnd}
                          onTouchEnd={handleDragEnd}
                          onMouseLeave={handleMouseLeave}
                        >
                          <div 
                            className="image-slider-track"
                            style={{
                              transform: `translateX(calc(-${currentIndex * 100}% + ${currentTranslate}px))`,
                              transition: isDragging ? 'none' : 'transform 0.3s ease-out'
                            }}
                          >
                            {images.map((imagePath, index) => {
                              const isIcon = imagePath.includes('intro1.')
                              return (
                                <div
                                  key={index}
                                  className={`slider-image-wrapper ${isIcon ? 'icon-image' : ''}`}
                                >
                                  <img
                                    src={imagePath}
                                    alt={`소개 이미지 ${index + 1}`}
                                    className={`slider-image ${isIcon ? 'icon-size' : ''}`}
                                    draggable={false}
                                  />
                                </div>
                              )
                            })}
                          </div>
                        </div>
                        
                        {/* 인디케이터 (점) */}
                        <div className="slider-indicators">
                          {images.map((_, index) => (
                            <div 
                              key={index}
                              className={`indicator-dot ${index === currentIndex ? 'active' : ''}`}
                            />
                          ))}
                        </div>

                        {/* 스와이프 안내 (처음 1회만 표시) */}
                        {!hasInteracted && (
                          <div className="swipe-guide">
                            <span className="swipe-hand-icon">👆</span>
                            <span>밀어서 넘겨보세요</span>
                          </div>
                        )}
                      </>
                    ) : !isLoading ? (
                      <div className="mockup-feed">
                        <div className="mockup-post"></div>
                        <div className="mockup-post"></div>
                        <div className="mockup-post"></div>
                      </div>
                    ) : (
                      <div className="loading-placeholder">이미지 로딩 중...</div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="test-application" className="download">
          <div className="container">
            <h2 className="section-title">알파 테스트</h2>
            <p className="download-subtitle">귀한 시간 내어 주셔서 감사합니다. <br/> 아래 버튼을 클릭하여 바로 테스트를 시작하세요!</p>
            <div className="download-buttons">
              <button 
                className="download-btn ios"
                onClick={() => window.open('https://testflight.apple.com/join/Fuac52T3', '_blank')}
              >
                <span>iOS 테스트 시작</span>
              </button>
              <button 
                className="download-btn android"
                onClick={() => window.open('https://play.google.com/store/apps/details?id=com.babpleapp', '_blank')}
              >
                <span>Android 테스트 시작</span>
              </button>
            </div>
          </div>
        </section>

        <section id="features" className="features">
          <div className="container">
            <h2 className="section-title">주요 기능</h2>
            <div className="features-grid">
              <div className="feature-card">
                <div className="feature-icon">🍳</div>
                <h3>레시피 공유</h3>
                <p>집에서 만든 맛있는 요리 레시피를 사진과 함께 공유하세요.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">👥</div>
                <h3>이웃 커뮤니티</h3>
                <p>동네 이웃들과 레시피를 공유하고 요리 팁을 나눠요.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🏪</div>
                <h3>동네 마트 정보</h3>
                <p>가까운 동네 마트의 기획 상품과 전단지를 확인하세요.</p>
              </div>
              <div className="feature-card">
                <div className="feature-icon">🗺️</div>
                <h3>지도 기반 탐색</h3>
                <p>내 주변의 맛있는 레시피를 지도에서 쉽게 찾아보세요.</p>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="about">
          <div className="container">
            <h2 className="section-title">Babple이란?</h2>
            <div className="about-content">
              <p>
                Babple은 "맛있는 집밥"을 의미하는 "밥"과 "사람들"을 의미하는 "People"의 합성어로, <br/>
                "지금 우리 아파트에 퍼지는 이 맛있는 냄새는 뭐지?" 라는 질문에서 시작한 집밥 공유 플랫폼입니다.
              </p>
              <p className="about-p-bold">
                "레시피 업로드는 매우 쉽고 빠르게! 핵심만!"
              </p>
              <p>
                AI 쉐프가 요리를 직접 맛보고, 레시피를 분석해줘요! <br/>
                본인 스타일로 수정만 하고 업로드하면 끝! <br/>
                우리 동네 주부 9단의 맛있는 집밥 레시피를 배울 수 있고, 나만의 비장의 요리를 우리 동네 사람들에게 자랑할 수 있습니다!
              </p>
              <p>
                레시피 공유부터 동네 마트 정보, 지도 기반 탐색까지. Babple과 함께 더 맛있는 집밥을 만들어보세요.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-company-info">
              <p className="footer-copyright">&copy; 2025 Babple. All rights reserved.</p>
              <div className="footer-company-details">
                <p>사업자 등록 번호: 713-08-03171</p>
                <p>주소: 인천광역시 남동구 남동서로 236번길 30, 222-A149호</p>
                <p>대표: 노영준</p>
              </div>
            </div>
            <div className="footer-links">
              <a href="/terms">이용약관</a>
              <a href="/child-safety">아동 안전 표준 정책</a>
              <a href="/privacy">개인정보처리방침</a>
              <a href="mailto:babple.biz@slowflowsoft.com">Contact Us</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default LandingPage

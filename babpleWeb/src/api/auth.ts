import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

// 약관 API는 인증이 필요 없으므로 별도의 클라이언트 사용
const publicApiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

export interface TermPolicy {
  id: number
  title: string
  content: string
  required: boolean
}

export const AuthAPI = {
  /**
   * 약관 정책 조회
   * GET /api/auth/terms/policies?type=0 또는 ?type=0,1
   * @param types 약관 타입 배열 (0: 일반, 1: 비즈니스). 없으면 모든 약관 반환
   */
  getTermsPolicies: async (types?: number[]): Promise<{success: boolean; data: TermPolicy[]}> => {
    const params = types && types.length > 0 ? {type: types.join(',')} : {}
    const response = await publicApiClient.get('/auth/terms/policies', {params})
    return response.data
  },
}


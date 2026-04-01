import apiClient from './client'

export interface AdminUser {
  user_id: string
  email: string
  nickname: string
  profile_image_url?: string | null
  role: string
  account_type?: string | null
  status?: string
  created_at: string
  delete_yn: boolean
}

export interface AdminRecipe {
  recipe_post_id: string
  title: string
  description?: string
  user: {
    user_id: string
    nickname: string
  }
  like_count: number
  comment_count: number
  created_at: string
  delete_yn: boolean
}

export interface AdminAd {
  campaign_id: string
  campaign_name: string
  advertiser: {
    advertiser_id: string
    biz_name: string
  }
  status: string
  total_budget: number
  cpi: number
  start_date: string
  end_date: string
  view_count: number
  click_count: number
  created_at: string
  delete_yn: boolean
}

export const AdminAPI = {
  // 로그인
  login: async (email: string, password: string) => {
    const response = await apiClient.post('/admin/login', { email, password })
    return response.data
  },

  // 유저 목록
  getUsers: async (page: number = 1, limit: number = 20, keyword?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    if (keyword) {
      params.append('keyword', keyword)
    }
    const response = await apiClient.get(`/admin/users?${params.toString()}`)
    return response.data
  },

  // 유저 상세
  getUser: async (userId: string) => {
    const response = await apiClient.get(`/admin/users/${userId}`)
    return response.data
  },

  // 유저 제재
  banUser: async (userId: string, reason: string) => {
    const response = await apiClient.post(`/admin/users/${userId}/ban`, { reason })
    return response.data
  },

  // 유저 제재 해제
  unbanUser: async (userId: string) => {
    const response = await apiClient.post(`/admin/users/${userId}/unban`)
    return response.data
  },

  // 유저 상태 변경
  updateUserStatus: async (userId: string, status: 'ACTIVE' | 'PENDING' | 'SUSPENDED') => {
    const response = await apiClient.put(`/admin/users/${userId}/status`, { status })
    return response.data
  },

  // 게시글 목록
  getRecipes: async (page: number = 1, limit: number = 20, keyword?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    if (keyword) {
      params.append('keyword', keyword)
    }
    const response = await apiClient.get(`/admin/recipes?${params.toString()}`)
    return response.data
  },

  // 게시글 상세
  getRecipe: async (recipeId: string) => {
    const response = await apiClient.get(`/admin/recipes/${recipeId}`)
    return response.data
  },

  // 게시글 삭제
  deleteRecipe: async (recipeId: string) => {
    const response = await apiClient.delete(`/admin/recipes/${recipeId}`)
    return response.data
  },

  // 광고 목록
  getAds: async (page: number = 1, limit: number = 20, status?: string) => {
    const params = new URLSearchParams({
      page: page.toString(),
      limit: limit.toString(),
    })
    if (status) {
      params.append('status', status)
    }
    const response = await apiClient.get(`/admin/ads?${params.toString()}`)
    return response.data
  },

  // 광고 캠페인 승인
  approveAd: async (campaignId: string) => {
    const response = await apiClient.post(`/admin/ads/${campaignId}/approve`)
    return response.data
  },

  // 광고 캠페인 거부
  rejectAd: async (campaignId: string, reason: string) => {
    const response = await apiClient.post(`/admin/ads/${campaignId}/reject`, { reason })
    return response.data
  },

  // 비즈니스 계정 승인
  approveBusiness: async (userId: string, accountType: 'store' | 'advertiser') => {
    const response = await apiClient.post(`/admin/business/${userId}/approve`, { account_type: accountType })
    return response.data
  },

  // 비즈니스 계정 거부
  rejectBusiness: async (userId: string, accountType: 'store' | 'advertiser', reason: string) => {
    const response = await apiClient.post(`/admin/business/${userId}/reject`, { account_type: accountType, reason })
    return response.data
  },
}


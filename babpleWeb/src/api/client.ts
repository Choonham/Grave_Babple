import axios from 'axios'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000'

export const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
})

// Request interceptor for adding auth token
apiClient.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => {
    return Promise.reject(error)
  }
)

// Response interceptor for handling errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // 로그인 API 호출 중이면 리다이렉트하지 않음
      const isLoginRequest = error.config?.url?.includes('/admin/login')
      if (!isLoginRequest) {
        localStorage.removeItem('admin_token')
        // 현재 페이지가 로그인 페이지가 아닐 때만 리다이렉트
        if (window.location.pathname !== '/admin/login') {
          window.location.href = '/admin/login'
        }
      }
    }
    return Promise.reject(error)
  }
)

export default apiClient


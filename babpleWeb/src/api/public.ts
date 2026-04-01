import apiClient from './client'

export const PublicAPI = {
  // 공유용 레시피 조회 (인증 불필요)
  getRecipeForShare: async (recipeId: string) => {
    const response = await apiClient.get(`/recipes/${recipeId}/share`, {
      headers: {
        Authorization: undefined, // 인증 헤더 제거
      },
    })
    return response.data
  },
}


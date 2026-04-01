import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import CategoryScreen from '../screens/upload/CategoryScreen';
import PostRecipeScreen from '../screens/upload/PostRecipeScreen';

export type UploadStackParamList = {
  Category?: {
    mode?: 'create' | 'edit';
    recipePostId?: string;
    initialRecipeName?: string;
    initialDescription?: string;
    initialSituationId?: number | null;
    initialMethodId?: number | null;
    initialMainIngredientIds?: number[];
    recipeDetail?: any;
  };
  PostRecipe?: {
    recipeName?: string;
    recipe_post_id?: string;
    selectedSituation?: string;
    selectedSituationId?: number | null;
    selectedMethodId?: number | null;
    selectedMainIngredientIds?: number[];
    selectedMainIngredientNames?: string[];
    selectedMainIngredientUnits?: Record<string, string>;
    selectedMainIngredientIngredientIds?: Record<string, number>;
    mode?: 'create' | 'edit';
    fromDefaultTemplate?: boolean; // 추천 레시피에서 가져온 경우
    aiAnalysisImageUri?: string; // AI 분석용 이미지 URI
    aiAnalysisMode?: boolean; // AI 분석 모드 여부
  };
};

const UploadStack = createStackNavigator<UploadStackParamList>();

/**
 * 업로드 스택 네비게이터
 * 카테고리 선택 -> 업로드 정보 입력 화면을 관리합니다.
 */
export default function UploadNavigator() {
  return (
    <UploadStack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <UploadStack.Screen name="Category" component={CategoryScreen} />
      <UploadStack.Screen name="PostRecipe" component={PostRecipeScreen} />
    </UploadStack.Navigator>
  );
}


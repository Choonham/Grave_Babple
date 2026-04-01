import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import StoreDashboardScreen from '../screens/biz/store/StoreDashboardScreen';
import StoreScreen from '../screens/biz/store/StoreScreen';
import PromotionListScreen from '../screens/biz/store/PromotionListScreen';

// 타입 정의
export type BizStoreStackParamList = {
  StoreDashboard: undefined;
  Store: {isMine?: boolean};
  PromotionList: undefined;
  // TODO: 다른 상점주 화면들을 여기에 추가
};

// 네비게이터 인스턴스 생성
const Stack = createStackNavigator<BizStoreStackParamList>();

/**
 * 비즈니스 상점 스택 네비게이터
 * 상점주 전용 화면들을 관리합니다.
 */
export default function BizStoreNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="StoreDashboard" component={StoreDashboardScreen} />
      <Stack.Screen name="Store" component={StoreScreen} />
      <Stack.Screen name="PromotionList" component={PromotionListScreen} />
      {/* TODO: 다른 상점주 화면들을 여기에 추가 */}
    </Stack.Navigator>
  );
}


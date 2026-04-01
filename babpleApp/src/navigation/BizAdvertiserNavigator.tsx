import React from 'react';
import {createStackNavigator} from '@react-navigation/stack';
import AdvertiserDashboardScreen from '../screens/biz/advertiser/AdvertiserDashboardScreen';
import CampaignListScreen from '../screens/biz/advertiser/CampaignListScreen';
import AdResourceListScreen from '../screens/biz/advertiser/AdResourceListScreen';

// 타입 정의
export type BizAdvertiserStackParamList = {
  AdvertiserDashboard: undefined;
  CampaignList: undefined;
  AdResourceList: undefined;
  // TODO: 다른 광고주 화면들을 여기에 추가
};

// 네비게이터 인스턴스 생성
const Stack = createStackNavigator<BizAdvertiserStackParamList>();

/**
 * 비즈니스 광고주 스택 네비게이터
 * 광고주 전용 화면들을 관리합니다.
 */
export default function BizAdvertiserNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen
        name="AdvertiserDashboard"
        component={AdvertiserDashboardScreen}
      />
      <Stack.Screen name="CampaignList" component={CampaignListScreen} />
      <Stack.Screen name="AdResourceList" component={AdResourceListScreen} />
      {/* TODO: 다른 광고주 화면들을 여기에 추가 */}
    </Stack.Navigator>
  );
}


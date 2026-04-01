import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createStackNavigator} from '@react-navigation/stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {TouchableOpacity, Platform} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing} from '../styles/commonStyles';

// 인증 화면
import LoginScreen from '../screens/auth/LoginScreen';
import BasicRegisterScreen from '../screens/auth/BasicRegisterScreen';
import BizBasicRegisterScreen from '../screens/auth/biz/BizBasicRegisterScreen';
import SelectAccountTypeScreen from '../screens/auth/biz/SelectAccountTypeScreen';
import StoreRegisterScreen from '../screens/auth/biz/store/StoreRegisterScreen';
import AdvertiserRegisterScreen from '../screens/auth/biz/advertiser/AdvertiserRegisterScreen';
import CompleteRegScreen from '../screens/auth/biz/CompleteRegScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import VerifyEmailScreen from '../screens/auth/VerifyEmailScreen';
import PermissionRequestScreen from '../screens/auth/PermissionRequestScreen';

// 메인 화면
import HomeScreen from '../screens/main/HomeScreen';
import MapScreen from '../screens/main/MapScreen';
import SearchScreen from '../screens/main/SearchScreen';
import ProfileScreen from '../screens/main/ProfileScreen';

// 업로드 네비게이터
import UploadNavigator from './UploadNavigator';

// 비즈니스 네비게이터
import BizStoreNavigator from './BizStoreNavigator';
import BizAdvertiserNavigator from './BizAdvertiserNavigator';

// 타입 정의
export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  Upload: undefined;
  BizStore: undefined;
  BizAdvertiser: undefined;
};

export type AuthStackParamList = {
  Login: undefined;
  BasicRegister: undefined;
  BizBasicRegister: undefined;
  SelectAccountType: undefined;
  StoreRegister: undefined;
  AdvertiserRegister: undefined;
  CompleteReg: undefined;
  VerifyEmail: undefined;
  ProfileSetup: undefined;
  PermissionRequest: undefined;
};

export type MainTabParamList = {
  Home: undefined;
  AddPost: undefined;
  Map: undefined;
  Search: undefined;
  Profile: undefined;
};

// 네비게이터 인스턴스 생성
const Stack = createStackNavigator<RootStackParamList>();
const AuthStack = createStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

/**
 * 인증 스택 네비게이터
 * 로그인, 회원가입 화면을 관리합니다.
 */
function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
      }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="BasicRegister" component={BasicRegisterScreen} />
      <AuthStack.Screen name="BizBasicRegister" component={BizBasicRegisterScreen} />
      <AuthStack.Screen name="SelectAccountType" component={SelectAccountTypeScreen} />
      <AuthStack.Screen name="StoreRegister" component={StoreRegisterScreen} />
      <AuthStack.Screen name="AdvertiserRegister" component={AdvertiserRegisterScreen} />
      <AuthStack.Screen name="CompleteReg" component={CompleteRegScreen} />
      <AuthStack.Screen name="VerifyEmail" component={VerifyEmailScreen} />
      <AuthStack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <AuthStack.Screen name="PermissionRequest" component={PermissionRequestScreen} />
    </AuthStack.Navigator>
  );
}

/**
 * 메인 탭 네비게이터
 * 하단 네비게이션 바를 포함한 메인 화면들을 관리합니다.
 */
function MainTabNavigator({navigation}: any) {
  const insets = useSafeAreaInsets();
  const tabBarHeight = 68 + (Platform.OS === 'android' ? insets.bottom : 0);

  return (
    <Tab.Navigator
      screenOptions={({route}) => ({
        headerShown: false,
        tabBarIcon: ({focused, color, size}) => {
          let iconName: string = '';

          if (route.name === 'Home') {
            iconName = 'home';
          } else if (route.name === 'AddPost') {
            // 중앙 버튼은 tabBarButton에서 처리
            return null;
          } else if (route.name === 'Map') {
            iconName = 'map-pin';
          } else if (route.name === 'Search') {
            iconName = 'search';
          } else if (route.name === 'Profile') {
            iconName = 'user';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.white,
          borderTopWidth: 1,
          borderTopColor: colors.lightGray,
          paddingBottom: Platform.OS === 'android' ? insets.bottom + 8 : 8,
          paddingTop: spacing.xs,
          height: tabBarHeight,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontFamily: 'Pretendard-Regular',
        },
      })}>
      <Tab.Screen name="Home" component={HomeScreen} options={{tabBarLabel: '피드'}} />
      <Tab.Screen name="Map" component={MapScreen} options={{tabBarLabel: '지도'}} />
      <Tab.Screen
              name="AddPost"
              component={HomeScreen} // TODO: 실제 게시글 추가 화면 구현
              options={{
                tabBarLabel: '',
                tabBarIcon: () => null, // 아이콘은 button에서 직접 렌더링
                tabBarButton: (props) => (
                  <TouchableOpacity
                    onPress={() => navigation.navigate('Upload')}
                    style={{
                      flex: 1,
                      justifyContent: 'center',
                      alignItems: 'center',
                      position: 'absolute',
                      left: '50%',
                      top: -15, // 상단으로 살짝 떠있는 효과
                      marginLeft: -28, // 버튼의 절반 너비 (중앙 정렬)
                      width: 56,
                      height: 56,
                      borderRadius: 28,
                      backgroundColor: colors.secondary, // 연한 주황색
                      borderWidth: 2,
                      borderColor: 'rgba(255,255,255,0)',
                      shadowColor: colors.almostBlack,
                      shadowOffset: {width: 0, height: 2},
                      shadowOpacity: 0.1,
                      shadowRadius: 4,
                      elevation: 4, // Android 그림자 효과
                    }}>
                    <Icon name="plus" size={28} color={colors.primary} />
                  </TouchableOpacity>
                ),
              }}
            />
      <Tab.Screen name="Search" component={SearchScreen} options={{tabBarLabel: '탐색'}} />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{tabBarLabel: '마이페이지'}}
      />
    </Tab.Navigator>
  );
}

/**
 * 루트 스택 네비게이터
 * 전체 앱의 네비게이션 구조를 관리합니다.
 */
function RootNavigator() {
  // 권한 체크는 LoginScreen에서 수행하므로 항상 Auth로 시작
  const initialRouteName: keyof RootStackParamList = 'Auth';

  return (
    <Stack.Navigator
      initialRouteName={initialRouteName}
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="Auth" component={AuthNavigator} />
      <Stack.Screen name="Main" component={MainTabNavigator} />
      <Stack.Screen name="Upload" component={UploadNavigator} />
      <Stack.Screen name="BizStore" component={BizStoreNavigator} />
      <Stack.Screen name="BizAdvertiser" component={BizAdvertiserNavigator} />
    </Stack.Navigator>
  );
}

/**
 * 앱 네비게이션 컨테이너
 * 전체 앱의 네비게이션을 관리하는 최상위 컴포넌트입니다.
 */
export default function AppNavigator() {
  return (
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>
  );
}

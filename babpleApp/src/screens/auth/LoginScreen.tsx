import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Keyboard,
} from 'react-native';
import { useDispatch } from 'react-redux';
import { USER_LOGIN_SUCCESS, setRegisterInProgress } from '../../redux/states/userState';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { ScreenWrapper, Button, TextInput } from '../../components/common';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import { userLogin } from '../../redux/states/userState';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { GoogleSignin, statusCodes } from '@react-native-google-signin/google-signin';
import { AuthAPI } from '../../api/ApiRequests';
import { useAlert } from '../../contexts/AlertContext';
import firebaseService from '../../services/FirebaseService';
import { check, PERMISSIONS, RESULTS, Permission } from 'react-native-permissions';
import Icon from 'react-native-vector-icons/Feather';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import Ionicons from 'react-native-vector-icons/Ionicons';
import {
  appleAuth,
} from '@invertase/react-native-apple-authentication';

/**
 * 로그인 화면
 * 이메일/비밀번호 로그인과 소셜 로그인을 제공합니다.
 */
type LoginScreenRouteProp = RouteProp<{ params: { email?: string } }, 'params'>;

const LoginScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute<LoginScreenRouteProp>();
  const { confirm } = useAlert();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // 개발용 백도어 - 더블 탭 카운터
  const [lastTapTime, setLastTapTime] = useState(0);
  const [longPressTimer, setLongPressTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const [forgotPasswordLastTapTime, setForgotPasswordLastTapTime] = useState(0);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false); // 로그인 중 상태
  const [toastVisible, setToastVisible] = useState(false); // Toast 표시 상태
  const [toastMessage, setToastMessage] = useState(''); // Toast 메시지
  const hasAutoLoginAttempted = useRef(false);
  const hasPermissionChecked = useRef(false);
  const scrollViewRef = useRef<ScrollView>(null);

  /**
   * Toast 메시지 표시 함수
   */
  const showToast = (message: string) => {
    setToastMessage(message);
    setToastVisible(true);
    setTimeout(() => {
      setToastVisible(false);
    }, 3000); // 3초 후 자동 사라짐
  };

  // 구글 로그인 클라이언트 ID (Google Cloud Console에서 발급받은 값으로 교체)
  const GOOGLE_WEB_CLIENT_ID =
    '700301965010-9r1c1vn87u65ss1hnk8vc2goqbs1nci1.apps.googleusercontent.com';
  const GOOGLE_IOS_CLIENT_ID = '700301965010-iag07bfrb7t4ajapqhlbc6s7mls3fpvj.apps.googleusercontent.com';

  const getStoredLocation = async () => {
    try {
      const stored = await AsyncStorage.getItem('userLocation');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (
          parsed &&
          typeof parsed.latitude === 'number' &&
          typeof parsed.longitude === 'number'
        ) {
          return parsed as {
            latitude: number;
            longitude: number;
            locationText?: string | null;
          };
        }
      }
    } catch (error) {
      console.log('⚠️ [로그인] 저장된 위치 불러오기 실패:', error);
    }
    return null;
  };

  const requestCurrentLocation = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      const geoOptions: any = {
        enableHighAccuracy: false, // 비정확한 위치 사용 (프라이버시 보호, 빠른 응답)
        timeout: 10000, // 10초로 증가 (더 안정적인 위치 획득)
        maximumAge: 300000, // 5분간 캐시된 위치 사용
        distanceFilter: 0,
        accuracy: {
          android: 'balanced', // 중간 정확도
          ios: 'reduced', // iOS에서 비정확한 위치 (프라이버시 보호)
        },
        forceRequestLocation: false,
        showLocationDialog: true,
      };

      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => {
          console.log('⚠️ [로그인] 현재 위치 가져오기 실패:', error);
          reject(error);
        },
        geoOptions,
      );
    });

  useEffect(() => {
    GoogleSignin.configure({
      webClientId: GOOGLE_WEB_CLIENT_ID,
      ...(GOOGLE_IOS_CLIENT_ID ? { iosClientId: GOOGLE_IOS_CLIENT_ID } : {}),
      offlineAccess: true,
    });
  }, []);

  // route params에서 이메일 받아서 설정
  useEffect(() => {
    const routeEmail = route.params?.email;
    if (routeEmail) {
      setEmail(routeEmail);
    }
  }, [route.params?.email]);

  // 키보드 이벤트 리스너 - 키보드가 올라올 때 스크롤을 아래로 이동
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        // 키보드가 올라올 때 스크롤을 맨 아래로 이동
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
      },
    );

    return () => {
      keyboardDidShowListener.remove();
    };
  }, []);

  // 권한 안내 화면 표시 여부 체크
  useEffect(() => {
    const checkPermissionScreenShown = async () => {
      if (hasPermissionChecked.current) {
        return;
      }
      hasPermissionChecked.current = true;

      try {
        const checked = await AsyncStorage.getItem('permissions_checked');
        if (checked !== 'true') {
          console.log('ℹ️ [로그인 화면] 권한 안내 화면이 아직 표시되지 않음 -> 이동');
          // @ts-ignore
          navigation.navigate('PermissionRequest');
        } else {
          console.log('✅ [로그인 화면] 권한 안내 화면 이미 표시됨');
        }
      } catch (error) {
        console.error('권한 안내 확인 체크 오류:', error);
      }
    };

    checkPermissionScreenShown();
  }, [navigation]);

  // 자동 로그인 시도
  useEffect(() => {
    const attemptAutoLogin = async () => {
      if (hasAutoLoginAttempted.current) {
        return;
      }

      hasAutoLoginAttempted.current = true;

      try {
        const token = await AsyncStorage.getItem('accessToken');
        const storedUser = await AsyncStorage.getItem('userInfo');

        if (!token || !storedUser) {
          console.log('📱 [자동 로그인] 저장된 토큰 또는 사용자 정보 없음');
          return;
        }

        let userData;
        try {
          userData = JSON.parse(storedUser);
        } catch (error) {
          console.log('⚠️ [자동 로그인] 사용자 정보 파싱 실패:', error);
          return;
        }

        if (!userData.email) {
          console.log('⚠️ [자동 로그인] 이메일 정보 없음');
          return;
        }

        console.log('🔄 [자동 로그인] 자동 로그인 시도 중...');
        setIsAutoLoggingIn(true);

        // 저장된 이메일로 자동 로그인 시도
        // 비밀번호는 저장하지 않으므로, 서버에서 토큰 검증이 필요합니다
        // 여기서는 토큰이 유효한지 확인하는 별도 API를 호출하거나,
        // 또는 사용자에게 비밀번호를 다시 입력받아야 합니다.
        // 일단은 저장된 이메일을 입력 필드에 채우고, 사용자가 로그인 버튼을 누르도록 유도합니다.
        setEmail(userData.email);

        // 토큰이 있으면 프로필 조회로 토큰 유효성 확인
        try {
          const profileResponse = await AuthAPI.getProfile();
          if (profileResponse?.success && profileResponse.data) {
            console.log('✅ [자동 로그인] 토큰 유효, 자동 로그인 성공');

            // 자동 로그인 성공 후 FCM 토큰 업데이트
            try {
              await firebaseService.registerPendingFcmToken();
              const currentToken = firebaseService.getFcmToken();
              if (currentToken && currentToken !== 'fcm_token') {
                await firebaseService.registerFcmToken(currentToken);
                console.log('✅ [자동 로그인] FCM 토큰 업데이트 완료');
              } else {
                // 토큰이 없으면 초기화 시도
                await firebaseService.initialize();
                const newToken = firebaseService.getFcmToken();
                if (newToken && newToken !== 'fcm_token') {
                  await firebaseService.registerFcmToken(newToken);
                  console.log('✅ [자동 로그인] FCM 토큰 초기화 후 업데이트 완료');
                }
              }
            } catch (fcmError) {
              console.error('❌ [자동 로그인] FCM 토큰 업데이트 실패:', fcmError);
            }

            // Redux 상태 업데이트
            dispatch({
              type: USER_LOGIN_SUCCESS,
              payload: {
                token: token,
                user: profileResponse.data,
              },
            });
            // role에 따라 네비게이션 결정
            const userRole = profileResponse.data?.role;
            console.log('📋 [자동 로그인] 사용자 role:', userRole);

            if (userRole === 1) {
              // 상점주 (role=1)인 경우 BizStore 네비게이터로 이동
              console.log('🏪 [자동 로그인] 상점주로 인식, BizStore로 이동');
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'BizStore' }],
                }),
              );
            } else if (userRole === 2) {
              // 광고주 (role=2)인 경우 BizAdvertiser 네비게이터로 이동
              console.log('📢 [자동 로그인] 광고주로 인식, BizAdvertiser로 이동');
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'BizAdvertiser' }],
                }),
              );
            } else {
              // 일반 유저인 경우 Main 탭으로 이동
              console.log('👤 [자동 로그인] 일반 유저로 인식, Main으로 이동');
              navigation.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Main' }],
                }),
              );
            }
            return;
          }
        } catch (profileError: any) {
          console.log('⚠️ [자동 로그인] 토큰 검증 실패, 수동 로그인 필요:', profileError);

          // 서버 응답이 없는 경우 (네트워크 오류, 타임아웃, 서버 다운 등)
          if (!profileError?.response) {
            // 서버 응답 없음은 자동 로그인 실패로 처리 (사용자에게 알림 없이)
            // 수동 로그인 화면에서 로그인 시도 시 에러가 표시됨
            console.log('⚠️ [자동 로그인] 서버 응답 없음, 수동 로그인 필요');
          }

          // 토큰이 만료되었거나 유효하지 않으면 수동 로그인 필요
          // 만료된 토큰 제거
          await AsyncStorage.removeItem('accessToken');
          await AsyncStorage.removeItem('userInfo');
        }
      } catch (error) {
        console.error('❌ [자동 로그인] 오류:', error);
      } finally {
        setIsAutoLoggingIn(false);
      }
    };

    attemptAutoLogin();
  }, [navigation]);

  /**
   * 일반 로그인 처리
   */
  const handleLogin = async () => {
    if (!email || !password) {
      showToast('이메일과 비밀번호를 입력해주세요.');
      return;
    }

    setIsLoggingIn(true); // 로그인 시작

    // role은 로그인 성공 후 서버 응답에서 확인

    // 위치 정보는 비동기로 가져오되, 로그인은 즉시 진행
    // 저장된 위치가 있으면 사용하고, 없으면 null로 전송 (서버에서 처리)
    let locationPayload = await getStoredLocation();

    // 저장된 위치가 없으면 빠르게 시도하되, 로그인은 즉시 진행
    if (!locationPayload) {
      // 1초 타임아웃으로 빠르게 시도
      Promise.race([
        requestCurrentLocation(),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
      ])
        .then(async currentLocation => {
          const payload = {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
          };
          await AsyncStorage.setItem('userLocation', JSON.stringify(payload));
          console.log('✅ [로그인] 위치 저장 완료');
        })
        .catch(error => {
          // 실패해도 로그인은 계속 진행
          console.log('⚠️ [로그인] 위치 가져오기 실패 (백그라운드에서 재시도):', error?.message || error);
        });
    }

    // FCM 토큰 가져오기 (토큰이 준비될 때까지 최대 3초 대기)
    let fcmToken = 'fcm_token'; // 기본값
    try {
      console.log('📱 [로그인] FCM 토큰 가져오기 시도...');
      const token = await firebaseService.waitForToken(3000);
      if (token && token !== 'fcm_token') {
        fcmToken = token;
        console.log('📱 [로그인] FCM 토큰 사용:', token.substring(0, 20) + '...');
      } else {
        console.warn('⚠️ [로그인] FCM 토큰을 가져올 수 없습니다. 기본값 사용.');
      }
    } catch (fcmError) {
      console.error('❌ [로그인] FCM 토큰 가져오기 실패:', fcmError);
    }

    dispatch(
      userLogin(email, password, fcmToken, 'device_id', locationPayload, {
        onSuccess: async (data: any) => {
          setIsLoggingIn(false); // 로그인 완료
          console.log('✅ 로그인 성공:', data);

          // 로그인 성공 후 FCM 토큰 재등록 (토큰이 변경되었을 수 있음)
          try {
            // 대기 중인 FCM 토큰이 있으면 등록
            await firebaseService.registerPendingFcmToken();

            // 현재 FCM 토큰이 있으면 서버에 등록
            const currentToken = firebaseService.getFcmToken();
            if (currentToken && currentToken !== 'fcm_token') {
              await firebaseService.registerFcmToken(currentToken);
              console.log('✅ [로그인] FCM 토큰 재등록 완료');
            } else {
              // 토큰이 없거나 기본값이면 다시 초기화 시도
              await firebaseService.initialize();
              const newToken = firebaseService.getFcmToken();
              if (newToken && newToken !== 'fcm_token') {
                await firebaseService.registerFcmToken(newToken);
                console.log('✅ [로그인] FCM 토큰 초기화 후 등록 완료');
              }
            }
          } catch (fcmError) {
            console.error('❌ [로그인] FCM 토큰 재등록 실패:', fcmError);
          }

          // 위치 정보는 백그라운드에서 저장 (로그인 지연 방지)
          if (data?.user?.location) {
            AsyncStorage.setItem(
              'userLocation',
              JSON.stringify({
                latitude: data.user.location.latitude,
                longitude: data.user.location.longitude,
                locationText: data.user.location_text || null,
              }),
            ).catch(error => {
              console.log('⚠️ [로그인] 위치 저장 실패:', error);
            });
          }

          // 로그인 후 백그라운드에서 위치 업데이트 시도 (로그인 지연 없음)
          // 위치가 없거나 오래된 경우에만 업데이트
          setTimeout(async () => {
            try {
              const storedLocation = await getStoredLocation();
              if (!storedLocation) {
                // 저장된 위치가 없으면 다시 시도 (타임아웃 짧게)
                const currentLocation = await Promise.race([
                  requestCurrentLocation(),
                  new Promise<never>((_, reject) =>
                    setTimeout(() => reject(new Error('timeout')), 3000),
                  ),
                ]);

                // 위치만 저장 (locationText는 서버에서 처리하거나 나중에 업데이트)
                await AsyncStorage.setItem(
                  'userLocation',
                  JSON.stringify({
                    latitude: currentLocation.latitude,
                    longitude: currentLocation.longitude,
                  }),
                );
                console.log('✅ [로그인] 백그라운드 위치 저장 완료');
              }
            } catch (error) {
              // 실패해도 무시 (로그인에 영향 없음)
              console.log('⚠️ [로그인] 백그라운드 위치 업데이트 실패 (무시):', error);
            }
          }, 2000); // 2초 후 백그라운드에서 실행

          // role에 따라 네비게이션 결정
          const userRole = data?.user?.role;
          console.log('📋 [로그인] 사용자 role:', userRole);

          if (userRole === 1) {
            // 상점주 (role=1)인 경우 BizStore 네비게이터로 이동
            console.log('🏪 [로그인] 상점주로 인식, BizStore로 이동');
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'BizStore' }],
              }),
            );
          } else if (userRole === 2) {
            // 광고주 (role=2)인 경우 BizAdvertiser 네비게이터로 이동
            console.log('📢 [로그인] 광고주로 인식, BizAdvertiser로 이동');
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'BizAdvertiser' }],
              }),
            );
          } else {
            // 일반 유저인 경우 Main 탭으로 이동
            console.log('👤 [로그인] 일반 유저로 인식, Main으로 이동');
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              }),
            );
          }
        },
        onFailure: (error: any) => {
          console.log('❌ 로그인 실패:', error);
          setIsLoggingIn(false); // 로그인 실패 시 로딩 종료

          // 서버 응답이 없는 경우 (네트워크 오류, 타임아웃, 서버 다운 등)
          if (!error?.response) {
            // 타임아웃 오류
            if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
              showToast('서버의 응답이 없습니다. 네트워크 연결을 확인해주세요.');
              return;
            }

            // 연결 거부 (서버가 실행 중이 아님)
            if (error?.code === 'ECONNREFUSED') {
              showToast('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
              return;
            }

            // 네트워크 오류
            if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
              showToast('네트워크 연결을 확인해주세요.');
              return;
            }

            // 기타 응답 없는 오류
            showToast('서버의 응답이 없습니다. 잠시 후 다시 시도해주세요.');
            return;
          }

          // 서버 응답이 있는 경우 (일반적인 로그인 실패)
          const errorMessage =
            error?.response?.data?.message ||
            error?.message ||
            '로그인에 실패했습니다.';
          showToast(errorMessage);
        },
      }),
    );
  };

  /**
   * 개발용 백도어 - 더블 탭 처리
   */
  const handleDoubleTapLogin = () => {
    const now = Date.now();
    if (now - lastTapTime < 500) {
      // 0.5초 이내에 두 번 탭이면 메인 화면으로 이동
      setLastTapTime(0);

      console.log('✅ 개발 백도어: 메인 화면으로 이동');
      // @ts-ignore
      navigation.navigate('Main');
    } else {
      // 일반 탭: 일반 로그인 처리
      handleLogin().catch(error => console.log('❌ [로그인] 처리 중 오류:', error));
      setLastTapTime(now);
    }
  };

  /**
   * 개발용 백도어 - Long Press 처리
   */
  const handleLongPress = () => {
    console.log('✅ 개발 백도어: 상점주 대시보드로 이동 (Long Press)');
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{ name: 'BizStore' }],
      }),
    );
  };

  /**
   * Long Press 시작
   */
  const handlePressIn = () => {
    const timer = setTimeout(() => {
      handleLongPress();
    }, 1000); // 1초 동안 누르고 있으면 Long Press로 간주
    setLongPressTimer(timer);
  };

  /**
   * Long Press 취소
   */
  const handlePressOut = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const finalizeGoogleLogin = async (token: string, user: any) => {
    if (!token || !user) {
      throw new Error('서버에서 올바른 사용자 정보를 받지 못했습니다.');
    }

    await AsyncStorage.setItem('accessToken', token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(user));

    // 로그인 성공 후 FCM 토큰 재등록 (토큰이 변경되었을 수 있음)
    try {
      // 대기 중인 FCM 토큰이 있으면 등록
      await firebaseService.registerPendingFcmToken();

      // 현재 FCM 토큰이 있으면 서버에 등록
      const currentToken = firebaseService.getFcmToken();
      if (currentToken && currentToken !== 'fcm_token') {
        await firebaseService.registerFcmToken(currentToken);
        console.log('✅ [구글 로그인] FCM 토큰 재등록 완료');
      } else {
        // 토큰이 없거나 기본값이면 다시 초기화 시도
        await firebaseService.initialize();
        const newToken = firebaseService.getFcmToken();
        if (newToken && newToken !== 'fcm_token') {
          await firebaseService.registerFcmToken(newToken);
          console.log('✅ [구글 로그인] FCM 토큰 초기화 후 등록 완료');
        }
      }
    } catch (fcmError) {
      console.error('❌ [구글 로그인] FCM 토큰 재등록 실패:', fcmError);
    }

    const needsProfileSetup =
      !user.nickname ||
      (typeof user.nickname === 'string' && user.nickname.startsWith('user_')) ||
      !user.gender ||
      !user.age_group ||
      !user.location_text;

    if (needsProfileSetup) {
      // Redux store를 먼저 업데이트 (프로필 설정 화면에서도 userInfo를 사용할 수 있도록)
      dispatch({
        type: USER_LOGIN_SUCCESS,
        payload: {
          token,
          user,
        },
      });

      dispatch(setRegisterInProgress(user.user_id, user.email));
      // @ts-ignore
      navigation.navigate('ProfileSetup');
      return;
    }

    dispatch({
      type: USER_LOGIN_SUCCESS,
      payload: {
        token,
        user,
      },
    });

    // role에 따라 네비게이션 결정
    const userRole = user?.role;
    console.log('📋 [구글 로그인] 사용자 role:', userRole);

    if (userRole === 1) {
      // 상점주 (role=1)인 경우 BizStore 네비게이터로 이동
      console.log('🏪 [구글 로그인] 상점주로 인식, BizStore로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'BizStore' }],
        }),
      );
    } else if (userRole === 2) {
      // 광고주 (role=2)인 경우 BizAdvertiser 네비게이터로 이동
      console.log('📢 [구글 로그인] 광고주로 인식, BizAdvertiser로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'BizAdvertiser' }],
        }),
      );
    } else {
      // 일반 유저인 경우 Main 탭으로 이동
      console.log('👤 [구글 로그인] 일반 유저로 인식, Main으로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        }),
      );
    }
  };

  /**
   * Apple 로그인 완료 처리
   */
  const finalizeAppleLogin = async (token: string, user: any) => {
    if (!token || !user) {
      throw new Error('서버에서 올바른 사용자 정보를 받지 못했습니다.');
    }

    await AsyncStorage.setItem('accessToken', token);
    await AsyncStorage.setItem('userInfo', JSON.stringify(user));

    // 로그인 성공 후 FCM 토큰 재등록
    try {
      await firebaseService.registerPendingFcmToken();
      const currentToken = firebaseService.getFcmToken();
      if (currentToken && currentToken !== 'fcm_token') {
        await firebaseService.registerFcmToken(currentToken);
        console.log('✅ [Apple 로그인] FCM 토큰 재등록 완료');
      } else {
        await firebaseService.initialize();
        const newToken = firebaseService.getFcmToken();
        if (newToken && newToken !== 'fcm_token') {
          await firebaseService.registerFcmToken(newToken);
          console.log('✅ [Apple 로그인] FCM 토큰 초기화 후 등록 완료');
        }
      }
    } catch (fcmError) {
      console.error('❌ [Apple 로그인] FCM 토큰 재등록 실패:', fcmError);
    }

    const needsProfileSetup =
      !user.nickname ||
      (typeof user.nickname === 'string' && user.nickname.startsWith('user_')) ||
      !user.gender ||
      !user.age_group ||
      !user.location_text;

    if (needsProfileSetup) {
      dispatch({
        type: USER_LOGIN_SUCCESS,
        payload: { token, user },
      });
      dispatch(setRegisterInProgress(user.user_id, user.email));
      // @ts-ignore
      navigation.navigate('ProfileSetup');
      return;
    }

    dispatch({
      type: USER_LOGIN_SUCCESS,
      payload: { token, user },
    });

    const userRole = user?.role;
    console.log('📋 [Apple 로그인] 사용자 role:', userRole);

    if (userRole === 1) {
      console.log('🏪 [Apple 로그인] 상점주로 인식, BizStore로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'BizStore' }],
        }),
      );
    } else if (userRole === 2) {
      console.log('📢 [Apple 로그인] 광고주로 인식, BizAdvertiser로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'BizAdvertiser' }],
        }),
      );
    } else {
      console.log('👤 [Apple 로그인] 일반 유저로 인식, Main으로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'Main' }],
        }),
      );
    }
  };

  /**
   * Apple 로그인 처리
   */
  const onAppleButtonPress = async () => {
    if (Platform.OS !== 'ios') return;

    try {
      setIsLoggingIn(true);

      // performs login request
      const appleAuthRequestResponse = await appleAuth.performRequest({
        requestedOperation: appleAuth.Operation.LOGIN,
        requestedScopes: [appleAuth.Scope.FULL_NAME, appleAuth.Scope.EMAIL],
      });

      // get current authentication state for user
      const credentialState = await appleAuth.getCredentialStateForUser(
        appleAuthRequestResponse.user,
      );

      if (credentialState === appleAuth.State.AUTHORIZED) {
        const { identityToken, email, fullName, user, authorizationCode } = appleAuthRequestResponse;

        if (!identityToken) {
          throw new Error('Apple Identity Token이 없습니다.');
        }

        let locationPayload = await getStoredLocation();
        if (!locationPayload) {
          try {
            // 타임아웃 1초 적용
            const currentLocation = await Promise.race([
              requestCurrentLocation(),
              new Promise<any>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
            ]);

            locationPayload = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            };
            await AsyncStorage.setItem('userLocation', JSON.stringify(locationPayload));
          } catch (e) {
            console.log('⚠️ [Apple 로그인] 위치 가져오기 실패 (무시):', e);
          }
        }

        // FCM 토큰 가져오기
        let fcmToken = 'fcm_token';
        try {
          const token = await firebaseService.waitForToken(3000);
          if (token && token !== 'fcm_token') {
            fcmToken = token;
          }
        } catch (e) {
          console.error('❌ [Apple 로그인] FCM 토큰 실패:', e);
        }

        const loginPayload = {
          identityToken,
          authorizationCode: authorizationCode ?? undefined,
          user,
          email,
          fullName,
          fcmToken,
          deviceId: 'device_id',
          latitude: locationPayload?.latitude,
          longitude: locationPayload?.longitude,
          location_text: locationPayload?.locationText ?? undefined,
        };

        const response = await AuthAPI.loginWithApple(loginPayload);
        if (!response?.success) {
          throw new Error(response?.message || 'Apple 로그인에 실패했습니다.');
        }

        const { token, user: userData } = response.data || {};
        setIsLoggingIn(false);
        await finalizeAppleLogin(token, userData);
      }
    } catch (error: any) {
      if (error.code === appleAuth.Error.CANCELED) {
        setIsLoggingIn(false);
        return;
      }
      console.error('❌ [Apple 로그인] 오류:', error);
      setIsLoggingIn(false);
      showToast('Apple 로그인 중 오류가 발생했습니다.');
    }
  };

  /**
   * 구글 로그인 처리
   */
  const handleGoogleLogin = async () => {
    try {
      setIsGoogleLoading(true);
      setIsLoggingIn(true); // 로그인 시작
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
      await GoogleSignin.signInSilently().catch(() => null);
      const userInfo = await GoogleSignin.signIn();
      const tokens = await GoogleSignin.getTokens();

      if (!tokens.idToken) {
        throw new Error('Google 인증 토큰을 가져올 수 없습니다.');
      }

      let locationPayload = await getStoredLocation();

      // 저장된 위치가 없으면 빠르게 시도하되, 로그인은 즉시 진행
      if (!locationPayload) {
        // 1초 타임아웃으로 빠르게 시도
        Promise.race([
          requestCurrentLocation(),
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000)),
        ])
          .then(async currentLocation => {
            const payload = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            };
            await AsyncStorage.setItem('userLocation', JSON.stringify(payload));
            console.log('✅ [구글 로그인] 위치 저장 완료');
          })
          .catch(error => {
            // 실패해도 로그인은 계속 진행
            console.log('⚠️ [구글 로그인] 위치 가져오기 실패 (백그라운드에서 재시도):', error?.message || error);
          });
      }

      // FCM 토큰 가져오기 (토큰이 준비될 때까지 최대 3초 대기)
      let fcmToken = 'fcm_token'; // 기본값
      try {
        console.log('📱 [구글 로그인] FCM 토큰 가져오기 시도...');
        const token = await firebaseService.waitForToken(3000);
        if (token && token !== 'fcm_token') {
          fcmToken = token;
          console.log('📱 [구글 로그인] FCM 토큰 사용:', token.substring(0, 20) + '...');
        } else {
          console.warn('⚠️ [구글 로그인] FCM 토큰을 가져올 수 없습니다. 기본값 사용.');
        }
      } catch (fcmError) {
        console.error('❌ [구글 로그인] FCM 토큰 가져오기 실패:', fcmError);
      }

      const loginPayload = {
        idToken: tokens.idToken,
        fcmToken: fcmToken,
        deviceId: 'device_id',
        latitude: locationPayload?.latitude,
        longitude: locationPayload?.longitude,
        location_text: locationPayload?.locationText ?? undefined,
      };

      const executeGoogleLogin = async () => {
        const response = await AuthAPI.loginWithGoogle(loginPayload);
        if (!response?.success) {
          throw new Error(response?.message || '구글 로그인에 실패했습니다.');
        }
        const { token, user } = response.data || {};
        setIsLoggingIn(false); // 로그인 성공
        await finalizeGoogleLogin(token, user);
      };

      const handleRestoreDeletedAccountFlow = async (userId?: string) => {
        if (!userId) {
          showToast('복구할 계정 정보를 찾을 수 없습니다.');
          return;
        }
        try {
          setIsGoogleLoading(true);
          const restoreResponse = await AuthAPI.restoreDeletedAccount({ userId });
          if (!restoreResponse?.success) {
            throw new Error(restoreResponse?.message || '계정을 복구하지 못했습니다.');
          }
          setIsLoggingIn(true); // 로그인 시작
          await executeGoogleLogin();
        } catch (restoreError: any) {
          console.error('❌ [구글 로그인] 계정 복구 실패:', restoreError);
          setIsLoggingIn(false); // 로딩 종료
          showToast(
            restoreError?.response?.data?.message ||
            restoreError?.message ||
            '계정을 복구하지 못했습니다.',
          );
        } finally {
          setIsGoogleLoading(false);
        }
      };

      try {
        await executeGoogleLogin();
      } catch (error: any) {
        const status = error?.response?.status;
        const errorCode = error?.response?.data?.code;
        if (status === 423 && errorCode === 'ACCOUNT_DELETED') {
          const deletedUserId = error?.response?.data?.data?.user_id;
          setIsGoogleLoading(false);
          setIsLoggingIn(false); // 로딩 종료
          const shouldRestore = await confirm(
            '계정 복구',
            '이미 탈퇴한 계정입니다. 복구하시겠습니까?',
          );
          if (shouldRestore) {
            handleRestoreDeletedAccountFlow(deletedUserId);
          } else {
            try {
              await GoogleSignin.signOut();
            } catch (signOutError) {
              console.log('⚠️ [구글 로그인] Google 계정 로그아웃 실패:', signOutError);
            }
          }
          return;
        }
        throw error;
      }
    } catch (error: any) {
      console.error('❌ [구글 로그인] 오류:', error);
      setIsLoggingIn(false); // 로그인 실패 시 로딩 종료

      // Google 로그인 취소는 조용히 처리
      if (error?.code === statusCodes.SIGN_IN_CANCELLED) {
        return;
      }
      if (error?.code === statusCodes.IN_PROGRESS) {
        showToast('이미 로그인 진행 중입니다.');
        return;
      }
      if (error?.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        showToast('Google Play 서비스가 필요합니다. 업데이트 후 다시 시도해주세요.');
        return;
      }

      // 서버 응답이 없는 경우 (네트워크 오류, 타임아웃, 서버 다운 등)
      if (!error?.response) {
        // 타임아웃 오류
        if (error?.code === 'ECONNABORTED' || error?.message?.includes('timeout')) {
          showToast('서버의 응답이 없습니다. 네트워크 연결을 확인해주세요.');
          return;
        }

        // 연결 거부 (서버가 실행 중이 아님)
        if (error?.code === 'ECONNREFUSED') {
          showToast('서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.');
          return;
        }

        // 네트워크 오류
        if (error?.code === 'NETWORK_ERROR' || error?.message?.includes('Network Error')) {
          showToast('네트워크 연결을 확인해주세요.');
          return;
        }

        // 기타 응답 없는 오류
        showToast('서버의 응답이 없습니다. 잠시 후 다시 시도해주세요.');
        return;
      }

      // 서버 응답이 있는 경우 (일반적인 로그인 실패)
      const message =
        error?.response?.data?.message ||
        error?.message ||
        '구글 로그인 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.';
      showToast(message);
    } finally {
      setIsGoogleLoading(false);
    }
  };

  /**
   * 회원가입 이동
   */
  const handleRegister = () => {
    // @ts-ignore
    navigation.navigate('BasicRegister');
  };

  /**
   * 비밀번호 찾기 이동
   * 개발용 백도어: 더블 탭 시 광고주 대시보드로 이동
   */
  const handleForgotPassword = () => {
    const now = Date.now();
    if (now - forgotPasswordLastTapTime < 500) {
      // 0.5초 이내에 두 번 탭이면 광고주 대시보드로 이동 (백도어)
      setForgotPasswordLastTapTime(0);
      console.log('✅ 개발 백도어: 광고주 대시보드로 이동');
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [{ name: 'BizAdvertiser' }],
        }),
      );
    } else {
      // 일반 탭: 비밀번호 찾기 화면으로 이동
      console.log('비밀번호 찾기 화면으로 이동');
      setForgotPasswordLastTapTime(now);
    }
  };

  /**
   * 사업자 회원가입 이동
   */
  const handleBusinessRegister = () => {
    // @ts-ignore
    navigation.navigate('SelectAccountType');
  };


  return (
    <ScreenWrapper>
      {/* 로딩 오버레이 */}
      <LoadingOverlay
        visible={isAutoLoggingIn || isLoggingIn || isGoogleLoading}
        message={
          isAutoLoggingIn
            ? '자동 로그인 중...'
            : isGoogleLoading
              ? '구글 로그인 중...'
              : '로그인 중...'
        }
      />

      {/* Toast 메시지 */}
      {toastVisible && (
        <View style={[styles.toastContainer, { top: insets.top + 60 }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <ScrollView
          ref={scrollViewRef}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          {/* 앱 타이틀 */}
          <Text style={styles.title}>Babple</Text>

          {/* 소셜 로그인 버튼들 */}
          <View style={styles.socialButtons}>
            {Platform.OS === 'ios' && (
              <TouchableOpacity
                style={[
                  styles.socialButton,
                  { backgroundColor: colors.almostBlack, borderColor: colors.almostBlack },
                ]}
                onPress={onAppleButtonPress}
                disabled={isLoggingIn}>
                <View style={styles.socialButtonContent}>
                  <Ionicons name="logo-apple" size={24} color={colors.white} style={{ marginRight: spacing.s }} />
                  <Text style={[styles.socialButtonText, { color: colors.white }]}>
                    Apple
                  </Text>
                </View>
              </TouchableOpacity>
            )}
            <TouchableOpacity
              style={[
                styles.socialButton,
                { backgroundColor: colors.white, opacity: isGoogleLoading ? 0.6 : 1 },
              ]}
              onPress={handleGoogleLogin}
              disabled={isGoogleLoading}>
              <View style={styles.socialButtonContent}>
                {isGoogleLoading ? (
                  <ActivityIndicator color={colors.primary} />
                ) : (
                  <>
                    <Image
                      source={{
                        uri: 'https://developers.google.com/identity/images/g-logo.png',
                      }}
                      style={styles.socialLogo}
                    />
                    <Text style={[styles.socialButtonText, { color: colors.almostBlack }]}>
                      Google
                    </Text>
                  </>
                )}
              </View>
            </TouchableOpacity>

            {/* 카카오/네이버 로그인 추후 구현 예정 */}
            <View style={styles.comingSoonContainer}>
              <Text style={styles.comingSoonText}>카카오, 네이버 로그인은 추후 구현 예정입니다</Text>
            </View>
          </View>

          {/* 구분선 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 이메일 입력 */}
          <TextInput
            placeholder="이메일"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            style={styles.input}
            maxLength={100}
          />

          {/* 비밀번호 입력 */}
          <View style={styles.passwordContainer}>
            <TextInput
              placeholder="비밀번호"
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, styles.passwordInput]}
              maxLength={50}
            />
            <TouchableOpacity
              onPress={() => setShowPassword(!showPassword)}
              style={styles.passwordToggle}>
              <Icon
                name={showPassword ? 'eye-off' : 'eye'}
                size={20}
                color={colors.textSecondary}
              />
            </TouchableOpacity>
          </View>

          {/* 로그인 버튼 */}
          <TouchableOpacity
            style={[
              {
                height: 56,
                backgroundColor: colors.primary,
                borderRadius: borderRadius.s,
                justifyContent: 'center',
                alignItems: 'center',
              },
              styles.loginButton,
            ]}
            onPress={handleDoubleTapLogin}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}>
            <Text
              style={[
                typography.bodyMedium,
                { color: colors.white, fontWeight: '600' as const },
              ]}>
              Login
            </Text>
          </TouchableOpacity>

          {/* 하단 링크들 */}
          <View style={styles.bottomLinks}>
            <TouchableOpacity onPress={handleRegister}>
              <Text style={styles.linkText}>회원가입</Text>
            </TouchableOpacity>
            <View style={styles.linkDivider} />
            <TouchableOpacity onPress={handleForgotPassword}>
              <Text style={styles.linkText}>비밀번호 찾기</Text>
            </TouchableOpacity>
          </View>

          {/* 사업자 회원가입 링크 */}
          <TouchableOpacity onPress={handleBusinessRegister}>
            <Text style={styles.businessLink}>사업자 회원가입</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  scrollContent: {
    flexGrow: 1,
    paddingTop: 60,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 36,
    fontWeight: '700' as const,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontFamily: 'Pretendard-Regular',
  },
  socialButtons: {
    gap: spacing.m,
    marginBottom: spacing.xl,
  },
  socialButton: {
    height: 56,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  socialButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    marginRight: spacing.s,
  },
  socialIconImage: {
    width: 24,
    height: 24,
    marginRight: spacing.s,
  },
  googleLogo: {
    width: 28,
    height: 28,
    marginRight: spacing.s,
  },
  socialLogo: {
    width: 28,
    height: 28,
    marginRight: spacing.s,
  },
  comingSoonContainer: {
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  comingSoonText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    fontSize: 11,
  },
  socialButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600' as const,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightGray,
  },
  dividerText: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    marginHorizontal: spacing.m,
  },
  input: {
    marginBottom: spacing.m,
  },
  passwordContainer: {
    position: 'relative',
    marginBottom: spacing.m,
  },
  passwordInput: {
    paddingRight: 50,
  },
  passwordToggle: {
    position: 'absolute',
    right: spacing.m,
    justifyContent: 'center',
    alignItems: 'center',
    width: 40,
    height: 56, // TextInput 높이와 동일하게 설정
    top: 0, // 컨테이너 전체 높이를 사용하여 자동으로 중앙 정렬
  },
  loginButton: {
    marginTop: spacing.m,
    marginBottom: spacing.xl,
  },
  bottomLinks: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  linkText: {
    ...typography.captionRegular,
    color: colors.textPrimary,
  },
  linkDivider: {
    width: 1,
    height: 14,
    backgroundColor: colors.lightGray,
    marginHorizontal: spacing.m,
  },
  businessLink: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  autoLoginOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
    gap: spacing.m,
  },
  autoLoginText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.m,
    zIndex: 1000,
    maxWidth: '80%',
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
    textAlign: 'center',
  },
});

export default LoginScreen;


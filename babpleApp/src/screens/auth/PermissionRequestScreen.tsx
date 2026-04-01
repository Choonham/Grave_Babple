import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Platform,
  Linking,
} from 'react-native';
import { useNavigation, useFocusEffect, useRoute, RouteProp } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { check, request, PERMISSIONS, RESULTS, Permission, openSettings } from 'react-native-permissions';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkPermission, requestPermission } from '../../utils/permission';
import Icon from 'react-native-vector-icons/Feather';
import { IconButton } from '../../components/common';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../styles/commonStyles';
import { useAlert } from '../../contexts/AlertContext';

/**
 * 권한 요청 화면
 * 앱 사용에 필요한 권한을 요청합니다.
 */
type PermissionRequestScreenRouteProp = RouteProp<{ params: { email?: string } }, 'params'>;

const PermissionRequestScreen: React.FC = () => {
  const { alert } = useAlert();
  const navigation = useNavigation();
  const route = useRoute<PermissionRequestScreenRouteProp>();

  // 개발용 백도어 - 더블 탭 카운터
  const [lastTapTime, setLastTapTime] = useState(0);
  const [permissionStatuses, setPermissionStatuses] = useState<{ [key: string]: string }>({});
  const hasInitialCheckCompleted = useRef(false); // 초기 체크 완료 여부

  // Android 버전 확인 (한 번만 계산)
  const androidVersion =
    typeof Platform.Version === 'string' ? parseInt(Platform.Version, 10) : Platform.Version;

  // Android 권한 정의
  const androidPermissions = {
    location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    camera: PERMISSIONS.ANDROID.CAMERA,
    storage: androidVersion >= 33
      ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
      : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    // Android 13 이상에서만 알림 권한 사용
    // react-native-permissions에서 POST_NOTIFICATIONS가 제대로 export되지 않는 경우 대비하여 문자열로 직접 사용
    notification: androidVersion >= 33
      ? ('android.permission.POST_NOTIFICATIONS' as Permission)
      : null,
  };

  // iOS 권한 정의
  const iosPermissions = {
    location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    camera: PERMISSIONS.IOS.CAMERA,
    storage: PERMISSIONS.IOS.PHOTO_LIBRARY,
    notification: (PERMISSIONS as any)?.IOS?.NOTIFICATIONS || null,
  };

  const nativePermissions = Platform.OS === 'android' ? androidPermissions : iosPermissions;

  // 권한 상태 체크
  useEffect(() => {
    const checkStatuses = async () => {
      console.log('🔍 [PermissionRequestScreen] 권한 상태 체크');
      const statuses: { [key: string]: string } = {};

      statuses.location = await checkPermission('location');
      statuses.camera = await checkPermission('camera');
      statuses.storage = await checkPermission('photo');
      statuses.notification = await checkPermission('notification');

      setPermissionStatuses(statuses);
    };

    checkStatuses();
  }, []);

  /**
   * 설정 앱으로 이동하는 함수 (iOS/Android 모두 지원)
   */
  const openAppSettings = async () => {
    try {
      const canOpen = await openSettings();
      if (!canOpen) {
        // 설정 앱을 열 수 없는 경우 (일부 안드로이드 기기)
        alert('설정 열기 실패', '설정 앱을 열 수 없습니다. 수동으로 앱 설정에서 권한을 허용해주세요.');
      }
    } catch (error) {
      console.error('설정 앱 열기 오류:', error);
      // openSettings 실패 시 Linking 사용 (fallback)
      try {
        if (Platform.OS === 'ios') {
          await Linking.openURL('app-settings:');
        } else {
          await Linking.openSettings();
        }
      } catch (linkError) {
        console.error('Linking으로 설정 열기 실패:', linkError);
        alert('설정 열기 실패', '설정 앱을 열 수 없습니다. 수동으로 앱 설정에서 권한을 허용해주세요.');
      }
    }
  };

  /**
   * 화면 포커스 시 권한 상태 재확인 (설정에서 돌아왔을 때)
   */
  useFocusEffect(
    useCallback(() => {
      const checkStatuses = async () => {
        const statuses: { [key: string]: string } = {};
        statuses.location = await checkPermission('location');
        statuses.camera = await checkPermission('camera');
        statuses.storage = await checkPermission('photo');
        statuses.notification = await checkPermission('notification');
        setPermissionStatuses(statuses);
      };

      checkStatuses();
    }, [])
  );

  /**
   * 완료(확인) 버튼 처리 - 권한 여부와 상관없이 다음으로 진행
   */
  const handleConfirm = async () => {
    try {
      await AsyncStorage.setItem('permissions_checked', 'true');
      const token = await AsyncStorage.getItem('accessToken');
      const storedUser = await AsyncStorage.getItem('userInfo');
      const isLoggedIn = !!token && !!storedUser;

      // 알림 권한 요청 (한 번만 물어봄)
      const hasNotificationPermission = await checkPermission('notification');
      if (hasNotificationPermission !== RESULTS.GRANTED) {
        // 권한 요청
        await requestPermission('notification', {
          title: '알림 설정',
          message: '알림을 차단하시면 중요한 소식을 놓칠 수 있어요. 설정에서 언제든지 변경할 수 있습니다.',
        });
      }

      const email = route.params?.email;

      // 권한 상태와 무관하게 네비게이션 진행
      navigation.dispatch(
        CommonActions.reset({
          index: 0,
          routes: [
            {
              name: isLoggedIn ? 'Main' : 'Auth',
              ...(isLoggedIn
                ? {
                  state: {
                    routes: [{ name: 'Home' }],
                  },
                }
                : {
                  state: {
                    routes: [
                      {
                        name: 'Login',
                        params: email ? { email } : undefined,
                      },
                    ],
                  },
                }),
            },
          ],
        }),
      );
    } catch (error) {
      console.error('❌ [PermissionRequestScreen] 이동 오류:', error);
      alert('오류', '화면 이동 중 오류가 발생했습니다.');
    }
  };

  /**
   * 확인 버튼 처리 (더블 탭 백도어 제거)
   */
  const handleButtonPress = () => {
    handleConfirm();
  };

  const permissions = [
    {
      icon: 'map-pin',
      title: '위치',
      required: true,
      description: '내 주변 이웃들의 맛있는 집밥을 확인하고, 내 집밥을 동네에 공유하기 위해 필요해요.',
    },
    {
      icon: 'camera',
      title: '카메라',
      required: true,
      description: '직접 만든 맛있는 집밥의 사진을 찍기 위해서 필요해요.',
    },
    {
      icon: 'folder',
      title: '저장소',
      required: true,
      description: '저장된 맛있는 집밥 사진을 찾기 위해서 필요해요.',
    },
    {
      icon: 'bell',
      title: '알림',
      required: false,
      description: '다른 이웃들이 내 집밥에 남긴 반응이나 관심 있는 이웃의 새 글을 바로 알려드려요.',
    },
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 내용 */}
        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* 메인 타이틀 */}
          <Text style={styles.mainTitle}>
            Babple 서비스를 위해 딱 맞는 권한만 알려드릴게요.
          </Text>

          {/* 서브 타이틀 */}
          <Text style={styles.subTitle}>
            핵심 기능 사용을 위해 아래 권한들의 허용이 필요해요.
          </Text>

          {/* 권한 목록 */}
          <View style={styles.permissionsContainer}>
            {permissions.map((permission, index) => {
              const permissionKey = permission.title === '위치' ? 'location' :
                permission.title === '카메라' ? 'camera' :
                  permission.title === '저장소' ? 'storage' : 'notification';
              const status = permissionStatuses[permissionKey];
              const isGranted = status === RESULTS.GRANTED;

              return (
                <View key={index} style={styles.permissionItem}>
                  {/* 아이콘 */}
                  <View style={styles.iconContainer}>
                    <Icon
                      name={permission.icon}
                      size={32}
                      color={isGranted ? colors.primary : colors.textPrimary}
                    />
                  </View>

                  {/* 권한 정보 */}
                  <View style={styles.permissionInfo}>
                    <View style={styles.permissionTitleRow}>
                      <Text style={styles.permissionTitle}>
                        {permission.title}
                        <Text style={styles.requiredBadge}>
                          {' '}
                          ({permission.required ? '필수' : '선택'})
                        </Text>
                      </Text>
                      {isGranted && (
                        <Icon name="check" size={20} color={colors.primary} />
                      )}
                    </View>
                    <Text style={styles.permissionDescription}>
                      {permission.description}
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        </ScrollView>

        {/* 확인 버튼 */}
        <TouchableOpacity style={styles.confirmButton} onPress={handleButtonPress}>
          <Text style={styles.confirmButtonText}>네, 모두 확인했어요.</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.m,
  },
  mainTitle: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.m,
    fontWeight: '700',
  },
  subTitle: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  permissionsContainer: {
    marginBottom: spacing.m,
  },
  permissionItem: {
    flexDirection: 'row',
    marginBottom: spacing.xl,
    alignItems: 'flex-start',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
    marginTop: spacing.xs,
  },
  permissionInfo: {
    flex: 1,
    justifyContent: 'flex-start',
    paddingTop: 0,
  },
  permissionTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    marginBottom: spacing.xs,
  },
  permissionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  requiredBadge: {
    color: colors.primary,
    fontWeight: '600',
  },
  requestButton: {
    marginTop: spacing.s,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    alignSelf: 'flex-start',
  },
  requestButtonText: {
    ...typography.captionMedium,
    color: colors.white,
    fontWeight: '600',
  },
  permissionDescription: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    lineHeight: 20,
  },
  confirmButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    margin: spacing.l,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
});

export default PermissionRequestScreen;


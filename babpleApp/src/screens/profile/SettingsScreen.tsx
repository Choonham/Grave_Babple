import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Modal,
  Platform,
  ActivityIndicator,
  TextInput,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useDispatch, useSelector } from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import { USER_LOGOUT_SUCCESS } from '../../redux/states/userState';
import { check, request, RESULTS, PERMISSIONS } from 'react-native-permissions';
import { openAppSettings } from '../../utils/permission';
import { RootState } from '../../redux';
import { AuthAPI } from '../../api/ApiRequests';
import AccountScreen from './AccountScreen';
import LocationScreen from './LocationScreen';
import ViewModeScreen from './ViewModeScreen';
import NoticeScreen from './NoticeScreen';
import CustomerServiceScreen from './CustomerServiceScreen';
import TermsScreen from './TermsScreen';
import HiddenUsersScreen from './HiddenUsersScreen';
import { useAlert } from '../../contexts/AlertContext';

interface SettingItem {
  id: string;
  icon: string;
  label: string;
  type: 'toggle' | 'navigation' | 'value';
  value?: string;
  hasToggle?: boolean;
  toggleValue?: boolean;
  isRed?: boolean;
}

interface SettingsScreenProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * 설정 화면
 * Full Screen Modal
 */
const SettingsScreen: React.FC<SettingsScreenProps> = ({
  visible = true,
  onClose,
}) => {
  const { alert, confirm } = useAlert();
  const navigation = useNavigation();
  const dispatch = useDispatch();
  const userInfo = useSelector((state: RootState) => state.userState.userInfo);
  const insets = useSafeAreaInsets();
  const isAdmin = userInfo?.role === 9;
  const [isAccountScreenVisible, setIsAccountScreenVisible] = useState(false);
  const [isLocationScreenVisible, setIsLocationScreenVisible] = useState(false);
  const [isViewModeScreenVisible, setIsViewModeScreenVisible] = useState(false);
  const [isNoticeScreenVisible, setIsNoticeScreenVisible] = useState(false);
  const [isCustomerServiceScreenVisible, setIsCustomerServiceScreenVisible] = useState(false);
  const [isTermsScreenVisible, setIsTermsScreenVisible] = useState(false);
  const [isHiddenUsersScreenVisible, setIsHiddenUsersScreenVisible] = useState(false);
  const [pushNotificationEnabled, setPushNotificationEnabled] = useState(false);
  const [isPurgeModalVisible, setIsPurgeModalVisible] = useState(false);
  const [adminSecret, setAdminSecret] = useState('');
  const [purgeError, setPurgeError] = useState('');
  const [isPurging, setIsPurging] = useState(false);

  // Modal의 onRequestClose 핸들러 (뒤로가기 버튼 처리)
  const handleRequestClose = useCallback(() => {
    // 하위 모달이 열려있는지 확인하고, 열려있으면 해당 모달을 닫음
    if (isAccountScreenVisible) {
      setIsAccountScreenVisible(false);
      return;
    }
    if (isLocationScreenVisible) {
      setIsLocationScreenVisible(false);
      return;
    }
    if (isViewModeScreenVisible) {
      setIsViewModeScreenVisible(false);
      return;
    }
    if (isNoticeScreenVisible) {
      setIsNoticeScreenVisible(false);
      return;
    }
    if (isCustomerServiceScreenVisible) {
      setIsCustomerServiceScreenVisible(false);
      return;
    }
    if (isTermsScreenVisible) {
      setIsTermsScreenVisible(false);
      return;
    }
    if (isHiddenUsersScreenVisible) {
      setIsHiddenUsersScreenVisible(false);
      return;
    }
    if (isPurgeModalVisible) {
      setIsPurgeModalVisible(false);
      setAdminSecret('');
      setPurgeError('');
      return;
    }

    // 모든 하위 모달이 닫혀있으면 SettingsScreen을 닫음
    if (onClose) {
      onClose();
    }
  }, [
    isAccountScreenVisible,
    isLocationScreenVisible,
    isViewModeScreenVisible,
    isNoticeScreenVisible,
    isCustomerServiceScreenVisible,
    isTermsScreenVisible,
    isHiddenUsersScreenVisible,
    isPurgeModalVisible,
    onClose,
  ]);

  const handleLogout = async () => {
    const confirmed = await confirm(
      '확인',
      '정말 로그아웃하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '로그아웃',
          style: 'destructive',
        },
      ],
    );

    if (confirmed) {
      try {
        // 로컬 저장소에서 모든 인증 정보 제거
        await AsyncStorage.removeItem('accessToken');
        await AsyncStorage.removeItem('refreshToken');
        await AsyncStorage.removeItem('userInfo');
        await AsyncStorage.removeItem('userLocation');
        console.log('✅ [로그아웃] 모든 인증 정보 제거 완료');

        // Redux 상태 초기화
        dispatch({
          type: USER_LOGOUT_SUCCESS,
          payload: null,
        });

        // 로그인 화면으로 이동
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          }),
        );

        // 모달 닫기
        if (onClose) {
          onClose();
        }
      } catch (error) {
        console.error('❌ [로그아웃] 저장소 정리 실패:', error);
        // 에러가 발생해도 Redux 상태는 초기화하고 로그인 화면으로 이동
        dispatch({
          type: USER_LOGOUT_SUCCESS,
          payload: null,
        });
        navigation.dispatch(
          CommonActions.reset({
            index: 0,
            routes: [{ name: 'Auth' }],
          }),
        );
        if (onClose) {
          onClose();
        }
      }
    }
  };

  const handlePurgeDeletedUsers = async () => {
    if (!adminSecret.trim()) {
      setPurgeError('관리자 시크릿을 입력해주세요.');
      return;
    }
    try {
      setIsPurging(true);
      const response = await AuthAPI.purgeDeletedUsers(adminSecret.trim());
      if (!response?.success) {
        throw new Error(response?.message || '탈퇴 계정을 정리하지 못했습니다.');
      }
      setIsPurgeModalVisible(false);
      setAdminSecret('');
      await alert(
        '완료',
        response?.message ||
        `탈퇴 유예 기간이 지난 계정 ${response?.data?.purged ?? 0}개를 삭제했습니다.`,
      );
    } catch (error: any) {
      console.error('❌ [설정] 탈퇴 계정 정리 실패:', error);
      setPurgeError(error?.message || '탈퇴 계정을 정리하지 못했습니다.');
    } finally {
      setIsPurging(false);
    }
  };

  // 설정 데이터
  const accountItems: SettingItem[] = [
    {
      id: '1',
      icon: 'lock',
      label: '계정 및 보안',
      type: 'navigation',
    },
  ];

  const appSettingsItems: SettingItem[] = [
    {
      id: '2',
      icon: 'bell',
      label: '알림 설정',
      type: 'navigation',
    },
  ];

  const supportItems: SettingItem[] = [
    {
      id: '5',
      icon: 'info',
      label: '공지사항',
      type: 'navigation',
    },
    {
      id: '6',
      icon: 'help-circle',
      label: '고객센터 및 도움말',
      type: 'navigation',
    },
    {
      id: '7',
      icon: 'file-text',
      label: '서비스 이용약관',
      type: 'navigation',
    },
  ];

  const otherItems: SettingItem[] = [
    {
      id: '11',
      icon: 'user-x',
      label: '차단한 사용자',
      type: 'navigation',
    },
    {
      id: '8',
      icon: 'link',
      label: '앱 버전',
      type: 'value',
      value: 'v0.4.5-alpha.1',
    },
  ];

  if (isAdmin) {
    otherItems.push({
      id: '10',
      icon: 'trash-2',
      label: '탈퇴 계정 정리',
      type: 'navigation',
      isRed: true,
    });
  }

  otherItems.push({
    id: '9',
    icon: 'log-out',
    label: '로그아웃',
    type: 'navigation',
    isRed: true,
  });

  const renderSettingItem = (item: SettingItem) => {
    const iconColor = item.isRed ? colors.error : colors.textPrimary;

    const handlePress = () => {
      if (item.type === 'navigation') {
        if (item.id === '1') {
          // 계정 및 보안
          setIsAccountScreenVisible(true);
        } else if (item.id === '3') {
          // 위치 서비스 설정
          setIsLocationScreenVisible(true);
        } else if (item.id === '4') {
          // 화면 설정
          setIsViewModeScreenVisible(true);
        } else if (item.id === '2') {
          // 알림 설정 (os 설정으로 이동)
          openAppSettings();
        } else if (item.id === '5') {
          // 공지사항
          setIsNoticeScreenVisible(true);
        } else if (item.id === '6') {
          // 고객센터 및 도움말
          setIsCustomerServiceScreenVisible(true);
        } else if (item.id === '7') {
          // 서비스 이용약관
          setIsTermsScreenVisible(true);
        } else if (item.id === '11') {
          // 차단한 사용자
          setIsHiddenUsersScreenVisible(true);
        } else if (item.id === '10') {
          setAdminSecret('');
          setPurgeError('');
          setIsPurgeModalVisible(true);
        } else if (item.id === '9') {
          // 로그아웃
          handleLogout();
        } else {
          console.log(`${item.label} 페이지로 이동`);
        }
      }
    };

    return (
      <TouchableOpacity key={item.id} style={styles.settingItem} onPress={handlePress}>
        <View style={styles.settingItemLeft}>
          <Icon name={item.icon} size={24} color={iconColor} />
          <Text
            style={[styles.settingItemText, item.isRed && styles.settingItemTextRed]}>
            {item.label}
          </Text>
        </View>
        <View style={styles.settingItemRight}>
          {item.type === 'value' && (
            <Text style={styles.settingItemValue}>{item.value}</Text>
          )}
          {item.hasToggle && (
            <Switch
              value={item.toggleValue}
              onValueChange={async (value) => {
                if (value) {
                  // 푸시 알림 토글 ON 시 권한 요청
                  try {
                    let notificationPermission: string | null = null;

                    if (Platform.OS === 'android') {
                      if (Platform.Version >= 33) {
                        notificationPermission = (PERMISSIONS as any)?.ANDROID?.POST_NOTIFICATIONS || null;
                      } else {
                        setPushNotificationEnabled(true);
                        return;
                      }
                    } else {
                      notificationPermission = (PERMISSIONS as any)?.IOS?.NOTIFICATIONS || null;
                    }

                    if (!notificationPermission) {
                      setPushNotificationEnabled(true);
                      return;
                    }

                    // 권한 상태 확인
                    const permissionStatus = await check(notificationPermission as any);
                    console.log('🔔 [SettingsScreen] 알림 권한 상태:', permissionStatus);

                    if (permissionStatus === RESULTS.GRANTED) {
                      // 이미 권한이 허용됨
                      setPushNotificationEnabled(true);
                    } else if (permissionStatus === RESULTS.UNAVAILABLE) {
                      // 권한이 사용 불가능한 경우 (Android 13 미만 등)
                      setPushNotificationEnabled(true);
                    } else {
                      // 권한이 없거나 거부된 경우 - 권한 요청
                      console.log('🔔 [SettingsScreen] 알림 권한 요청 시작...');
                      const requestResult = await request(notificationPermission as any);
                      console.log('🔔 [SettingsScreen] 알림 권한 요청 결과:', requestResult);

                      if (requestResult === RESULTS.GRANTED) {
                        setPushNotificationEnabled(true);
                      } else if (requestResult === RESULTS.BLOCKED) {
                        // 권한이 차단된 경우 - 설정으로 이동 안내
                        const shouldOpenSettings = await confirm(
                          '알림 권한 필요',
                          '푸시 알림을 받으려면 알림 권한이 필요합니다. 설정에서 권한을 허용해주세요.',
                          [
                            {
                              text: '취소',
                              style: 'cancel',
                            },
                            {
                              text: '설정',
                              style: 'default',
                            },
                          ],
                        );

                        if (shouldOpenSettings) {
                          openSettings();
                        } else {
                          setPushNotificationEnabled(false);
                        }
                      } else {
                        // 권한이 거부된 경우
                        setPushNotificationEnabled(false);
                      }
                    }
                  } catch (error) {
                    console.error('❌ [SettingsScreen] 푸시 알림 권한 요청 오류:', error);
                    await alert('오류', '알림 권한을 확인할 수 없습니다.');
                    setPushNotificationEnabled(false);
                  }
                } else {
                  setPushNotificationEnabled(false);
                }
              }}
              trackColor={{ false: colors.lightGray, true: colors.primary }}
              thumbColor={colors.white}
            />
          )}
          {item.type === 'navigation' && (
            <Icon name="chevron-right" size={20} color={iconColor} />
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleRequestClose}
      statusBarTranslucent={false}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 헤더 - insets.top을 직접 적용 */}
        <View style={[styles.header, { paddingTop: insets.top + spacing.m }]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={onClose || (() => console.log('뒤로 가기'))}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>설정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.bodyWrapper}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 계정 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>계정</Text>
              {accountItems.map(item => renderSettingItem(item))}
            </View>

            {/* 앱 설정 */}
            {appSettingsItems.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>앱 설정</Text>
                {appSettingsItems.map(item => renderSettingItem(item))}
              </View>
            )}

            {/* 정보 및 지원 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>정보 및 지원</Text>
              {supportItems.map(item => renderSettingItem(item))}
            </View>

            {/* 기타 */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>기타</Text>
              {otherItems.map(item => renderSettingItem(item))}
            </View>
          </ScrollView>

          {/* 계정 및 보안 화면 */}
          {isAccountScreenVisible && (
            <AccountScreen visible={true} onClose={() => setIsAccountScreenVisible(false)} />
          )}

          {/* 위치 서비스 설정 화면 */}
          {isLocationScreenVisible && (
            <LocationScreen
              visible={true}
              onClose={() => setIsLocationScreenVisible(false)}
            />
          )}

          {/* 화면 설정 화면 */}
          {isViewModeScreenVisible && (
            <ViewModeScreen
              visible={true}
              onClose={() => setIsViewModeScreenVisible(false)}
            />
          )}

          {/* 공지사항 화면 */}
          {isNoticeScreenVisible && (
            <NoticeScreen
              visible={true}
              onClose={() => setIsNoticeScreenVisible(false)}
            />
          )}

          {/* 고객센터 및 도움말 화면 */}
          {isCustomerServiceScreenVisible && (
            <CustomerServiceScreen
              visible={true}
              onClose={() => setIsCustomerServiceScreenVisible(false)}
            />
          )}

          {/* 서비스 이용약관 화면 */}
          {isTermsScreenVisible && (
            <TermsScreen
              visible={true}
              onClose={() => setIsTermsScreenVisible(false)}
            />
          )}

          {/* 차단한 사용자 화면 */}
          {isHiddenUsersScreenVisible && (
            <HiddenUsersScreen
              visible={true}
              onClose={() => setIsHiddenUsersScreenVisible(false)}
            />
          )}

          <Modal visible={isPurgeModalVisible} transparent animationType="fade">
            <View style={styles.adminModalBackdrop}>
              <View style={styles.adminModalContent}>
                <Text style={styles.adminModalTitle}>탈퇴 계정 정리</Text>
                <Text style={styles.adminModalDescription}>
                  관리자 전용 기능입니다. 서버와 동일한 관리자 시크릿을 입력해야 실행됩니다.
                </Text>
                <TextInput
                  value={adminSecret}
                  onChangeText={text => {
                    setAdminSecret(text);
                    setPurgeError('');
                  }}
                  placeholder="관리자 시크릿"
                  secureTextEntry
                  style={styles.adminInput}
                />
                {purgeError ? <Text style={styles.adminErrorText}>{purgeError}</Text> : null}
                <View style={styles.adminModalActions}>
                  <TouchableOpacity
                    style={[styles.adminModalButton, styles.adminModalCancel]}
                    onPress={() => {
                      setIsPurgeModalVisible(false);
                      setAdminSecret('');
                      setPurgeError('');
                    }}>
                    <Text style={styles.adminModalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.adminModalButton, styles.adminModalConfirm]}
                    onPress={handlePurgeDeletedUsers}
                    disabled={isPurging}>
                    {isPurging ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.adminModalConfirmText}>정리 실행</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          </Modal>
        </View>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
  },
  bodyWrapper: {
    flex: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: spacing.l,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginLeft: spacing.m,
  },
  settingItemTextRed: {
    color: colors.error,
  },
  settingItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingItemValue: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginRight: spacing.xs,
  },
  adminModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  adminModalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.l,
  },
  adminModalTitle: {
    ...typography.h2,
    marginBottom: spacing.s,
  },
  adminModalDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  adminInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginBottom: spacing.s,
  },
  adminErrorText: {
    ...typography.captionRegular,
    color: colors.error,
    marginBottom: spacing.s,
  },
  adminModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.s,
  },
  adminModalButton: {
    minWidth: 90,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.s,
    alignItems: 'center',
  },
  adminModalCancel: {
    backgroundColor: colors.lightGray,
  },
  adminModalCancelText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  adminModalConfirm: {
    backgroundColor: colors.error,
  },
  adminModalConfirmText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});

export default SettingsScreen;


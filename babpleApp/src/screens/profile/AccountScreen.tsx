import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useDispatch, useSelector} from 'react-redux';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {GoogleSignin} from '@react-native-google-signin/google-signin';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AuthAPI} from '../../api/ApiRequests';
import {RootState} from '../../redux';
import {USER_LOGOUT_SUCCESS, USER_PROFILE_UPDATE_SUCCESS} from '../../redux/states/userState';
import {CommonActions, useNavigation} from '@react-navigation/native';
import {useAlert} from '../../contexts/AlertContext';

interface AccountScreenProps {
  visible?: boolean;
  onClose?: () => void;
}

/**
 * 계정 및 보안 화면
 */
const AccountScreen: React.FC<AccountScreenProps> = ({visible = true, onClose}) => {
  const {alert, confirm} = useAlert();
  const [isAnimating, setIsAnimating] = useState(false);
  const [isUnlinking, setIsUnlinking] = useState(false);
  const [isPasswordModalVisible, setIsPasswordModalVisible] = useState(false);
  const [passwordVerificationCode, setPasswordVerificationCode] = useState('');
  const [passwordCodeTimer, setPasswordCodeTimer] = useState(0);
  const [isPasswordCodeSending, setIsPasswordCodeSending] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isPasswordChanging, setIsPasswordChanging] = useState(false);
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteCodeTimer, setDeleteCodeTimer] = useState(0);
  const [isDeleteCodeSending, setIsDeleteCodeSending] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const userInfo = useSelector((state: RootState) => state.userState.userInfo);
  const linkedProvider = userInfo?.social_provider
    ? String(userInfo.social_provider).toUpperCase()
    : null;
  const providerLabel =
    linkedProvider === 'GOOGLE'
      ? 'Google'
      : linkedProvider === 'KAKAO'
      ? 'Kakao'
      : linkedProvider || '';
  const isSocialAccount = !!linkedProvider;

  useEffect(() => {
    if (visible) {
      setIsAnimating(true);
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        setIsAnimating(false);
      });
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    if (onClose) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-400, 0, -400],
  });

  const confirmUnlinkSocial = async () => {
    if (!linkedProvider) {
      return;
    }
    try {
      setIsUnlinking(true);
      let providerToken: string | undefined;

      if (linkedProvider === 'GOOGLE') {
        try {
          const tokens = await GoogleSignin.getTokens();
          providerToken = tokens.accessToken || tokens.idToken;
        } catch (tokenError) {
          console.log('⚠️ [계정] 구글 토큰 취득 실패:', tokenError);
        }

        try {
          await GoogleSignin.revokeAccess();
        } catch (revokeError) {
          console.log('⚠️ [계정] 구글 연동 해제 알림 실패:', revokeError);
        }
      }

      const response = await AuthAPI.unlinkSocialAccount({
        provider: linkedProvider,
        providerToken,
      });

      if (!response?.success) {
        throw new Error(response?.message || '연동 해제에 실패했습니다.');
      }

      dispatch({
        type: USER_PROFILE_UPDATE_SUCCESS,
        payload: {social_provider: null},
      });

      const stored = await AsyncStorage.getItem('userInfo');
      if (stored) {
        const parsed = JSON.parse(stored);
        parsed.social_provider = null;
        await AsyncStorage.setItem('userInfo', JSON.stringify(parsed));
      }

      alert('완료', '연동이 해제되었습니다.');
    } catch (error: any) {
      console.error('❌ [계정] 소셜 연동 해제 실패:', error);
      alert('오류', error?.message || '연동 해제에 실패했습니다.');
    } finally {
      setIsUnlinking(false);
    }
  };

  const handleUnlinkPress = async () => {
    if (!linkedProvider) {
      return;
    }
    const shouldUnlink = await confirm(
      '연동 해제',
      `${providerLabel} 계정 연동을 해제하면 일반 계정으로 전환됩니다.\n계속하시겠습니까?`,
    );
    if (shouldUnlink) {
      confirmUnlinkSocial();
    }
  };

  const handleWithdrawPress = () => {
    setDeletePassword('');
    setDeleteCode('');
    setDeleteError('');
    setDeleteCodeTimer(0);
    setIsDeleteModalVisible(true);
  };

  const logoutAfterDeletion = async () => {
    await AsyncStorage.removeItem('accessToken');
    await AsyncStorage.removeItem('refreshToken');
    await AsyncStorage.removeItem('userInfo');
    dispatch({type: USER_LOGOUT_SUCCESS, payload: null});
    navigation.dispatch(
      CommonActions.reset({
        index: 0,
        routes: [{name: 'Auth'}],
      }),
    );
    if (onClose) {
      onClose();
    }
  };

  const startTimer = (setter: React.Dispatch<React.SetStateAction<number>>) => {
    setter(180);
  };

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (passwordCodeTimer > 0) {
      interval = setInterval(() => {
        setPasswordCodeTimer(prev => {
          if (prev <= 1) {
            if (interval) {
              clearInterval(interval);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [passwordCodeTimer]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (deleteCodeTimer > 0) {
      interval = setInterval(() => {
        setDeleteCodeTimer(prev => {
          if (prev <= 1) {
            if (interval) {
              clearInterval(interval);
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [deleteCodeTimer]);

  const handleSendPasswordCode = async () => {
    if (!userInfo?.email) {
      return;
    }
    setIsPasswordCodeSending(true);
    try {
      const response = await AuthAPI.requestEmailVerificationCode({
        email: userInfo.email,
        purpose: 'PASSWORD_CHANGE',
      });
      if (response?.success) {
        startTimer(setPasswordCodeTimer);
        alert('안내', '이메일로 인증번호를 전송했습니다.');
      } else {
        alert('오류', response?.message || '인증번호 전송에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [계정] 비밀번호 코드 전송 실패:', error);
      alert('오류', error?.message || '인증번호 전송에 실패했습니다.');
    } finally {
      setIsPasswordCodeSending(false);
    }
  };

  const handleSendDeleteCode = async () => {
    if (!userInfo?.email) {
      return;
    }
    setIsDeleteCodeSending(true);
    try {
      const response = await AuthAPI.requestEmailVerificationCode({
        email: userInfo.email,
        purpose: 'ACCOUNT_DELETE',
      });
      if (response?.success) {
        startTimer(setDeleteCodeTimer);
        alert('안내', '이메일로 인증번호를 전송했습니다.');
      } else {
        alert('오류', response?.message || '인증번호 전송에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [계정] 탈퇴 코드 전송 실패:', error);
      alert('오류', error?.message || '인증번호 전송에 실패했습니다.');
    } finally {
      setIsDeleteCodeSending(false);
    }
  };

  const confirmDelete = () => {
    if (isSocialAccount) {
      if (!deleteCode.trim()) {
        setDeleteError('이메일로 받은 인증번호를 입력해주세요.');
        return;
      }
    } else if (!deletePassword.trim()) {
      setDeleteError('비밀번호를 입력해주세요.');
      return;
    }
    confirm(
      '회원 탈퇴',
      '정말 탈퇴하시겠습니까? 탈퇴 후 90일 동안만 복구가 가능합니다.',
    ).then(async (shouldDelete) => {
      if (!shouldDelete) return;
      try {
        setIsDeleting(true);
        const response = await AuthAPI.requestAccountDeletion({
          password: isSocialAccount ? undefined : deletePassword.trim(),
          verificationCode: isSocialAccount ? deleteCode.trim() : undefined,
        });
        if (!response?.success) {
          throw new Error(response?.message || '회원 탈퇴에 실패했습니다.');
        }
        setIsDeleteModalVisible(false);
        setDeletePassword('');
        setDeleteCode('');
        setDeleteCodeTimer(0);
        alert('탈퇴 완료', '90일 후 모든 정보가 삭제됩니다.').then(() => {
          logoutAfterDeletion();
        });
      } catch (error: any) {
        console.error('❌ [계정] 탈퇴 실패:', error);
        setDeleteError(error?.message || '회원 탈퇴에 실패했습니다.');
      } finally {
        setIsDeleting(false);
      }
    });
  };

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{translateX}],
        },
      ]}>
      <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={handleClose}>
          <Icon name="chevron-left" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>계정 및 보안</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}>
        {/* 로그인 정보 */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>로그인 정보</Text>
          <TouchableOpacity
            style={[
              styles.settingItem,
              isSocialAccount && {opacity: 0.4},
            ]}
            disabled={isSocialAccount}
            onPress={() => {
              setIsPasswordModalVisible(true);
              setPasswordVerificationCode('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordError('');
              setPasswordCodeTimer(0);
            }}>
            <View style={styles.settingItemLeft}>
              <Icon name="lock" size={24} color={colors.textPrimary} />
              <Text style={styles.settingItemText}>
                비밀번호 변경 {isSocialAccount ? '(비활성화)' : ''}
              </Text>
            </View>
            <Icon name="chevron-right" size={20} color={colors.textPrimary} />
          </TouchableOpacity>
          {isSocialAccount && (
            <Text style={styles.socialHint}>소셜 로그인 계정은 비밀번호를 변경할 수 없습니다.</Text>
          )}
        </View>

        {/* 연동된 계정 - 숨김 처리 */}

        {/* 회원 탈퇴 */}
        <TouchableOpacity
          style={styles.withdrawItem}
          onPress={handleWithdrawPress}>
          <Text style={styles.withdrawText}>회원 탈퇴</Text>
          <Icon name="chevron-right" size={20} color={colors.textPrimary} />
        </TouchableOpacity>
      </ScrollView>
      <Modal visible={isPasswordModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => {
              setIsPasswordModalVisible(false);
              setPasswordVerificationCode('');
              setNewPassword('');
              setConfirmPassword('');
              setPasswordError('');
              setPasswordCodeTimer(0);
            }}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>비밀번호 변경</Text>
                <Text style={styles.modalDescription}>
                  이메일 인증을 완료한 후 새 비밀번호를 설정해주세요.
                </Text>
                <View style={styles.codeRow}>
                  <TextInput
                    value={passwordVerificationCode}
                    onChangeText={text => {
                      setPasswordVerificationCode(text);
                      setPasswordError('');
                    }}
                    placeholder="인증번호 6자리"
                    placeholderTextColor={colors.textTertiary}
                    keyboardType="number-pad"
                    style={[styles.passwordInput, styles.codeInput]}
                  />
                  <TouchableOpacity
                    style={[
                      styles.codeButton,
                      (passwordCodeTimer > 0 || isPasswordCodeSending) && styles.codeButtonDisabled,
                    ]}
                    disabled={passwordCodeTimer > 0 || isPasswordCodeSending}
                    onPress={handleSendPasswordCode}>
                    {isPasswordCodeSending ? (
                      <ActivityIndicator size="small" color={colors.white} />
                    ) : (
                      <Text style={styles.codeButtonText}>
                        {passwordCodeTimer > 0 ? `${passwordCodeTimer}s` : '코드 전송'}
                      </Text>
                    )}
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={newPassword}
                  onChangeText={text => {
                    setNewPassword(text);
                    setPasswordError('');
                  }}
                  placeholder="새 비밀번호"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  style={styles.passwordInput}
                />
                <TextInput
                  value={confirmPassword}
                  onChangeText={text => {
                    setConfirmPassword(text);
                    setPasswordError('');
                  }}
                  placeholder="새 비밀번호 확인"
                  placeholderTextColor={colors.textTertiary}
                  secureTextEntry
                  style={styles.passwordInput}
                />
                {passwordError ? <Text style={styles.errorText}>{passwordError}</Text> : null}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancel]}
                    onPress={() => {
                      setIsPasswordModalVisible(false);
                      setPasswordVerificationCode('');
                      setNewPassword('');
                      setConfirmPassword('');
                      setPasswordError('');
                      setPasswordCodeTimer(0);
                    }}>
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirm]}
                    onPress={async () => {
                      if (!passwordVerificationCode.trim()) {
                        setPasswordError('이메일 인증번호를 입력해주세요.');
                        return;
                      }
                      if (newPassword.length < 8) {
                        setPasswordError('비밀번호는 8자 이상이어야 합니다.');
                        return;
                      }
                      if (newPassword !== confirmPassword) {
                        setPasswordError('비밀번호가 일치하지 않습니다.');
                        return;
                      }
                      try {
                        setIsPasswordChanging(true);
                        const response = await AuthAPI.changePassword({
                          newPassword,
                          verificationCode: passwordVerificationCode.trim(),
                        });
                        if (!response?.success) {
                          throw new Error(response?.message || '비밀번호 변경에 실패했습니다.');
                        }
                        alert('완료', '비밀번호가 변경되었습니다.');
                        setIsPasswordModalVisible(false);
                        setPasswordVerificationCode('');
                        setNewPassword('');
                        setConfirmPassword('');
                      } catch (error: any) {
                        console.error('❌ [계정] 비밀번호 변경 실패:', error);
                        setPasswordError(error?.message || '비밀번호 변경에 실패했습니다.');
                      } finally {
                        setIsPasswordChanging(false);
                      }
                    }}
                    disabled={isPasswordChanging}>
                    {isPasswordChanging ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.modalConfirmText}>변경</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={isDeleteModalVisible} transparent animationType="fade">
        <KeyboardAvoidingView 
          style={{flex: 1}}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
          <TouchableOpacity
            activeOpacity={1}
            style={styles.modalBackdrop}
            onPress={() => {
              setIsDeleteModalVisible(false);
              setDeletePassword('');
              setDeleteCode('');
              setDeleteError('');
              setDeleteCodeTimer(0);
            }}>
            <TouchableOpacity activeOpacity={1} onPress={(e) => e.stopPropagation()}>
              <View style={styles.modalContent}>
                <Text style={styles.modalTitle}>회원 탈퇴</Text>
                {isSocialAccount ? (
                  <>
                    <Text style={styles.modalDescription}>
                      연동된 이메일로 받은 인증번호를 입력하면 탈퇴를 진행할 수 있습니다.
                    </Text>
                    <View style={styles.codeRow}>
                      <TextInput
                        value={deleteCode}
                        onChangeText={text => {
                          setDeleteCode(text);
                          setDeleteError('');
                        }}
                        placeholder="인증번호 6자리"
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        style={[styles.passwordInput, styles.codeInput]}
                      />
                      <TouchableOpacity
                        style={[
                          styles.codeButton,
                          (deleteCodeTimer > 0 || isDeleteCodeSending) && styles.codeButtonDisabled,
                        ]}
                        disabled={deleteCodeTimer > 0 || isDeleteCodeSending}
                        onPress={handleSendDeleteCode}>
                        {isDeleteCodeSending ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Text style={styles.codeButtonText}>
                            {deleteCodeTimer > 0 ? `${deleteCodeTimer}s` : '코드 전송'}
                          </Text>
                        )}
                      </TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <>
                    <Text style={styles.modalDescription}>
                      계정 탈퇴를 위해 비밀번호를 입력해주세요.
                    </Text>
                    <TextInput
                      value={deletePassword}
                      onChangeText={text => {
                        setDeletePassword(text);
                        setDeleteError('');
                      }}
                      placeholder="비밀번호"
                      secureTextEntry
                      style={styles.passwordInput}
                    />
                  </>
                )}
                {deleteError ? <Text style={styles.errorText}>{deleteError}</Text> : null}
                <View style={styles.modalActions}>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalCancel]}
                    onPress={() => {
                      setIsDeleteModalVisible(false);
                      setDeletePassword('');
                      setDeleteCode('');
                      setDeleteError('');
                      setDeleteCodeTimer(0);
                    }}>
                    <Text style={styles.modalCancelText}>취소</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.modalButton, styles.modalConfirm]}
                    onPress={confirmDelete}
                    disabled={isDeleting}>
                    {isDeleting ? (
                      <ActivityIndicator color={colors.white} />
                    ) : (
                      <Text style={styles.modalConfirmText}>다음</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            </TouchableOpacity>
          </TouchableOpacity>
        </KeyboardAvoidingView>
      </Modal>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
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
  socialHint: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  providerBadge: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginLeft: spacing.m,
  },
  googleIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#4285F4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  googleIcon: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#4285F4',
  },
  unlinkButton: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
  },
  unlinkText: {
    ...typography.bodyMedium,
    color: colors.error,
  },
  emptyLinkedText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  withdrawItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginTop: spacing.l,
  },
  withdrawText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  modalContent: {
    width: '100%',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.l,
  },
  modalTitle: {
    ...typography.h2,
    marginBottom: spacing.s,
  },
  modalDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginBottom: spacing.m,
  },
  passwordInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginBottom: spacing.s,
    fontSize: 14,
    color: colors.textPrimary,
    minHeight: 44,
  },
  codeInput: {
    flex: 1,
  },
  codeRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: spacing.s,
    marginBottom: spacing.s,
  },
  codeButton: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.s,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 44,
  },
  codeButtonDisabled: {
    backgroundColor: colors.mediumGray,
  },
  codeButtonText: {
    ...typography.captionMedium,
    color: colors.white,
  },
  errorText: {
    ...typography.captionRegular,
    color: colors.error,
    marginBottom: spacing.s,
  },
  modalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.s,
  },
  modalButton: {
    minWidth: 80,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.s,
    alignItems: 'center',
  },
  modalCancel: {
    backgroundColor: colors.lightGray,
  },
  modalCancelText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  modalConfirm: {
    backgroundColor: colors.error,
  },
  modalConfirmText: {
    ...typography.bodyMedium,
    color: colors.white,
  },
});

export default AccountScreen;


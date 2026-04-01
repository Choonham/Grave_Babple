import React, {useEffect, useMemo, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useSelector, useDispatch} from 'react-redux';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Button, TextInput, IconButton} from '../../components/common';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {RootState} from '../../redux';
import {AuthAPI} from '../../api/ApiRequests';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {setRegisterInProgress} from '../../redux/states/userState';
import {useAlert} from '../../contexts/AlertContext';

type BusinessType = 'mart' | 'advertiser';

interface RouteParams {
  account_type?: BusinessType;
  isBiz?: boolean;
}

/**
 * 이메일 인증 화면
 * 일반 회원가입 및 사업자 회원가입 사용자가 이메일로 받은 인증 코드를 입력하도록 유도합니다.
 */
const VerifyEmailScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation<any>();
  const route = useRoute();
  const {account_type, isBiz} = (route.params as RouteParams) || {};
  const dispatch = useDispatch();
  const registerInProgress = useSelector(
    (state: RootState) => state.userState.registerInProgress,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.userState.isAuthenticated,
  );

  const [isRestoring, setIsRestoring] = useState(true);

  const restoreRegisterInfo = useCallback(async () => {
    // 이미 로그인된 상태라면 복원할 필요 없음
    if (isAuthenticated) {
      console.log('✅ [이메일 인증] 이미 로그인된 상태, 복원 건너뛰기');
      setIsRestoring(false);
      return;
    }
    
    if (registerInProgress?.userId && registerInProgress?.email) {
      console.log('✅ [이메일 인증] Redux에 이미 정보 있음:', registerInProgress.email);
      setIsRestoring(false);
      return;
    }
    try {
      // 비즈 회원가입인 경우 temp_biz_register_info에서 가져오기
      const storageKey = isBiz ? 'temp_biz_register_info' : 'temp_register_info';
      const stored = await AsyncStorage.getItem(storageKey);
      console.log('📦 [이메일 인증] AsyncStorage에서 읽기:', storageKey, stored ? '있음' : '없음');
      if (stored) {
        const parsed = JSON.parse(stored);
        // 비즈 회원가입은 user_id, 일반은 userId
        const userId = parsed?.user_id || parsed?.userId;
        const email = parsed?.email;
        console.log('📦 [이메일 인증] 파싱 결과:', {userId, email: email ? '있음' : '없음'});
        if (userId && email) {
          dispatch(setRegisterInProgress(userId, email));
          console.log('✅ [이메일 인증] Redux에 저장 완료');
        } else {
          console.log('⚠️ [이메일 인증] userId 또는 email이 없음');
        }
      } else {
        console.log('⚠️ [이메일 인증] AsyncStorage에 정보 없음');
      }
    } catch (error) {
      console.log('⚠️ [이메일 인증] 임시 회원가입 정보 복원 실패:', error);
    } finally {
      setIsRestoring(false);
    }
  }, [dispatch, registerInProgress?.email, registerInProgress?.userId, isBiz, isAuthenticated]);

  useEffect(() => {
    // 이미 로그인된 상태라면 이 화면을 건너뛰기
    if (isAuthenticated) {
      console.log('✅ [이메일 인증] 이미 로그인된 상태, ProfileSetup으로 이동');
      // @ts-ignore
      navigation.navigate('ProfileSetup');
      return;
    }
    restoreRegisterInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const email = useMemo(() => registerInProgress?.email ?? '', [registerInProgress]);

  const [isCodeSent, setIsCodeSent] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verificationCode, setVerificationCode] = useState('');
  const [isVerified, setIsVerified] = useState(false);
  const [remainingTime, setRemainingTime] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // 이미 로그인된 상태라면 에러를 표시하지 않고 화면을 건너뛰기
    if (isAuthenticated) {
      console.log('✅ [이메일 인증] 이미 로그인된 상태, 화면 건너뛰기');
      // 이미 로그인된 상태이므로 이 화면은 필요 없음
      return;
    }
    
    // restoreRegisterInfo가 완료된 후에만 이메일 체크
    // 단, 이미 로그인된 상태가 아닐 때만 에러 표시
    if (!isRestoring && !email && !isAuthenticated) {
      console.log('⚠️ [이메일 인증] 이메일 정보 없음 - isRestoring:', isRestoring, 'email:', email, 'isAuthenticated:', isAuthenticated);
      alert('알림', '이메일 정보를 찾을 수 없습니다. 다시 회원가입을 진행해주세요.').then(() => {
        navigation.navigate('BasicRegister');
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isRestoring, email, isAuthenticated]);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, []);

  const startTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    setRemainingTime(300);
    timerRef.current = setInterval(() => {
      setRemainingTime(prev => {
        if (prev <= 1) {
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendCode = async () => {
    if (!email) {
      alert('오류', '이메일 정보를 찾을 수 없습니다.');
      return;
    }

    setIsSending(true);
    try {
      const response = await AuthAPI.requestEmailVerificationCode({
        email,
        purpose: 'REGISTER',
      });
      if (!response?.success) {
        throw new Error(response?.message || '인증 코드를 전송하지 못했습니다.');
      }

      setIsCodeSent(true);
      setIsVerified(false);
      setVerificationCode('');
      startTimer();
      alert('안내', '입력하신 이메일로 인증번호를 전송했습니다.');
    } catch (error: any) {
      console.error('❌ [이메일 인증] 전송 실패:', error);
      const message =
        error?.response?.data?.message || error?.message || '인증번호 전송 중 오류가 발생했습니다.';
      alert('오류', message);
    } finally {
      setIsSending(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      alert('오류', '이메일로 받은 인증번호를 입력해주세요.');
      return;
    }

    if (!email) {
      alert('오류', '이메일 정보를 찾을 수 없습니다.');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await AuthAPI.verifyEmailCode({
        email,
        code: verificationCode.trim(),
        purpose: 'REGISTER',
      });

      if (!response?.success) {
        throw new Error(response?.message || '인증번호가 올바르지 않습니다.');
      }

      setIsVerified(true);
      setRemainingTime(0);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      alert('완료', '이메일 인증이 완료되었습니다.').then(() => {
        // 비즈 회원가입인 경우 계정 유형에 따라 다른 화면으로 이동
        if (isBiz && account_type) {
          const userId = registerInProgress?.userId;
          const email = registerInProgress?.email || '';
          
          if (account_type === 'mart') {
            navigation.navigate('StoreRegister', {user_id: userId, email});
          } else if (account_type === 'advertiser') {
            navigation.navigate('AdvertiserRegister', {user_id: userId, email});
          }
        } else {
          // 일반 회원가입인 경우 프로필 설정 화면으로 이동
          navigation.navigate('ProfileSetup');
        }
      });
    } catch (error: any) {
      console.error('❌ [이메일 인증] 확인 실패:', error);
      const message =
        error?.response?.data?.message || error?.message || '인증번호 확인 중 오류가 발생했습니다.';
      alert('오류', message);
    } finally {
      setIsVerifying(false);
    }
  };

  /**
   * 다음 버튼 처리 - 인증 완료 후에만 다음 화면으로 이동
   */
  const handleContinue = () => {
    if (!isVerified) {
      alert('알림', '이메일 인증을 완료해주세요.');
      return;
    }
    
    console.log('✅ 이메일 인증 완료 후 다음 페이지로 이동');
    
    // 비즈 회원가입인 경우 계정 유형에 따라 다른 화면으로 이동
    if (isBiz && account_type) {
      const userId = registerInProgress?.userId;
      const email = registerInProgress?.email || '';
      
      if (account_type === 'mart') {
        navigation.navigate('StoreRegister', {user_id: userId, email});
      } else if (account_type === 'advertiser') {
        navigation.navigate('AdvertiserRegister', {user_id: userId, email});
      }
    } else {
      // 일반 회원가입인 경우 프로필 설정 화면으로 이동
      navigation.navigate('ProfileSetup');
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const sendButtonTitle = isCodeSent ? '인증 코드 재전송' : '인증 코드 보내기';
  const disableSendButton = isSending || !email || remainingTime > 0;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={styles.container}>
          <View style={styles.header}>
            <IconButton
              name="arrow-left"
              onPress={() => navigation.goBack()}
              color={colors.textPrimary}
            />
            <Text style={styles.headerTitle}>이메일 인증</Text>
            <View style={{width: 40}} />
          </View>

          {isRestoring ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>이메일 정보를 불러오는 중...</Text>
            </View>
          ) : (
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            <Text style={styles.title}>가입 이메일을 인증해주세요</Text>

            <View style={styles.infoCard}>
              <Text style={styles.infoLabel}>인증 대상 이메일</Text>
              <Text style={styles.infoEmail}>{email || '이메일 정보 없음'}</Text>
              <Text style={styles.infoDescription}>
                위 이메일로 6자리 인증번호를 전송합니다. 인증이 완료되어야 다음 단계로 이동할 수 있습니다.
              </Text>
            </View>

            <Button
              title={sendButtonTitle}
              onPress={handleSendCode}
              loading={isSending}
              disabled={disableSendButton}
              style={{marginTop: spacing.m}}
            />

            {remainingTime > 0 && (
              <Text style={styles.timerText}>
                인증번호 유효 시간 {formatTime(remainingTime)} 남음
              </Text>
            )}

            {isCodeSent && (
              <View style={styles.codeSection}>
                <Text style={styles.label}>이메일로 받은 인증번호</Text>
                <TextInput
                  placeholder="인증번호 6자리 입력"
                  value={verificationCode}
                  onChangeText={setVerificationCode}
                  keyboardType="number-pad"
                  maxLength={6}
                  style={styles.codeInput}
                />
                <Button
                  title="인증하기"
                  onPress={handleVerifyCode}
                  loading={isVerifying}
                  disabled={!verificationCode.trim()}
                />
              </View>
            )}

            <View style={styles.nextSection}>
              <Text style={styles.helperText}>
                인증이 완료되면 다음 버튼이 활성화됩니다.
              </Text>
              <Button
                title="다음"
                onPress={handleContinue}
                disabled={!isVerified}
                style={styles.nextButton}
              />
            </View>
          </ScrollView>
          )}
        </View>
      </KeyboardAvoidingView>
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
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 28,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h1,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  infoCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.l,
    shadowColor: colors.almostBlack,
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: {width: 0, height: 4},
    elevation: 2,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
  },
  infoEmail: {
    fontSize: 18,
    fontWeight: '600' as const,
    lineHeight: 26,
    fontFamily: 'Pretendard-Regular',
    color: colors.textPrimary,
    marginBottom: spacing.s,
  },
  infoDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  timerText: {
    ...typography.captionMedium,
    color: colors.error,
    textAlign: 'center',
    marginTop: spacing.s,
  },
  codeSection: {
    marginTop: spacing.xl,
  },
  label: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    marginBottom: spacing.s,
  },
  codeInput: {
    letterSpacing: 6,
    textAlign: 'center' as const,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
  },
  nextSection: {
    marginTop: spacing.xl,
  },
  helperText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.s,
  },
  nextButton: {
    marginTop: spacing.s,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  loadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
});

export default VerifyEmailScreen;



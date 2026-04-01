import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Modal,
  Dimensions,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {useNavigation, useRoute} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import {
  TextInput,
  Checkbox,
  IconButton,
} from '../../../components/common';
import {SafeAreaView} from 'react-native-safe-area-context';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AuthAPI, TermPolicy} from '../../../api/ApiRequests';
import {setRegisterInProgress} from '../../../redux/states/userState';
import {useAlert} from '../../../contexts/AlertContext';

type BusinessType = 'mart' | 'advertiser';

interface RouteParams {
  account_type: BusinessType;
}

/**
 * 사업자 회원가입 화면
 * 이메일, 비밀번호 입력 및 약관 동의를 처리합니다.
 */
const BizBasicRegisterScreen: React.FC = () => {
  const {alert} = useAlert();
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const route = useRoute();
  const {account_type} = (route.params as RouteParams) || {};

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // 약관 정보 (서버에서 받아온 약관)
  const [termsPolicies, setTermsPolicies] = useState<TermPolicy[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(true);

  // 약관 동의 상태 (동적으로 관리)
  const [termAgreements, setTermAgreements] = useState<{[key: number]: boolean}>({});
  const [allAgreed, setAllAgreed] = useState(false);

  // 에러 메시지
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');

  // 약관 상세 모달 상태
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<TermPolicy | null>(null);

  // 회원가입 진행 중
  const [isRegistering, setIsRegistering] = useState(false);

  // 개발용 백도어 - 더블 탭 카운터
  const [lastTapTime, setLastTapTime] = useState(0);

  /**
   * 화면 진입 시 약관 정보 가져오기
   */
  useEffect(() => {
    loadTermsPolicies();
  }, []);

  /**
   * 약관 정보 로드 (일반 + 비즈니스 약관)
   */
  const loadTermsPolicies = async () => {
    try {
      console.log('📋 [약관 로드] 시작 (일반 + 비즈니스)');
      setLoadingTerms(true);
      
      // 일반 약관(type=0) + 비즈니스 약관(type=1) 모두 요청
      const response = await AuthAPI.getTermsPolicies([0, 1]);
      console.log('📋 [약관 로드] API 호출 완료');
      console.log('📋 [약관 로드] 응답:', JSON.stringify(response, null, 2));
      
      if (response.success && response.data) {
        console.log('📋 [약관 로드] 성공, 약관 개수:', response.data.length);
        setTermsPolicies(response.data);

        // 약관 동의 상태 초기화
        const initialAgreements: {[key: number]: boolean} = {};
        response.data.forEach(term => {
          initialAgreements[term.id] = false;
          console.log(`📋 [약관 로드] 약관 추가: ID=${term.id}, 제목=${term.title}, 필수=${term.required}`);
        });
        setTermAgreements(initialAgreements);
        console.log('📋 [약관 로드] 약관 동의 상태 초기화 완료');
      } else {
        console.error('❌ [약관 로드] 응답 실패:', response);
        alert('오류', '약관 정보를 불러올 수 없습니다.');
      }
    } catch (error: any) {
      console.error('❌ [약관 로드] 오류 발생:', error);
      const errorMessage = error?.response?.data?.message || 
                          error?.message || 
                          '약관 정보를 불러오는 중 오류가 발생했습니다.';
      alert('오류', errorMessage);
    } finally {
      setLoadingTerms(false);
      console.log('📋 [약관 로드] 완료');
    }
  };

  /**
   * 전체 동의 토글
   */
  useEffect(() => {
    // 필수 약관이 모두 동의되었는지 확인
    const requiredTerms = termsPolicies.filter(term => term.required);
    const allRequiredAgreed = requiredTerms.length > 0 &&
      requiredTerms.every(term => termAgreements[term.id] === true);

    // 모든 약관이 동의되었는지 확인
    const allAgreed = termsPolicies.length > 0 &&
      termsPolicies.every(term => termAgreements[term.id] === true);

    setAllAgreed(allAgreed);
  }, [termAgreements, termsPolicies]);

  /**
   * 전체 동의 토글
   */
  const handleAllAgree = () => {
    const newValue = !allAgreed;
    const newAgreements: {[key: number]: boolean} = {};
    termsPolicies.forEach(term => {
      newAgreements[term.id] = newValue;
    });
    setTermAgreements(newAgreements);
  };

  /**
   * 개별 약관 동의 토글
   */
  const handleTermAgree = (termId: number) => {
    setTermAgreements(prev => ({
      ...prev,
      [termId]: !prev[termId],
    }));
  };

  /**
   * 약관 상세 보기
   */
  const handleViewTerm = (term: TermPolicy) => {
    setSelectedTerm(term);
    setTermModalVisible(true);
  };

  /**
   * 이메일 유효성 검증
   */
  const validateEmail = (text: string) => {
    setEmail(text);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (text && !emailRegex.test(text)) {
      setEmailError('올바른 이메일 형식을 입력해주세요.');
    } else {
      setEmailError('');
    }
  };

  /**
   * 비밀번호 유효성 검증
   */
  const validatePassword = (text: string) => {
    setPassword(text);
    if (text && text.length < 8) {
      setPasswordError('비밀번호는 8자 이상이어야 합니다.');
    } else {
      setPasswordError('');
    }

    // 비밀번호 확인 재검증
    if (confirmPassword) {
      if (text !== confirmPassword) {
        setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
      } else {
        setConfirmPasswordError('');
      }
    }
  };

  /**
   * 비밀번호 확인 유효성 검증
   */
  const validateConfirmPassword = (text: string) => {
    setConfirmPassword(text);
    if (text && text !== password) {
      setConfirmPasswordError('비밀번호가 일치하지 않습니다.');
    } else {
      setConfirmPasswordError('');
    }
  };

  /**
   * 약관 확인 버튼 처리
   */
  const handleViewTerms = (type: string) => {
    console.log(`${type} 약관 확인`);
    // TODO: 약관 상세 화면으로 이동
  };

  /**
   * 다음 버튼 처리 - 임시 계정 생성 후 이메일 인증 화면으로 이동
   */
  const handleNext = async () => {
    // 필수 입력 검증
    if (!email || !password || !confirmPassword) {
      alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    // 에러 검증
    if (emailError || passwordError || confirmPasswordError) {
      alert('오류', '입력 정보를 확인해주세요.');
      return;
    }

    // 약관 동의 검증 (필수 약관만)
    const requiredTerms = termsPolicies.filter(term => term.required);
    const allRequiredAgreed = requiredTerms.length > 0 &&
      requiredTerms.every(term => termAgreements[term.id] === true);

    if (!allRequiredAgreed) {
      alert('오류', '필수 약관에 동의해주세요.');
      return;
    }

    // 비밀번호 일치 확인
    if (password !== confirmPassword) {
      alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    // account_type 확인
    if (!account_type) {
      alert('오류', '계정 유형 정보가 없습니다. 다시 시도해주세요.');
      // @ts-ignore
      navigation.goBack();
      return;
    }

    try {
      setIsRegistering(true);
      console.log('📤 [사업자 임시 계정 생성] 요청:', {email, account_type});

      // 약관 동의 정보를 배열로 변환
      const terms: Array<{term_id: number; agreed: boolean}> = termsPolicies.map(term => ({
        term_id: term.id,
        agreed: termAgreements[term.id] || false,
      }));

      console.log('📤 [사업자 임시 계정 생성] 약관 동의 정보:', JSON.stringify(terms, null, 2));

      // 사업자 임시 계정 생성 API 호출
      const response = await AuthAPI.registerBizTemp({
        email,
        password,
        account_type,
        terms,
      });

      if (response.success && response.data) {
        const {user_id} = response.data;
        console.log('✅ [사업자 임시 계정 생성] 성공:', user_id);

        // user_id와 email을 AsyncStorage에 저장
        await AsyncStorage.setItem(
          'temp_biz_register_info',
          JSON.stringify({user_id, email, account_type}),
        );

        // Redux에 회원가입 진행 상태 저장
        dispatch(setRegisterInProgress(user_id, email));

        // 이메일 인증 화면으로 이동 (account_type 정보도 전달)
        // @ts-ignore
        navigation.navigate('VerifyEmail', {account_type, isBiz: true});
      } else {
        // 응답은 받았지만 success가 false인 경우
        const errorMessage = response.message || '임시 계정 생성에 실패했습니다.';
        console.error('❌ [사업자 임시 계정 생성] 실패:', errorMessage);
        alert('회원가입 실패', errorMessage);
      }
    } catch (error: any) {
      console.error('❌ [사업자 임시 계정 생성] 오류:', error);
      console.error('❌ [사업자 임시 계정 생성] 오류 응답:', error.response?.data);
      console.error('❌ [사업자 임시 계정 생성] 오류 상태:', error.response?.status);
      
      // 에러 응답에서 메시지 추출
      let errorMessage = '임시 계정 생성 중 오류가 발생했습니다.';
      
      if (error.response?.data) {
        // 백엔드에서 반환한 에러 메시지
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        // 네트워크 오류 등
        errorMessage = error.message;
      }
      
      alert('회원가입 실패', errorMessage);
    } finally {
      setIsRegistering(false);
    }
  };

  /**
   * 개발용 백도어 - 더블 탭 처리
   */
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 500) {
      // 0.5초 이내에 두 번 탭이면 다음 페이지로 이동
      setLastTapTime(0);

      console.log('✅ 개발 백도어: 다음 페이지로 이동');
      // handleNext 호출
      handleNext();
    } else {
      // 첫 번째 탭: 일반 처리
      handleNext();
      setLastTapTime(now);
    }
  };

  /**
   * 로그인 화면으로 이동
   */
  const handleGoToLogin = () => {
    // @ts-ignore
    navigation.navigate('Login');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{flex: 1}}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <IconButton
              name="arrow-left"
              onPress={() => navigation.goBack()}
              color={colors.textPrimary}
            />
            <Text style={styles.headerTitle}>사업자 회원가입</Text>
            <View style={{width: 40}} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
        {/* 타이틀 */}
        <Text style={styles.title} allowFontScaling={false}>
          <Text style={styles.titleHighlight}>Babple의 비즈니스 파트너가 되어주세요</Text>
        </Text>

        {/* 이메일 입력 */}
        <TextInput
          placeholder="이메일"
          value={email}
          onChangeText={validateEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          error={!!emailError}
          style={styles.input}
          maxLength={100}
        />
        {emailError ? (
          <Text style={styles.errorText}>{emailError}</Text>
        ) : (
          <View style={styles.placeholderText} />
        )}

        {/* 비밀번호 입력 */}
        <TextInput
          placeholder="비밀번호"
          value={password}
          onChangeText={validatePassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          error={!!passwordError}
          style={styles.input}
          maxLength={50}
        />
        {passwordError ? (
          <Text style={styles.errorText}>{passwordError}</Text>
        ) : (
          <View style={styles.placeholderText} />
        )}

        {/* 비밀번호 확인 입력 */}
        <TextInput
          placeholder="비밀번호 확인"
          value={confirmPassword}
          onChangeText={validateConfirmPassword}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          error={!!confirmPasswordError}
          style={styles.input}
          maxLength={50}
        />
        {confirmPasswordError ? (
          <Text style={styles.errorText}>{confirmPasswordError}</Text>
        ) : (
          <View style={styles.placeholderText} />
        )}

        {/* 약관 동의 */}
        {loadingTerms ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>약관 정보를 불러오는 중...</Text>
          </View>
        ) : (
          <View style={styles.agreementContainer}>
            {/* 전체 동의 */}
            <Checkbox
              label="전체 동의"
              checked={allAgreed}
              onPress={handleAllAgree}
              style={styles.checkbox}
            />
            <View style={styles.separator} />

            {/* 동적으로 약관 목록 표시 */}
            {termsPolicies.map(term => (
              <TouchableOpacity
                key={term.id}
                style={styles.checkboxRow}
                onPress={() => handleTermAgree(term.id)}>
                <Checkbox
                  label={term.title}
                  checked={termAgreements[term.id] || false}
                  onPress={() => handleTermAgree(term.id)}
                  required={term.required}
                  style={styles.checkbox}
                />
                <TouchableOpacity
                  onPress={() => handleViewTerm(term)}
                  style={styles.termsButton}>
                  <Text style={styles.termsButtonText}>확인</Text>
                </TouchableOpacity>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 약관 상세 모달 */}
        <Modal
          visible={termModalVisible}
          animationType="slide"
          transparent={false}
          onRequestClose={() => setTermModalVisible(false)}>
          <SafeAreaView style={styles.modalSafeArea} edges={['top', 'bottom']}>
            <View style={styles.modalContainer}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {selectedTerm?.title || '약관'}
                </Text>
                <TouchableOpacity
                  onPress={() => setTermModalVisible(false)}
                  style={styles.modalCloseButton}>
                  <Text style={styles.modalCloseText}>닫기</Text>
                </TouchableOpacity>
              </View>
              <ScrollView 
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}>
                <Markdown style={markdownStyles}>
                  {selectedTerm?.content || '약관 내용이 없습니다.'}
                </Markdown>
              </ScrollView>
            </View>
          </SafeAreaView>
        </Modal>

        {/* 로그인 링크 */}
        <View style={styles.loginLinkContainer}>
          <Text style={styles.loginLinkText}>이미 사업자 회원이신가요?</Text>
          <TouchableOpacity onPress={handleGoToLogin}>
            <Text style={styles.loginLinkButton}>로그인하기</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* 다음 버튼 - 고정 위치 */}
      <TouchableOpacity
        style={[styles.nextButton, isRegistering && styles.nextButtonDisabled]}
        onPress={handleDoubleTap}
        disabled={isRegistering || loadingTerms}>
        {isRegistering ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.nextButtonText}>다음</Text>
        )}
      </TouchableOpacity>
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
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.m,
  },
  title: {
    ...typography.h1,
    textAlign: 'center',
    marginBottom: spacing.l,
  },
  titleText: {
    ...typography.h1,
    color: colors.textPrimary,
  },
  titleHighlight: {
    ...typography.h2,
    color: colors.primary,
  },
  input: {
    marginBottom: 0,
  },
  errorText: {
    ...typography.captionRegular,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  placeholderText: {
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  agreementContainer: {
    marginTop: spacing.l,
    marginBottom: spacing.l,
  },
  checkbox: {
    marginBottom: spacing.m,
  },
  checkboxRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  termsButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.s,
  },
  termsButtonText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginVertical: spacing.m,
  },
  loginLinkContainer: {
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  loginLinkText: {
    ...typography.captionRegular,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  loginLinkButton: {
    ...typography.captionRegular,
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  nextButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.l,
    marginBottom: 30,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.l,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalCloseText: {
    ...typography.bodyMedium,
    color: colors.primary,
  },
  modalBody: {
    flex: 1,
  },
  modalBodyContent: {
    padding: spacing.l,
  },
  modalText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    lineHeight: 24,
  },
});

// 마크다운 스타일
const markdownStyles = {
  body: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'System',
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 7,
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  heading4: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 5,
  },
  paragraph: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.textPrimary,
  },
  listItem: {
    marginTop: 4,
    marginBottom: 4,
    color: colors.textPrimary,
  },
  bullet_list: {
    marginTop: 8,
    marginBottom: 8,
  },
  ordered_list: {
    marginTop: 8,
    marginBottom: 8,
  },
  code_inline: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  strong: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
    color: colors.textPrimary,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  hr: {
    backgroundColor: colors.lightGray,
    height: 1,
    marginTop: 16,
    marginBottom: 16,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  table: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  thead: {
    backgroundColor: colors.background,
  },
  th: {
    padding: 8,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  td: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
};

export default BizBasicRegisterScreen;


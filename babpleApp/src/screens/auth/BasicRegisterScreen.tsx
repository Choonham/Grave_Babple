import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {useDispatch} from 'react-redux';
import {useNavigation} from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Markdown from 'react-native-markdown-display';
import {setRegisterInProgress} from '../../redux/states/userState';
import {
  ScreenWrapper,
  Button,
  TextInput,
  Checkbox,
  IconButton,
} from '../../components/common';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '../../styles/commonStyles';
import {AuthAPI, TermPolicy, TermAgree} from '../../api/ApiRequests';
import {useAlert} from '../../contexts/AlertContext';

/**
 * 기본 회원가입 화면
 * 이메일, 비밀번호 입력 및 약관 동의를 처리합니다.
 */
const BasicRegisterScreen: React.FC = () => {
  const dispatch = useDispatch();
  const navigation = useNavigation();
  const {alert} = useAlert();
  const insets = useSafeAreaInsets();

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

  // 회원가입 진행 중
  const [isRegistering, setIsRegistering] = useState(false);

  // 약관 상세 모달 상태
  const [termModalVisible, setTermModalVisible] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<TermPolicy | null>(null);

  // 개발용 백도어 - 더블 탭 카운터
  const [lastTapTime, setLastTapTime] = useState(0);

  /**
   * 화면 진입 시 약관 정보 가져오기
   */
  useEffect(() => {
    loadTermsPolicies();
  }, []);

  /**
   * 약관 정보 로드
   */
  const loadTermsPolicies = async () => {
    try {
      console.log('📋 [약관 로드] 시작');
      setLoadingTerms(true);
      
      console.log('📋 [약관 로드] API 호출 전 (일반 약관만)');
      // 일반 약관만 요청 (type=0)
      const response = await AuthAPI.getTermsPolicies([0]);
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
      console.error('❌ [약관 로드] 오류 발생');
      console.error('❌ [약관 로드] 오류 타입:', error?.constructor?.name);
      console.error('❌ [약관 로드] 오류 메시지:', error?.message);
      console.error('❌ [약관 로드] 오류 상세:', error);
      console.error('❌ [약관 로드] 오류 코드:', error?.code);
      console.error('❌ [약관 로드] 오류 응답:', error?.response);
      
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
   * 약관 확인 버튼 처리 - 모달 열기
   */
  const handleViewTerms = (termId: number) => {
    const term = termsPolicies.find(t => t.id === termId);
    if (term) {
      console.log(`${term.title} 약관 확인`);
      setSelectedTerm(term);
      setTermModalVisible(true);
    }
  };

  /**
   * 약관 모달 닫기
   */
  const handleCloseTermModal = () => {
    setTermModalVisible(false);
    setSelectedTerm(null);
  };

  /**
   * 다음 버튼 처리 - 회원가입 진행
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

    // 비밀번호 일치 확인
    if (password !== confirmPassword) {
      alert('오류', '비밀번호가 일치하지 않습니다.');
      return;
    }

    // 필수 약관 동의 검증
    const requiredTerms = termsPolicies.filter(term => term.required);
    const allRequiredAgreed = requiredTerms.length > 0 &&
      requiredTerms.every(term => termAgreements[term.id] === true);

    if (!allRequiredAgreed) {
      alert('오류', '필수 약관에 동의해주세요.');
      return;
    }

    // 회원가입 진행
    try {
      setIsRegistering(true);

      // 약관 동의 정보를 배열로 변환
      const terms: TermAgree[] = termsPolicies.map(term => ({
        term_id: term.id,
        agreed: termAgreements[term.id] || false,
      }));

      // 전송할 데이터 준비
      const requestData = {
        email,
        password,
        terms,
      };

      console.log('📤 [회원가입] 전송할 데이터:');
      console.log('   - email:', email);
      console.log('   - password:', password ? '***' : undefined);
      console.log('   - terms:', JSON.stringify(terms, null, 2));
      console.log('   - terms 타입:', typeof terms);
      console.log('   - terms 배열인가?', Array.isArray(terms));
      console.log('   - terms 길이:', terms.length);

      // 서버로 회원가입 요청
      console.log('📤 [회원가입] API 호출 시작');
      const response = await AuthAPI.registerBasic(requestData);
      console.log('📥 [회원가입] API 응답 받음:', JSON.stringify(response, null, 2));

      if (response.success && response.data) {
        const userId = response.data.user_id;

        await AsyncStorage.setItem(
          'temp_register_info',
          JSON.stringify({userId, email, password}),
        );
        dispatch(setRegisterInProgress(userId, email));

        console.log('✅ [회원가입] user_id 저장 완료:', userId);
        console.log('✅ [회원가입] Redux에 회원가입 진행 상태 저장 완료');

        // 이메일 인증 화면으로 이동
        // @ts-ignore
        navigation.navigate('VerifyEmail');
      } else {
        alert('실패', response.message || '회원가입에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('회원가입 오류:', error);
      const errorMessage = error.response?.data?.message || error.message || '회원가입 중 오류가 발생했습니다.';
      alert('오류', errorMessage);
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
      // 다음 화면으로 이동
      // @ts-ignore
      navigation.navigate('VerifyEmail');
    } else {
      // 첫 번째 탭: 일반 처리
      handleNext();
      setLastTapTime(now);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={styles.container}
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
          <Text style={styles.headerTitle}>회원가입</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
        {/* 타이틀 */}
        <Text style={styles.title} allowFontScaling={false}>밥플 시작하기</Text>

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
        <View style={styles.agreementContainer}>
          {loadingTerms ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>약관 정보를 불러오는 중...</Text>
            </View>
          ) : (
            <>
              {/* 전체 동의 */}
              <Checkbox
                label="전체 동의"
                checked={allAgreed}
                onPress={handleAllAgree}
                style={styles.checkbox}
              />
              <View style={styles.separator} />

              {/* 동적으로 약관 표시 */}
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
                    onPress={() => handleViewTerms(term.id)}
                    style={styles.termsButton}>
                    <Text style={styles.termsButtonText}>확인</Text>
                  </TouchableOpacity>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>

        {/* 다음 버튼 */}
        <TouchableOpacity
          style={[styles.nextButton, (isRegistering || loadingTerms) && styles.nextButtonDisabled]}
          onPress={handleDoubleTap}
          disabled={isRegistering || loadingTerms}>
          {isRegistering ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>다음</Text>
          )}
        </TouchableOpacity>
      </ScrollView>
        </View>
      </KeyboardAvoidingView>

    {/* 약관 상세 모달 */}
    <Modal
      visible={termModalVisible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleCloseTermModal}>
      <SafeAreaView style={styles.modalSafeArea} edges={['bottom']}>
        <View style={styles.modalContainer}>
          {/* 헤더 - insets.top을 직접 적용 */}
          <View style={[styles.modalHeader, {paddingTop: insets.top + spacing.m}]}>
            <Text style={styles.modalTitle}>
              {selectedTerm?.title || '약관'}
            </Text>
            <TouchableOpacity
              onPress={handleCloseTermModal}
              style={styles.modalCloseButton}>
              <Text style={styles.modalCloseButtonText}>닫기</Text>
            </TouchableOpacity>
          </View>

          {/* 약관 내용 */}
          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}>
            <Markdown style={markdownStyles}>
              {selectedTerm?.content || ''}
            </Markdown>
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
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
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    lineHeight: 40,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xxl,
    fontWeight: '700' as const,
  },
  input: {
    marginBottom: 0,
  },
  errorText: {
    fontSize: 14,
    lineHeight: 20,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  placeholderText: {
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  agreementContainer: {
    marginTop: spacing.xl,
    marginBottom: spacing.xl,
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
    fontSize: 14,
    lineHeight: 20,
    color: colors.textTertiary,
  },
  separator: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginVertical: spacing.m,
  },
  nextButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.xl,
  },
  nextButtonDisabled: {
    backgroundColor: colors.lightGray,
    opacity: 0.6,
  },
  nextButtonText: {
    fontSize: 16,
    lineHeight: 24,
    color: colors.white,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.l,
  },
  loadingText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginLeft: spacing.s,
  },
  // 약관 상세 모달 스타일
  modalSafeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    flex: 1,
  },
  modalCloseButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
  },
  modalCloseButtonText: {
    fontSize: 16,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: spacing.l,
  },
  modalContentText: {
    fontSize: 14,
    lineHeight: 22,
    color: colors.textPrimary,
    textAlign: 'left',
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

export default BasicRegisterScreen;


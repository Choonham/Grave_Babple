import React, { useCallback, useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { CommonActions } from '@react-navigation/native';
import { useSelector, useDispatch } from 'react-redux';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Asset } from 'react-native-image-picker';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import CustomGallery from '../../components/CustomGallery';
import { RootState } from '../../redux';
import { clearRegisterInProgress, setRegisterInProgress } from '../../redux/states/userState';
import { userLogin } from '../../redux/states/userState';
import firebaseService from '../../services/FirebaseService';
import { AuthAPI, UploadAPI } from '../../api/ApiRequests';
import {
  Button,
  TextInput,
  TextArea,
  Selector,
  IconButton,
} from '../../components/common';
import AddressSearchModal from '../../components/AddressSearchModal';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../styles/commonStyles';
import { useAlert } from '../../contexts/AlertContext';

/**
 * 프로필 설정 화면
 * 닉네임, 동네를 입력받습니다.
 */
const ProfileSetupScreen: React.FC = () => {
  const { alert, confirm } = useAlert();
  const navigation = useNavigation();
  const dispatch = useDispatch();

  // Redux에서 회원가입 진행 상태 및 로그인 상태 가져오기
  const registerInProgress = useSelector(
    (state: RootState) => state.userState.registerInProgress,
  );
  const isAuthenticated = useSelector(
    (state: RootState) => state.userState.isAuthenticated,
  );
  const currentUserInfo = useSelector(
    (state: RootState) => state.userState.userInfo,
  );

  const restoreRegisterInfo = useCallback(async () => {
    if (registerInProgress?.userId && registerInProgress?.email) {
      return;
    }

    try {
      const stored = await AsyncStorage.getItem('temp_register_info');
      if (stored) {
        const parsed = JSON.parse(stored);
        const userId = parsed?.userId;
        const email = parsed?.email;
        if (userId && email) {
          dispatch(setRegisterInProgress(userId, email));
          // 비밀번호는 temp_register_info에 그대로 유지 (회원가입 완료 시점에 읽기 위해)
        }
      }
    } catch (error) {
      console.log('⚠️ [프로필 설정] 임시 회원가입 정보 복원 실패:', error);
    }
  }, [dispatch, registerInProgress?.email, registerInProgress?.userId]);

  useEffect(() => {
    restoreRegisterInfo();
  }, [restoreRegisterInfo]);

  // 상태 관리
  const [nickname, setNickname] = useState('');
  const [introduction, setIntroduction] = useState('');

  const [neighborhood, setNeighborhood] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isAddressSearchVisible, setIsAddressSearchVisible] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);

  // 개발용 백도어 - 더블 탭 카운터
  const [doubleTapCount, setDoubleTapCount] = useState(0);
  const [lastTapTime, setLastTapTime] = useState(0);

  /**
   * 닉네임 유효성 검증
   */
  const handleNicknameChange = (text: string) => {
    setNickname(text);

    if (text.length > 0 && text.length < 2) {
      setNicknameError('닉네임은 2자 이상이어야 합니다.');
      setNicknameAvailable(false);
    } else if (text.length > 10) {
      setNicknameError('닉네임은 10자 이하여야 합니다.');
      setNicknameAvailable(false);
    } else if (text.length >= 2 && text.length <= 10) {
      // TODO: 서버에 닉네임 중복 확인 요청
      setNicknameError('');
      setNicknameAvailable(true);
    } else {
      setNicknameError('');
      setNicknameAvailable(false);
    }
  };



  /**
   * 내 동네 찾기
   */
  const handleFindNeighborhood = () => {
    setIsAddressSearchVisible(true);
  };

  /**
   * 주소 선택 시 호출
   */
  const handleAddressSelect = (address: string, coordinates?: { latitude: number; longitude: number }) => {
    setNeighborhood(address);
    setIsAddressSearchVisible(false);
    // 일반 회원가입에서는 좌표 정보를 사용하지 않음
  };

  /**
   * 프로필 사진 선택 옵션 표시 (CustomGallery 사용)
   */
  const showImagePickerOptions = () => {
    setShowCustomGallery(true);
  };

  /**
   * 프로필 이미지 업로드
   */
  const uploadProfileImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        type,
        name: filename,
      } as any);

      const response = await UploadAPI.uploadImage(formData);

      if (response.success && response.data?.image_url) {
        return response.data.image_url;
      } else {
        throw new Error(response.message || '이미지 업로드에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('프로필 이미지 업로드 오류:', error);
      alert('오류', error.message || '프로필 이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * 다음 버튼 처리 - 회원가입 완료
   */
  const handleNext = async () => {
    // 필수 입력 검증
    if (!nickname || !neighborhood) {
      alert('오류', '모든 필드를 입력해주세요.');
      return;
    }

    // 닉네임 유효성 검증
    if (nicknameError || nickname.length < 2 || nickname.length > 10) {
      alert('오류', '닉네임을 확인해주세요.');
      return;
    }

    // user_id 확인
    if (!registerInProgress || !registerInProgress.userId) {
      alert('오류', '회원가입 정보를 찾을 수 없습니다. 다시 시도해주세요.');
      // @ts-ignore
      navigation.navigate('BasicRegister');
      return;
    }

    try {
      setIsSubmitting(true);

      // 프로필 이미지 업로드 (있는 경우)
      let profileImageUrl: string | null = null;
      if (profileImageUri) {
        profileImageUrl = await uploadProfileImage(profileImageUri);
        if (!profileImageUrl) {
          // 이미지 업로드 실패 시에도 계속 진행할지 물어보기
          const shouldContinue = await confirm('이미지 업로드 실패', '프로필 이미지 업로드에 실패했습니다. 이미지 없이 계속 진행하시겠습니까?');
          if (!shouldContinue) {
            setIsSubmitting(false);
            return;
          }
        }
      }

      const completeData = {
        user_id: registerInProgress.userId,
        nickname,
        introduction: introduction.trim() || undefined,
        location_text: neighborhood,
        profile_image_url: profileImageUrl || undefined,
      };

      console.log('📤 [프로필 설정] 회원가입 완료 요청:', completeData);

      const response = await AuthAPI.completeRegistration(completeData);

      console.log('📥 [프로필 설정] 회원가입 완료 응답:', response);

      if (response.success) {
        const userEmail = registerInProgress?.email || '';

        // 구글 로그인으로 온 경우 (이미 Redux에 로그인됨) vs 일반 회원가입 (비밀번호 필요)
        const isGoogleLogin = isAuthenticated && currentUserInfo?.user_id === registerInProgress?.userId;

        if (isGoogleLogin) {
          // 구글 로그인인 경우: Redux userInfo 업데이트만 필요
          console.log('✅ [프로필 설정] 구글 로그인 감지 - Redux 업데이트만 진행');

          // 프로필 정보로 Redux 업데이트
          dispatch({
            type: 'userState/USER_PROFILE_UPDATE_SUCCESS',
            payload: {
              nickname,
              introduction: introduction.trim() || undefined,
              location_text: neighborhood,
              profile_image_url: profileImageUrl || currentUserInfo?.profile_image_url,
            },
          });

          // 회원가입 진행 상태 초기화
          dispatch(clearRegisterInProgress());
          await AsyncStorage.removeItem('temp_register_info');

          // FCM 토큰 재등록
          try {
            await firebaseService.registerPendingFcmToken();
            const currentToken = firebaseService.getFcmToken();
            if (currentToken && currentToken !== 'fcm_token') {
              await firebaseService.registerFcmToken(currentToken);
            }
          } catch (fcmError) {
            console.error('❌ [프로필 설정] FCM 토큰 재등록 실패:', fcmError);
          }

          // 메인 화면으로 이동 (일반 유저는 role 0)
          const userRole = currentUserInfo?.role ?? 0;
          if (userRole === 1) {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'BizStore' }],
              }),
            );
          } else if (userRole === 2) {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'BizAdvertiser' }],
              }),
            );
          } else {
            navigation.dispatch(
              CommonActions.reset({
                index: 0,
                routes: [{ name: 'Main' }],
              }),
            );
          }
          return;
        }

        // 일반 이메일 회원가입인 경우: 비밀번호로 자동 로그인 필요
        console.log('✅ [프로필 설정] 일반 회원가입 감지 - 자동 로그인 진행');

        // temp_register_info에서 비밀번호 읽기 (삭제 전에)
        let tempPassword: string | null = null;
        try {
          const tempInfo = await AsyncStorage.getItem('temp_register_info');
          if (tempInfo) {
            const parsed = JSON.parse(tempInfo);
            tempPassword = parsed?.password || null;
            console.log('🔑 [프로필 설정] 비밀번호 읽기:', tempPassword ? '***' : '없음');
          }
        } catch (error) {
          console.error('❌ [프로필 설정] temp_register_info 읽기 실패:', error);
        }

        // 자동 로그인 시도
        if (userEmail && tempPassword) {
          console.log('🔄 [프로필 설정] 자동 로그인 시도 - 이메일:', userEmail);
          try {
            console.log('🔄 [프로필 설정] 자동 로그인 시도...');

            // FCM 토큰 가져오기
            let fcmToken = 'fcm_token';
            try {
              const token = await firebaseService.waitForToken(3000);
              if (token && token !== 'fcm_token') {
                fcmToken = token;
              }
            } catch (fcmError) {
              console.error('❌ [프로필 설정] FCM 토큰 가져오기 실패:', fcmError);
            }

            // 로그인 시도
            dispatch(
              userLogin(userEmail, tempPassword, fcmToken, 'device_id', null, {
                onSuccess: async (data: any) => {
                  console.log('✅ [프로필 설정] 자동 로그인 성공:', data);

                  // 자동 로그인 성공 후 회원가입 진행 상태 초기화
                  dispatch(clearRegisterInProgress());
                  await AsyncStorage.removeItem('temp_register_info');
                  console.log('✅ [프로필 설정] 회원가입 진행 상태 초기화 완료');

                  // FCM 토큰 재등록
                  try {
                    await firebaseService.registerPendingFcmToken();
                    const currentToken = firebaseService.getFcmToken();
                    if (currentToken && currentToken !== 'fcm_token') {
                      await firebaseService.registerFcmToken(currentToken);
                    }
                  } catch (fcmError) {
                    console.error('❌ [프로필 설정] FCM 토큰 재등록 실패:', fcmError);
                  }

                  const user = data?.user || data;
                  const userRole = user?.role ?? 0;

                  // role에 따라 네비게이션 결정
                  if (userRole === 1) {
                    // 상점주인 경우 BizStore로 이동
                    navigation.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'BizStore' }],
                      }),
                    );
                  } else if (userRole === 2) {
                    // 광고주인 경우 BizAdvertiser로 이동
                    navigation.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'BizAdvertiser' }],
                      }),
                    );
                  } else {
                    // 일반 유저인 경우 Main 탭으로 이동
                    console.log('👤 [프로필 설정] 일반 유저로 인식, Main으로 이동');
                    navigation.dispatch(
                      CommonActions.reset({
                        index: 0,
                        routes: [{ name: 'Main' }],
                      }),
                    );
                  }
                },
                onFailure: (error: any) => {
                  console.error('❌ [프로필 설정] 자동 로그인 실패:', error);
                  console.error('❌ [프로필 설정] 에러 상세:', JSON.stringify(error, null, 2));
                  console.error('❌ [프로필 설정] 에러 응답:', error?.response?.data);
                  // 자동 로그인 실패 시 로그인 화면으로 이동 (이메일 전달)
                  alert('성공', '회원가입이 완료되었습니다!').then(() => {
                    // @ts-ignore
                    navigation.navigate('PermissionRequest', { email: userEmail });
                  });
                },
              }),
            );
          } catch (loginError) {
            console.error('❌ [프로필 설정] 자동 로그인 오류:', loginError);
            // 오류 발생 시 로그인 화면으로 이동
            alert('성공', '회원가입이 완료되었습니다!').then(() => {
              // @ts-ignore
              navigation.navigate('PermissionRequest', { email: userEmail });
            });
          }
        } else {
          // 비밀번호가 없으면 일반적으로 처리
          alert('성공', '회원가입이 완료되었습니다!').then(() => {
            // @ts-ignore
            navigation.navigate('PermissionRequest', { email: userEmail });
          });
        }
      } else {
        alert('오류', response.message || '회원가입 완료에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [프로필 설정] 회원가입 완료 오류:', error);
      alert('오류', error.response?.data?.message || '회원가입 완료 중 오류가 발생했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * 개발용 백도어 - 더블 탭 처리
   */
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 500) {
      // 0.5초 이내에 두 번 탭이면 다음 페이지로 이동
      setDoubleTapCount(0);
      setLastTapTime(0);

      console.log('✅ 개발 백도어: 다음 페이지로 이동');
      // 다음 화면으로 이동
      // @ts-ignore
      navigation.navigate('PermissionRequest');
    } else if (canProceed) {
      // 일반 탭: 조건 만족 시에만 이동
      handleNext();
    } else {
      // 첫 번째 탭 또는 조건 미충족
      setDoubleTapCount(1);
      setLastTapTime(now);
    }
  };



  /**
   * 다음 버튼 활성화 조건
   */
  const canProceed =
    nickname.length >= 2 &&
    !nicknameError &&
    neighborhood;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
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
            <View style={{ width: 40 }} />
          </View>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}>
            {/* 타이틀 */}
            <Text style={styles.title}>프로필 설정</Text>

            {/* 프로필 사진 */}
            <View style={styles.profileImageContainer}>
              <TouchableOpacity
                style={styles.profileImageWrapper}
                onPress={showImagePickerOptions}
                disabled={uploadingImage}>
                {profileImageUri ? (
                  <Image source={{ uri: profileImageUri }} style={styles.profileImage} />
                ) : (
                  <View style={styles.profileImagePlaceholder}>
                    <Icon name="camera" size={32} color={colors.textTertiary} />
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 닉네임 입력 */}
            <TextInput
              placeholder="닉네임"
              value={nickname}
              onChangeText={handleNicknameChange}
              error={!!nicknameError}
              style={styles.input}
              maxLength={10}
            />
            {nicknameError ? (
              <Text style={styles.errorText}>{nicknameError}</Text>
            ) : nicknameAvailable ? (
              <Text style={styles.successText}>사용 가능한 닉네임입니다</Text>
            ) : (
              <View style={styles.placeholderText} />
            )}

            {/* 소개글 입력 */}
            <TextArea
              placeholder="자기소개를 입력해주세요. (선택사항)"
              value={introduction}
              onChangeText={setIntroduction}
              style={styles.textArea}
              maxLength={100}
            />

            {/* 섹션 구분선 */}
            <View style={styles.divider}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>추가 정보</Text>
              <View style={styles.dividerLine} />
            </View>



            {/* 동네 입력 */}
            <View style={styles.neighborhoodWrapper}>
              <View style={styles.neighborhoodContainer}>
                <TextInput
                  placeholder="우리 동네 (읍, 면, 동)"
                  value={neighborhood}
                  onChangeText={setNeighborhood}
                  editable={false}
                  style={styles.neighborhoodInput}
                />
                <TouchableOpacity
                  style={styles.findButton}
                  onPress={handleFindNeighborhood}>
                  <Text style={styles.findButtonText}>내 동네 찾기</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 다음 버튼 */}
            <TouchableOpacity
              style={[
                styles.nextButton,
                (!canProceed || isSubmitting) && styles.nextButtonDisabled,
              ]}
              onPress={handleDoubleTap}
              disabled={!canProceed || isSubmitting}>
              {isSubmitting ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.nextButtonText}>Babple 시작하기</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>

        {/* 주소 검색 모달 */}
        <AddressSearchModal
          visible={isAddressSearchVisible}
          onClose={() => setIsAddressSearchVisible(false)}
          onSelect={handleAddressSelect}
        />

        {/* 커스텀 갤러리 */}
        <CustomGallery
          visible={showCustomGallery}
          onClose={() => setShowCustomGallery(false)}
          onSelectImage={(imageUri) => {
            setProfileImageUri(imageUri);
            setShowCustomGallery(false);
          }}
          cropperToolbarTitle="프로필 사진 편집"
          allowCropping={true}
          compressImageQuality={0.5}
        />

        {/* 로딩 오버레이 */}
        <LoadingOverlay
          visible={isSubmitting || uploadingImage}
          message={uploadingImage ? '이미지 업로드 중...' : '프로필 설정 중...'}
        />
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
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
  },
  title: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '700',
  },
  input: {
    marginBottom: spacing.m,
  },
  textArea: {
    marginBottom: spacing.m,
  },
  errorText: {
    ...typography.captionRegular,
    color: colors.error,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  successText: {
    ...typography.captionRegular,
    color: colors.success,
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  placeholderText: {
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightGray,
  },
  dividerText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginHorizontal: spacing.m,
  },
  neighborhoodWrapper: {
    marginBottom: spacing.m,
  },
  neighborhoodContainer: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  neighborhoodInput: {
    flex: 1,
  },
  findButton: {
    width: 120,
    height: 56,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
  },
  findButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
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
    backgroundColor: colors.mediumGray,
    opacity: 0.5,
  },
  nextButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  profileImageContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  profileImageWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.lightGray,
  },
  uploadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ProfileSetupScreen;


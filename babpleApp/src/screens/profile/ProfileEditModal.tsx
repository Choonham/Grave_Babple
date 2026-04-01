import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Modal,
  Animated,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
  Image,
  Dimensions,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import CustomGallery from '../../components/CustomGallery';
import { useDispatch } from 'react-redux';
import Avatar from '../../components/common/Avatar';
import Selector from '../../components/common/Selector';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import { userProfileUpdate } from '../../redux/states/userState';
import { UploadAPI } from '../../api/ApiRequests';
import AddressSearchModal from '../../components/AddressSearchModal';
import { useAlert } from '../../contexts/AlertContext';

import { API_BASE_URL } from '../../config/api';

const buildMediaUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  let normalized = trimmed.replace(/\\/g, '/');

  if (normalized.startsWith('/uploads')) {
    // Already normalized
    return `${API_BASE_URL}${normalized}`;
  }

  if (normalized.startsWith('uploads')) {
    normalized = normalized.replace(/^uploads/, '/uploads');
  } else {
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized.startsWith('/uploads')) {
      normalized = `/uploads${normalized}`;
    }
  }

  return `${API_BASE_URL}${normalized}`;
};

interface ProfileEditModalProps {
  visible: boolean;
  onClose: () => void;
  onSave: () => void;
  initialData?: {
    nickname?: string;
    introduction?: string;
    location_text?: string;
    profile_image_url?: string | null;
  };
}

/**
 * 프로필 수정 모달
 */
const ProfileEditModal: React.FC<ProfileEditModalProps> = ({
  visible,
  onClose,
  onSave,
  initialData,
}) => {
  const { alert, confirm } = useAlert();
  const dispatch = useDispatch();
  const [slideAnim] = useState(new Animated.Value(0));
  const [loading, setLoading] = useState(false);
  const [nickname, setNickname] = useState('');
  const [nicknameError, setNicknameError] = useState('');
  const [nicknameAvailable, setNicknameAvailable] = useState(true);
  const [bio, setBio] = useState('');

  const [location, setLocation] = useState('');
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [isAddressSearchVisible, setIsAddressSearchVisible] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  // 초기 데이터 로드
  useEffect(() => {
    if (visible && initialData) {
      setNickname(initialData.nickname || '');
      setBio(initialData.introduction || '');
      setLocation(initialData.location_text || '');
      setProfileImageUri(initialData.profile_image_url || null);
      setNicknameError('');
      setNicknameAvailable(true);
    }
  }, [visible, initialData]);

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
      setNicknameError('');
      setNicknameAvailable(true);
    } else {
      setNicknameError('');
      setNicknameAvailable(false);
    }
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
   * 저장 버튼 처리
   */
  const handleSave = async () => {
    console.log('🔥 [프로필 수정] handleSave 호출됨');
    // 유효성 검증
    if (!nickname || nickname.length < 2 || nickname.length > 10) {
      alert('오류', '닉네임을 확인해주세요.');
      return;
    }

    if (nicknameError) {
      alert('오류', '닉네임을 확인해주세요.');
      return;
    }

    try {
      setLoading(true);

      // 프로필 이미지 업로드 (변경된 경우)
      let profileImageUrl: string | null = null;
      if (profileImageUri && profileImageUri !== initialData?.profile_image_url) {
        // 새로운 이미지인 경우 (로컬 URI인 경우)
        // iOS 절대 경로 (/var/mobile/...) 또는 file:// 프로토콜
        const isLocalFile = profileImageUri.startsWith('file://') ||
          (profileImageUri.startsWith('/') && !profileImageUri.startsWith('/uploads'));
        if (isLocalFile) {
          profileImageUrl = await uploadProfileImage(profileImageUri);
          if (!profileImageUrl) {
            // 이미지 업로드 실패 시에도 계속 진행할지 물어보기
            const shouldContinue = await confirm('이미지 업로드 실패', '프로필 이미지 업로드에 실패했습니다. 이미지 없이 계속 진행하시겠습니까?');
            if (!shouldContinue) {
              setLoading(false);
              return;
            }
          }
        } else {
          // 이미 업로드된 이미지 URL인 경우
          profileImageUrl = profileImageUri;
        }
      } else if (profileImageUri === null && initialData?.profile_image_url) {
        // 이미지 삭제된 경우
        profileImageUrl = null;
      } else if (initialData?.profile_image_url) {
        // 이미지 변경 없음
        profileImageUrl = initialData.profile_image_url;
      }

      const updateData: any = {
        nickname: nickname.trim(),
      };

      if (bio !== undefined) {
        updateData.introduction = bio.trim() || null;
      }

      if (location !== undefined) {
        updateData.location_text = location.trim() || null;
      }
      if (profileImageUrl !== undefined) {
        updateData.profile_image_url = profileImageUrl;
      }

      console.log('📤 [프로필 수정] dispatch 시작:', updateData);
      dispatch(
        userProfileUpdate(updateData, {
          onSuccess: (data: any) => {
            console.log('✅ [프로필 수정] 성공, 응답:', data);
            // loading state를 먼저 false로 설정
            setLoading(false);
            // 약간의 딜레이를 주고 모달 닫기 (iOS에서 Modal이 완전히 정리되도록)
            setTimeout(() => {
              onSave();
              // 모달 닫힌 후 alert 표시
              setTimeout(() => {
                alert('성공', '프로필이 수정되었습니다.');
              }, 300);
            }, 100);
          },
          onFailure: (error: any) => {
            setLoading(false);
            console.error('❌ [프로필 수정] 실패:', error);
            const errorMessage =
              error?.response?.data?.message ||
              error?.message ||
              '프로필 수정에 실패했습니다.';
            alert('오류', errorMessage);
          },
        }),
      );
    } catch (error: any) {
      setLoading(false);
      console.error('❌ [프로필 수정] 오류:', error);
      alert('오류', '프로필 수정 중 오류가 발생했습니다.');
    }
  };



  React.useEffect(() => {
    if (visible) {
      // 모달이 보일 때 애니메이션 시작
      slideAnim.setValue(0); // 초기값 설정
      Animated.spring(slideAnim, {
        toValue: 1,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Android 뒤로가기 버튼 처리
  useEffect(() => {
    if (!visible) {
      return;
    }

    const onBackPress = () => {
      onClose();
      return true; // 기본 동작 방지
    };

    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }
  }, [visible, onClose]);

  const modalTranslateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Dimensions.get('window').height, 0],
  });

  const modalOpacity = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.modalContainer}>
        {/* 오버레이 */}
        <TouchableOpacity
          style={[styles.overlay, { opacity: modalOpacity }]}
          activeOpacity={1}
          onPress={onClose}
        />
        {/* 모달 컨텐츠 */}
        <Animated.View
          style={[
            styles.modalContent,
            {
              transform: [{ translateY: modalTranslateY }],
            },
          ]}>

          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Text style={styles.cancelButton}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>프로필 수정</Text>
            <TouchableOpacity onPress={handleSave} disabled={loading}>
              {loading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.saveButton}>저장</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            showsVerticalScrollIndicator={false}>
            {/* 아바타 */}
            <View style={styles.avatarContainer}>
              <TouchableOpacity
                onPress={() => {
                  // 이미지가 있으면 이미지 뷰어 표시, 없으면 이미지 선택 옵션 표시
                  if (profileImageUri || initialData?.profile_image_url) {
                    setImageViewerVisible(true);
                  } else {
                    showImagePickerOptions();
                  }
                }}
                activeOpacity={0.7}>
                <Avatar
                  source={(() => {
                    if (profileImageUri) {
                      // 이미 전체 URL인 경우
                      if (profileImageUri.startsWith('http://') || profileImageUri.startsWith('https://') || profileImageUri.startsWith('data:')) {
                        return { uri: profileImageUri };
                      }
                      // 로컬 파일 URI (file://) 
                      if (profileImageUri.startsWith('file://')) {
                        return { uri: profileImageUri };
                      }
                      // iOS 절대 경로 (/var/mobile/...) - 서버 경로(/uploads)와 구분
                      if (profileImageUri.startsWith('/') && !profileImageUri.startsWith('/uploads')) {
                        return { uri: profileImageUri };
                      }
                      // 상대 경로인 경우 buildMediaUrl로 변환
                      const fullUrl = buildMediaUrl(profileImageUri);
                      if (fullUrl) {
                        return { uri: fullUrl };
                      }
                    }
                    // profileImageUri가 없거나 변환 실패 시 initialData 사용
                    if (initialData?.profile_image_url) {
                      const fullUrl = buildMediaUrl(initialData.profile_image_url);
                      if (fullUrl) {
                        return { uri: fullUrl };
                      }
                    }
                    // 둘 다 없으면 undefined 반환 (Avatar가 defaultSource 사용)
                    return undefined;
                  })()}
                  size={100}
                  defaultSource={require('../../../assets/dev/images/feedProfile01.png')}
                />
              </TouchableOpacity>
            </View>

            {/* 닉네임 */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>닉네임</Text>
              <TextInput
                style={styles.input}
                value={nickname}
                onChangeText={handleNicknameChange}
                placeholderTextColor={colors.textTertiary}
                maxLength={10}
              />
              {nicknameError ? (
                <Text style={styles.errorText}>{nicknameError}</Text>
              ) : nicknameAvailable && nickname.length >= 2 ? (
                <Text style={styles.successText}>
                  사용 가능한 닉네임입니다
                </Text>
              ) : (
                <Text style={styles.helperText}>
                  이 닉네임으로 12일 활동했어요!
                </Text>
              )}
            </View>

            {/* 자기 소개 */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>자기 소개</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={bio}
                onChangeText={setBio}
                multiline
                numberOfLines={4}
                placeholderTextColor={colors.textTertiary}
                maxLength={100}
              />
              <Text style={styles.helperText}>
                자기 소개는 100자까지 입력할 수 있어요! ({bio.length}/100)
              </Text>
            </View>



            {/* 활동 지역 */}
            <View style={styles.fieldContainer}>
              <Text style={styles.label}>활동 지역</Text>
              <View style={styles.locationContainer}>
                <TextInput
                  style={[styles.input, styles.locationInput]}
                  value={location}
                  editable={false}
                  placeholder="주소 검색을 통해 입력하세요"
                  placeholderTextColor={colors.textTertiary}
                />
                <TouchableOpacity
                  style={styles.findLocationButton}
                  onPress={() => setIsAddressSearchVisible(true)}>
                  <Text style={styles.findLocationButtonText}>내 동네 찾기</Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>

      {/* 프로필 이미지 확대 보기 모달 */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}>
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerBackdrop}
            activeOpacity={1}
            onPress={() => setImageViewerVisible(false)}
          />
          <View style={styles.imageViewerContent}>
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                onPress={() => setImageViewerVisible(false)}
                style={styles.imageViewerCloseButton}>
                <Icon name="x" size={24} color={colors.white} />
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => {
                  setImageViewerVisible(false);
                  showImagePickerOptions();
                }}
                style={styles.imageViewerEditButton}>
                <Icon name="edit-2" size={20} color={colors.white} />
                <Text style={styles.imageViewerEditText}>수정</Text>
              </TouchableOpacity>
            </View>
            <View style={[styles.imageViewerImageContainer, { width: screenWidth, height: screenHeight }]}>
              <Image
                source={{
                  uri: profileImageUri
                    ? profileImageUri.startsWith('http://') || profileImageUri.startsWith('https://') || profileImageUri.startsWith('data:') || profileImageUri.startsWith('file://') || (profileImageUri.startsWith('/') && !profileImageUri.startsWith('/uploads'))
                      ? profileImageUri
                      : buildMediaUrl(profileImageUri) || undefined
                    : initialData?.profile_image_url
                      ? buildMediaUrl(initialData.profile_image_url) || undefined
                      : undefined,
                }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* 주소 검색 모달 */}
      <AddressSearchModal
        visible={isAddressSearchVisible}
        onClose={() => setIsAddressSearchVisible(false)}
        onSelect={(address: string) => {
          setLocation(address);
          setIsAddressSearchVisible(false);
        }}
        returnFullAddress={false}
      />

      {/* 커스텀 갤러리 */}
      <CustomGallery
        visible={showCustomGallery}
        onClose={() => setShowCustomGallery(false)}
        onSelectImage={(imageUri) => {
          setProfileImageUri(imageUri);
          setImageViewerVisible(false);
          setShowCustomGallery(false);
        }}
        cropperToolbarTitle="프로필 사진 편집"
        allowCropping={true}
        compressImageQuality={0.5}
      />

      {/* 로딩 오버레이 - Modal 내부에서 직접 렌더링 (중첩 Modal 문제 방지) */}
      {(loading || uploadingImage) && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingContent}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>
              {uploadingImage ? '이미지 업로드 중...' : '프로필 수정 중...'}
            </Text>
          </View>
        </View>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: spacing.l,
    paddingBottom: spacing.l,
    maxHeight: '90%',
    width: '100%',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  cancelButton: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  saveButton: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  scrollView: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  avatarContainer: {
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  fieldContainer: {
    marginBottom: spacing.l,
  },
  label: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    color: colors.textPrimary,
    fontSize: 15,
    textAlign: 'right',
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        lineHeight: 18, // fontSize(15)보다 약간 크게 설정하여 텍스트 잘림 방지
      }
      : {
        ...typography.bodyMedium,
      }),
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
    textAlign: 'left',
    paddingTop: spacing.s,
  },
  helperText: {
    ...typography.infoRegular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  errorText: {
    ...typography.infoRegular,
    color: colors.error,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  successText: {
    ...typography.infoRegular,
    color: colors.primary,
    marginTop: spacing.xs,
    fontSize: 12,
  },
  locationContainer: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  locationInput: {
    flex: 1,
    textAlign: 'left',
  },
  findLocationButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    justifyContent: 'center',
  },
  findLocationButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontSize: 15,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerContent: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
    paddingBottom: spacing.m,
    zIndex: 1,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerEditButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.m,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    gap: spacing.xs,
  },
  imageViewerEditText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600' as const,
  },
  imageViewerImageContainer: {
    flex: 1,
    width: '100%',
    height: '100%',
    overflow: 'hidden',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 9999,
  },
  loadingContent: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    minWidth: 200,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    marginTop: spacing.m,
    fontWeight: '600',
  },
});

export default ProfileEditModal;

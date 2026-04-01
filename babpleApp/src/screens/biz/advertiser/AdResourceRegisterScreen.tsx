import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomGallery from '../../../components/CustomGallery';
import {useSelector} from 'react-redux';
import {RootState} from '../../../redux';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI, UploadAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

import {API_BASE_URL} from '../../../config/api';

/**
 * 이미지 URL 빌드 (상대 경로를 전체 URL로 변환)
 */
const buildImageUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  // 이미 완전한 URL인 경우
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 백슬래시를 슬래시로 변환
  let normalized = trimmed.replace(/\\/g, '/');

  // /uploads로 시작하는 경우 그대로 사용
  if (normalized.startsWith('/uploads')) {
    return `${API_BASE_URL}${normalized}`;
  }

  // uploads로 시작하는 경우 앞에 /만 추가
  if (normalized.startsWith('uploads')) {
    normalized = `/${normalized}`;
    return `${API_BASE_URL}${normalized}`;
  }

  // 그 외의 경우 /uploads/ 접두사 추가
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.startsWith('/uploads')) {
    normalized = `/uploads${normalized}`;
  }

  return `${API_BASE_URL}${normalized}`;
};

type AdType = 'feedAd' | 'recipeCardAd';

interface AdResourceRegisterScreenProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 광고 소재 등록 화면
 */
const AdResourceRegisterScreen: React.FC<AdResourceRegisterScreenProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const {alert, confirm} = useAlert();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const [selectedAdType, setSelectedAdType] = useState<AdType | null>(null);
  const [advertiserName, setAdvertiserName] = useState('');
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [profileImageError, setProfileImageError] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);

  /**
   * 화면이 열릴 때 사용자 닉네임을 advertiserName에 설정 및 프로필 이미지 에러 초기화
   */
  useEffect(() => {
    if (visible && currentUser?.nickname) {
      setAdvertiserName(currentUser.nickname);
      setProfileImageError(false); // 화면이 열릴 때마다 에러 상태 초기화
      console.log('📸 [프로필 이미지] currentUser.profile_image_url:', currentUser.profile_image_url);
      console.log('📸 [프로필 이미지] 빌드된 URL:', buildImageUrl(currentUser.profile_image_url));
    }
  }, [visible, currentUser?.nickname, currentUser?.profile_image_url]);

  /**
   * 이미지 선택 옵션 표시 (CustomGallery 사용)
   */
  const showImagePickerOptions = () => {
    setShowCustomGallery(true);
  };

  /**
   * 이미지 업로드
   */
  const uploadImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'ad_image.jpg';
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
      console.error('이미지 업로드 오류:', error);
      alert('오류', error.message || '이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleImageUpload = () => {
    showImagePickerOptions();
  };

  const isFormValid = () => {
    if (!selectedAdType) return false;
    if (!adTitle.trim()) return false;
    if (!pageUrl.trim()) return false;
    if (!imageUri && !imageUrl) return false;
    return true;
  };

  const handleRegister = async () => {
    if (!isFormValid()) {
      alert('알림', '모든 필수 항목을 입력해주세요.');
      return;
    }

    try {
      setRegistering(true);

      // 이미지 업로드
      let uploadedImageUrl = imageUrl;
      if (imageUri && !imageUrl) {
        console.log('📤 [광고 소재 등록] 이미지 업로드 시작');
        uploadedImageUrl = await uploadImage(imageUri);
        if (!uploadedImageUrl) {
          alert('오류', '이미지 업로드에 실패했습니다.');
          return;
        }
        setImageUrl(uploadedImageUrl);
      }

      if (!uploadedImageUrl) {
        alert('오류', '이미지를 업로드해주세요.');
        return;
      }

      // ad_type 변환 (feedAd: 1, recipeCardAd: 2)
      const adType = selectedAdType === 'feedAd' ? 1 : 2;

      // 피드 광고일 때만 프로필 이미지 URL 빌드
      const createrImageUrl = selectedAdType === 'feedAd' && currentUser?.profile_image_url
        ? buildImageUrl(currentUser.profile_image_url) || undefined
        : undefined;

      console.log('📤 [광고 소재 등록] 요청 데이터:', {
        ad_title: adTitle,
        ad_body: adDescription || undefined,
        ad_image_url: uploadedImageUrl,
        ad_type: adType,
        landing_page_url: pageUrl,
        creater_name: advertiserName || undefined,
        creater_image_url: createrImageUrl,
      });

      // 광고 소재 등록 API 호출
      const response = await AdvertiserAPI.createCreative({
        ad_title: adTitle,
        ad_body: adDescription || undefined,
        ad_image_url: uploadedImageUrl,
        ad_type: adType,
        landing_page_url: pageUrl,
        creater_name: advertiserName || undefined,
        creater_image_url: createrImageUrl,
      });

      if (response.success && response.data) {
        console.log('✅ [광고 소재 등록] 성공:', response.data.creative_id);
        alert('성공', '광고 소재가 등록되었습니다.').then(() => {
          // 데이터 초기화
          setSelectedAdType(null);
          setAdvertiserName('');
          setAdTitle('');
          setAdDescription('');
          setPageUrl('');
          setImageUri(null);
          setImageUrl(null);
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        });
      } else {
        alert('실패', response.message || '광고 소재 등록에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [광고 소재 등록] 오류:', error);
      console.error('❌ [광고 소재 등록] 오류 응답:', error.response?.data);
      console.error('❌ [광고 소재 등록] 오류 상태:', error.response?.status);

      // 에러 응답에서 메시지 추출
      let errorMessage = '광고 소재 등록 중 오류가 발생했습니다.';

      if (error.response?.data) {
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert('광고 소재 등록 실패', errorMessage);
    } finally {
      setRegistering(false);
    }
  };

  const handleCancel = async () => {
    // Modal 위에서는 native Alert 사용
    Alert.alert(
      '확인',
      '입력한 데이터가 사라집니다. 정말 취소하시겠습니까?',
      [
        {
          text: '아니오',
          style: 'cancel',
        },
        {
          text: '예',
          style: 'destructive',
          onPress: () => {
            // 데이터 초기화
            setSelectedAdType(null);
            setAdvertiserName('');
            setAdTitle('');
            setAdDescription('');
            setPageUrl('');
            setImageUri(null);
            setImageUrl(null);
            onClose();
          },
        },
      ],
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>새 광고 소재 만들기</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 광고 유형 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                광고 유형 선택<Text style={styles.required}> (필수)</Text>
              </Text>
              <View style={styles.adTypeContainer}>
                <TouchableOpacity
                  style={[
                    styles.adTypeCard,
                    selectedAdType === 'feedAd' && styles.adTypeCardSelected,
                  ]}
                  onPress={() => setSelectedAdType('feedAd')}>
                  <Text
                    style={[
                      styles.adTypeTitle,
                      selectedAdType === 'feedAd' && styles.adTypeTitleFeedAd,
                    ]}>
                    피드 광고
                  </Text>
                  <Text style={styles.adTypeDescription}>
                    피드 중간에 자연스럽게 노출되는 광고입니다.
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.adTypeCard,
                    selectedAdType === 'recipeCardAd' &&
                      styles.adTypeCardSelected,
                  ]}
                  onPress={() => setSelectedAdType('recipeCardAd')}>
                  <Text
                    style={[
                      styles.adTypeTitle,
                      selectedAdType === 'recipeCardAd' &&
                        styles.adTypeTitleRecipeCardAd,
                    ]}>
                    레시피 카드 광고
                  </Text>
                  <Text style={styles.adTypeDescription}>
                    레시피 상세 페이지 내에 노출되는 광고입니다.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 광고 소재 만들기 */}
            {selectedAdType && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>광고 소재 만들기</Text>
                {selectedAdType === 'feedAd' ? (
                  <View style={styles.feedAdPreviewContainer}>
                    {/* 미리보기 헤더 */}
                    <View style={styles.previewHeader}>
                      <View style={styles.previewHeaderLeft}>
                        <View style={styles.userIconContainer}>
                          {currentUser?.profile_image_url && !profileImageError ? (
                            <Image
                              source={{
                                uri: buildImageUrl(currentUser.profile_image_url) || '',
                              }}
                              style={styles.userIconImage}
                              resizeMode="cover"
                              onError={(error) => {
                                console.error('❌ [프로필 이미지 로드 실패]', error.nativeEvent.error);
                                console.error('❌ [프로필 이미지 URL]', buildImageUrl(currentUser.profile_image_url));
                                setProfileImageError(true);
                              }}
                              onLoad={() => {
                                console.log('✅ [프로필 이미지 로드 성공]', buildImageUrl(currentUser.profile_image_url));
                              }}
                            />
                          ) : (
                            <Icon name="user" size={16} color={colors.textPrimary} />
                          )}
                        </View>
                        <TextInput
                          style={styles.previewAdvertiserName}
                          value={advertiserName}
                          onChangeText={setAdvertiserName}
                          placeholder="광고주 이름"
                          placeholderTextColor={colors.textTertiary}
                          maxLength={30}
                        />
                      </View>
                      <Text style={styles.sponsoredText}>Sponsored</Text>
                    </View>
                    {/* 이미지 업로드 영역 */}
                    <TouchableOpacity
                      style={styles.imageUploadArea}
                      onPress={handleImageUpload}
                      disabled={uploadingImage}>
                      {uploadingImage ? (
                        <ActivityIndicator size="large" color={colors.primary} />
                      ) : imageUri || imageUrl ? (
                        <Image
                          source={{
                            uri: imageUri || (imageUrl?.startsWith('http') ? imageUrl : `${API_BASE_URL}${imageUrl?.startsWith('/') ? imageUrl : `/${imageUrl}`}`),
                          }}
                          style={styles.uploadedImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imageUploadPlaceholder}>
                          <Icon name="image" size={48} color={colors.lightGray} />
                          <Text style={styles.imageUploadText}>
                            탭하여 이미지 추가
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                    {/* 입력 필드 */}
                    <TextInput
                      style={styles.input}
                      placeholder="광고 소재 제목을 입력해주세요"
                      placeholderTextColor={colors.textTertiary}
                      value={adTitle}
                      onChangeText={setAdTitle}
                      maxLength={30}
                      multiline={false}
                    />
                    <TextInput
                      style={[styles.input, styles.textArea]}
                      placeholder="광고 문구를 입력해주세요 (선택)"
                      placeholderTextColor={colors.textTertiary}
                      value={adDescription}
                      onChangeText={setAdDescription}
                      multiline
                      numberOfLines={4}
                      maxLength={200}
                    />
                  </View>
                ) : (
                  <View style={styles.cardAdPreviewContainer}>
                    <TextInput
                      style={styles.input}
                      placeholder="광고주 이름 혹은 프로젝트 이름을 입력해주세요"
                      placeholderTextColor={colors.textTertiary}
                      value={advertiserName}
                      onChangeText={setAdvertiserName}
                      maxLength={30}
                      multiline={false}
                    />
                    <TextInput
                      style={[styles.input, styles.inputShort]}
                      placeholder="광고 제목을 입력해주세요"
                      placeholderTextColor={colors.textTertiary}
                      value={adTitle}
                      onChangeText={setAdTitle}
                      maxLength={30}
                      multiline={false}
                    />
                    {/* 이미지 업로드 영역 */}
                    <TouchableOpacity
                      style={styles.imageUploadAreaRecipeCard}
                      onPress={handleImageUpload}
                      disabled={uploadingImage}>
                      {uploadingImage ? (
                        <ActivityIndicator size="large" color={colors.primary} />
                      ) : imageUri || imageUrl ? (
                        <Image
                          source={{
                            uri: imageUri || (imageUrl?.startsWith('http') ? imageUrl : `${API_BASE_URL}${imageUrl?.startsWith('/') ? imageUrl : `/${imageUrl}`}`),
                          }}
                          style={styles.uploadedImageRecipeCard}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={styles.imageUploadPlaceholderRecipeCard}>
                          <Icon name="camera" size={48} color={colors.lightGray} />
                          <Text style={styles.imageUploadText}>
                            탭하여 이미지 추가
                          </Text>
                        </View>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}

            {/* 연결할 페이지 주소 */}
            {selectedAdType && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>
                  연결할 페이지 주소<Text style={styles.required}> (필수)</Text>
                </Text>
                <TextInput
                  style={styles.input}
                  placeholder="사용자가 광고를 탭했을 때 이동할 주소를 입력하세요."
                  placeholderTextColor={colors.textTertiary}
                  value={pageUrl}
                  onChangeText={setPageUrl}
                />
              </View>
            )}
          </ScrollView>

          {/* 등록하기 버튼 */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              isFormValid() && styles.registerButtonActive,
              (registering || uploadingImage) && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={!isFormValid() || registering || uploadingImage}>
            {registering || uploadingImage ? (
              <ActivityIndicator color={colors.white} />
            ) : (
              <Text
                style={[
                  styles.registerButtonText,
                  isFormValid() && styles.registerButtonTextActive,
                ]}>
                등록하기
              </Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 커스텀 갤러리 */}
        <CustomGallery
          visible={showCustomGallery}
          onClose={() => setShowCustomGallery(false)}
          onSelectImage={(imageUri) => {
            setImageUri(imageUri);
            setShowCustomGallery(false);
          }}
          cropperToolbarTitle="광고 이미지 편집"
          allowCropping={true}
          compressImageQuality={0.5}
        />
      </SafeAreaView>
    </Modal>
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
    paddingBottom: spacing.m,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 20,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  required: {
    color: colors.primary,
  },
  adTypeContainer: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  adTypeCard: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  adTypeCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  adTypeTitle: {
    ...typography.bodyMedium,
    fontWeight: '600' as const,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  adTypeTitleFeedAd: {
    color: '#2E86C1',
    fontWeight: 'bold',
  },
  adTypeTitleRecipeCardAd: {
    color: '#28B463',
    fontWeight: 'bold',
  },
  adTypeDescription: {
    ...typography.infoRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  feedAdPreviewContainer: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    gap: spacing.m,
  },
  cardAdPreviewContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.m,
  },
  previewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  previewHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userIconImage: {
    width: '100%',
    height: '100%',
  },
  previewAdvertiserName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500' as const,
    width: 150,
    padding: 0,
    margin: 0,
  },
  sponsoredText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
  },
  imageUploadArea: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
  },
  imageUploadPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imageUploadText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.s,
  },
  imageUploadAreaRecipeCard: {
    width: '100%',
    aspectRatio: 2.5,
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.m,
    overflow: 'hidden',
  },
  imageUploadPlaceholderRecipeCard: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  uploadedImageRecipeCard: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.s,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    padding: spacing.m,
    ...typography.bodyRegular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  inputShort: {
    width: '80%',
    paddingVertical: 5,
    alignSelf: 'flex-start',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  registerButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.lightGray,
    paddingVertical: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonActive: {
    backgroundColor: colors.primary,
  },
  registerButtonText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontWeight: '600' as const,
  },
  registerButtonTextActive: {
    color: colors.white,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
});

export default AdResourceRegisterScreen;


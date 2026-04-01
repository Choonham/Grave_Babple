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

interface AdResourceModifyScreenProps {
  visible: boolean;
  onClose: () => void;
  resource?: {
    id: string;
    creative_id?: string;
    type: AdType;
    advertiserName?: string;
    adTitle?: string;
    adDescription?: string;
    pageUrl?: string;
    image?: any;
  };
  onSuccess?: () => void;
}

/**
 * 광고 소재 수정 화면
 */
const AdResourceModifyScreen: React.FC<AdResourceModifyScreenProps> = ({
  visible,
  onClose,
  resource: propResource,
  onSuccess,
}) => {
  const {alert, confirm} = useAlert();
  const [selectedAdType, setSelectedAdType] = useState<AdType>('feedAd');
  const [advertiserName, setAdvertiserName] = useState('');
  const [adTitle, setAdTitle] = useState('');
  const [adDescription, setAdDescription] = useState('');
  const [pageUrl, setPageUrl] = useState('');
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [createrImageUrl, setCreaterImageUrl] = useState<string | null>(null);
  const [showCustomGallery, setShowCustomGallery] = useState(false);

  /**
   * 광고 소재 데이터 로드
   */
  useEffect(() => {
    if (visible && propResource?.id) {
      loadCreativeData();
    } else if (visible && propResource) {
      // propResource에서 직접 데이터 사용
      setSelectedAdType(propResource.type);
      setAdvertiserName(propResource.advertiserName || '');
      setAdTitle(propResource.adTitle || '');
      setAdDescription(propResource.adDescription || '');
      setPageUrl(propResource.pageUrl || '');
      setImageUrl(propResource.image ? (typeof propResource.image === 'string' ? propResource.image : null) : null);
      setImageUri(null);
    }
  }, [visible, propResource]);

  const loadCreativeData = async () => {
    if (!propResource?.id) return;

    try {
      setLoading(true);
      const response = await AdvertiserAPI.getCreative(propResource.id);
      if (response.success && response.data) {
        const data = response.data;
        const adType: AdType = data.ad_type === 1 ? 'feedAd' : data.ad_type === 2 ? 'recipeCardAd' : 'feedAd';
        
        setSelectedAdType(adType);
        setAdvertiserName(data.creater_name || '');
        setAdTitle(data.ad_title || '');
        setAdDescription(data.ad_body || '');
        setPageUrl(data.landing_page_url || '');
        setImageUrl(buildImageUrl(data.ad_image_url));
        setImageUri(null);
        setCreaterImageUrl(data.creater_image_url || null);
      }
    } catch (error: any) {
      console.error('❌ [광고 소재 수정] 데이터 로드 오류:', error);
      alert('오류', '광고 소재 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

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

  const handleModify = async () => {
    if (!isFormValid()) {
      alert('알림', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!propResource?.id) {
      alert('오류', '수정할 광고 소재 정보가 없습니다.');
      return;
    }

    try {
      setModifying(true);

      // 이미지 업로드 처리
      let uploadedImageUrl = imageUrl;
      
      // 새 이미지가 선택된 경우 (imageUri가 있으면) 무조건 업로드
      if (imageUri) {
        console.log('📤 [광고 소재 수정] 새 이미지 업로드 시작');
        uploadedImageUrl = await uploadImage(imageUri);
        if (!uploadedImageUrl) {
          alert('오류', '이미지 업로드에 실패했습니다.');
          setModifying(false);
          return;
        }
        setImageUrl(uploadedImageUrl);
      } else if (imageUrl) {
        // 기존 이미지를 사용하는 경우
        // 전체 URL이면 상대 경로로 변환 (서버에 저장된 형식에 맞춤)
        if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
          // 전체 URL에서 상대 경로 추출
          const urlMatch = imageUrl.match(/\/uploads\/.+$/);
          if (urlMatch) {
            uploadedImageUrl = urlMatch[0];
          }
          // 변환 실패 시 원본 URL 사용 (서버에서 처리)
        }
      }

      if (!uploadedImageUrl) {
        alert('오류', '이미지를 업로드해주세요.');
        setModifying(false);
        return;
      }

      // ad_type 변환 (feedAd: 1, recipeCardAd: 2)
      const adType = selectedAdType === 'feedAd' ? 1 : 2;

      console.log('📤 [광고 소재 수정] 요청 데이터:', {
        ad_title: adTitle,
        ad_body: adDescription || undefined,
        ad_image_url: uploadedImageUrl,
        ad_type: adType,
        landing_page_url: pageUrl,
        creater_name: advertiserName || undefined,
      });

      // 광고 소재 수정 API 호출
      const response = await AdvertiserAPI.updateCreative(propResource.id, {
        ad_title: adTitle,
        ad_body: adDescription || undefined,
        ad_image_url: uploadedImageUrl,
        ad_type: adType,
        landing_page_url: pageUrl,
        creater_name: advertiserName || undefined,
      });

      if (response.success && response.data) {
        console.log('✅ [광고 소재 수정] 성공:', response.data.creative_id);
        alert('성공', '광고 소재가 수정되었습니다.').then(() => {
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        });
      } else {
        alert('실패', response.message || '광고 소재 수정에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [광고 소재 수정] 오류:', error);
      console.error('❌ [광고 소재 수정] 오류 응답:', error.response?.data);
      console.error('❌ [광고 소재 수정] 오류 상태:', error.response?.status);

      // 에러 응답에서 메시지 추출
      let errorMessage = '광고 소재 수정 중 오류가 발생했습니다.';

      if (error.response?.data) {
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert('광고 소재 수정 실패', errorMessage);
    } finally {
      setModifying(false);
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
            <Text style={styles.headerTitle}>광고 소재 수정하기</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 광고 유형 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>광고 유형</Text>
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
                      selectedAdType === 'feedAd' &&
                        styles.adTypeTitleSelected,
                    ]}>
                    피드 광고
                  </Text>
                  <Text
                    style={[
                      styles.adTypeDescription,
                      selectedAdType === 'feedAd' &&
                        styles.adTypeDescriptionSelected,
                    ]}>
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
                        styles.adTypeTitleSelectedRecipeCard,
                    ]}>
                    레시피 카드 광고
                  </Text>
                  <Text
                    style={[
                      styles.adTypeDescription,
                      selectedAdType === 'recipeCardAd' &&
                        styles.adTypeDescriptionSelected,
                    ]}>
                    레시피 상세 페이지 내에 노출되는 광고입니다.
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 광고 소재 미리보기 및 입력 */}
            {selectedAdType && (
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>광고 소재 만들기</Text>
                {selectedAdType === 'feedAd' ? (
                  <View>
                    {/* 미리보기 */}
                    <View style={styles.feedAdPreviewContainer}>
                      <View style={styles.feedAdHeader}>
                        <View style={styles.feedAdHeaderLeft}>
                          <View style={styles.userIconContainer}>
                            {createrImageUrl ? (
                              <Image
                                source={{
                                  uri: buildImageUrl(createrImageUrl) || '',
                                }}
                                style={styles.userIconImage}
                                resizeMode="cover"
                              />
                            ) : (
                              <Icon
                                name="user"
                                size={16}
                                color={colors.textPrimary}
                              />
                            )}
                          </View>
                          <TextInput
                            style={styles.previewAdvertiserName}
                            value={advertiserName || '(주) 삼성전자'}
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
                            <Icon
                              name="camera"
                              size={48}
                              color={colors.lightGray}
                            />
                            <Text style={styles.imageUploadText}>
                              탭하여 이미지 추가
                            </Text>
                          </View>
                        )}
                      </TouchableOpacity>
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
                          <Icon
                            name="camera"
                            size={48}
                            color={colors.lightGray}
                          />
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

          {/* 수정하기 버튼 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.registerButton,
                isFormValid() && styles.registerButtonActive,
                (modifying || uploadingImage) && styles.registerButtonDisabled,
              ]}
              onPress={handleModify}
              disabled={!isFormValid() || modifying || uploadingImage}>
              {modifying || uploadingImage ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text
                  style={[
                    styles.registerButtonText,
                    isFormValid() && styles.registerButtonTextActive,
                  ]}>
                  수정하기
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 커스텀 갤러리 */}
        <CustomGallery
          visible={showCustomGallery}
          onClose={() => setShowCustomGallery(false)}
          onSelectImage={(imageUri) => {
            setImageUri(imageUri);
            setImageUrl(null); // 새 이미지 선택 시 기존 URL 초기화
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
    width: 60,
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
    color: '#2E86C1',
    fontWeight: '600' as const,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  adTypeTitleSelected: {
    color: '#2E86C1',
  },
  adTypeTitleSelectedRecipeCard: {
    color: '#28B463',
  },
  adTypeDescription: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  adTypeDescriptionSelected: {
    color: colors.textSecondary,
  },
  feedAdPreviewContainer: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    gap: spacing.m,
  },
  feedAdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  feedAdHeaderLeft: {
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
  cardAdPreviewContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    gap: spacing.m,
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
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  inputShort: {
    width: '80%',
    paddingVertical: 5,
    alignSelf: 'flex-start',
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
  loadingContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdResourceModifyScreen;


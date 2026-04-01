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
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI} from '../../../api/ApiRequests';
import AdResourceModifyScreen from './AdResourceModifyScreen';
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

interface AdResourceDetailScreenProps {
  visible: boolean;
  onClose: () => void;
  resource?: {
    id: string;
    type: AdType;
    title: string;
    thumbnail: any;
  };
  onDeleteSuccess?: () => void;
  onModifySuccess?: () => void;
}

/**
 * 광고 소재 상세 화면
 */
const AdResourceDetailScreen: React.FC<AdResourceDetailScreenProps> = ({
  visible,
  onClose,
  resource: propResource,
  onDeleteSuccess,
  onModifySuccess,
}) => {
  const {alert, confirm} = useAlert();
  const [isModifyScreenVisible, setIsModifyScreenVisible] = useState(false);
  const [resource, setResource] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  /**
   * 광고 소재 데이터 로드
   */
  useEffect(() => {
    if (visible && propResource?.id) {
      loadCreativeData();
    } else if (visible && propResource) {
      // propResource에서 직접 데이터 사용 (기존 방식)
      setResource({
        id: propResource.id,
        type: propResource.type,
        advertiserName: 'Samsung',
        adTitle: propResource.title,
        adDescription: '',
        pageUrl: '',
        image: propResource.thumbnail,
      });
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
        
        setResource({
          id: data.creative_id,
          creative_id: data.creative_id,
          type: adType,
          advertiserName: data.creater_name || '',
          adTitle: data.ad_title || '',
          adDescription: data.ad_body || '',
          pageUrl: data.landing_page_url || '',
          image: buildImageUrl(data.ad_image_url),
          createrImageUrl: data.creater_image_url || null,
        });
      }
    } catch (error: any) {
      console.error('❌ [광고 소재 상세] 로드 오류:', error);
      alert('오류', '광고 소재 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    // Modal 위에서는 native Alert 사용
    Alert.alert(
      '확인',
      '정말 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: async () => {
            try {
              if (!resource?.id) {
                alert('오류', '삭제할 광고 소재 정보가 없습니다.');
                return;
              }

              const response = await AdvertiserAPI.deleteCreative(resource.id);
              if (response.success) {
                alert('성공', '광고 소재가 삭제되었습니다.').then(() => {
                  onClose();
                  if (onDeleteSuccess) {
                    onDeleteSuccess();
                  }
                });
              } else {
                alert('실패', response.message || '광고 소재 삭제에 실패했습니다.');
              }
            } catch (error: any) {
              console.error('❌ [광고 소재 삭제] 오류:', error);
              alert('오류', '광고 소재 삭제 중 오류가 발생했습니다.');
            }
          },
        },
      ],
    );
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        presentationStyle="fullScreen"
        onRequestClose={onClose}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View style={styles.container}>
            {/* 헤더 */}
            <View style={styles.header}>
              <TouchableOpacity
                onPress={onClose}
                style={styles.backButton}>
                <Icon name="arrow-left" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
              <Text style={styles.headerTitle}>광고 소재 상세보기</Text>
              <View style={styles.headerSpacer} />
            </View>

            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={colors.primary} />
                </View>
              ) : resource ? (
                <>
                  {/* 광고 유형 */}
                  <View style={styles.section}>
                    <Text style={styles.sectionLabel}>광고 유형</Text>
                    <View style={styles.adTypeContainer}>
                      <TouchableOpacity
                        style={[
                          styles.adTypeCard,
                          resource.type === 'feedAd' && styles.adTypeCardSelected,
                        ]}
                        disabled>
                        <Text
                          style={[
                            styles.adTypeTitle,
                            resource.type === 'feedAd' && styles.adTypeTitleSelected,
                          ]}>
                          피드 광고
                        </Text>
                        <Text
                          style={[
                            styles.adTypeDescription,
                            resource.type === 'feedAd' &&
                              styles.adTypeDescriptionSelected,
                          ]}>
                          피드 중간에 자연스럽게 노출되는 광고입니다.
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[
                          styles.adTypeCard,
                          resource.type === 'recipeCardAd' &&
                            styles.adTypeCardSelected,
                        ]}
                        disabled>
                        <Text
                          style={[
                            styles.adTypeTitle,
                            resource.type === 'recipeCardAd' &&
                              styles.adTypeTitleSelectedRecipeCard,
                          ]}>
                          레시피 카드 광고
                        </Text>
                        <Text
                          style={[
                            styles.adTypeDescription,
                            resource.type === 'recipeCardAd' &&
                              styles.adTypeDescriptionSelected,
                          ]}>
                          레시피 상세 페이지 내에 노출되는 광고입니다.
                        </Text>
                      </TouchableOpacity>
                    </View>
                  </View>

              {/* 광고 소재 미리보기 */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>광고 소재 미리보기</Text>
                {resource.type === 'feedAd' ? (
                  <View style={styles.feedAdPreviewContainer}>
                    <View style={styles.feedAdHeader}>
                      <View style={styles.feedAdHeaderLeft}>
                        <View style={styles.userIconContainer}>
                          {resource.createrImageUrl ? (
                            <Image
                              source={{
                                uri: buildImageUrl(resource.createrImageUrl) || '',
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
                        <Text style={styles.previewAdvertiserName}>
                          {resource.advertiserName}
                        </Text>
                      </View>
                      <Text style={styles.sponsoredText}>Sponsored</Text>
                    </View>
                    <View style={styles.feedAdImageContainer}>
                      {resource.image ? (
                        <Image
                          source={
                            typeof resource.image === 'string'
                              ? {uri: resource.image}
                              : resource.image
                          }
                          style={styles.feedAdImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.feedAdImage, styles.imagePlaceholder]}>
                          <Icon name="image" size={48} color={colors.lightGray} />
                        </View>
                      )}
                    </View>
                    <Text style={styles.feedAdTitle}>{resource.adTitle}</Text>
                    <Text style={styles.feedAdDescription}>
                      {resource.adDescription}
                    </Text>
                  </View>
                ) : (
                  <View style={styles.cardAdPreviewContainer}>
                    <Text style={styles.cardAdBrandName}>
                      {resource.advertiserName}
                    </Text>
                    <View style={styles.cardAdContentContainer}>
                      <View style={styles.cardAdProductInfoBar}>
                        <Text style={styles.cardAdProductInfo}>
                          {resource.adTitle}
                        </Text>
                      </View>
                      <View style={styles.cardAdImageContainer}>
                        {resource.image ? (
                          <Image
                            source={
                              typeof resource.image === 'string'
                                ? {uri: resource.image}
                                : resource.image
                            }
                            style={styles.cardAdImage}
                            resizeMode="cover"
                          />
                        ) : (
                          <View style={[styles.cardAdImage, styles.imagePlaceholder]}>
                            <Icon name="image" size={48} color={colors.lightGray} />
                          </View>
                        )}
                      </View>
                    </View>
                  </View>
                )}
              </View>

              {/* 연결할 페이지 주소 */}
              <View style={styles.section}>
                <Text style={styles.sectionLabel}>연결할 페이지 주소</Text>
                <TextInput
                  style={styles.input}
                  value={resource.pageUrl}
                  editable={false}
                  placeholderTextColor={colors.textTertiary}
                />
              </View>
                </>
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>광고 소재 정보를 불러올 수 없습니다.</Text>
                </View>
              )}
            </ScrollView>

            {/* 액션 버튼 */}
            {resource && (
              <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => setIsModifyScreenVisible(true)}>
                <Icon name="edit-2" size={24} color={colors.textPrimary} />
                <Text style={styles.actionButtonLabel}>광고 소재 수정하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDelete]}
                onPress={handleDelete}>
                <Icon name="trash-2" size={24} color={colors.textPrimary} />
                <Text style={styles.actionButtonLabel}>광고 소재 삭제하기</Text>
              </TouchableOpacity>
            </View>
            )}
          </View>
        </SafeAreaView>
      </Modal>

      {/* 광고 소재 수정 화면 */}
      <AdResourceModifyScreen
        visible={isModifyScreenVisible}
        onClose={() => setIsModifyScreenVisible(false)}
        resource={resource}
        onSuccess={() => {
          if (onModifySuccess) {
            onModifySuccess();
          }
          loadCreativeData(); // 데이터 다시 로드
          setIsModifyScreenVisible(false);
        }}
      />
    </>
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
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
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
    padding: spacing.l,
    paddingBottom: 120,
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
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.xs,
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
  },
  sponsoredText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
  },
  feedAdImageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItem: 'center',
  },
  feedAdImage: {
    width: '100%',
    height: 300,
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
  },
  feedAdTitle: {
    ...typography.bodyMedium,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800' as const,
    marginBottom: spacing.xs,
  },
  feedAdDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    paddingVertical: spacing.s,
  },
  cardAdPreviewContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  cardAdBrandName: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.m,
  },
  cardAdContentContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
  },
  cardAdProductInfoBar: {
    padding: spacing.s,
    alignSelf: 'flex-start',
  },
  cardAdProductInfo: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
  cardAdImageContainer: {
    width: '100%',
    padding: spacing.s,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItem: 'center',
  },
  cardAdImage: {
    flex: 1,
    aspectRatio: 2.5,
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
  actionButtonsContainer: {
    flexDirection: 'row',
    padding: spacing.l,
    gap: spacing.m,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
    gap: spacing.xs,
  },
  actionButtonDelete: {
    borderColor: colors.error || '#FF4444',
  },
  actionButtonLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  imagePlaceholder: {
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdResourceDetailScreen;


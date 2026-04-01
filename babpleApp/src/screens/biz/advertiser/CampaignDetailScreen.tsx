import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Modal,
  Dimensions,
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
import Selector from '../../../components/common/Selector';
import CampaignModifyScreen from './CampaignModifyScreen';
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

const {width} = Dimensions.get('window');

interface CampaignDetailScreenProps {
  visible: boolean;
  onClose: () => void;
  campaignId?: string;
  onModifySuccess?: () => void;
  onDeleteSuccess?: () => void;
}

interface AdResource {
  id: string;
  title: string;
  type: 'feedAd' | 'recipeCardAd';
  thumbnail: any;
  advertiserName?: string;
  adTitle?: string;
  adDescription?: string;
}

/**
 * 캠페인 상세 화면
 */
const CampaignDetailScreen: React.FC<CampaignDetailScreenProps> = ({
  visible,
  onClose,
  campaignId,
  onModifySuccess,
  onDeleteSuccess,
}) => {
  const {alert, confirm} = useAlert();
  const [timeFilter, setTimeFilter] = useState('7');
  const [isModifyScreenVisible, setIsModifyScreenVisible] = useState(false);
  const [campaign, setCampaign] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  const timeOptions = [
    {label: '지난 7일', value: '7'},
    {label: '지난 30일', value: '30'},
    {label: '지난 90일', value: '90'},
  ];

  /**
   * 캠페인 데이터 로드
   */
  useEffect(() => {
    if (visible && campaignId) {
      loadCampaignData();
    }
  }, [visible, campaignId]);

  const loadCampaignData = async () => {
    if (!campaignId) return;

    try {
      setLoading(true);
      const response = await AdvertiserAPI.getCampaign(campaignId);
      if (response.success && response.data) {
        setCampaign(response.data);
      }
    } catch (error: any) {
      console.error('❌ [캠페인 상세] 로드 오류:', error);
      alert('오류', '캠페인 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
   */
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'inProgress':
        return '진행 중';
      case 'COMPLETED':
      case 'completed':
        return '종료됨';
      case 'PENDING':
      case 'underReview':
        return '심사 중';
      case 'PAUSED':
      case 'paused':
        return '중단됨';
      default:
        return '';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'inProgress':
        return colors.success;
      case 'COMPLETED':
      case 'completed':
        return colors.textTertiary;
      case 'PENDING':
      case 'underReview':
        return colors.warning;
      case 'PAUSED':
      case 'paused':
        return colors.textTertiary;
      default:
        return colors.textTertiary;
    }
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
            <TouchableOpacity
              onPress={onClose}
              style={styles.backButton}>
              <Icon name="arrow-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>
              {campaign?.campaign_name || '캠페인 상세'}
            </Text>
            <TouchableOpacity
              style={styles.editButton}
              onPress={() => {
                setIsModifyScreenVisible(true);
              }}>
              <Icon name="edit-2" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
              </View>
            ) : campaign ? (
              <>
                {/* 캠페인 성과 */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>캠페인 성과</Text>
                    <Selector
                      value={timeFilter}
                      options={timeOptions}
                      onValueChange={setTimeFilter}
                      style={styles.timeFilter}
                    />
                  </View>

                  {/* KPI 카드 그리드 */}
                  <View style={styles.kpiGrid}>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiValue}>
                        {Math.round(campaign.spent).toLocaleString()}원
                      </Text>
                      <Text style={styles.kpiLabel}>총 소진 예산</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiValue}>
                        {campaign.view_count.toLocaleString()}회
                      </Text>
                      <Text style={styles.kpiLabel}>총 노출 수</Text>
                    </View>
                    <View style={styles.kpiCard}>
                      <Text style={styles.kpiValue}>
                        {campaign.click_count.toLocaleString()}회
                      </Text>
                      <Text style={styles.kpiLabel}>총 클릭 수</Text>
                    </View>
                    <View style={[styles.kpiCard, styles.kpiCardHighlighted]}>
                      <Text style={styles.kpiValue}>
                        {campaign.avgCPI.toFixed(1)}원
                      </Text>
                      <Text style={styles.kpiLabel}>평균 노출당 비용</Text>
                    </View>
                  </View>

              {/* 차트 영역 */}
              <View style={styles.chartPlaceholder}>
                <Text style={styles.chartPlaceholderText}>
                  일별 노출 수, 일별 클릭 수 등 라인 차트
                </Text>
              </View>
            </View>

                {/* 광고 미리보기 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>광고 미리보기</Text>
                  {campaign.creatives && campaign.creatives.length > 0 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.previewScrollView}
                      contentContainerStyle={styles.previewScrollContent}
                      snapToInterval={300 + spacing.m}
                      snapToAlignment="start"
                      decelerationRate="fast"
                      pagingEnabled={false}>
                      {campaign.creatives.map((creative: any, index: number) => {
                        const adType = creative.ad_type === 1 ? 'feedAd' : creative.ad_type === 2 ? 'recipeCardAd' : 'feedAd';
                        const imageUrl = buildImageUrl(creative.ad_image_url);
                        return (
                          <View
                            key={creative.creative_id}
                            style={[
                              styles.previewCard,
                              index > 0 && styles.previewCardMargin,
                            ]}>
                            {adType === 'feedAd' ? (
                              <View style={styles.feedAdPreviewContainer}>
                                {/* 피드 광고 미리보기 */}
                                <View style={styles.feedAdHeader}>
                                  <View style={styles.feedAdHeaderLeft}>
                                    <View style={styles.userIconContainer}>
                                      {creative.creater_image_url ? (
                                        <Image
                                          source={{
                                            uri: buildImageUrl(creative.creater_image_url) || '',
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
                                    <Text style={styles.advertiserName}>
                                      {creative.creater_name || '광고주'}
                                    </Text>
                                  </View>
                                  <Text style={styles.sponsoredText}>Sponsored</Text>
                                </View>
                                <View style={styles.feedAdImageContainer}>
                                  {imageUrl ? (
                                    <Image
                                      source={{uri: imageUrl}}
                                      style={styles.feedAdImage}
                                      resizeMode="cover"
                                    />
                                  ) : (
                                    <View style={[styles.feedAdImage, styles.imagePlaceholder]}>
                                      <Icon name="image" size={48} color={colors.lightGray} />
                                    </View>
                                  )}
                                </View>
                                <Text style={styles.feedAdTitle}>
                                  {creative.ad_title || '제목 없음'}
                                </Text>
                                {creative.ad_body && (
                                  <Text style={styles.feedAdDescription}>
                                    {creative.ad_body}
                                  </Text>
                                )}
                              </View>
                            ) : (
                              <View style={styles.cardAdPreviewContainer}>
                                {/* 레시피 카드 광고 미리보기 */}
                                <Text style={styles.cardAdBrandName}>
                                  {creative.creater_name || '광고주'}
                                </Text>
                                <View style={styles.cardAdContentContainer}>
                                  <View style={styles.cardAdProductInfoBar}>
                                    <Text style={styles.cardAdProductInfo}>
                                      {creative.ad_title || '제목 없음'}
                                    </Text>
                                  </View>
                                  <View style={styles.cardAdImageContainer}>
                                    {imageUrl ? (
                                      <Image
                                        source={{uri: imageUrl}}
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
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.emptyCreativesContainer}>
                      <Text style={styles.emptyCreativesText}>
                        연결된 광고 소재가 없습니다.
                      </Text>
                    </View>
                  )}
                </View>

                {/* 캠페인 설정 */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>캠페인 설정</Text>
                  <View style={styles.settingsList}>
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>상태</Text>
                      <Text
                        style={[
                          styles.settingValue,
                          {color: getStatusColor(campaign.status)},
                        ]}>
                        {getStatusLabel(campaign.status)}
                      </Text>
                    </View>
                    <View style={styles.settingDivider} />
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>총 예산</Text>
                      <Text style={styles.settingValue}>
                        ₩{campaign.total_budget.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.settingDivider} />
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>노출 당 단가</Text>
                      <Text style={styles.settingValue}>
                        ₩{campaign.cpi.toLocaleString()}
                      </Text>
                    </View>
                    <View style={styles.settingDivider} />
                    <View style={styles.settingItem}>
                      <Text style={styles.settingLabel}>기간</Text>
                      <Text style={styles.settingValue}>
                        {formatDate(campaign.start_date)} ~ {formatDate(campaign.end_date)}
                      </Text>
                    </View>
                  </View>
                </View>
              </>
            ) : (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>캠페인 정보를 불러올 수 없습니다.</Text>
              </View>
            )}
          </ScrollView>

          {/* 액션 버튼 */}
          {campaign && (
            <View style={styles.actionButtonsContainer}>
              {/* ACTIVE 상태: 비활성화 버튼 표시 */}
              {campaign.status === 'ACTIVE' && (
                <TouchableOpacity
                  style={[styles.actionButton, updatingStatus && styles.actionButtonDisabled]}
                  onPress={() => {
                    if (updatingStatus) return;
                    // Modal 위에서는 native Alert 사용
                    Alert.alert(
                      '확인',
                      '정말 중단하시겠습니까?',
                      [
                        {
                          text: '취소',
                          style: 'cancel',
                        },
                        {
                          text: '중단',
                          style: 'destructive',
                          onPress: async () => {
                            try {
                              if (!campaignId) {
                                alert('오류', '캠페인 정보가 없습니다.');
                                return;
                              }

                              setUpdatingStatus(true);
                              const response = await AdvertiserAPI.updateCampaignStatus(
                                campaignId,
                                'PAUSED',
                              );
                              if (response.success) {
                                // 즉시 로컬 상태 업데이트 (UI 즉시 반영)
                                if (campaign) {
                                  setCampaign({
                                    ...campaign,
                                    status: 'PAUSED',
                                  });
                                }
                                
                                // 데이터 새로고침 (최신 정보 확인)
                                await loadCampaignData();
                                
                                // 부모 컴포넌트에 알림 (목록 새로고침용)
                                if (onModifySuccess) {
                                  onModifySuccess();
                                }

                                alert('성공', '캠페인이 비활성화되었습니다.');
                              } else {
                                alert('실패', response.message || '캠페인 비활성화에 실패했습니다.');
                              }
                            } catch (error: any) {
                              console.error('❌ [캠페인 비활성화] 오류:', error);
                              const errorMessage =
                                error.response?.data?.message ||
                                error.message ||
                                '캠페인 비활성화 중 오류가 발생했습니다.';
                              alert('오류', errorMessage);
                            } finally {
                              setUpdatingStatus(false);
                            }
                          },
                        },
                      ],
                    );
                  }}>
                  <View style={styles.actionButtonIcon}>
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color={colors.error} />
                    ) : (
                      <Icon name="x" size={24} color={colors.error} />
                    )}
                  </View>
                  <Text style={styles.actionButtonLabel}>
                    {updatingStatus ? '처리 중...' : '캠페인 중단하기'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* PAUSED 상태: 활성화 버튼 표시 */}
              {campaign.status === 'PAUSED' && (
                <TouchableOpacity
                  style={[
                    styles.actionButton,
                    styles.actionButtonActive,
                    updatingStatus && styles.actionButtonDisabled,
                  ]}
                  onPress={async () => {
                    if (updatingStatus) return;
                    try {
                      if (!campaignId) {
                        alert('오류', '캠페인 정보가 없습니다.');
                        return;
                      }

                      setUpdatingStatus(true);
                      const response = await AdvertiserAPI.updateCampaignStatus(
                        campaignId,
                        'ACTIVE',
                      );
                      if (response.success) {
                        // 즉시 로컬 상태 업데이트 (UI 즉시 반영)
                        if (campaign) {
                          setCampaign({
                            ...campaign,
                            status: 'ACTIVE',
                          });
                        }
                        
                        // 데이터 새로고침 (최신 정보 확인)
                        await loadCampaignData();
                        
                        // 부모 컴포넌트에 알림 (목록 새로고침용)
                        if (onModifySuccess) {
                          onModifySuccess();
                        }

                        alert('성공', '캠페인이 활성화되었습니다.');
                      } else {
                        alert('실패', response.message || '캠페인 활성화에 실패했습니다.');
                      }
                    } catch (error: any) {
                      console.error('❌ [캠페인 활성화] 오류:', error);
                      const errorMessage =
                        error.response?.data?.message ||
                        error.message ||
                        '캠페인 활성화 중 오류가 발생했습니다.';
                      alert('오류', errorMessage);
                    } finally {
                      setUpdatingStatus(false);
                    }
                  }}>
                  <View style={styles.actionButtonIcon}>
                    {updatingStatus ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Icon name="play" size={16} color={colors.primary} />
                    )}
                  </View>
                  <Text style={styles.actionButtonLabel}>
                    {updatingStatus ? '처리 중...' : '활성화'}
                  </Text>
                </TouchableOpacity>
              )}

              {/* PENDING 상태: 버튼 표시 안 함 (심사 중이므로 활성화 불가) */}

              {/* 삭제 버튼 (항상 표시) */}
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDelete]}
                onPress={() => {
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
                            if (!campaignId) {
                              alert('오류', '삭제할 캠페인 정보가 없습니다.');
                              return;
                            }

                            const response = await AdvertiserAPI.deleteCampaign(campaignId);
                            if (response.success) {
                              alert('성공', '캠페인이 삭제되었습니다.').then(() => {
                                onClose();
                                if (onDeleteSuccess) {
                                  onDeleteSuccess();
                                }
                              });
                            } else {
                              alert('실패', response.message || '캠페인 삭제에 실패했습니다.');
                            }
                          } catch (error: any) {
                            console.error('❌ [캠페인 삭제] 오류:', error);
                            alert('오류', '캠페인 삭제 중 오류가 발생했습니다.');
                          }
                        },
                      },
                    ],
                  );
                }}>
                <Icon name="trash-2" size={24} color={colors.textPrimary} />
                <Text style={styles.actionButtonLabel}>캠페인 삭제하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>

      {/* 캠페인 수정 화면 */}
      <CampaignModifyScreen
        visible={isModifyScreenVisible}
        onClose={() => setIsModifyScreenVisible(false)}
        campaign={campaign}
        onSuccess={() => {
          if (onModifySuccess) {
            onModifySuccess();
          }
          loadCampaignData(); // 데이터 다시 로드
          setIsModifyScreenVisible(false);
        }}
      />
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
  editButton: {
    padding: spacing.xs,
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
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.l,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
  },
  timeFilter: {
    width: 120,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  kpiCard: {
    width: (width - spacing.l * 2 - spacing.m * 4) / 2,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  kpiCardHighlighted: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  kpiValue: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700' as const,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  kpiLabel: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  chartPlaceholder: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.m,
    padding: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  chartPlaceholderText: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  previewScrollView: {
    marginTop: spacing.m,
  },
  previewScrollContent: {
    paddingRight: spacing.l,
  },
  previewCard: {
    width: 300,
  },
  previewCardMargin: {
    marginLeft: spacing.m,
  },
  feedAdPreviewContainer: {
    width: 300,
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    gap: spacing.m,
  },
  cardAdPreviewContainer: {
    width: 300,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  feedAdHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  feedAdHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  userIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 16,
    backgroundColor: colors.lightGray,
    marginRight: spacing.xs,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  userIconImage: {
    width: '100%',
    height: '100%',
  },
  advertiserName: {
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
  feedAdImageContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItem: 'center',
  },
  feedAdImage: {
    width: 270,
    height: 270,
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
    paddingVertical: spacing.s
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
  settingsList: {
    marginTop: spacing.m,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.m,
  },
  settingLabel: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  settingValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  settingDivider: {
    height: 1,
    backgroundColor: colors.lightGray,
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
    flexDirection: 'row',
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
    borderColor: colors.primary,
  },
  actionButtonActive: {
    borderColor: colors.primary,
    backgroundColor: colors.secondary,
  },
  actionButtonIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
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
  emptyCreativesContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
  },
  emptyCreativesText: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  imagePlaceholder: {
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.6,
  },
});

export default CampaignDetailScreen;


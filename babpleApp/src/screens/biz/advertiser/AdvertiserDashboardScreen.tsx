import React, {useState, useEffect, useCallback, useMemo} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Dimensions,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {MediaType} from 'react-native-image-picker';
import CustomGallery from '../../../components/CustomGallery';
import {useSelector} from 'react-redux';
import {RootState} from '../../../redux';
import {Selector} from '../../../components/common';
import SettingsScreen from '../../profile/SettingsScreen';
import CampaignDetailScreen from './CampaignDetailScreen';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI, AuthAPI, UploadAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

const {width} = Dimensions.get('window');

/**
 * 광고주 대시보드 화면
 */
import {API_BASE_URL} from '../../../config/api';

const AdvertiserDashboardScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const [timeFilter, setTimeFilter] = useState('7');
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();

  // 광고주 정보 및 통계 상태
  const [advertiserInfo, setAdvertiserInfo] = useState<{
    biz_name: string;
    biz_owner?: string;
    charged: number;
  } | null>(null);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [allCampaigns, setAllCampaigns] = useState<any[]>([]); // 총 소진 예산 계산용
  const [loading, setLoading] = useState(true);
  const [campaignsLoading, setCampaignsLoading] = useState(false);
  const [uploadingProfileImage, setUploadingProfileImage] = useState(false);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [stats, setStats] = useState<{
    totalImpressions: number;
    totalClicks: number;
    ctr: number;
    dailyStats: Array<{date: string; impressions: number; clicks: number}>;
  } | null>(null);
  const [loadingStats, setLoadingStats] = useState(false);

  const timeOptions = [
    {label: '지난 7일', value: '7'},
    {label: '지난 30일', value: '30'},
    {label: '지난 90일', value: '90'},
  ];

  /**
   * KPI 카드 데이터 계산
   */
  const kpiCards = useMemo(() => {
    // 모든 캠페인의 spent 합계 계산 (총 소진 예산 계산용으로 allCampaigns 사용)
    const totalSpentFromCampaigns = allCampaigns.reduce((sum, c) => {
      const spent = Number(c.spent) || 0;
      return sum + spent;
    }, 0);
    
    // 총 소진 예산: advertiserInfo.charged가 있으면 사용, 없으면 모든 캠페인들의 spent 합계 사용
    // charged가 0인 경우는 캠페인들의 합계를 사용
    const totalSpent = (advertiserInfo?.charged && advertiserInfo.charged > 0) 
      ? advertiserInfo.charged 
      : totalSpentFromCampaigns;
    
    console.log('📊 [KPI 계산] 데이터:', {
      allCampaignsCount: allCampaigns.length,
      allCampaigns: allCampaigns.map(c => ({ 
        name: c.campaign_name, 
        spent: c.spent,
        view_count: c.view_count,
        cpi: c.cpi 
      })),
      totalSpentFromCampaigns,
      advertiserCharged: advertiserInfo?.charged,
      finalTotalSpent: totalSpent,
    });
    
    const totalViews = stats?.totalImpressions || campaigns.reduce((sum, c) => sum + (c.view_count || 0), 0);
    const totalClicks = stats?.totalClicks || campaigns.reduce((sum, c) => sum + (c.click_count || 0), 0);
    const avgCPI = totalViews > 0 ? totalSpent / totalViews : 0;
    const ctr = stats?.ctr || (totalViews > 0 ? (totalClicks / totalViews) * 100 : 0);

    return [
      {value: `${totalSpent.toLocaleString()}원`, label: '총 소진 예산'},
      {value: `${totalViews.toLocaleString()}회`, label: '총 노출 수'},
      {value: `${totalClicks.toLocaleString()}회`, label: '총 클릭 수'},
      {value: `${ctr.toFixed(2)}%`, label: 'CTR (클릭률)', highlighted: true},
    ];
  }, [allCampaigns, advertiserInfo?.charged, campaigns, stats]);

  /**
   * 프로필 이미지 URL 빌드
   */
  const buildImageUrl = (path?: string | null) => {
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

  /**
   * 통계 데이터 로드
   */
  const loadStats = useCallback(async () => {
    try {
      setLoadingStats(true);
      const days = parseInt(timeFilter) || 7;
      const response = await AdvertiserAPI.getAdvertiserStats(days);
      if (response.success && response.data) {
        setStats(response.data);
      }
    } catch (error: any) {
      console.error('❌ [광고주 대시보드] 통계 로드 오류:', error);
      // 통계 로드 실패는 조용히 처리
    } finally {
      setLoadingStats(false);
    }
  }, [timeFilter]);

  /**
   * 캠페인 목록 로드
   */
  const loadCampaigns = useCallback(async () => {
    try {
      setCampaignsLoading(true);
      const response = await AdvertiserAPI.getMyCampaigns();
      if (response.success && response.data) {
        console.log('📥 [캠페인 로드] 받은 데이터:', response.data.map((c: any) => ({
          name: c.campaign_name,
          spent: c.spent,
          view_count: c.view_count,
          cpi: c.cpi,
          status: c.status,
        })));
        
        // 모든 캠페인 저장 (총 소진 예산 계산용)
        setAllCampaigns(response.data);
        
        // ACTIVE 상태이고 진행 중인 캠페인만 필터링 (최대 2개)
        const activeCampaigns = response.data
          .filter((c: any) => c.status === 'ACTIVE')
          .slice(0, 2);
        setCampaigns(activeCampaigns);
      }
    } catch (error: any) {
      console.error('❌ [광고주 대시보드] 캠페인 로드 오류:', error);
      // 캠페인 로드 실패는 조용히 처리 (대시보드 전체를 막지 않음)
    } finally {
      setCampaignsLoading(false);
    }
  }, []);

  /**
   * 광고주 정보 로드
   */
  const loadAdvertiserData = useCallback(async () => {
    try {
      setLoading(true);
      const response = await AdvertiserAPI.getMyAdvertiser();
      if (response.success && response.data) {
        setAdvertiserInfo({
          biz_name: response.data.biz_name,
          biz_owner: response.data.biz_owner,
          charged: response.data.charged,
        });
      }
    } catch (error: any) {
      console.error('❌ [광고주 대시보드] 데이터 로드 오류:', error);
      alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 초기 마운트 시 데이터 로드 (한 번만)
   */
  useEffect(() => {
    loadAdvertiserData();
    loadCampaigns();
    loadStats();
    // 프로필 이미지 URL 설정
    if (currentUser?.profile_image_url) {
      setProfileImageUrl(buildImageUrl(currentUser.profile_image_url));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 시간 필터 변경 시 통계만 다시 로드
   */
  useEffect(() => {
    loadStats();
  }, [loadStats]);

  // 프로필 이미지 URL만 별도로 업데이트 (프로필 이미지 변경 시에만)
  useEffect(() => {
    if (currentUser?.profile_image_url) {
      setProfileImageUrl(buildImageUrl(currentUser.profile_image_url));
    }
  }, [currentUser?.profile_image_url]);

  // 화면 포커스 시 캠페인만 새로고침 (광고주 정보는 불필요, 통계는 timeFilter에 따라 자동 로드)
  useFocusEffect(
    React.useCallback(() => {
      loadCampaigns();
    }, [loadCampaigns]),
  );

  /**
   * 프로필 이미지 선택 옵션 표시
   */
  /**
   * 프로필 사진 선택 옵션 표시 (CustomGallery 사용)
   */
  const showImagePickerOptions = () => {
    setShowCustomGallery(true);
  };

  /**
   * 이미지 업로드 및 프로필 업데이트
   */
  const handleImageUpload = async (imageUri: string) => {
    try {
      setUploadingProfileImage(true);

      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'profile_image.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      // Android와 iOS 모두에서 올바른 URI 형식 사용
      let finalUri = imageUri;
      if (Platform.OS === 'ios') {
        // iOS: file:// 제거
        finalUri = imageUri.replace('file://', '');
      } else {
        // Android: content:// URI는 그대로 사용, file:// URI도 그대로 사용
        // 필요시 file:// 제거하지 않음 (Android에서는 그대로 사용해야 함)
        if (imageUri.startsWith('file://')) {
          finalUri = imageUri;
        } else if (imageUri.startsWith('content://')) {
          finalUri = imageUri;
        } else {
          // 상대 경로인 경우 file:// 추가
          finalUri = imageUri.startsWith('/') ? `file://${imageUri}` : imageUri;
        }
      }

      formData.append('image', {
        uri: finalUri,
        type,
        name: filename,
      } as any);

      const uploadResponse = await UploadAPI.uploadImage(formData);

      if (uploadResponse.success && uploadResponse.data?.image_url) {
        const imageUrl = uploadResponse.data.image_url;
        
        // 프로필 이미지 URL 업데이트
        const updateResponse = await AuthAPI.updateProfile({
          profile_image_url: imageUrl,
        });

        if (updateResponse.success) {
          setProfileImageUrl(buildImageUrl(imageUrl));
          alert('성공', '프로필 사진이 업데이트되었습니다.');
        } else {
          alert('오류', updateResponse.message || '프로필 업데이트에 실패했습니다.');
        }
      } else {
        throw new Error(uploadResponse.message || '이미지 업로드에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('프로필 이미지 업로드 오류:', error);
      alert('오류', error.message || '프로필 사진 업로드에 실패했습니다.');
    } finally {
      setUploadingProfileImage(false);
    }
  };

  const actionButtons = [
    {icon: 'plus-circle', label: '새 캠페인 만들기', route: 'CampaignList'},
    {icon: 'file-text', label: '광고 소재 관리', route: 'AdResourceList'},
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}>
        {/* 헤더 */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Babple-Biz</Text>
          <TouchableOpacity
            style={styles.settingsButton}
            onPress={() => setIsSettingsVisible(true)}>
            <Icon name="settings" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 인사말 */}
        <View style={styles.greetingSection}>
          <Text style={styles.greeting}>안녕하세요.</Text>
          {loading ? (
            <ActivityIndicator size="small" color={colors.primary} />
          ) : (
            <Text style={styles.companyName}>
              <Text style={styles.companyNameHighlight}>
                {advertiserInfo?.biz_name || '광고주'}
              </Text>
              {advertiserInfo?.biz_owner ? ` ${advertiserInfo.biz_owner}` : ''} 담당자님
            </Text>
          )}
        </View>

        {/* 프로필 사진 영역 */}
        <View style={styles.profileImageSection}>
          <View style={styles.profileImageWrapper}>
            <TouchableOpacity
              style={styles.profileImageContainer}
              onPress={showImagePickerOptions}
              disabled={uploadingProfileImage}>
              {uploadingProfileImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : profileImageUrl ? (
                <Image
                  source={{uri: profileImageUrl}}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <View style={styles.profileImagePlaceholder}>
                  <Icon name="camera" size={48} color={colors.lightGray} />
                </View>
              )}
            </TouchableOpacity>
            <View style={styles.profileImageEditIcon}>
              <Icon name="edit-2" size={20} color={colors.white} />
            </View>
          </View>
        </View>

        {/* 핵심 성과 요약 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>핵심 성과 요약</Text>
            <Selector
              value={timeFilter}
              options={timeOptions}
              onSelect={setTimeFilter}
              style={styles.timeFilter}
            />
          </View>

          {/* KPI 카드 그리드 */}
          <View style={styles.kpiGrid}>
            {kpiCards.map((card, index) => (
              <View
                key={index}
                style={[
                  styles.kpiCard,
                  card.highlighted && styles.kpiCardHighlighted,
                ]}>
                <Text style={styles.kpiValue}>{card.value}</Text>
                <Text style={styles.kpiLabel}>{card.label}</Text>
              </View>
            ))}
          </View>

          {/* 통계 그래프 */}
          {loadingStats ? (
            <View style={styles.statsLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : stats && stats.dailyStats.length > 0 ? (
            <View style={styles.statsSection}>
              <Text style={styles.statsTitle}>일별 통계</Text>
              <ScrollView 
                horizontal 
                showsHorizontalScrollIndicator={true}
                contentContainerStyle={styles.chartContainer}>
                {stats.dailyStats.map((day, index) => {
                  const maxValue = Math.max(
                    ...stats.dailyStats.map(d => Math.max(d.impressions, d.clicks)),
                    1,
                  );
                  const impressionsHeight = (day.impressions / maxValue) * 100;
                  const clicksHeight = (day.clicks / maxValue) * 100;
                  const date = new Date(day.date);
                  const dayLabel = `${date.getMonth() + 1}/${date.getDate()}`;

                  // 레이블 표시 간격 설정
                  const daysFilter = parseInt(timeFilter) || 7;
                  let shouldShowLabel = true;
                  
                  if (daysFilter === 30) {
                    // 30일: 5일 단위로 표시 (0, 5, 10, 15, 20, 25, 29)
                    shouldShowLabel = index % 5 === 0 || index === stats.dailyStats.length - 1;
                  } else if (daysFilter === 90) {
                    // 90일: 7일 단위로 표시 (0, 7, 14, 21, ...)
                    shouldShowLabel = index % 7 === 0 || index === stats.dailyStats.length - 1;
                  }
                  // 7일: 모든 레이블 표시

                  return (
                    <View key={index} style={styles.chartBarContainer}>
                      <View style={styles.chartBars}>
                        <View
                          style={[
                            styles.chartBar,
                            styles.chartBarImpressions,
                            {height: `${impressionsHeight}%`},
                          ]}
                        />
                        <View
                          style={[
                            styles.chartBar,
                            styles.chartBarClicks,
                            {height: `${clicksHeight}%`},
                          ]}
                        />
                      </View>
                      <View style={styles.chartLabelContainer}>
                        {shouldShowLabel ? (
                          <Text style={styles.chartLabel}>{dayLabel}</Text>
                        ) : (
                          <Text style={styles.chartLabelPlaceholder}> </Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </ScrollView>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, {backgroundColor: colors.primary}]} />
                  <Text style={styles.legendText}>노출</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendColor, {backgroundColor: colors.success}]} />
                  <Text style={styles.legendText}>클릭</Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {/* 진행 중인 캠페인 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>진행 중인 캠페인</Text>
            <TouchableOpacity
              onPress={() => {
                // @ts-ignore
                navigation.navigate('CampaignList');
              }}>
              <Text style={styles.viewAllLink}>전체 보기</Text>
            </TouchableOpacity>
          </View>

          {/* 캠페인 카드들 */}
          {campaignsLoading ? (
            <View style={styles.campaignsLoadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : campaigns.length > 0 ? (
            campaigns.map(campaign => {
              return (
                <TouchableOpacity
                  key={campaign.campaign_id}
                  style={styles.campaignCard}
                  onPress={() => {
                    setSelectedCampaignId(campaign.campaign_id);
                    setIsDetailModalVisible(true);
                  }}>
                  <Text style={styles.campaignTitle}>{campaign.campaign_name}</Text>
                  <View style={styles.progressContainer}>
                    <View style={styles.progressBarBackground}>
                      <View
                        style={[
                          styles.progressBarFill,
                          {width: `${campaign.progress}%`},
                        ]}
                      />
                    </View>
                    <Text style={styles.daysLeft}>
                      {campaign.daysLeft > 0 ? `${campaign.daysLeft}일 남음` : '종료됨'}
                    </Text>
                  </View>
                  <View style={styles.campaignBudget}>
                    <Text style={styles.spentAmount}>
                      ₩{Math.round(campaign.spent).toLocaleString()}
                    </Text>
                    <Text style={styles.budgetAmount}>
                      / ₩{campaign.total_budget.toLocaleString()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })
          ) : (
            <View style={styles.emptyCampaignsContainer}>
              <Text style={styles.emptyCampaignsText}>
                진행 중인 캠페인이 없습니다.
              </Text>
            </View>
          )}
        </View>

        {/* 하단 액션 버튼들 */}
        <View style={styles.actionButtonsContainer}>
          {actionButtons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={() => {
                if (button.route) {
                  if (button.label === '새 캠페인 만들기') {
                    // @ts-ignore
                    navigation.navigate(button.route, {openRegister: true});
                  } else {
                    // @ts-ignore
                    navigation.navigate(button.route);
                  }
                } else {
                  console.log(button.label);
                }
              }}>
              <View style={styles.actionButtonIcon}>
                <Icon name={button.icon} size={32} color={colors.primary} />
              </View>
              <Text style={styles.actionButtonLabel}>{button.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      {/* 설정 모달 */}
      <SettingsScreen
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      {/* 캠페인 상세 모달 */}
      <CampaignDetailScreen
        visible={isDetailModalVisible}
        onClose={() => setIsDetailModalVisible(false)}
        campaignId={selectedCampaignId}
        onModifySuccess={() => {
          loadCampaigns();
        }}
        onDeleteSuccess={() => {
          loadCampaigns();
        }}
      />

      {/* 커스텀 갤러리 */}
      <CustomGallery
        visible={showCustomGallery}
        onClose={() => setShowCustomGallery(false)}
        onSelectImage={(imageUri) => {
          handleImageUpload(imageUri);
          setShowCustomGallery(false);
        }}
        cropperToolbarTitle="프로필 사진 편집"
        allowCropping={true}
        compressImageQuality={0.5}
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700' as const,
  },
  settingsButton: {
    padding: spacing.xs,
  },
  greetingSection: {
    alignItems: 'center',
    paddingVertical: spacing.s,
    marginBottom: spacing.m,
  },
  profileImageSection: {
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  profileImageWrapper: {
    position: 'relative',
    width: 120,
    height: 120,
  },
  profileImageContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden', // 이미지는 원 안에 유지
    borderWidth: 3,
    borderColor: colors.primary,
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  profileImagePlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  profileImageEditIcon: {
    position: 'absolute',
    bottom: 0, // 원의 하단에 위치
    right: 0, // 원의 우측에 위치
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.white,
    transform: [{translateX: 4}, {translateY: 4}], // 원 밖으로 이동
  },
  greeting: {
    ...typography.bodyMedium,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  companyName: {
    ...typography.bodyMedium,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  companyNameHighlight: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  section: {
    marginHorizontal: spacing.m,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginBottom: spacing.l,
    borderRadius: borderRadius.m,
    backgroundColor: colors.backgroundCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 56,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
  },
  timeFilter: {
    width: 140,
    borderWidth: 0,
  },
  viewAllLink: {
    ...typography.captionRegular,
    fontWeight: 'bold',
    color: colors.textPrimary,
    fontWeight: '400' as const,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  kpiCard: {
    width: (width - spacing.l * 2 - spacing.m * 3) / 2,
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
  campaignCard: {
    backgroundColor: colors.white,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderBottomWidth: 1,
    borderColor: colors.lightGray,
  },
  campaignTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
  },
  progressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    marginBottom: spacing.s,
  },
  progressBarBackground: {
    flex: 1,
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.s,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
  },
  daysLeft: {
    ...typography.captionMedium,
    color: colors.primary,
    fontWeight: '400' as const,
  },
  campaignBudget: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: spacing.xs,
  },
  spentAmount: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  budgetAmount: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  actionButton: {
    flex: 1,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
    gap: spacing.m,
  },
  actionButtonIcon: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionButtonLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500' as const,
    textAlign: 'center',
  },
  campaignsLoadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
  },
  emptyCampaignsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
  },
  emptyCampaignsText: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  statsLoadingContainer: {
    padding: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statsSection: {
    marginTop: spacing.l,
    padding: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  statsTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
  },
  chartContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 150,
    marginBottom: spacing.m,
    paddingHorizontal: spacing.xs,
  },
  chartBarContainer: {
    width: 40,
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginHorizontal: 2,
  },
  chartBars: {
    width: '80%',
    height: '100%',
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  chartBar: {
    flex: 1,
    minHeight: 2,
    borderRadius: borderRadius.xs,
  },
  chartBarImpressions: {
    backgroundColor: colors.primary,
  },
  chartBarClicks: {
    backgroundColor: colors.success,
  },
  chartLabelContainer: {
    height: 20,
    justifyContent: 'center',
    marginTop: spacing.xs,
  },
  chartLabel: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    fontSize: 10,
  },
  chartLabelPlaceholder: {
    fontSize: 10,
    color: 'transparent',
  },
  chartLegend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.m,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  legendColor: {
    width: 12,
    height: 12,
    borderRadius: borderRadius.xs,
  },
  legendText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
});

export default AdvertiserDashboardScreen;


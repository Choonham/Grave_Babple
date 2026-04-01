import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {Selector} from '../../../components/common';
import SettingsScreen from '../../profile/SettingsScreen';
import PromotionRegisterScreen from './PromotionRegisterScreen';
import PromotionDetailModal from './PromotionDetailModal';
import FlyerRegisterScreen from './FlyerRegisterScreen';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {StoreAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

const {width} = Dimensions.get('window');
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

/**
 * 상점주 대시보드 화면
 */
const StoreDashboardScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const [timeFilter, setTimeFilter] = useState('7');
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isPromotionRegisterVisible, setIsPromotionRegisterVisible] =
    useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [isFlyerRegisterVisible, setIsFlyerRegisterVisible] = useState(false);

  // 상점 정보 및 통계 상태
  const [storeInfo, setStoreInfo] = useState<{
    name: string;
    owner: string;
  } | null>(null);
  const [kpiData, setKpiData] = useState<{
    promotion_impressions: number;
    store_visits: number;
    flyer_views: number;
    biz_spent: number;
  } | null>(null);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  /**
   * 상점 정보 및 통계 데이터 로드 (초기 마운트 시 한 번만)
   */
  useEffect(() => {
    loadStoreData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * 기간 필터 변경 시 통계 데이터만 다시 로드 (storeInfo 의존성 제거)
   */
  useEffect(() => {
    loadDashboardStats();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeFilter]);

  /**
   * 상점 정보 및 통계 데이터 로드
   */
  const loadStoreData = async () => {
    try {
      setLoading(true);

      // 상점 정보 조회
      const storeResponse = await StoreAPI.getMyStore();
      if (storeResponse.success && storeResponse.data) {
        setStoreInfo({
          name: storeResponse.data.name,
          owner: storeResponse.data.owner || '',
        });
      }

      // 통계 데이터 조회
      await loadDashboardStats();

      // 진행 중인 프로모션 조회
      const promotionsResponse = await StoreAPI.getMyPromotions();
      if (promotionsResponse.success && promotionsResponse.data) {
        // 프로모션 데이터 포맷팅 (진행 중인 것만)
        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        
        const formattedPromotions = promotionsResponse.data
          .filter((promo: any) => {
            const startDate = new Date(promo.start_date);
            const endDate = new Date(promo.end_date);
            const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
            const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
            return start <= today && today <= end;
          })
          .map((promo: any) => {
            const endDate = new Date(promo.end_date);
            const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            const hoursLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60));

            let timeLeft = '';
            if (daysLeft > 0) {
              timeLeft = `${daysLeft}일 남음`;
            } else if (hoursLeft > 0) {
              timeLeft = `${hoursLeft}시간 남음`;
            } else {
              timeLeft = '종료 임박';
            }

            return {
              id: promo.promotion_id,
              promotion_id: promo.promotion_id,
              title: promo.title || '프로모션',
              name: promo.title || '프로모션',
              description: promo.description,
              price: `${promo.sale_price.toLocaleString()}원`,
              original_price: promo.original_price,
              sale_price: promo.sale_price,
              timeLeft,
              image: promo.promotion_image_url,
              start_date: promo.start_date,
              end_date: promo.end_date,
              ...promo,
            };
          });
        setPromotions(formattedPromotions);
      }
    } catch (error: any) {
      console.error('❌ [상점 대시보드] 데이터 로드 오류:', error);
      alert('오류', '데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * 대시보드 통계 데이터 로드
   */
  const loadDashboardStats = async () => {
    try {
      const days = parseInt(timeFilter) || 7;
      const statsResponse = await StoreAPI.getStoreDashboardStats(days);
      if (statsResponse.success && statsResponse.data) {
        setKpiData(statsResponse.data);
      }
    } catch (error: any) {
      console.error('❌ [상점 대시보드] 통계 데이터 로드 오류:', error);
    }
  };

  const handleMyStorePress = () => {
    // @ts-ignore
    navigation.navigate('Store', {isMine: true});
  };

  const timeOptions = [
    {label: '하루', value: '1'},
    {label: '7일', value: '7'},
    {label: '30일', value: '30'},
  ];

  const actionButtons = [
    {icon: 'shopping-cart', label: '내 가게'},
    {icon: 'tag', label: '기획 상품 등록'},
    {icon: 'file-text', label: '전단지 등록'},
  ];

  /**
   * KPI 카드 데이터 포맷팅
   */
  const kpiCards = kpiData
    ? [
        {value: `${kpiData.promotion_impressions.toLocaleString()}회`, label: '기획 상품 노출 수'},
        {value: `${kpiData.store_visits.toLocaleString()}회`, label: '가게 페이지 방문 수'},
        {value: `${kpiData.flyer_views.toLocaleString()}회`, label: '전단지 조회 수'},
        {
          value: `${kpiData.biz_spent.toLocaleString()}원`,
          label: 'Biz 사용 금액',
          highlighted: true,
        },
      ]
    : [
        {value: '0회', label: '기획 상품 노출 수'},
        {value: '0회', label: '가게 페이지 방문 수'},
        {value: '0회', label: '전단지 조회 수'},
        {value: '0원', label: 'Biz 사용 금액', highlighted: true},
      ];

  const tips = [
    "팁: '돼지고기'를 할인하면 '김치찌개' 레시피와 함께 추천될 확률이 높아요!",
    '팁: 가게 소개에 주차 가능 여부를 적어주면 방문율이 올라가요!',
  ];

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>데이터를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.scrollContent}>
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
          {storeInfo ? (
            <Text style={styles.storeName}>
              <Text style={styles.storeNameHighlight}>{storeInfo.name}</Text>
              {storeInfo.owner ? ` ${storeInfo.owner}` : ''} 담당자님
            </Text>
          ) : (
            <Text style={styles.storeName}>
              <Text style={styles.storeNameHighlight}>상점</Text> 담당자님
            </Text>
          )}
        </View>

        {/* 액션 버튼들 */}
        <View style={styles.actionButtonsContainer}>
          {actionButtons.map((button, index) => (
            <TouchableOpacity
              key={index}
              style={styles.actionButton}
              onPress={
                button.label === '내 가게'
                  ? handleMyStorePress
                  : button.label === '기획 상품 등록'
                  ? () => setIsPromotionRegisterVisible(true)
                  : button.label === '전단지 등록'
                  ? () => setIsFlyerRegisterVisible(true)
                  : undefined
              }>
              <View style={styles.actionButtonIcon}>
                <Icon name={button.icon} size={28} color={colors.primary} />
              </View>
              <Text style={styles.actionButtonLabel}>{button.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 핵심 성과 요약 */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>핵심 성과 요약</Text>
            <View style={styles.selectorContainer}>
              <Selector
                placeholder="지난 7일"
                value={timeFilter}
                options={timeOptions}
                onSelect={setTimeFilter}
                style={styles.timeSelector}
              />
            </View>
          </View>
          <View style={styles.kpiGrid}>
            {kpiCards.map((card, index) => (
              <View
                key={index}
                style={[
                  styles.kpiCard,
                  card.highlighted && styles.kpiCardHighlighted,
                ]}>
                <Text
                  style={[
                    styles.kpiValue,
                    card.highlighted && styles.kpiValueHighlighted,
                  ]}>
                  {card.value}
                </Text>
                <Text style={styles.kpiLabel}>{card.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* 진행 중인 프로모션 */}
        <View style={styles.section}>
          <View style={styles.sectionHeaderRow}>
            <Text style={styles.sectionTitle}>진행 중인 프로모션</Text>
            <TouchableOpacity
              onPress={() => {
                // @ts-ignore
                navigation.navigate('PromotionList');
              }}>
              <Text style={styles.viewAllLink}>전체 보기 &gt;</Text>
            </TouchableOpacity>
          </View>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.promotionsScroll}
            contentContainerStyle={styles.promotionsContainer}>
            {promotions.length > 0 ? (
              promotions.map((promo, index) => {
                const isUrgent = promo.timeLeft.includes('시간');
                return (
                  <TouchableOpacity
                    key={promo.promotion_id || promo.id || index}
                    style={styles.promotionCard}
                    onPress={() => {
                      const formatDate = (date: Date | string): string => {
                        const d = typeof date === 'string' ? new Date(date) : date;
                        const year = d.getFullYear();
                        const month = String(d.getMonth() + 1).padStart(2, '0');
                        const day = String(d.getDate()).padStart(2, '0');
                        return `${year}.${month}.${day}`;
                      };

                      setSelectedPromotion({
                        id: promo.promotion_id || promo.id,
                        promotion_id: promo.promotion_id || promo.id,
                        image: buildImageUrl(promo.promotion_image_url) || null,
                        title: promo.title || promo.name,
                        subtitle: promo.description || '',
                        quantity: promo.quantity && promo.quantity_unit
                          ? `${promo.quantity}${promo.quantity_unit}`
                          : '',
                        originalPrice: promo.original_price
                          ? `${promo.original_price.toLocaleString()}원`
                          : undefined,
                        discountPrice: `${promo.sale_price.toLocaleString()}원`,
                        period: promo.start_date && promo.end_date
                          ? `${formatDate(promo.start_date)} ~ ${formatDate(promo.end_date)}`
                          : '',
                      });
                      setIsDetailModalVisible(true);
                    }}>
                    <View style={styles.promotionImageContainer}>
                      {promo.image || promo.promotion_image_url ? (
                        <Image
                          source={{
                            uri: buildImageUrl(promo.image || promo.promotion_image_url) || '',
                          }}
                          style={styles.promotionImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <Image
                          source={require('../../../../assets/dev/images/storePromotion.png')}
                          style={styles.promotionImage}
                          resizeMode="cover"
                        />
                      )}
                      <View style={[styles.promotionOverlay, styles.promotionOverlayTop]}>
                        <Text style={styles.promotionOverlayText}>{promo.name}</Text>
                      </View>
                      <View style={[styles.promotionOverlay, styles.promotionOverlayBottom]}>
                        <Text style={styles.promotionOverlayText}>{promo.price}</Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.promotionTime,
                        isUrgent && styles.promotionTimeUrgent,
                      ]}>
                      {promo.timeLeft}
                    </Text>
                  </TouchableOpacity>
                );
              })
            ) : (
              <View style={styles.emptyPromotionsContainer}>
                <Text style={styles.emptyPromotionsText}>진행 중인 프로모션이 없습니다.</Text>
              </View>
            )}
          </ScrollView>
        </View>

        {/* 팁 섹션 */}
        <View style={styles.tipsSection}>
          {tips.map((tip, index) => (
            <View key={index} style={styles.tipItem}>
              <Icon name="lightbulb" size={16} color={colors.primary} />
              <Text style={styles.tipText}>{tip}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      {/* 설정 화면 */}
      <SettingsScreen
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      {/* 기획 상품 등록 모달 */}
      <PromotionRegisterScreen
        visible={isPromotionRegisterVisible}
        onClose={() => setIsPromotionRegisterVisible(false)}
        onSuccess={() => {
          // 프로모션 목록 다시 로드
          loadStoreData();
        }}
      />

      {/* 기획 상품 정보 모달 */}
      {selectedPromotion && (
        <PromotionDetailModal
          visible={isDetailModalVisible}
          onClose={() => {
            setIsDetailModalVisible(false);
            setSelectedPromotion(null);
          }}
          promotion={selectedPromotion}
          isMine={true}
          onModify={() => {
            // 수정하기 로직은 PromotionDetailModal 내부에서 처리
            console.log('수정하기');
          }}
          onModifySuccess={() => {
            // 수정 완료 후 대시보드 새로고침
            loadStoreData();
          }}
          onDelete={async () => {
            // 삭제하기 로직
            if (selectedPromotion?.promotion_id) {
              try {
                const response = await StoreAPI.deletePromotion(selectedPromotion.promotion_id);
                if (response.success) {
                  alert('성공', '프로모션이 삭제되었습니다.');
                  loadStoreData();
                  setIsDetailModalVisible(false);
                  setSelectedPromotion(null);
                } else {
                  alert('오류', '프로모션 삭제에 실패했습니다.');
                }
              } catch (error: any) {
                console.error('❌ [프로모션 삭제] 오류:', error);
                alert('오류', '프로모션 삭제 중 오류가 발생했습니다.');
              }
            }
          }}
        />
      )}

      {/* 전단지 등록 모달 */}
      <FlyerRegisterScreen
        visible={isFlyerRegisterVisible}
        onClose={() => setIsFlyerRegisterVisible(false)}
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
    paddingBottom: spacing.l,
  },
  headerTitle: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '700',
  },
  settingsButton: {
    padding: spacing.xs,
  },
  greetingSection: {
    paddingHorizontal: spacing.l,
    marginBottom: spacing.xl,
    alignItems: 'center',
  },
  greeting: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  storeName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  storeNameHighlight: {
    color: colors.primary,
    fontWeight: '600',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    marginBottom: spacing.xl,
    gap: spacing.m,
  },
  actionButton: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    gap: spacing.s,
  },
  actionButtonIcon: {
    marginBottom: spacing.s,
  },
  actionButtonLabel: {
    ...typography.captionRegular,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  section: {
    marginBottom: spacing.xl,
    paddingHorizontal: spacing.l,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  selectorContainer: {
    width: 120,
  },
  timeSelector: {
    height: 36,
    paddingHorizontal: spacing.s,
  },
  viewAllLink: {
    ...typography.captionRegular,
    color: colors.textPrimary,
  },
  kpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.m,
  },
  kpiCard: {
    width: (width - spacing.l * 2 - spacing.m) / 2,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
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
    fontWeight: '700',
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  kpiValueHighlighted: {
    color: colors.primary,
  },
  kpiLabel: {
    ...typography.captionRegular,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  promotionsScroll: {
    marginHorizontal: -spacing.l,
  },
  promotionsContainer: {
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  promotionCard: {
    width: (width - spacing.l * 2 - spacing.m * 2) / 2.8,
    marginRight: spacing.m,
  },
  promotionImageContainer: {
    width: '100%',
    aspectRatio: 0.85,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    marginBottom: spacing.s,
    position: 'relative',
  },
  promotionImage: {
    width: '100%',
    height: '100%',
  },
  promotionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.xs,
    alignItems: 'center',
  },
  promotionOverlayTop: {
    top: 0,
  },
  promotionOverlayBottom: {
    bottom: 0,
  },
  promotionOverlayText: {
    ...typography.captionRegular,
    color: colors.white,
    textAlign: 'center',
  },
  promotionTime: {
    ...typography.captionRegular,
    color: colors.textPrimary,
    textAlign: 'center',
  },
  promotionTimeUrgent: {
    color: colors.primary,
  },
  tipsSection: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginHorizontal: spacing.l,
    gap: spacing.m,
  },
  tipItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.s,
  },
  tipText: {
    flex: 1,
    ...typography.captionRegular,
    color: colors.textPrimary,
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.m,
  },
  loadingText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emptyPromotionsContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  emptyPromotionsText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
});

export default StoreDashboardScreen;

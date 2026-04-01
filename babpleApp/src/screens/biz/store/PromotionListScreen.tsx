import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
  shadows,
} from '../../../styles/commonStyles';
import PromotionRegisterScreen from './PromotionRegisterScreen';
import PromotionDetailModal from './PromotionDetailModal';
import {StoreAPI} from '../../../api/ApiRequests';
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

/**
 * 기획 상품 목록 화면
 */
const PromotionListScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const [selectedTab, setSelectedTab] = useState<'active' | 'ended'>('active');
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 날짜 포맷팅 (Date -> YYYY.MM.DD)
   */
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  /**
   * 남은 시간 계산
   */
  const calculateRemainingTime = (endDate: Date | string): string => {
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;
    const now = new Date();
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return '행사 종료';
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    if (days > 0) {
      return `남은 행사 기간: ${days}일 ${hours}시간`;
    } else if (hours > 0) {
      return `남은 행사 기간: ${hours}시간 ${minutes}분`;
    } else {
      return `남은 행사 기간: ${minutes}분`;
    }
  };

  /**
   * 프로모션 목록 로드
   */
  const loadPromotions = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await StoreAPI.getMyPromotions();
      if (response.success && response.data) {
        setPromotions(response.data);
      }
    } catch (error: any) {
      console.error('❌ [프로모션 목록] 로드 오류:', error);
      alert('오류', '프로모션 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadPromotions(false);
    setRefreshing(false);
  }, [loadPromotions]);

  // 화면 포커스 시 데이터 로드
  useFocusEffect(
    React.useCallback(() => {
      loadPromotions();
    }, []),
  );

  // 진행 중인 프로모션
  const activePromotions = promotions.filter(promo => promo.is_active);

  // 종료된 프로모션
  const endedPromotions = promotions.filter(promo => !promo.is_active);

  const handlePromotionPress = (promotion: any) => {
    const period = promotion.start_date && promotion.end_date
      ? `${formatDate(promotion.start_date)} ~ ${formatDate(promotion.end_date)}`
      : '';

    setSelectedPromotion({
      id: promotion.promotion_id,
      promotion_id: promotion.promotion_id,
      image: buildImageUrl(promotion.promotion_image_url) || null,
      title: promotion.title,
      subtitle: promotion.description || '',
      quantity: promotion.quantity && promotion.quantity_unit
        ? `${promotion.quantity}${promotion.quantity_unit}`
        : '',
      originalPrice: promotion.original_price
        ? `${promotion.original_price.toLocaleString()}원`
        : undefined,
      discountPrice: `${promotion.sale_price.toLocaleString()}원`,
      period: period,
    });
    setIsDetailModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.headerButton}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>기획 상품 목록</Text>
          <View style={styles.headerButton} />
        </View>

        {/* 탭 */}
        <View style={styles.tabsContainer}>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'active' && styles.tabActive]}
            onPress={() => setSelectedTab('active')}>
            <Text
              style={[
                styles.tabText,
                selectedTab === 'active' && styles.tabTextActive,
              ]}>
              진행 중
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, selectedTab === 'ended' && styles.tabActive]}
            onPress={() => setSelectedTab('ended')}>
            <Text
              style={[
                styles.tabText,
                selectedTab === 'ended' && styles.tabTextActive,
              ]}>
              종료됨
            </Text>
          </TouchableOpacity>
        </View>

        {/* 프로모션 리스트 */}
        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>프로모션 목록을 불러오는 중...</Text>
          </View>
        ) : (
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          {selectedTab === 'active' ? (
            <>
              {activePromotions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="tag" size={64} color={colors.lightGray} />
                  <Text style={styles.emptyTitle}>
                    등록된 기획 상품이 없어요.
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    하단의 '+' 버튼을 눌러 새로운 기획 상품을 추가해보세요.
                  </Text>
                </View>
              ) : (
                <>
                  {activePromotions.map(promotion => {
                    const remainingTime = promotion.end_date
                      ? calculateRemainingTime(promotion.end_date)
                      : '';
                    const quantity = promotion.quantity && promotion.quantity_unit
                      ? `${promotion.quantity}${promotion.quantity_unit}`
                      : '';

                    return (
                    <TouchableOpacity
                        key={promotion.promotion_id}
                      style={styles.promotionCard}
                      onPress={() => handlePromotionPress(promotion)}>
                        {remainingTime && (
                      <Text style={styles.promotionTime}>
                            {remainingTime}
                      </Text>
                        )}
                      <View style={styles.promotionContent}>
                          {promotion.promotion_image_url ? (
                            <Image
                              source={{
                                uri: buildImageUrl(promotion.promotion_image_url) || '',
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
                        <View style={styles.promotionTitleContainer}>
                          <Text style={styles.promotionTitle}>
                            {promotion.title}
                          </Text>
                            {promotion.description && (
                          <Text 
                            style={styles.promotionSubtitle}
                            numberOfLines={2}
                            ellipsizeMode="tail">
                                {promotion.description}
                          </Text>
                            )}
                        </View>
                        <View style={styles.promotionPriceContainer}>
                            {quantity && (
                          <Text style={styles.promotionQuantity}>
                                {quantity}
                          </Text>
                            )}
                          <Text style={styles.promotionPrice}>
                              {promotion.sale_price.toLocaleString()}원
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          ) : (
            <>
              {endedPromotions.length === 0 ? (
                <View style={styles.emptyContainer}>
                  <Icon name="tag" size={64} color={colors.lightGray} />
                  <Text style={styles.emptyTitle}>
                    등록된 기획 상품이 없어요.
                  </Text>
                  <Text style={styles.emptySubtitle}>
                    하단의 '+' 버튼을 눌러 새로운 기획 상품을 추가해보세요.
                  </Text>
                </View>
              ) : (
                <>
                  {endedPromotions.map(promotion => {
                    const period = promotion.start_date && promotion.end_date
                      ? `행사 기간: ${formatDate(promotion.start_date)} ~ ${formatDate(promotion.end_date)}`
                      : '';
                    const quantity = promotion.quantity && promotion.quantity_unit
                      ? `${promotion.quantity}${promotion.quantity_unit}`
                      : '';

                    return (
                    <TouchableOpacity
                        key={promotion.promotion_id}
                      style={[styles.promotionCard, styles.promotionCardEnded]}
                      onPress={() => handlePromotionPress(promotion)}>
                        {period && (
                      <Text style={styles.promotionPeriod}>
                            {period}
                      </Text>
                        )}
                      <View style={styles.promotionContent}>
                          {promotion.promotion_image_url ? (
                            <Image
                              source={{
                                uri: buildImageUrl(promotion.promotion_image_url) || '',
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
                        <View style={styles.promotionTitleContainer}>
                          <Text style={styles.promotionTitle}>
                            {promotion.title}
                          </Text>
                            {promotion.description && (
                          <Text 
                            style={styles.promotionSubtitle}
                            numberOfLines={2}
                            ellipsizeMode="tail">
                                {promotion.description}
                          </Text>
                            )}
                        </View>
                        <View style={styles.promotionPriceContainer}>
                            {quantity && (
                          <Text style={styles.promotionQuantity}>
                                {quantity}
                          </Text>
                            )}
                          <Text style={styles.promotionPrice}>
                              {promotion.sale_price.toLocaleString()}원
                          </Text>
                        </View>
                      </View>
                    </TouchableOpacity>
                    );
                  })}
                </>
              )}
            </>
          )}
        </ScrollView>
        )}

        {/* Floating Action Button */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsRegisterModalVisible(true)}>
          <Icon name="plus" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* 기획 상품 등록 모달 */}
      <PromotionRegisterScreen
        visible={isRegisterModalVisible}
        onClose={() => setIsRegisterModalVisible(false)}
        onSuccess={() => {
          loadPromotions();
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
            // 수정 완료 후 목록 새로고침
            loadPromotions();
          }}
          onDelete={async () => {
            // 삭제하기 로직
            if (selectedPromotion?.promotion_id) {
              try {
                const response = await StoreAPI.deletePromotion(selectedPromotion.promotion_id);
                if (response.success) {
                  alert('성공', '프로모션이 삭제되었습니다.');
                  loadPromotions();
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
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    backgroundColor: colors.white,
  },
  headerButton: {
    padding: spacing.xs,
    width: 40,
    alignItems: 'center',
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.m,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontWeight: '400' as const,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.xxl,
    flexGrow: 1,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    minHeight: 400,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginTop: spacing.l,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  promotionCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  promotionCardEnded: {
    backgroundColor: '#F5F5F5',
  },
  promotionTime: {
    fontSize: typography.captionRegular.fontSize,
    lineHeight: typography.captionRegular.lineHeight,
    fontFamily: typography.captionRegular.fontFamily,
    color: '#FF6961',
    marginBottom: spacing.s,
    fontWeight: '400' as const,
    textAlign: 'center',
  },
  promotionPeriod: {
    fontSize: typography.captionRegular.fontSize,
    lineHeight: typography.captionRegular.lineHeight,
    fontFamily: typography.captionRegular.fontFamily,
    color: colors.textSecondary,
    marginBottom: spacing.s,
    textAlign: 'center',
    fontWeight: '600' as const,
  },
  promotionContent: {
    flexDirection: 'row',
    gap: spacing.m,
    alignItems: 'center',
  },
  promotionImage: {
    width: 80,
    height: 80,
    borderRadius: borderRadius.s,
    overflow: 'hidden' as const,
  },
  promotionTitleContainer: {
    flex: 1,
    justifyContent: 'center',
  },
  promotionTitle: {
    fontSize: typography.captionMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: 2,
    textAlign: 'center',
  },
  promotionSubtitle: {
    fontSize: typography.captionMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  promotionPriceContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  promotionQuantity: {
    fontSize: typography.captionRegular.fontSize,
    lineHeight: typography.captionRegular.lineHeight,
    fontFamily: typography.captionRegular.fontFamily,
    color: '#FF6961',
    fontWeight: '400' as const,
  },
  promotionPrice: {
    fontSize: typography.h2.fontSize,
    lineHeight: typography.h2.lineHeight,
    fontFamily: typography.h2.fontFamily,
    color: '#FF6961',
    fontWeight: '700' as const,
  },
  fab: {
    position: 'absolute',
    bottom: spacing.l,
    right: spacing.l,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl * 2,
  },
  loadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
});

export default PromotionListScreen;


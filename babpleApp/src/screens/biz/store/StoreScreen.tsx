import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Dimensions,
  ActivityIndicator,
  Modal,
  RefreshControl,
  Platform,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import MapView, {Marker, Region} from 'react-native-maps';
import StoreModifyScreen from './StoreModifyScreen';
import FlyerDetailModal from './FlyerDetailModal';
import PromotionDetailModal from './PromotionDetailModal';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {StoreAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

const {width} = Dimensions.get('window');
import {getThumbnailUrl, buildMediaUrl} from '../../../utils/imageUtils';

const buildImageUrl = buildMediaUrl; // 하위 호환성 유지

interface StoreScreenProps {
  isModal?: boolean;
  onClose?: () => void;
  isMine?: boolean;
  storeId?: string; // store_id가 있으면 해당 가게 정보를 조회
}

/**
 * 상점 상세 화면
 * Full Screen Modal 또는 네비게이터로 사용 가능
 */
const StoreScreen: React.FC<StoreScreenProps> = ({
  isModal = false,
  onClose,
  isMine: isMineProp = false,
  storeId,
}) => {
  const navigation = useNavigation();
  const route = useRoute();
  const routeParams = route.params as {isMine?: boolean} | undefined;
  const {alert} = useAlert();
  const isMine = isModal ? isMineProp : routeParams?.isMine ?? false;
  const [selectedTab, setSelectedTab] = useState<'current' | 'past'>('current');
  const [isModifyModalVisible, setIsModifyModalVisible] = useState(false);
  const [isFlyerDetailVisible, setIsFlyerDetailVisible] = useState(false);
  const [selectedFlyer, setSelectedFlyer] = useState<any>(null);

  // Store 정보 상태
  const [storeInfo, setStoreInfo] = useState<{
    name: string;
    description: string;
    phone: string;
    address: string;
    profile_image_url?: string;
    operatingHours: any;
    holidays: string;
    latitude?: number | null;
    longitude?: number | null;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [flyers, setFlyers] = useState<Array<{
    flyer_id: string;
    title: string | null;
    start_date: Date;
    end_date: Date;
    flyer_image_url: string;
    view_count: number;
    created_at: Date;
    is_active: boolean;
  }>>([]);
  const [loadingFlyers, setLoadingFlyers] = useState(false);
  const [promotions, setPromotions] = useState<Array<{
    promotion_id: string;
    ingredient_id: number;
    ingredient_name: string | null;
    title: string;
    description: string | null;
    sale_price: number;
    original_price: number | null;
    start_date: Date;
    end_date: Date;
    promotion_image_url: string | null;
    view_count: number;
    created_at: Date;
    is_active: boolean;
  }>>([]);
  const [loadingPromotions, setLoadingPromotions] = useState(false);
  const [selectedPromotion, setSelectedPromotion] = useState<any>(null);
  const [isPromotionDetailVisible, setIsPromotionDetailVisible] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 영업 시간 포맷팅
   */
  const formatOperatingHours = (operatingHours: any): string => {
    if (!operatingHours || typeof operatingHours !== 'object') {
      return '영업 시간 정보 없음';
    }

    // operating_hours 형식: { "월": { "opening": "10:00", "closing": "22:00" }, ... }
    const days = ['월', '화', '수', '목', '금', '토', '일'];
    const hoursList: string[] = [];

    days.forEach(day => {
      if (operatingHours[day] && operatingHours[day].opening && operatingHours[day].closing) {
        const opening = operatingHours[day].opening;
        const closing = operatingHours[day].closing;
        
        // "HH:mm" 형식을 "H시 m분" 형식으로 변환
        const formatTime = (time: string) => {
          const [hour, minute] = time.split(':');
          const h = parseInt(hour, 10);
          const m = parseInt(minute, 10);
          if (m === 0) {
            return `${h}시`;
          }
          return `${h}시 ${m}분`;
        };

        hoursList.push(`${day}: ${formatTime(opening)} ~ ${formatTime(closing)}`);
      }
    });

    if (hoursList.length === 0) {
      return '영업 시간 정보 없음';
    }

    // 모든 요일이 동일한 시간이면 "매일"로 표시
    if (hoursList.length === 7) {
      const timeRanges = hoursList.map(h => h.split(': ')[1]);
      if (new Set(timeRanges).size === 1) {
        return `매일: ${timeRanges[0]}`;
      }
    }

    return hoursList.join('\n');
  };

  /**
   * 휴무일 포맷팅
   */
  const formatOffDays = (offDays: any): string => {
    if (!offDays || !Array.isArray(offDays) || offDays.length === 0) {
      return '정기 휴무일 없음';
    }

    // off_days가 [{week: "첫째주", day: "토"}, ...] 형태라고 가정
    const formatted = offDays.map((off: any) => {
      if (off.week && off.day) {
        return `${off.week} ${off.day}`;
      }
      return '';
    }).filter(Boolean).join(', ');

    return formatted || '정기 휴무일 없음';
  };

  /**
   * Store 정보 로드
   */
  useEffect(() => {
    if (isMine) {
      loadStoreInfo();
      loadFlyers();
      loadPromotions();
    } else if (storeId) {
      // store_id가 있으면 해당 가게 정보 조회
      loadStoreInfoByStoreId(storeId);
      loadFlyersByStoreId(storeId);
      loadPromotionsByStoreId(storeId);
    }
  }, [isMine, storeId]);

  const loadStoreInfo = async () => {
    try {
      setLoading(true);
      const response = await StoreAPI.getMyStore();
      if (response.success && response.data) {
        const data = response.data;
        
        // 영업 시간 포맷팅
        let operatingHoursText = formatOperatingHours(data.operating_hours);
        
        // 휴무일 포맷팅
        const holidaysText = formatOffDays(data.off_days);

        setStoreInfo({
          name: data.name || '상점명 없음',
          description: data.description || '상점 소개가 없습니다.',
          phone: data.phone_number || '전화번호 없음',
          address: data.address || '주소 없음',
          profile_image_url: buildImageUrl(data.profile_image_url) || undefined,
          operatingHours: operatingHoursText,
          holidays: holidaysText,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
      } else {
        alert('오류', '상점 정보를 불러올 수 없습니다.');
      }
    } catch (error: any) {
      console.error('❌ [내 가게] 정보 로드 오류:', error);
      alert('오류', '상점 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * store_id로 가게 정보 로드
   */
  const loadStoreInfoByStoreId = async (storeId: string) => {
    try {
      setLoading(true);
      const response = await StoreAPI.getStoreDetail(storeId);
      if (response.success && response.data) {
        const data = response.data;
        
        // 영업 시간 포맷팅
        let operatingHoursText = formatOperatingHours(data.operating_hours);
        
        // 휴무일 포맷팅
        const holidaysText = formatOffDays(data.off_days);

        setStoreInfo({
          name: data.name || '상점명 없음',
          description: data.description || '상점 소개가 없습니다.',
          phone: data.phone_number || '전화번호 없음',
          address: data.address || '주소 없음',
          profile_image_url: buildImageUrl(data.profile_image_url) || undefined,
          operatingHours: operatingHoursText,
          holidays: holidaysText,
          latitude: data.latitude ?? null,
          longitude: data.longitude ?? null,
        });
      } else {
        alert('오류', '상점 정보를 불러올 수 없습니다.');
      }
    } catch (error: any) {
      console.error('❌ [가게 정보] 로드 오류:', error);
      alert('오류', '상점 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  /**
   * store_id로 전단지 목록 로드
   */
  const loadFlyersByStoreId = async (storeId: string) => {
    try {
      setLoadingFlyers(true);
      const response = await StoreAPI.getStoreFlyers(storeId);
      if (response.success && response.data) {
        setFlyers(response.data);
      } else {
        console.error('❌ [전단지 목록] 로드 실패');
      }
    } catch (error: any) {
      console.error('❌ [전단지 목록] 로드 오류:', error);
    } finally {
      setLoadingFlyers(false);
    }
  };

  /**
   * store_id로 프로모션 목록 로드
   */
  const loadPromotionsByStoreId = async (storeId: string) => {
    try {
      setLoadingPromotions(true);
      const response = await StoreAPI.getStorePromotions(storeId);
      if (response.success && response.data) {
        setPromotions(response.data);
      } else {
        console.error('❌ [프로모션 목록] 로드 실패');
      }
    } catch (error: any) {
      console.error('❌ [프로모션 목록] 로드 오류:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

  /**
   * 전단지 목록 로드
   */
  const loadFlyers = async () => {
    try {
      setLoadingFlyers(true);
      const response = await StoreAPI.getMyFlyers();
      if (response.success && response.data) {
        setFlyers(response.data);
      } else {
        console.error('❌ [전단지 목록] 로드 실패');
      }
    } catch (error: any) {
      console.error('❌ [전단지 목록] 로드 오류:', error);
    } finally {
      setLoadingFlyers(false);
    }
  };

  /**
   * 프로모션 목록 로드
   */
  const loadPromotions = async () => {
    try {
      setLoadingPromotions(true);
      const response = await StoreAPI.getMyPromotions();
      if (response.success && response.data) {
        setPromotions(response.data);
      } else {
        console.error('❌ [프로모션 목록] 로드 실패');
      }
    } catch (error: any) {
      console.error('❌ [프로모션 목록] 로드 오류:', error);
    } finally {
      setLoadingPromotions(false);
    }
  };

  const handleBack = () => {
    if (isModal && onClose) {
      onClose();
    } else {
      navigation.goBack();
    }
  };

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    if (isMine) {
      await Promise.all([
        loadStoreInfo(),
        loadFlyers(),
        loadPromotions(),
      ]);
    } else if (storeId) {
      await Promise.all([
        loadStoreInfoByStoreId(storeId),
        loadFlyersByStoreId(storeId),
        loadPromotionsByStoreId(storeId),
      ]);
    }
    setRefreshing(false);
  }, [isMine, storeId]);

  // 프로모션 분류 (진행 중 / 지난 프로모션)
  const currentPromotions = promotions.filter(p => p.is_active);
  const pastPromotions = promotions.filter(p => !p.is_active);

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

  /**
   * 날짜에서 년/월/주 추출
   */
  const getDateInfo = (date: Date | string) => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const week = Math.ceil(day / 7);
    return {year, month, week};
  };

  // 전단지 분류 (진행 중 / 지난 전단지)
  const currentFlyers = flyers.filter(f => f.is_active);
  const pastFlyers = flyers.filter(f => !f.is_active);

  const {width} = Dimensions.get('window');
  const flyerCardWidth = (width - spacing.l * 2 - spacing.m * 2) / 3;

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>상점 정보를 불러오는 중...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!storeInfo && isMine) {
    return (
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>상점 정보가 없습니다.</Text>
        </View>
      </SafeAreaView>
    );
  }

  // isMine이 false이거나 storeInfo가 없을 때는 더미 데이터 사용 (다른 사용자의 상점 보기)
  const displayStoreInfo = storeInfo || {
    name: '웅이 식자재 마트',
    description: '안녕하세요. 언제나 고객님을 위해 최고의 물건을 판매하는 웅이 식자재 마트입니다.',
    phone: '032-812-0699',
    address: '인천광역시 연수구 용담로 14',
    operatingHours: '매일: 10시 ~ 22시',
    holidays: '매월 둘째주 일요일',
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity onPress={handleBack} style={styles.headerButton}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>{displayStoreInfo.name}</Text>
          {isMine && (
            <TouchableOpacity
              style={styles.headerButton}
              onPress={() => setIsModifyModalVisible(true)}>
              <Icon name="edit" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          {!isMine && <View style={styles.headerButton} />}
        </View>

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
          {/* 프로필 섹션 */}
          <View style={styles.profileSection}>
            {displayStoreInfo.profile_image_url ? (
              <Image
                source={{uri: getThumbnailUrl(displayStoreInfo.profile_image_url, true) || displayStoreInfo.profile_image_url}}
                style={styles.profileImage}
                resizeMode="cover"
              />
            ) : (
              <Image
                source={require('../../../../assets/dev/images/storeImage.png')}
                style={styles.profileImage}
                resizeMode="cover"
              />
            )}
            <Text style={styles.storeName}>{displayStoreInfo.name}</Text>
            <Text style={styles.description}>{displayStoreInfo.description}</Text>
            <TouchableOpacity
              style={styles.locationButton}
              onPress={() => {
                if (storeInfo?.latitude && storeInfo?.longitude) {
                  setIsMapModalVisible(true);
                } else {
                  alert('알림', '등록된 위치 정보가 없습니다.');
                }
              }}>
              <Icon name="map-pin" size={16} color={colors.textPrimary} />
              <Text style={styles.locationButtonText}>위치 보기</Text>
            </TouchableOpacity>
          </View>

          {/* 연락처 및 영업 시간 */}
          <View style={styles.infoSection}>
            {/* 전화번호 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>전화번호</Text>
              <Text style={styles.infoValue}>{displayStoreInfo.phone}</Text>
            </View>

            {/* 주소 */}
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>주소</Text>
              <Text style={[styles.infoValue, {flex: 1, textAlign: 'right'}]}>
                {displayStoreInfo.address}
              </Text>
            </View>

            {/* 영업 시간 */}
            <View style={styles.infoSectionLabel}>
              <Text style={styles.sectionLabel}>영업 시간</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={{flex: 1}} />
              <Text style={[styles.infoValue, {flex: 1, textAlign: 'right'}]}>
                {typeof displayStoreInfo.operatingHours === 'string'
                  ? displayStoreInfo.operatingHours
                  : '영업 시간 정보 없음'}
              </Text>
            </View>

            {/* 휴무일 */}
            <View style={styles.infoSectionLabel}>
              <Text style={styles.sectionLabel}>휴무일</Text>
            </View>
            <View style={styles.infoRow}>
              <View style={{flex: 1}} />
              <Text style={[styles.infoValue, {flex: 1, textAlign: 'right'}]}>
                {displayStoreInfo.holidays}
              </Text>
            </View>
          </View>

          {/* 탭 메뉴 */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[
                styles.tab,
                selectedTab === 'current' && styles.tabActive,
              ]}
              onPress={() => setSelectedTab('current')}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === 'current' && styles.tabTextActive,
                ]}>
                진행 중인 행사
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'past' && styles.tabActive]}
              onPress={() => setSelectedTab('past')}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === 'past' && styles.tabTextActive,
                ]}>
                지난 행사
              </Text>
            </TouchableOpacity>
          </View>

          {/* 컨텐츠 */}
          {selectedTab === 'current' ? (
            <>
              {/* 진행 중인 전단지 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>진행 중인 전단지</Text>
                {currentFlyers.length > 0 ? (
                  currentFlyers.length >= 3 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.flyersScroll}
                      contentContainerStyle={styles.flyersContainer}>
                      {currentFlyers.map(flyer => {
                        const startInfo = getDateInfo(flyer.start_date);
                        return (
                          <TouchableOpacity
                            key={flyer.flyer_id}
                            onPress={() => {
                              setSelectedFlyer({...flyer, store_id: storeId || undefined});
                              setIsFlyerDetailVisible(true);
                            }}
                            style={[styles.flyerCard, {width: flyerCardWidth}]}>
                            <View style={styles.flyerImageContainer}>
                              <Image
                                source={{
                                  uri: getThumbnailUrl(flyer.flyer_image_url, true) || buildImageUrl(flyer.flyer_image_url) || '',
                                }}
                                style={styles.flyerThumbnail}
                                resizeMode="cover"
                              />
                              <View style={styles.flyerOverlay} />
                              <View style={styles.flyerTextContainer}>
                                <Text style={styles.flyerYear}>{startInfo.year}년</Text>
                                <Text style={styles.flyerMonthWeek}>
                                  {startInfo.month}월 {startInfo.week === 1 ? '첫째주' : startInfo.week === 2 ? '둘째주' : startInfo.week === 3 ? '셋째주' : startInfo.week === 4 ? '넷째주' : '다섯째주'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.flyersContainerCenter}>
                      {currentFlyers.map(flyer => {
                        const startInfo = getDateInfo(flyer.start_date);
                        return (
                          <TouchableOpacity
                            key={flyer.flyer_id}
                            onPress={() => {
                              setSelectedFlyer({...flyer, store_id: storeId || undefined});
                              setIsFlyerDetailVisible(true);
                            }}
                            style={[styles.flyerCard, {width: flyerCardWidth}]}>
                            <View style={styles.flyerImageContainer}>
                              <Image
                                source={{
                                  uri: getThumbnailUrl(flyer.flyer_image_url, true) || buildImageUrl(flyer.flyer_image_url) || '',
                                }}
                                style={styles.flyerThumbnail}
                                resizeMode="cover"
                              />
                              <View style={styles.flyerOverlay} />
                              <View style={styles.flyerTextContainer}>
                                <Text style={styles.flyerYear}>{startInfo.year}년</Text>
                                <Text style={styles.flyerMonthWeek}>
                                  {startInfo.month}월 {startInfo.week === 1 ? '첫째주' : startInfo.week === 2 ? '둘째주' : startInfo.week === 3 ? '셋째주' : startInfo.week === 4 ? '넷째주' : '다섯째주'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>진행 중인 전단지가 없습니다.</Text>
                  </View>
                )}
              </View>

              {/* 진행 중인 기획 상품 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>진행 중인 기획 상품</Text>
                {currentPromotions.length > 0 ? (
                  currentPromotions.map(promotion => {
                    const now = new Date();
                    const endDate = new Date(promotion.end_date);
                    const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
                    const hoursLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60));
                    const remainingTime = daysLeft > 0 ? `${daysLeft}일 남음` : hoursLeft > 0 ? `${hoursLeft}시간 남음` : '종료 임박';

                    return (
                      <TouchableOpacity
                        key={promotion.promotion_id}
                        style={styles.promotionCard}
                        onPress={() => {
                          setSelectedPromotion(promotion);
                          setIsPromotionDetailVisible(true);
                        }}>
                        <Text style={styles.promotionTime}>
                          남은 행사 기간: {remainingTime}
                        </Text>
                        <View style={styles.promotionContent}>
                          <Image
                            source={{
                              uri: getThumbnailUrl(promotion.promotion_image_url, true) || buildImageUrl(promotion.promotion_image_url) || '',
                            }}
                            style={styles.promotionImage}
                            resizeMode="cover"
                          />
                          <View style={styles.promotionTitleContainer}>
                            <Text style={styles.promotionTitle}>
                              {promotion.title}
                            </Text>
                            {promotion.description && (
                              <Text style={styles.promotionSubtitle}>
                                {promotion.description}
                              </Text>
                            )}
                          </View>
                          <View style={styles.promotionPriceContainer}>
                            {promotion.original_price && (
                              <Text style={styles.promotionOriginalPrice}>
                                {promotion.original_price.toLocaleString()}원
                              </Text>
                            )}
                            <Text style={styles.promotionPrice}>
                              {promotion.sale_price.toLocaleString()}원
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>진행 중인 기획 상품이 없습니다.</Text>
                  </View>
                )}
              </View>
            </>
          ) : (
            <>
              {/* 지난 전단지 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>지난 전단지</Text>
                {pastFlyers.length > 0 ? (
                  pastFlyers.length >= 3 ? (
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.flyersScroll}
                      contentContainerStyle={styles.flyersContainer}>
                      {pastFlyers.map(flyer => {
                        const startInfo = getDateInfo(flyer.start_date);
                        const endInfo = getDateInfo(flyer.end_date);
                        return (
                          <TouchableOpacity
                            key={flyer.flyer_id}
                            onPress={() => {
                              setSelectedFlyer({...flyer, store_id: storeId || undefined});
                              setIsFlyerDetailVisible(true);
                            }}
                            style={[styles.flyerCard, {width: flyerCardWidth}]}>
                            <View style={styles.flyerImageContainer}>
                              <Image
                                source={{
                                  uri: getThumbnailUrl(flyer.flyer_image_url, true) || buildImageUrl(flyer.flyer_image_url) || '',
                                }}
                                style={styles.flyerThumbnail}
                                resizeMode="cover"
                              />
                              <View style={styles.flyerOverlay} />
                              <View style={styles.flyerTextContainer}>
                                <Text style={styles.flyerYear}>{startInfo.year}년</Text>
                                <Text style={styles.flyerMonthWeek}>
                                  {startInfo.month}월 {startInfo.week === 1 ? '첫째주' : startInfo.week === 2 ? '둘째주' : startInfo.week === 3 ? '셋째주' : startInfo.week === 4 ? '넷째주' : '다섯째주'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  ) : (
                    <View style={styles.flyersContainerCenter}>
                      {pastFlyers.map(flyer => {
                        const startInfo = getDateInfo(flyer.start_date);
                        const endInfo = getDateInfo(flyer.end_date);
                        return (
                          <TouchableOpacity
                            key={flyer.flyer_id}
                            onPress={() => {
                              setSelectedFlyer({...flyer, store_id: storeId || undefined});
                              setIsFlyerDetailVisible(true);
                            }}
                            style={[styles.flyerCard, {width: flyerCardWidth}]}>
                            <View style={styles.flyerImageContainer}>
                              <Image
                                source={{
                                  uri: getThumbnailUrl(flyer.flyer_image_url, true) || buildImageUrl(flyer.flyer_image_url) || '',
                                }}
                                style={styles.flyerThumbnail}
                                resizeMode="cover"
                              />
                              <View style={styles.flyerOverlay} />
                              <View style={styles.flyerTextContainer}>
                                <Text style={styles.flyerYear}>{startInfo.year}년</Text>
                                <Text style={styles.flyerMonthWeek}>
                                  {startInfo.month}월 {startInfo.week === 1 ? '첫째주' : startInfo.week === 2 ? '둘째주' : startInfo.week === 3 ? '셋째주' : startInfo.week === 4 ? '넷째주' : '다섯째주'}
                                </Text>
                              </View>
                            </View>
                          </TouchableOpacity>
                        );
                      })}
                    </View>
                  )
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>지난 전단지가 없습니다.</Text>
                  </View>
                )}
              </View>

              {/* 지난 기획 상품 */}
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>지난 기획 상품</Text>
                {pastPromotions.length > 0 ? (
                  pastPromotions.map(promotion => {
                    const period = `${formatDate(promotion.start_date)} ~ ${formatDate(promotion.end_date)}`;
                    return (
                      <TouchableOpacity
                        key={promotion.promotion_id}
                        style={styles.promotionCard}
                        onPress={() => {
                          setSelectedPromotion(promotion);
                          setIsPromotionDetailVisible(true);
                        }}>
                        <Text style={styles.promotionPeriod}>
                          행사 기간: {period}
                        </Text>
                        <View style={styles.promotionContent}>
                          <Image
                            source={{
                              uri: getThumbnailUrl(promotion.promotion_image_url, true) || buildImageUrl(promotion.promotion_image_url) || '',
                            }}
                            style={styles.promotionImage}
                            resizeMode="cover"
                          />
                          <View style={styles.promotionTitleContainer}>
                            <Text style={styles.promotionTitle}>
                              {promotion.title}
                            </Text>
                            {promotion.description && (
                              <Text style={styles.promotionSubtitle}>
                                {promotion.description}
                              </Text>
                            )}
                          </View>
                          <View style={styles.promotionPriceContainer}>
                            {promotion.original_price && (
                              <Text style={styles.promotionOriginalPrice}>
                                {promotion.original_price.toLocaleString()}원
                              </Text>
                            )}
                            <Text style={styles.promotionPrice}>
                              {promotion.sale_price.toLocaleString()}원
                            </Text>
                          </View>
                        </View>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>지난 기획 상품이 없습니다.</Text>
                  </View>
                )}
              </View>
            </>
          )}
        </ScrollView>
      </View>

      {/* 마트 정보 수정 모달 */}
      <StoreModifyScreen
        visible={isModifyModalVisible}
        onClose={() => {
          setIsModifyModalVisible(false);
          // 수정 후 정보 다시 로드
          if (isMine) {
            loadStoreInfo();
          }
        }}
      />

      {/* 전단지 상세 모달 */}
      {selectedFlyer && (
        <FlyerDetailModal
          visible={isFlyerDetailVisible}
          onClose={() => {
            setIsFlyerDetailVisible(false);
            setSelectedFlyer(null);
            // 전단지 목록 다시 로드
            if (isMine) {
              loadFlyers();
            } else if (storeId) {
              loadFlyersByStoreId(storeId);
            }
          }}
          flyer={{
            ...selectedFlyer,
            store_id: storeId, // store_id 추가
          }}
          isMine={isMine}
          onModify={() => {
            // 수정하기 로직은 FlyerDetailModal 내부에서 처리
            console.log('수정하기');
          }}
          onDelete={async () => {
            // 삭제하기 로직
            try {
              const response = await StoreAPI.deleteFlyer(selectedFlyer.flyer_id);
              if (response.success) {
                alert('성공', '전단지가 삭제되었습니다.');
                if (isMine) {
                  loadFlyers();
                } else if (storeId) {
                  loadFlyersByStoreId(storeId);
                }
              } else {
                alert('실패', response.message || '전단지 삭제에 실패했습니다.');
              }
            } catch (error: any) {
              console.error('❌ [전단지 삭제] 오류:', error);
              alert('오류', '전단지 삭제 중 오류가 발생했습니다.');
            }
          }}
        />
      )}

      {/* 프로모션 상세 모달 */}
      {selectedPromotion && (
        <PromotionDetailModal
          visible={isPromotionDetailVisible}
          onClose={() => {
            setIsPromotionDetailVisible(false);
            setSelectedPromotion(null);
            // 프로모션 목록 다시 로드
            if (isMine) {
              loadPromotions();
            }
          }}
          promotion={{
            id: selectedPromotion.promotion_id,
            promotion_id: selectedPromotion.promotion_id,
            image: buildImageUrl(selectedPromotion.promotion_image_url) || null,
            title: selectedPromotion.title,
            subtitle: selectedPromotion.description || '',
            quantity: selectedPromotion.quantity && selectedPromotion.quantity_unit
              ? `${selectedPromotion.quantity}${selectedPromotion.quantity_unit}`
              : '',
            originalPrice: selectedPromotion.original_price
              ? `${selectedPromotion.original_price.toLocaleString()}원`
              : undefined,
            discountPrice: `${selectedPromotion.sale_price.toLocaleString()}원`,
            period: `${formatDate(selectedPromotion.start_date)} ~ ${formatDate(selectedPromotion.end_date)}`,
          }}
          isMine={isMine}
          onModify={() => {
            // 수정하기 로직은 PromotionDetailModal 내부에서 처리
            console.log('수정하기');
          }}
          onModifySuccess={() => {
            // 수정 완료 후 프로모션 목록 새로고침
            if (isMine) {
              loadPromotions();
            }
          }}
          onDelete={async () => {
            // 삭제하기 로직
            try {
              const response = await StoreAPI.deletePromotion(selectedPromotion.promotion_id);
              if (response.success) {
                alert('성공', '프로모션이 삭제되었습니다.');
                loadPromotions();
              } else {
                alert('오류', '프로모션 삭제에 실패했습니다.');
              }
            } catch (error: any) {
              console.error('❌ [프로모션 삭제] 오류:', error);
              alert('오류', '프로모션 삭제 중 오류가 발생했습니다.');
            }
          }}
        />
      )}

      {/* 지도 모달 */}
      <Modal
        visible={isMapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsMapModalVisible(false)}>
        <SafeAreaView style={styles.mapModalContainer} edges={['top', 'bottom']}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>위치</Text>
            <TouchableOpacity
              onPress={() => setIsMapModalVisible(false)}
              style={styles.mapModalCloseButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          {storeInfo?.latitude && storeInfo?.longitude ? (
            <MapView
              style={styles.map}
              provider={Platform.OS === 'ios' ? undefined : 'google'}
              initialRegion={{
                latitude: storeInfo.latitude,
                longitude: storeInfo.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}>
              <Marker
                coordinate={{
                  latitude: storeInfo.latitude,
                  longitude: storeInfo.longitude,
                }}
                title={storeInfo.name}
                description={storeInfo.address || ''}
              />
            </MapView>
          ) : (
            <View style={styles.mapPlaceholder}>
              <Text style={styles.mapPlaceholderText}>
                위치 정보가 없습니다.
              </Text>
            </View>
          )}
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: spacing.xl,
  },
  profileSection: {
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingBottom: spacing.l,
  },
  profileImage: {
    width: 120,
    height: 120,
    borderRadius: 60,
    marginBottom: spacing.m,
  },
  storeName: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.s,
  },
  description: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginHorizontal: spacing.l,
    marginBottom: spacing.m,
    lineHeight: 22,
  },
  addressText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginHorizontal: spacing.l,
    marginBottom: spacing.s,
    fontSize: 14,
  },
  locationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.s,
  },
  locationButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
  },
  infoSection: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  infoLabel: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
  },
  infoSectionLabel: {
    alignItems: 'center',
    marginBottom: spacing.m,
    marginTop: spacing.s,
  },
  sectionLabel: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textSecondary,
    fontWeight: '400' as const,
  },
  tabsContainer: {
    flexDirection: 'row',
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
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textTertiary,
    fontWeight: '400' as const,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  section: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  currentFlyerImageContainer: {
    alignItems: 'center',
  },
  currentFlyerImage: {
    width: '100%',
    borderRadius: borderRadius.m,
  },
  flyersScroll: {
    marginHorizontal: -spacing.l,
  },
  flyersContainer: {
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  flyersContainerCenter: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  flyerCard: {
    marginRight: spacing.m,
    alignItems: 'center',
  },
  flyerImageContainer: {
    width: '100%',
    aspectRatio: 0.7,
    borderRadius: borderRadius.m,
    marginBottom: spacing.s,
    overflow: 'hidden' as const,
    position: 'relative',
  },
  flyerThumbnail: {
    width: '100%',
    height: '100%',
    opacity: 0.6,
  },
  flyerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  flyerTextContainer: {
    position: 'absolute',
    bottom: spacing.s,
    left: 0,
    right: 0,
    alignItems: 'center',
    gap: 2,
  },
  flyerYear: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.white,
    textAlign: 'center',
    fontWeight: '700' as const,
  },
  flyerMonthWeek: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.white,
    textAlign: 'center',
    fontWeight: '700' as const,
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
  promotionOriginalPrice: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
  },
  promotionPrice: {
    fontSize: typography.h2.fontSize,
    lineHeight: typography.h2.lineHeight,
    fontFamily: typography.h2.fontFamily,
    color: '#FF6961',
    fontWeight: '700' as const,
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
  mapModalContainer: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  mapModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
  },
  mapModalCloseButton: {
    padding: spacing.xs,
  },
  map: {
    flex: 1,
  },
  mapPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
  },
  emptyContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
});

export default StoreScreen;


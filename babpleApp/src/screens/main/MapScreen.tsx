import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  ActivityIndicator,
  Dimensions,
  Platform,
} from 'react-native';
import MapView, { Marker, Region } from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Geolocation from '@react-native-community/geolocation';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux';
import Avatar from '../../components/common/Avatar';
import ImageWithLottie from '../../components/common/ImageWithLottie';
import RecipeDetailModal from '../post/RecipeDetailModal';
import { colors, spacing, typography, borderRadius, shadows } from '../../styles/commonStyles';
import { MapAPI } from '../../api/ApiRequests';
import { useRateLimiter } from '../../utils/rateLimiter';
import { useAlert } from '../../contexts/AlertContext';
import { requestPermission } from '../../utils/permission';
import { API_BASE_URL } from '../../config/api';
const DEFAULT_REGION: Region = {
  latitude: 37.5665,
  longitude: 126.978,
  latitudeDelta: 0.05,
  longitudeDelta: 0.05,
};

const SCREEN_WIDTH = Dimensions.get('window').width;
const CLUSTER_CARD_WIDTH = SCREEN_WIDTH - spacing.l * 2;

// 마커 아이콘을 컴포넌트 외부에서 require하여 릴리즈 빌드에서도 정상 작동하도록 보장
const MARKER_ICON = require('../../../assets/icon/map/rice.png');

type SingleMarker = {
  type: 'single';
  recipe_post_id: string;
  latitude: number;
  longitude: number;
  main_ingredient_name: string;
  title: string;
  description?: string | null;
  imageUrl: string | null;
  likeCount: number;
  commentCount: number;
  user?: {
    user_id?: string;
    nickname: string;
    profile_image_url?: string | null;
  } | null;
};

type ClusterMarker = {
  type: 'cluster';
  latitude: number;
  longitude: number;
  representativeIngredient: string;
  recipes: SingleMarker[];
};

type MarkerItem = SingleMarker | ClusterMarker;

interface RecipeMarker {
  recipe_post_id: string;
  main_ingredient_name: string;
  latitude: number;
  longitude: number;
  title: string;
  represent_photo_url: string | null;
  represent_photo_full_url: string | null;
  nickname: string;
  view_count: number;
}

/**
 * 지도 화면
 */
const MapScreen: React.FC = () => {
  const { alert } = useAlert();
  const insets = useSafeAreaInsets();
  const userLocation = useSelector((state: RootState) => state.userState.userInfo?.location);
  const [selectedMarker, setSelectedMarker] = useState<MarkerItem | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [markers, setMarkers] = useState<MarkerItem[]>([]);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [isFetchingMarkers, setIsFetchingMarkers] = useState(false);
  const locationErrorNotifiedRef = useRef(false);
  const fetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mapRef = useRef<MapView>(null);
  const sheetScrollRef = useRef<ScrollView | null>(null);
  const [sheetRecipes, setSheetRecipes] = useState<SingleMarker[]>([]);
  const [sheetIndex, setSheetIndex] = useState(0);
  const markersRateLimiterRef = useRef(useRateLimiter(2000));

  const buildImageUrl = useCallback((path?: string | null) => {
    if (!path) {
      return null;
    }
    if (path.startsWith('http')) {
      // iOS 캐시 문제 해결: 외부 URL에도 타임스탬프 추가
      if (Platform.OS === 'ios') {
        const separator = path.includes('?') ? '&' : '?';
        return `${path}${separator}t=${Date.now()}`;
      }
      return path;
    }
    // uploads/ 또는 /uploads로 시작하는 경우 처리
    const normalized = path.startsWith('/uploads') ? path :
      path.startsWith('uploads/') ? `/${path}` :
        `/uploads/${path}`;
    const url = `${API_BASE_URL}${normalized}`;

    // iOS 캐시 문제 해결: URL에 타임스탬프 추가
    if (Platform.OS === 'ios') {
      return `${url}?t=${Date.now()}`;
    }
    return url;
  }, []);

  const fetchMarkers = useCallback(
    async (targetRegion: Region) => {
      await markersRateLimiterRef.current.execute(async () => {
        try {
          setIsFetchingMarkers(true);

          const halfLat = targetRegion.latitudeDelta / 2;
          const halfLng = targetRegion.longitudeDelta / 2;
          const params = {
            min_latitude: targetRegion.latitude - halfLat,
            max_latitude: targetRegion.latitude + halfLat,
            min_longitude: targetRegion.longitude - halfLng,
            max_longitude: targetRegion.longitude + halfLng,
            latitude: targetRegion.latitude,
            longitude: targetRegion.longitude,
          };

          const response = await MapAPI.getRecipes(params);
          if (response?.success && Array.isArray(response.data)) {
            const singles: SingleMarker[] = response.data
              .filter((item: any) => item.latitude && item.longitude)
              .map((item: any) => {
                const imageUrl = buildImageUrl(item.represent_photo_url);
                const profilePhoto = buildImageUrl(item.profile_image_url);
                return {
                  type: 'single' as const,
                  recipe_post_id: item.recipe_post_id,
                  latitude: Number(item.latitude),
                  longitude: Number(item.longitude),
                  main_ingredient_name: item.main_ingredient_name || '',
                  title: item.title || '',
                  description: item.description || '',
                  imageUrl,
                  likeCount: Number(item.like_count ?? 0),
                  commentCount: Number(item.comment_count ?? 0),
                  user: item.nickname
                    ? {
                      user_id: item.user_id,
                      nickname: item.nickname,
                      profile_image_url: profilePhoto,
                    }
                    : null,
                };
              });

            const grouped = groupMarkersByCoordinate(singles);
            setMarkers(grouped);
          } else {
            setMarkers([]);
          }
        } catch (error) {
          console.error('지도 레시피 조회 오류:', error);
        } finally {
          setIsFetchingMarkers(false);
        }
      });
    },
    [buildImageUrl],
  );

  const initializeLocation = useCallback(async () => {
    // 1. 위치 권한 요청 (JIT)
    const hasPermission = await requestPermission('location');
    if (!hasPermission) {
      console.log('⚠️ [MapScreen] 위치 권한 거부됨, 기본 위치 사용');
      return;
    }

    // Redux에 위치가 없으면 Geolocation API 사용 (저정밀 모드로 빠르게)
    const getPosition = () =>
      new Promise((resolve, reject) => {
        Geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false, // 저정밀 모드로 고정 (빠른 응답)
          timeout: 5000,
          maximumAge: 300000, // 5분 캐시 허용
          distanceFilter: 0,
        });
      });

    const handleSuccess = (position: any) => {
      const {
        coords: { latitude, longitude },
      } = position;
      console.log('✅ [MapScreen] 위치 가져오기 성공:', { latitude, longitude });
      const nextRegion: Region = {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      // region이 실제로 변경되었는지 확인
      const regionChanged =
        Math.abs(region.latitude - nextRegion.latitude) > 0.0001 ||
        Math.abs(region.longitude - nextRegion.longitude) > 0.0001;

      if (regionChanged) {
        setRegion(nextRegion);
        setTimeout(() => {
          mapRef.current?.animateToRegion(nextRegion, 400);
        }, 120);
        fetchMarkers(nextRegion);
      }
    };

    const handleFailure = (error: any, attempt: string) => {
      console.error(`❌ [MapScreen] 위치 가져오기 실패 (${attempt}):`, {
        code: error?.code,
        message: error?.message,
        error,
      });

      // 기본 위치로 이동 (region이 실제로 변경되었는지 확인)
      const regionChanged =
        Math.abs(region.latitude - DEFAULT_REGION.latitude) > 0.0001 ||
        Math.abs(region.longitude - DEFAULT_REGION.longitude) > 0.0001;

      if (regionChanged) {
        setRegion(DEFAULT_REGION);
        mapRef.current?.animateToRegion(DEFAULT_REGION, 300);
        fetchMarkers(DEFAULT_REGION);
      }

      // 타임아웃 에러(code 3)는 조용히 처리 (GPS가 꺼져 있거나 느릴 때 발생)
      // 권한 거부(code 1)나 위치 서비스 사용 불가(code 2)만 알림 표시
      if (error?.code === 3) {
        // 타임아웃은 조용히 처리 (GPS가 꺼져 있거나 느릴 때 정상적인 상황)
        console.log('⚠️ [MapScreen] 위치 가져오기 타임아웃, 기본 위치로 이동');
        return;
      }

      // 권한 거부나 위치 서비스 사용 불가인 경우에만 알림 표시
      if (!locationErrorNotifiedRef.current) {
        locationErrorNotifiedRef.current = true;
        let errorMessage = '현재 위치를 가져오지 못했습니다.';
        if (error?.code === 1) {
          errorMessage = '위치 권한이 거부되었습니다. 설정에서 위치 권한을 허용해주세요.';
        } else if (error?.code === 2) {
          errorMessage = 'GPS가 꺼져 있거나 위치 서비스를 사용할 수 없습니다. 설정에서 위치 서비스를 켜주세요.';
        }
        alert('위치 확인 실패', errorMessage);
      }
    };

    // 저정밀 모드로만 위치 가져오기 (빠른 응답)
    try {
      console.log('📍 [MapScreen] 저정밀 모드로 위치 가져오기 시도...');
      const position: any = await getPosition();
      handleSuccess(position);
    } catch (error: any) {
      console.log('⚠️ [MapScreen] 위치 가져오기 실패');
      handleFailure(error, '저정밀 모드');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    Geolocation.setRNConfiguration({
      skipPermissionRequests: false,
      authorizationLevel: 'whenInUse',
    });

    // 먼저 Redux에 저장된 사용자 위치 확인
    if (
      userLocation &&
      typeof userLocation.latitude === 'number' &&
      typeof userLocation.longitude === 'number' &&
      !Number.isNaN(userLocation.latitude) &&
      !Number.isNaN(userLocation.longitude)
    ) {
      console.log('📍 [MapScreen] Redux에서 저장된 위치 사용:', userLocation);
      const nextRegion: Region = {
        latitude: userLocation.latitude,
        longitude: userLocation.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      };
      // region이 실제로 변경되었는지 확인
      const regionChanged =
        Math.abs(region.latitude - nextRegion.latitude) > 0.0001 ||
        Math.abs(region.longitude - nextRegion.longitude) > 0.0001;

      if (regionChanged) {
        setRegion(nextRegion);
        setTimeout(() => {
          mapRef.current?.animateToRegion(nextRegion, 400);
        }, 120);
        fetchMarkers(nextRegion);
      }
    } else {
      // Redux에 위치가 없으면 Geolocation API 사용
      initializeLocation();
    }

    return () => {
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userLocation?.latitude, userLocation?.longitude]);

  /**
   * 마커 터치 시 하단 시트 열기
   */
  const handleMarkerPress = (marker: MarkerItem) => {
    if (marker.type === 'cluster') {
      setSheetRecipes(marker.recipes);
      setSheetIndex(0);
      setSelectedMarker(marker);
      return;
    }
    setSheetRecipes([marker as SingleMarker]);
    setSheetIndex(0);
    setSelectedMarker(marker);
  };

  /**
   * 하단 시트 닫기
   */
  const handleCloseSheet = () => {
    setSelectedMarker(null);
    setSheetRecipes([]);
    setSheetIndex(0);
  };

  const handleRegionChangeComplete = useCallback(
    (nextRegion: Region) => {
      setRegion(nextRegion);
      if (fetchTimerRef.current) {
        clearTimeout(fetchTimerRef.current);
      }
      fetchTimerRef.current = setTimeout(() => {
        fetchMarkers(nextRegion);
      }, 400);
    },
    [fetchMarkers],
  );

  const markerComponents = useMemo(
    () =>
      markers.map(marker => {
        if (marker.type === 'cluster') {
          return (
            <Marker
              key={`cluster-${marker.latitude}-${marker.longitude}`}
              coordinate={{ latitude: marker.latitude, longitude: marker.longitude }}
              onPress={() => handleMarkerPress(marker)}>
              <View style={styles.clusterMarkerWrapper}>
                <View style={styles.clusterIconContainer}>
                  {/*<Image
                    source={iconByIngredientName(marker.representativeIngredient)}
                    style={{width: 24, height: 24}}
                  />*/}
                  <Text style={styles.clusterCountText}>{`+${marker.recipes.length}`}</Text>
                </View>
              </View>
            </Marker>
          );
        }

        const single = marker as SingleMarker;
        return (
          <Marker
            key={single.recipe_post_id}
            coordinate={{
              latitude: single.latitude,
              longitude: single.longitude,
            }}
            onPress={() => handleMarkerPress(single)}
            anchor={{ x: 0.5, y: 0.5 }}>
            {/* <View style={styles.markerIcon} collapsable={false}>
              <Image
                source={MARKER_ICON}
                style={styles.markerIconImage}
                resizeMode="contain"
                onError={(error) => {
                  console.error('❌ [마커 이미지 로드 실패]', single.recipe_post_id, error.nativeEvent);
                }}
                onLoad={() => {
                  console.log('✅ [마커 이미지 로드 성공]', single.recipe_post_id);
                }}
              />
            </View> */}
            <View style={styles.clusterMarkerWrapper}>
              <View style={styles.clusterIconContainer}>
                {/*<Image
                    source={iconByIngredientName(marker.representativeIngredient)}
                    style={{width: 24, height: 24}}
                  />*/}
                <Text style={styles.clusterCountText}>{`+1`}</Text>
              </View>
            </View>
          </Marker>
        );
      }),
    [markers],
  );

  return (
    <View style={styles.container}>
      {/* 지도 */}
      <View style={[styles.mapContainer, { top: insets.top }]}>
        <MapView
          ref={mapRef}
          style={styles.map}
          provider={Platform.OS === 'ios' ? undefined : 'google'}
          region={region}
          showsUserLocation
          showsMyLocationButton
          onRegionChangeComplete={handleRegionChangeComplete}
          onMapReady={() => {
            // 지도 준비 완료
          }}>
          {markerComponents}
        </MapView>
      </View>

      {/* 마커 이미지를 미리 렌더링하여 캐시에 올림 (화면 밖에 위치) */}
      <View style={styles.imagePreloader} pointerEvents="none">
        <Image
          source={MARKER_ICON}
          style={styles.preloadImage}
          resizeMode="contain"
        />
      </View>

      {isFetchingMarkers && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      )}

      {/* 하단 시트 */}
      {selectedMarker && sheetRecipes.length > 0 && (
        <ClusterSheet
          recipes={sheetRecipes}
          activeIndex={sheetIndex}
          onChangeIndex={(index: number) => setSheetIndex(index)}
          onClose={handleCloseSheet}
          onSelectRecipe={(recipe: SingleMarker) => {
            handleCloseSheet();
            setSelectedRecipeId(recipe.recipe_post_id);
            setModalVisible(true);
          }}
          scrollRef={sheetScrollRef}
        />
      )}

      {/* RecipeDetailModal */}
      <RecipeDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        recipeId={selectedRecipeId}
      />
    </View>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
  },
  mapContainer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  map: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
  markerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  markerIconImage: {
    width: 28,
    height: 28,
  },
  clusterMarkerWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  clusterIconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 3,
  },
  clusterCountText: {
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 8,
    backgroundColor: colors.primary,
    color: colors.white,
    fontSize: 16,
    fontWeight: 'bold',
  },
  loadingIndicator: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.xl,
    padding: spacing.s,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: borderRadius.s,
    ...shadows.card,
  },
  imagePreloader: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    width: 1,
    height: 1,
    opacity: 0,
  },
  preloadImage: {
    width: 28,
    height: 28,
  },
});

const clusterStyles = StyleSheet.create<any>({
  container: {
    position: 'absolute',
    bottom: 30,
    left: spacing.l,
    right: spacing.l,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    ...shadows.card,
  },
  scrollContent: {
    paddingHorizontal: spacing.m,
  },
  compactCard: {
    width: CLUSTER_CARD_WIDTH * 0.85,
    height: 110,
    marginRight: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.offWhite,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    gap: spacing.m,
  },
  compactImageWrapper: {
    width: 72,
    height: 72,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  compactImage: {
    width: '100%',
    height: '100%',
  },
  compactInfo: {
    flex: 1,
    gap: spacing.xs,
  },
  compactTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  compactUserRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  compactNickname: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  compactMeta: {
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: spacing.s,
  },
  compactMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  compactMetaText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  pagination: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: spacing.s,
    gap: spacing.xs,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lightGray,
  },
  dotActive: {
    backgroundColor: colors.primary,
  },
  closeButton: {
    position: 'absolute',
    top: spacing.s,
    right: spacing.s,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

function groupMarkersByCoordinate(markers: SingleMarker[]): MarkerItem[] {
  const buckets = new Map<string, { latitude: number; longitude: number; recipes: SingleMarker[] }>();
  const precision = 1000; // ~100m (클러스터링용, 축적이 작을 때 사용)

  markers.forEach(marker => {
    const keyLat = Math.round(marker.latitude * precision) / precision;
    const keyLng = Math.round(marker.longitude * precision) / precision;
    const key = `${keyLat}:${keyLng}`;
    if (!buckets.has(key)) {
      buckets.set(key, { latitude: keyLat, longitude: keyLng, recipes: [] });
    }
    buckets.get(key)!.recipes.push(marker);
  });

  const result: MarkerItem[] = [];
  buckets.forEach(bucket => {
    if (bucket.recipes.length === 1) {
      // 단일 마커는 원본 좌표를 그대로 사용하여 정확한 위치에 표시
      result.push(bucket.recipes[0]);
    } else {
      result.push({
        type: 'cluster',
        latitude: bucket.latitude,
        longitude: bucket.longitude,
        representativeIngredient: bucket.recipes[0].main_ingredient_name,
        recipes: bucket.recipes,
      });
    }
  });

  return result;
}

interface ClusterSheetProps {
  recipes: SingleMarker[];
  activeIndex: number;
  onChangeIndex: (index: number) => void;
  onClose: () => void;
  onSelectRecipe: (recipe: SingleMarker) => void;
  scrollRef: React.MutableRefObject<ScrollView | null>;
}

function ClusterSheet({
  recipes,
  activeIndex,
  onChangeIndex,
  onClose,
  onSelectRecipe,
  scrollRef,
}: ClusterSheetProps) {
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ x: activeIndex * CLUSTER_CARD_WIDTH, animated: true });
    }
  }, [activeIndex, scrollRef]);

  return (
    <View style={clusterStyles.container}>
      <ScrollView
        ref={scrollRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={clusterStyles.scrollContent}>
        {recipes.map((recipe, index) => {
          const profileSource = recipe.user?.profile_image_url
            ? { uri: recipe.user.profile_image_url }
            : undefined;
          return (
            <TouchableOpacity
              key={`${recipe.recipe_post_id}-${index}`}
              activeOpacity={0.9}
              style={clusterStyles.compactCard}
              onPress={() => onSelectRecipe(recipe)}>
              <View style={clusterStyles.compactImageWrapper}>
                <ImageWithLottie
                  source={recipe.imageUrl ? { uri: recipe.imageUrl } : require('../../../assets/dev/images/feed01.png')}
                  style={clusterStyles.compactImage}
                  resizeMode="cover"
                  onError={() => {
                    console.warn('❌ [ClusterSheet] 이미지 로딩 실패:', recipe.imageUrl);
                  }}
                />
              </View>
              <View style={clusterStyles.compactInfo}>
                <Text style={clusterStyles.compactTitle} numberOfLines={1}>
                  {recipe.title}
                </Text>
                <View style={clusterStyles.compactUserRow}>
                  <Avatar size={24} source={profileSource} />
                  <Text style={clusterStyles.compactNickname}>{recipe.user?.nickname || '이웃'}</Text>
                </View>
              </View>
              <View style={clusterStyles.compactMeta}>
                <View style={clusterStyles.compactMetaItem}>
                  <Icon name="heart" size={16} color={colors.accent} />
                  <Text style={clusterStyles.compactMetaText}>{recipe.likeCount}</Text>
                </View>
                <View style={clusterStyles.compactMetaItem}>
                  <Icon name="message-circle" size={16} color={colors.textSecondary} />
                  <Text style={clusterStyles.compactMetaText}>{recipe.commentCount}</Text>
                </View>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <View style={clusterStyles.pagination}>
        {recipes.map((_, index) => (
          <View
            key={index}
            style={[
              clusterStyles.dot,
              activeIndex === index && clusterStyles.dotActive,
            ]}
          />
        ))}
      </View>
      <TouchableOpacity style={clusterStyles.closeButton} onPress={onClose}>
        <Icon name="x" size={24} color={colors.white} />
      </TouchableOpacity>
    </View>
  );
}

export default MapScreen;


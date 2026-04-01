import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  RefreshControl,
  Modal,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useFocusEffect, useNavigation} from '@react-navigation/native';
import Icon from 'react-native-vector-icons/Feather';
import {LottieSpinner} from '../../components/common';
import ImageWithLottie from '../../components/common/ImageWithLottie';
import StoreScreen from '../biz/store/StoreScreen';
import {colors, spacing, typography, borderRadius, shadows} from '../../styles/commonStyles';
import {IngredientAPI, RecipeAPI, SearchAPI, StoreAPI, UserAPI} from '../../api/ApiRequests';
import {useSelector} from 'react-redux';
import {RootState} from '../../redux';
import Avatar from '../../components/common/Avatar';
import RecipeDetailModal from '../post/RecipeDetailModal';
import UserProfileScreen from '../profile/UserProfileScreen';
import {useRateLimiter} from '../../utils/rateLimiter';

import {API_BASE_URL} from '../../config/api';

interface SearchRecipeResult {
  recipe_post_id: string;
  title: string;
  thumbnail?: string | null;
  like_count?: number;
  comment_count?: number;
}

interface SearchIngredientResult {
  ingredient_id: number;
  name: string;
  default_unit?: string;
}

interface SearchUserResult {
  user_id: string;
  nickname: string;
  profile_image_url?: string | null;
  introduction?: string | null;
}

interface TrendingKeywordItem {
  keyword: string;
  count: number;
}

interface LocalRankingRecipe {
  recipe_post_id: string;
  title: string;
  nickname: string;
  like_count: number;
  comment_count: number;
  thumbnail?: string | null;
  rank?: number;
  location_text?: string | null;
}

interface RecentRandomRecipe {
  recipe_post_id: string;
  title: string;
  thumbnail?: string | null;
}

const buildMediaUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    // iOS 캐시 문제 해결: 외부 URL에도 타임스탬프 추가
    if (Platform.OS === 'ios') {
      const separator = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${separator}t=${Date.now()}`;
    }
    return trimmed;
  }

  let normalized = trimmed.replace(/\\/g, '/');

  if (normalized.startsWith('/uploads')) {
    // Already normalized
    const url = `${API_BASE_URL}${normalized}`;
    // iOS 캐시 문제 해결: URL에 타임스탬프 추가
    if (Platform.OS === 'ios') {
      return `${url}?t=${Date.now()}`;
    }
    return url;
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

  const url = `${API_BASE_URL}${normalized}`;
  // iOS 캐시 문제 해결: URL에 타임스탬프 추가
  if (Platform.OS === 'ios') {
    return `${url}?t=${Date.now()}`;
  }
  return url;
};

/**
 * 탐색 화면
 */
const SearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const [selectedTag, setSelectedTag] = useState('');
  const [isStoreModalVisible, setIsStoreModalVisible] = useState(false);
  const [isAppIntroModalVisible, setIsAppIntroModalVisible] = useState(false);
  const [searchKeyword, setSearchKeyword] = useState('');
  const [searchResults, setSearchResults] = useState<SearchRecipeResult[]>([]);
  const [ingredientResults, setIngredientResults] = useState<SearchIngredientResult[]>([]);
  const [userResults, setUserResults] = useState<SearchUserResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchErrors, setSearchErrors] = useState<{
    recipes: string | null;
    ingredients: string | null;
    users: string | null;
  }>({recipes: null, ingredients: null, users: null});
  const [activeTab, setActiveTab] = useState<'recipes' | 'ingredients' | 'users'>('recipes');
  const latestQueryRef = useRef('');
  const latestLoggedKeywordRef = useRef('');
  const searchLogTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string | null>(null);
  const [userProfileVisible, setUserProfileVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedUserName, setSelectedUserName] = useState<string>('');
  const [trendingKeywords, setTrendingKeywords] = useState<TrendingKeywordItem[]>([]);
  const userLocation = useSelector((state: RootState) => state.userState.userInfo?.location);
  const userLocationText = useSelector(
    (state: RootState) => state.userState.userInfo?.location_text,
  );
  const userLatitude =
    userLocation && typeof userLocation.latitude === 'number'
      ? userLocation.latitude
      : undefined;
  const userLongitude =
    userLocation && typeof userLocation.longitude === 'number'
      ? userLocation.longitude
      : undefined;
  const [localRanking, setLocalRanking] = useState<LocalRankingRecipe[]>([]);
  const [localRankingLoading, setLocalRankingLoading] = useState(false);
  const [localRankingError, setLocalRankingError] = useState<string | null>(null);
  const [recentRandomRecipes, setRecentRandomRecipes] = useState<RecentRandomRecipe[]>([]);
  const [recentRandomLoading, setRecentRandomLoading] = useState(false);
  const [nearbyPromotion, setNearbyPromotion] = useState<{
    promotion_id: string;
    store_id: string;
    store_name: string | null;
    store_address: string | null;
    ingredient_id: number;
    ingredient_name: string | null;
    title: string;
    description: string | null;
    sale_price: number;
    original_price: number | null;
    start_date: Date;
    end_date: Date;
    promotion_image_url: string | null;
    quantity: number | null;
    quantity_unit: string | null;
    view_count: number;
    created_at: Date;
  } | null>(null);
  const [promotionLoading, setPromotionLoading] = useState(false);
  const [topRecipe, setTopRecipe] = useState<{
    recipe_post_id: string;
    title: string;
    description?: string | null;
    like_count: number;
    comment_count: number;
    represent_photo_url?: string | null;
    created_at: string;
    user: {
      user_id: string;
      nickname: string;
      profile_image_url?: string | null;
    };
  } | null>(null);
  const [topRecipeLoading, setTopRecipeLoading] = useState(false);
  const [lastPromotionId, setLastPromotionId] = useState<string | null>(null);
  const promotionRateLimiter = useRateLimiter(2000);
  const viewCountRateLimiter = useRateLimiter(5000); // view_count 증가용 별도 rate limiter (5초)
  const viewedPromotionIdsRef = React.useRef<Set<string>>(new Set()); // 이미 view_count를 증가시킨 promotion_id 추적
  const visitedStoreIdsRef = useRef<Set<string>>(new Set()); // 이미 방문 기록을 한 store_id 추적
  const [refreshing, setRefreshing] = useState(false);

  const fetchTrendingKeywords = useCallback(async () => {
    try {
      const response = await SearchAPI.getTrendingSearches({hours: 24 * 7, limit: 12});
      if (response?.success && Array.isArray(response.data)) {
        setTrendingKeywords(response.data as TrendingKeywordItem[]);
      } else if (Array.isArray(response?.data)) {
        setTrendingKeywords(response.data as TrendingKeywordItem[]);
      }
    } catch (error) {
      console.error('❌ [SearchScreen] 인기 검색어 조회 실패:', error);
    }
  }, []);

  useEffect(() => {
    fetchTrendingKeywords();
  }, [fetchTrendingKeywords]);

  const fetchLocalRanking = useCallback(async () => {
    try {
      setLocalRankingLoading(true);
      setLocalRankingError(null);

      const params: {
        location_text?: string;
        limit?: number;
      } = {limit: 10};

      // 🚧 릴리즈에서 변경: 알파 테스트 기간에는 주소 조건 없이 모든 레시피 표시
      // 릴리즈 시 아래 주석을 해제하여 구 단위 매칭 활성화
      /*
      if (userLocationText && userLocationText.trim()) {
        params.location_text = userLocationText.trim();
      }
      */

      const response = await RecipeAPI.getLocalRanking(params);

      if (response?.success && Array.isArray(response.data)) {
        setLocalRanking(response.data as LocalRankingRecipe[]);
      } else if (Array.isArray(response?.data)) {
        setLocalRanking(response.data as LocalRankingRecipe[]);
      } else {
        setLocalRanking([]);
        setLocalRankingError(response?.message || '지역 인기 레시피를 불러오지 못했습니다.');
      }
    } catch (error) {
      console.error('❌ [SearchScreen] 지역 인기 레시피 조회 실패:', error);
      setLocalRanking([]);
      setLocalRankingError('지역 인기 레시피를 불러오지 못했습니다.');
    } finally {
      setLocalRankingLoading(false);
    }
  }, [userLocationText]);

  useEffect(() => {
    fetchLocalRanking();
  }, [fetchLocalRanking]);

  const fetchRecentRandomRecipes = useCallback(async () => {
    try {
      setRecentRandomLoading(true);
      const response = await RecipeAPI.getRecentRandomRecipes({limit: 12});
      if (response?.success && Array.isArray(response.data)) {
        setRecentRandomRecipes(response.data as RecentRandomRecipe[]);
      } else if (Array.isArray(response?.data)) {
        setRecentRandomRecipes(response.data as RecentRandomRecipe[]);
      } else {
        setRecentRandomRecipes([]);
      }
    } catch (error) {
      console.error('❌ [SearchScreen] 최근 랜덤 레시피 조회 실패:', error);
      setRecentRandomRecipes([]);
    } finally {
      setRecentRandomLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecentRandomRecipes();
  }, [fetchRecentRandomRecipes]);

  /**
   * 근처 기획 상품 조회
   */
  const fetchNearbyPromotion = useCallback(async (resetLastId: boolean = false) => {
    if (!userLocationText) {
      return;
    }

    await promotionRateLimiter.execute(async () => {
      try {
        setPromotionLoading(true);
        
        const response = await StoreAPI.getNearbyPromotions({
          location_text: userLocationText,
        });

        if (response?.success && response.data && response.data.length > 0) {
          const promotion = response.data[0];
          
          // resetLastId가 true이거나 이전에 본 기획 상품과 다를 때만 업데이트
          setLastPromotionId(prevId => {
            if (resetLastId || promotion.promotion_id !== prevId) {
              setNearbyPromotion(promotion);
              
              // view_count 증가 (rate limiting 및 중복 방지 적용)
              // 같은 promotion_id에 대해서는 한 번만 증가시키도록 보장
              if (!viewedPromotionIdsRef.current.has(promotion.promotion_id)) {
                viewedPromotionIdsRef.current.add(promotion.promotion_id);
                
                viewCountRateLimiter.execute(async () => {
                  try {
                    await StoreAPI.incrementPromotionViewCount(promotion.promotion_id);
                  } catch (error: any) {
                    // 429 에러는 조용히 무시 (rate limit)
                    if (error?.response?.status === 429) {
                      return;
                    }
                    console.error('❌ [SearchScreen] view_count 증가 실패:', error);
                  }
                });
              }
              
              return promotion.promotion_id;
            }
            return prevId;
          });
        } else {
          setNearbyPromotion(null);
          setTopRecipe(null); // 기획 상품이 없으면 레시피도 초기화
          if (resetLastId) {
            setLastPromotionId(null);
            // resetLastId가 true일 때는 viewedPromotionIds도 초기화
            viewedPromotionIdsRef.current.clear();
          }
        }
      } catch (error) {
        console.error('❌ [SearchScreen] 근처 기획 상품 조회 실패:', error);
        setNearbyPromotion(null);
      } finally {
        setPromotionLoading(false);
      }
    });
  }, [userLocationText, promotionRateLimiter, viewCountRateLimiter]);

  /**
   * 특정 재료의 주재료 레시피 중 가장 좋아요가 많은 레시피 조회
   */
  const fetchTopRecipeByIngredient = useCallback(async (ingredientId: number) => {
    try {
      setTopRecipeLoading(true);
      const response = await RecipeAPI.getTopRecipeByMainIngredient(ingredientId);
      if (response?.success && response.data) {
        setTopRecipe(response.data);
      } else {
        setTopRecipe(null);
      }
    } catch (error) {
      console.error('❌ [SearchScreen] 주재료 레시피 조회 실패:', error);
      setTopRecipe(null);
    } finally {
      setTopRecipeLoading(false);
    }
  }, []);

  // nearbyPromotion이 변경될 때 해당 재료의 주재료 레시피 조회
  useEffect(() => {
    if (nearbyPromotion?.ingredient_id) {
      fetchTopRecipeByIngredient(nearbyPromotion.ingredient_id);
    } else {
      setTopRecipe(null);
    }
  }, [nearbyPromotion?.ingredient_id, fetchTopRecipeByIngredient]);

  // 화면 포커스 시 기획 상품 조회 (새로운 기획 상품을 위해 resetLastId=true로 호출)
  useFocusEffect(
    React.useCallback(() => {
      // 화면에 포커스될 때마다 새로운 기획 상품을 로드
      fetchNearbyPromotion(true);
    }, [fetchNearbyPromotion]),
  );

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    // 모든 데이터 새로고침
    await Promise.all([
      fetchTrendingKeywords(),
      fetchLocalRanking(),
      fetchRecentRandomRecipes(),
      fetchNearbyPromotion(true),
    ]);
    setRefreshing(false);
  }, [fetchTrendingKeywords, fetchLocalRanking, fetchRecentRandomRecipes, fetchNearbyPromotion]);

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

  const showSearchResults = searchKeyword.trim().length > 0;

  useEffect(() => {
    if (showSearchResults && isStoreModalVisible) {
      setIsStoreModalVisible(false);
    }
  }, [showSearchResults, isStoreModalVisible]);

  useEffect(() => {
    const trimmed = searchKeyword.trim();

    if (trimmed.length === 0) {
      latestQueryRef.current = '';
      latestLoggedKeywordRef.current = '';
      setSearchLoading(false);
      setSearchErrors({recipes: null, ingredients: null, users: null});
      setSearchResults([]);
      setIngredientResults([]);
      setUserResults([]);
      setActiveTab('recipes');
      return;
    }

    const query = trimmed;
    latestQueryRef.current = query;
    setSearchLoading(true);
    setSearchErrors({recipes: null, ingredients: null, users: null});

    const handler = setTimeout(async () => {
      try {
        const [recipeRes, ingredientRes, userRes] = await Promise.allSettled([
          RecipeAPI.searchRecipes(query),
          IngredientAPI.searchIngredients(query),
          UserAPI.searchUsers(query),
        ]);

        if (latestQueryRef.current !== query) {
          return;
        }

        let recipeData: SearchRecipeResult[] = [];
        let ingredientData: SearchIngredientResult[] = [];
        let userData: SearchUserResult[] = [];
        const nextErrors: {
          recipes: string | null;
          ingredients: string | null;
          users: string | null;
        } = {recipes: null, ingredients: null, users: null};

        if (recipeRes.status === 'fulfilled') {
          const value: any = recipeRes.value;
          if (value?.success && Array.isArray(value.data)) {
            recipeData = value.data as SearchRecipeResult[];
          } else {
            nextErrors.recipes = value?.message || '레시피 검색 결과를 불러오지 못했습니다.';
          }
        } else {
          nextErrors.recipes = '레시피 검색 중 오류가 발생했습니다.';
        }

        if (ingredientRes.status === 'fulfilled') {
          const value: any = ingredientRes.value;
          if (value?.success && Array.isArray(value.data)) {
            ingredientData = value.data as SearchIngredientResult[];
          } else {
            nextErrors.ingredients = value?.message || '재료 검색 결과를 불러오지 못했습니다.';
          }
        } else {
          nextErrors.ingredients = '재료 검색 중 오류가 발생했습니다.';
        }

        if (userRes.status === 'fulfilled') {
          const value: any = userRes.value;
          if (value?.success && Array.isArray(value.data)) {
            userData = value.data as SearchUserResult[];
          } else {
            nextErrors.users = value?.message || '사용자 검색 결과를 불러오지 못했습니다.';
          }
        } else {
          nextErrors.users = '사용자 검색 중 오류가 발생했습니다.';
        }

        setSearchResults(recipeData);
        setIngredientResults(ingredientData);
        setUserResults(userData);
        setSearchErrors(nextErrors);

        if (searchLogTimeoutRef.current) {
          clearTimeout(searchLogTimeoutRef.current);
        }

        const containsHangulInitial = /[ㄱ-ㅎ]/u.test(query);
        const isEmailLike = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(query);
        if (!containsHangulInitial && !isEmailLike) {
          searchLogTimeoutRef.current = setTimeout(() => {
            if (latestLoggedKeywordRef.current === query) {
              return;
            }
            latestLoggedKeywordRef.current = query;
            SearchAPI.recordSearch(query, 'global')
              .then(() => {
                fetchTrendingKeywords();
              })
              .catch(error => {
                console.error('❌ [SearchScreen] 검색 기록 저장 실패:', error);
              });
          }, 800);
        }
      } catch (error) {
        console.error('❌ [SearchScreen] 레시피 검색 실패:', error);
        if (latestQueryRef.current === query) {
          setSearchResults([]);
          setIngredientResults([]);
          setUserResults([]);
          setSearchErrors({
            recipes: '레시피 검색 중 오류가 발생했습니다.',
            ingredients: '재료 검색 중 오류가 발생했습니다.',
            users: '사용자 검색 중 오류가 발생했습니다.',
          });
        }
      } finally {
        if (latestQueryRef.current === query) {
          setSearchLoading(false);
        }
      }
    }, 300);

    return () => {
      clearTimeout(handler);
    };
  }, [fetchTrendingKeywords, searchKeyword]);

  useEffect(() => {
    return () => {
      if (searchLogTimeoutRef.current) {
        clearTimeout(searchLogTimeoutRef.current);
      }
    };
  }, []);

  const handleSearchKeywordChange = useCallback(
    (text: string) => {
      if (selectedTag) {
        setSelectedTag('');
      }
      setSearchKeyword(text);
    },
    [selectedTag],
  );

  const handleRecipeSelect = useCallback((recipe: SearchRecipeResult) => {
    setSelectedRecipeId(recipe.recipe_post_id);
    setDetailModalVisible(true);
  }, []);

  const handleRankingPress = useCallback(
    (item: LocalRankingRecipe) => {
      handleRecipeSelect({
        recipe_post_id: item.recipe_post_id,
        title: item.title,
        thumbnail: item.thumbnail,
        like_count: item.like_count,
        comment_count: item.comment_count,
      });
    },
    [handleRecipeSelect],
  );

  const handleModalClose = useCallback(() => {
    setDetailModalVisible(false);
    setSelectedRecipeId(null);
  }, []);

  const handleRecipeDeletedFromModal = useCallback((deletedId: string) => {
    setSearchResults(prev => prev.filter(item => item.recipe_post_id !== deletedId));
    setDetailModalVisible(false);
    setSelectedRecipeId(null);
  }, []);

  const tabItems: Array<{id: 'recipes' | 'ingredients' | 'users'; label: string}> = useMemo(
    () => [
      {id: 'recipes', label: '레시피'},
      {id: 'ingredients', label: '주재료'},
      {id: 'users', label: '닉네임'},
    ],
    [],
  );

  const resultsCount = useMemo(() => {
    if (activeTab === 'recipes') {
      return searchResults.length;
    }
    if (activeTab === 'ingredients') {
      return ingredientResults.length;
    }
    return userResults.length;
  }, [activeTab, searchResults.length, ingredientResults.length, userResults.length]);

  const renderedActiveResults = useMemo(() => {
    if (searchLoading) {
      return (
        <View style={styles.searchStatusWrapper}>
          <LottieSpinner size="small" />
          <Text style={styles.searchStatusText}>검색 중...</Text>
        </View>
      );
    }

    const activeError = searchErrors[activeTab];
    if (activeError) {
      return (
        <View style={styles.searchStatusWrapper}>
          <Icon name="alert-triangle" size={16} color={colors.error} />
          <Text style={styles.searchErrorText}>{activeError}</Text>
        </View>
      );
    }

    if (resultsCount === 0) {
      return (
        <View style={styles.searchStatusWrapper}>
          <Icon name="search" size={16} color={colors.textSecondary} />
          <Text style={styles.searchEmptyText}>
            '{searchKeyword.trim()}' 관련 {tabItems.find(item => item.id === activeTab)?.label} 결과가 없습니다.
          </Text>
        </View>
      );
    }

    if (activeTab === 'recipes') {
      return (
        <View style={styles.resultsGrid}>
          {searchResults.map(result => {
            const thumbnail = buildMediaUrl(result.thumbnail);
            return (
              <TouchableOpacity
                key={result.recipe_post_id}
                style={styles.resultCard}
                activeOpacity={0.8}
                onPress={() => handleRecipeSelect(result)}>
                <View style={styles.resultImageWrapper}>
                  {thumbnail ? (
                    <ImageWithLottie source={{uri: thumbnail}} style={styles.resultImage} />
                  ) : (
                    <View style={styles.resultImagePlaceholder}>
                      <Icon name="image" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                </View>
                <View style={styles.resultInfo}>
                  <Text style={styles.resultTitle} numberOfLines={2}>
                    {result.title || '레시피'}
                  </Text>
                  <View style={styles.resultMetaRow}>
                    <View style={styles.resultMetaItem}>
                      <Icon name="heart" size={12} color={colors.textSecondary} />
                      <Text style={styles.resultMetaText}>{result.like_count ?? 0}</Text>
                    </View>
                    <View style={styles.resultMetaItem}>
                      <Icon name="message-circle" size={12} color={colors.textSecondary} />
                      <Text style={styles.resultMetaText}>{result.comment_count ?? 0}</Text>
                    </View>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })}
        </View>
      );
    }

    if (activeTab === 'ingredients') {
      return (
        <View style={styles.ingredientList}>
          {ingredientResults.map(item => (
            <View key={item.ingredient_id} style={styles.ingredientItem}>
              <View style={styles.ingredientBullet} />
              <View style={styles.ingredientInfo}>
                <Text style={styles.ingredientName}>{item.name}</Text>
                {item.default_unit ? (
                  <Text style={styles.ingredientMeta}>기본 단위: {item.default_unit}</Text>
                ) : null}
              </View>
            </View>
          ))}
        </View>
      );
    }

    return (
      <View style={styles.userList}>
        {userResults.map(user => {
          const profileUri = buildMediaUrl(user.profile_image_url || undefined);
          const introduction = user.introduction?.trim() || '소개 정보가 없습니다.';
          const isOwnProfile = currentUser?.user_id && user.user_id === currentUser.user_id;
          
          return (
            <TouchableOpacity
              key={user.user_id}
              style={styles.userItem}
              activeOpacity={0.8}
              onPress={() => {
                if (isOwnProfile) {
                  // 본인이면 마이페이지로 이동
                  navigation.navigate('Profile');
                } else {
                  // 다른 유저면 프로필 모달 열기
                  setSelectedUserId(user.user_id);
                  setSelectedUserName(user.nickname);
                  setUserProfileVisible(true);
                }
              }}>
              <Avatar size={48} source={profileUri ? {uri: profileUri} : undefined} />
              <View style={styles.userInfo}>
                <Text style={styles.userNickname}>{user.nickname}</Text>
                <Text style={styles.userIntro} numberOfLines={1}>
                  {introduction}
                </Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }, [activeTab, handleRecipeSelect, ingredientResults, resultsCount, searchErrors, searchKeyword, searchLoading, searchResults, tabItems, userResults]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 검색창 */}
      <View style={styles.searchBarContainer}>
        <View style={styles.searchInputContainer}>
          <TextInput
            style={styles.searchPlaceholder}
            placeholder={'요리, 재료, 동네로 찾아보세요!'}
            value={searchKeyword}
            onChangeText={handleSearchKeywordChange}
            autoCorrect={false}
            autoCapitalize="none"
            clearButtonMode="while-editing"
          />
          <Icon name="search" size={20} color={colors.textTertiary} />
        </View>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>
        {showSearchResults ? (
          <View style={styles.searchResultsSection}>
            <View style={styles.resultsHeader}>
              <Text style={styles.resultsHeaderText}>
                '{searchKeyword.trim()}' 검색 결과
              </Text>
              <Text style={styles.resultsCountText}>
                {tabItems.find(item => item.id === activeTab)?.label} {resultsCount}개
              </Text>
            </View>
            <View style={styles.resultsTabs}>
              {tabItems.map(tab => {
                const isActive = tab.id === activeTab;
                return (
                  <TouchableOpacity
                    key={tab.id}
                    style={[styles.tabButton, isActive && styles.tabButtonActive]}
                    onPress={() => setActiveTab(tab.id)}
                    activeOpacity={0.8}>
                    <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {renderedActiveResults}
          </View>
        ) : (
          <>
        {/* 오늘의 특가 카드 */}
        {promotionLoading ? (
          <View style={styles.specialDealCard}>
            <View style={styles.specialDealInfoContainer}>
              <LottieSpinner size="small" />
              <Text style={styles.dealQuestion}>기획 상품을 불러오는 중...</Text>
            </View>
          </View>
        ) : nearbyPromotion ? (
          <TouchableOpacity
            style={styles.specialDealCard}
            onPress={async () => {
              // 가게 방문 수 증가 (한 번만 기록)
              if (nearbyPromotion.store_id && !visitedStoreIdsRef.current.has(nearbyPromotion.store_id)) {
                visitedStoreIdsRef.current.add(nearbyPromotion.store_id);
                try {
                  await StoreAPI.incrementStoreVisitCount(nearbyPromotion.store_id);
                } catch (error: any) {
                  // 429 에러는 조용히 처리하고, ref에서 제거하여 재시도 가능하게 함
                  if (error?.response?.status === 429) {
                    visitedStoreIdsRef.current.delete(nearbyPromotion.store_id);
                  } else {
                    console.error('❌ [SearchScreen] 가게 방문 수 증가 실패:', error);
                  }
                }
              }
              setIsStoreModalVisible(true);
            }}>
            {/* 왼쪽: 제품 이미지 */}
            <View style={styles.specialDealImageContainer}>
              <View style={styles.productImageWrapper}>
                {nearbyPromotion.promotion_image_url ? (
                  <Image
                    source={{uri: buildMediaUrl(nearbyPromotion.promotion_image_url) || ''}}
                    style={styles.specialDealProductImage}
                  />
                ) : (
                  <View style={[styles.specialDealProductImage, styles.productImagePlaceholder]}>
                    <Icon name="image" size={32} color={colors.textSecondary} />
                  </View>
                )}
                {/* 상단 텍스트 오버레이 */}
                {nearbyPromotion.ingredient_name && (
                  <View style={styles.productNameOverlay}>
                    <Text style={styles.productName} numberOfLines={1}>
                      {nearbyPromotion.ingredient_name}
                    </Text>
                  </View>
                )}
                {/* 하단 텍스트 오버레이 */}
                <View style={styles.productPriceOverlay}>
                  <Text style={styles.productPrice}>
                    {nearbyPromotion.sale_price.toLocaleString()}원
                  </Text>
                </View>
              </View>
            </View>

            {/* 오른쪽: 프로모션 정보 */}
            <View style={styles.specialDealInfoContainer}>
              {/* 오늘의 특가 헤더 */}
              <View style={styles.specialDealHeader}>
                <Icon name="tag" size={16} color={colors.white} />
                <Text style={styles.specialDealHeaderText}>오늘의 특가</Text>
              </View>

              {/* 프로모션 텍스트 */}
              <View style={styles.dealTextContainer}>
                {nearbyPromotion.store_name && (
                  <Text style={styles.dealStoreName}>{nearbyPromotion.store_name}에서</Text>
                )}
                <Text style={styles.dealPromotion} numberOfLines={2}>
                  {nearbyPromotion.title}
                </Text>
                {nearbyPromotion.description && (
                  <Text style={styles.dealQuestion} numberOfLines={2}>
                    {nearbyPromotion.description}
                  </Text>
                )}
              </View>

              {/* CTA 버튼 - 레시피가 있을 때만 표시 */}
              {topRecipe && (
                <TouchableOpacity
                  style={styles.ctaButton}
                  onPress={() => {
                    if (topRecipe) {
                      handleRecipeSelect({
                        recipe_post_id: topRecipe.recipe_post_id,
                        title: topRecipe.title,
                        thumbnail: topRecipe.represent_photo_url || null,
                        like_count: topRecipe.like_count,
                        comment_count: topRecipe.comment_count,
                      });
                    }
                  }}
                  disabled={topRecipeLoading}>
                  <Text style={styles.ctaButtonText}>
                    {topRecipeLoading ? '로딩 중...' : '1등 레시피 보기'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        ) : (
          /* 기획 상품이 없을 때 앱 소개 배너 */
          <TouchableOpacity
            style={styles.appIntroBanner}
            onPress={() => setIsAppIntroModalVisible(true)}>
            <View style={styles.appIntroBannerContent}>
              <View style={styles.appIntroBannerLeft}>
                <View style={styles.appIntroIconContainer}>
                  <Image
                    source={require('../../../assets/icon/app_icon/round/196.png')}
                    style={styles.appIntroIconImage}
                    resizeMode="contain"
                  />
                </View>
                <View style={styles.appIntroTextContainer}>
                  <Text style={styles.appIntroTitle}>Babple 앱 소개</Text>
                  <Text style={styles.appIntroDescription} numberOfLines={2}>
                    동네 사람들의 진짜 집밥 레시피를 공유하는 하이퍼로컬 레시피 앱
                  </Text>
                </View>
              </View>
              <Icon name="chevron-right" size={20} color={colors.textSecondary} />
            </View>
          </TouchableOpacity>
        )}

        {/* 현재 뜨는 레시피 */}
        <View style={styles.trendingSection}>
          <View style={styles.trendingSectionHeader}>
            <Text style={styles.trendingCrown}>👑</Text>
            <Text style={styles.trendingTitle}>지금 뜨는 레시피</Text>
          </View>
          <TouchableOpacity onPress={fetchLocalRanking} disabled={localRankingLoading}>
            <Text
              style={[
                styles.viewAllButton,
                localRankingLoading && styles.viewAllButtonDisabled,
              ]}>
              {localRankingLoading ? '불러오는 중' : '새로고침'}
            </Text>
          </TouchableOpacity>
        </View>
        {localRankingLoading ? (
          <View style={styles.rankingStatusWrapper}>
            <LottieSpinner size="small" />
            <Text style={styles.rankingStatusText}>주변 레시피를 불러오는 중...</Text>
          </View>
        ) : localRankingError ? (
          <View style={styles.rankingStatusWrapper}>
            <Icon name="frown" size={16} color={colors.error} />
            <Text style={styles.rankingStatusText}>{localRankingError}</Text>
          </View>
        ) : localRanking.length > 0 ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.recipeCardsContainer}
          contentContainerStyle={styles.recipeCardsContent}>
            {localRanking.map((recipe, index) => {
              const rank = recipe.rank ?? index + 1;
              const thumbnail = buildMediaUrl(recipe.thumbnail);
              return (
                <TouchableOpacity
                  key={recipe.recipe_post_id}
                  style={styles.recipeCard}
                  activeOpacity={0.85}
                  onPress={() => handleRankingPress(recipe)}>
                  {thumbnail ? (
                    <ImageWithLottie source={{uri: thumbnail}} style={styles.recipeCardImage} />
                  ) : (
                    <View style={[styles.recipeCardImage, styles.recipeCardPlaceholder]}>
                      <Icon name="image" size={28} color={colors.textSecondary} />
                    </View>
                  )}
              <View style={styles.rankBadge}>
                    {rank === 1 && <Text style={styles.rankCrown}>👑</Text>}
                    <Text style={styles.rankText}>{rank}등</Text>
              </View>
              <View style={styles.recipeCardFooter}>
                    <Text style={styles.recipeCardTitle} numberOfLines={1}>
                      {recipe.title}
                    </Text>
                <View style={styles.recipeCardAuthor}>
                  <Icon name="user" size={14} color={colors.white} />
                      <Text style={styles.recipeCardAuthorName} numberOfLines={1}>
                        {recipe.nickname || '이웃'}
                      </Text>
                    </View>
                    <View style={styles.recipeCardStats}>
                      <View style={styles.recipeCardStatItem}>
                        <Icon name="heart" size={12} color={colors.white} />
                        <Text style={styles.recipeCardStatText}>{recipe.like_count}</Text>
                      </View>
                      <View style={styles.recipeCardStatItem}>
                        <Icon name="message-circle" size={12} color={colors.white} />
                        <Text style={styles.recipeCardStatText}>{recipe.comment_count}</Text>
                      </View>
                </View>
              </View>
            </TouchableOpacity>
              );
            })}
        </ScrollView>
        ) : (
          <View style={styles.rankingStatusWrapper}>
            <Icon name="info" size={16} color={colors.textSecondary} />
            <Text style={styles.rankingStatusText}>아직 주변 레시피가 없습니다.</Text>
          </View>
        )}

        {/* 인기 검색어 해시태그 */}
        <View style={styles.tagsSection}>
              <Text style={styles.tagsSectionTitle}>✨ 지금 뜨는 인기 검색어</Text>
              {trendingKeywords.length > 0 ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.tagsContainer}
            contentContainerStyle={styles.tagsContent}>
                  {trendingKeywords.map((item, index) => (
              <TouchableOpacity
                      key={`${item.keyword}-${index}`}
                style={[
                  styles.tagChip,
                        selectedTag === item.keyword && styles.tagChipActive,
                      ]}
                      onPress={() => {
                        setSelectedTag(item.keyword);
                        latestLoggedKeywordRef.current = '';
                        setSearchKeyword(item.keyword);
                      }}>
                <Text
                  style={[
                    styles.tagText,
                          selectedTag === item.keyword && styles.tagTextActive,
                  ]}>
                        #{item.keyword}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
              ) : (
                <View style={styles.emptyTrendingWrapper}>
                  <Text style={styles.emptyTrendingText}>인기 검색어 데이터가 아직 없어요.</Text>
                </View>
              )}
        </View>

        {/* 그리드 레시피 */}
        <Text style={styles.sectionTitle}>
          새로운 집밥 레시피를 발견해보세요
        </Text>

        {recentRandomLoading ? (
          <View style={styles.gridLoadingWrapper}>
            <LottieSpinner size="small" />
            <Text style={styles.gridLoadingText}>레시피를 불러오는 중...</Text>
          </View>
        ) : recentRandomRecipes.length > 0 ? (
          <View style={styles.gridContainer}>
            {recentRandomRecipes.map(recipe => {
              const thumbnail = buildMediaUrl(recipe.thumbnail);
              return (
                <TouchableOpacity
                  key={recipe.recipe_post_id}
                  style={styles.gridItem}
                  activeOpacity={0.8}
                  onPress={() => handleRecipeSelect({
                    recipe_post_id: recipe.recipe_post_id,
                    title: recipe.title,
                    thumbnail: recipe.thumbnail,
                    like_count: 0,
                    comment_count: 0,
                  })}>
                  {thumbnail ? (
                    <ImageWithLottie source={{uri: thumbnail}} style={styles.gridImage} />
                  ) : (
                    <View style={[styles.gridImage, styles.gridImagePlaceholder]}>
                      <Icon name="image" size={28} color={colors.textSecondary} />
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        ) : (
          <View style={styles.gridEmptyWrapper}>
            <Icon name="image" size={32} color={colors.textSecondary} />
            <Text style={styles.gridEmptyText}>최근 레시피가 없습니다.</Text>
          </View>
        )}
          </>
        )}
      </ScrollView>

      <RecipeDetailModal
        visible={detailModalVisible}
        onClose={handleModalClose}
        recipeId={selectedRecipeId ?? undefined}
        onRecipeDeleted={handleRecipeDeletedFromModal}
      />

      {/* 유저 프로필 화면 모달 */}
      {selectedUserId && (
        <UserProfileScreen
          visible={userProfileVisible}
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setUserProfileVisible(false);
            setSelectedUserId(null);
            setSelectedUserName('');
          }}
        />
      )}

      {/* 상점 화면 모달 */}
      {isStoreModalVisible && !showSearchResults && nearbyPromotion && (
        <View style={StyleSheet.absoluteFillObject}>
          <StoreScreen
            isModal={true}
            onClose={() => setIsStoreModalVisible(false)}
            isMine={false}
            storeId={nearbyPromotion.store_id}
          />
        </View>
      )}

      {/* 앱 소개 모달 */}
      <Modal
        visible={isAppIntroModalVisible}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setIsAppIntroModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer} edges={['top', 'bottom']}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Babple 앱 소개</Text>
            <TouchableOpacity
              onPress={() => setIsAppIntroModalVisible(false)}
              style={styles.modalCloseButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.modalContent}
            contentContainerStyle={styles.modalContentContainer}>
            <View style={styles.appIntroSection}>
              <View style={styles.appIntroLogoContainer}>
                <Image
                  source={require('../../../assets/icon/app_icon/round/196.png')}
                  style={styles.appIntroLogoImage}
                  resizeMode="contain"
                />
                <Text style={styles.appIntroLogoText}>Babple</Text>
              </View>
              <Text style={styles.appIntroMainText}>
                동네 사람들의 '오늘 만든 진짜 집밥'과 레시피를 공유하는{'\n'}
                하이퍼로컬, 지도 기반 소셜 미디어 애플리케이션입니다.
              </Text>
            </View>

            <View style={styles.appIntroFeatures}>
              <Text style={styles.appIntroFeaturesTitle}>주요 기능</Text>
              
              <View style={styles.featureItem}>
                <Icon name="camera" size={20} color={colors.primary} />
                <Text style={styles.featureText}>사진과 레시피 업로드 및 공유</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="map-pin" size={20} color={colors.primary} />
                <Text style={styles.featureText}>지도 기반 게시물 탐색</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="heart" size={20} color={colors.primary} />
                <Text style={styles.featureText}>"맛있어요!" 좋아요 및 댓글 시스템</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="users" size={20} color={colors.primary} />
                <Text style={styles.featureText}>사용자 팔로우("단골 맺기")</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="shopping-bag" size={20} color={colors.primary} />
                <Text style={styles.featureText}>지역 상점 프로모션 및 광고</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="message-circle" size={20} color={colors.primary} />
                <Text style={styles.featureText}>실시간 채팅 기능</Text>
              </View>
              
              <View style={styles.featureItem}>
                <Icon name="target" size={20} color={colors.primary} />
                <Text style={styles.featureText}>개인화된 추천 시스템</Text>
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchBarContainer: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.background,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    paddingHorizontal: spacing.m,
    height: 48,
    ...shadows.card,
  },
  searchPlaceholder: {
    ...typography.bodyRegular,
    flex: 1,
    color: colors.textTertiary,
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 100,
  },
  searchResultsSection: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.xl,
  },
  resultsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  resultsTabs: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    padding: spacing.xs,
    marginBottom: spacing.m,
    gap: spacing.xs,
  },
  tabButton: {
    flex: 1,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.full,
    alignItems: 'center',
  },
  tabButtonActive: {
    backgroundColor: colors.primary,
  },
  tabLabel: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  tabLabelActive: {
    color: colors.white,
  },
  resultsHeaderText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  resultsCountText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  searchStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  searchStatusText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  searchErrorText: {
    ...typography.bodyRegular,
    color: colors.error,
  },
  searchEmptyText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  resultsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginHorizontal: -spacing.xs,
  },
  resultCard: {
    width: '50%',
    paddingHorizontal: spacing.xs,
    marginBottom: spacing.m,
  },
  resultImageWrapper: {
    aspectRatio: 1,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    backgroundColor: colors.offWhite,
  },
  resultImage: {
    width: '100%',
    height: '100%',
  },
  resultImagePlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resultInfo: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  resultTitle: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  resultMetaRow: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  resultMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  resultMetaText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  specialDealCard: {
    marginHorizontal: spacing.l,
    marginBottom: spacing.l,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    backgroundColor: colors.secondary,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.card,
  },
  specialDealImageContainer: {
    width: 120,
    padding: spacing.xs,
  },
  productImageWrapper: {
    position: 'relative',
    borderRadius: borderRadius.s,
    overflow: 'hidden',
  },
  specialDealProductImage: {
    width: '100%',
    height: 200,
  },
  productNameOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.xs,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  productPriceOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.xs,
  },
  productPrice: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
    textAlign: 'center',
  },
  productImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
  },
  specialDealInfoContainer: {
    flex: 1,
    padding: spacing.m,
  },
  specialDealHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: colors.primary,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.s,
    alignSelf: 'center',
    marginBottom: spacing.m,
  },
  specialDealHeaderText: {
    ...typography.captionMedium,
    color: colors.white,
    fontWeight: '600',
  },
  dealTextContainer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  dealStoreName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    textAlign: 'center',
  },
  dealPromotion: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
  },
  dealQuestion: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  ctaButton: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: borderRadius.s,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    alignSelf: 'center',
    marginTop: spacing.m,
  },
  ctaButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  trendingSection: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    marginTop: spacing.l,
    marginBottom: spacing.m,
  },
  trendingSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  trendingCrown: {
    fontSize: 16,
  },
  trendingTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  viewAllButton: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
    fontSize: 12,
  },
  viewAllButtonDisabled: {
    color: colors.textSecondary,
  },
  recipeCardsContainer: {
    marginBottom: spacing.l,
  },
  recipeCardsContent: {
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  rankingStatusWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    marginHorizontal: spacing.l,
    marginBottom: spacing.l,
    paddingVertical: spacing.s,
  },
  rankingStatusText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  recipeCard: {
    width: 160,
    height: 200,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    backgroundColor: colors.white,
    position: 'relative',
    ...shadows.card,
  },
  recipeCardImage: {
    width: '100%',
    height: '100%',
  },
  recipeCardPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
  },
  rankBadge: {
    position: 'absolute',
    top: spacing.xs,
    left: spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: 12,
    gap: spacing.xs,
  },
  rankCrown: {
    fontSize: 14,
  },
  rankText: {
    ...typography.captionMedium,
    color: colors.white,
    fontWeight: '600',
  },
  recipeCardFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.s,
    gap: spacing.xs,
  },
  recipeCardTitle: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  recipeCardAuthor: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recipeCardAuthorName: {
    ...typography.captionRegular,
    color: colors.white,
  },
  recipeCardStats: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  recipeCardStatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  recipeCardStatText: {
    ...typography.captionRegular,
    color: colors.white,
  },
  tagsSection: {
    marginBottom: spacing.l,
  },
  tagsSectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    paddingHorizontal: spacing.l,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  tagsContainer: {
    paddingBottom: spacing.m,
  },
  tagsContent: {
    paddingHorizontal: spacing.l,
    gap: spacing.s,
  },
  tagChip: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginRight: spacing.xs,
  },
  tagChipActive: {
    backgroundColor: colors.white,
    borderColor: colors.primary,
  },
  tagText: {
    ...typography.captionRegular,
    color: '#424242',
  },
  tagTextActive: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyTrendingWrapper: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    alignItems: 'center',
  },
  emptyTrendingText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 16,
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    textAlign: 'center',
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: spacing.xs,
  },
  gridItem: {
    width: '50%',
    aspectRatio: 1,
    padding: spacing.xs,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.s,
  },
  gridImagePlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
  },
  gridLoadingWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.xl,
  },
  gridLoadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  gridEmptyWrapper: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.s,
  },
  gridEmptyText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  ingredientList: {
    gap: spacing.s,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    ...shadows.card,
  },
  ingredientBullet: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginRight: spacing.m,
  },
  ingredientInfo: {
    flex: 1,
  },
  ingredientName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  ingredientMeta: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  userList: {
    gap: spacing.s,
  },
  userItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    ...shadows.card,
  },
  userInfo: {
    flex: 1,
    marginHorizontal: spacing.m,
    gap: spacing.xs,
  },
  userNickname: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  userIntro: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  appIntroBanner: {
    marginHorizontal: spacing.l,
    marginBottom: spacing.l,
    borderRadius: borderRadius.m,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray,
    ...shadows.card,
  },
  appIntroBannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.m,
  },
  appIntroBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: spacing.m,
  },
  appIntroIconContainer: {
    width: 48,
    height: 48,
    borderRadius: borderRadius.m,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  appIntroIconImage: {
    width: 48,
    height: 48,
  },
  appIntroTextContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  appIntroTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  appIntroDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    fontSize: 12,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  modalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  modalCloseButton: {
    padding: spacing.xs,
  },
  modalContent: {
    flex: 1,
  },
  modalContentContainer: {
    padding: spacing.l,
  },
  appIntroSection: {
    alignItems: 'center',
    marginBottom: spacing.xl,
    paddingVertical: spacing.l,
  },
  appIntroLogoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    marginBottom: spacing.m,
  },
  appIntroLogoImage: {
    width: 80,
    height: 80,
  },
  appIntroLogoText: {
    ...typography.h1,
    color: colors.primary,
    fontWeight: '700',
  },
  appIntroMainText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
  },
  appIntroFeatures: {
    gap: spacing.m,
  },
  appIntroFeaturesTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.s,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    paddingVertical: spacing.s,
  },
  featureText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
});

export default SearchScreen;


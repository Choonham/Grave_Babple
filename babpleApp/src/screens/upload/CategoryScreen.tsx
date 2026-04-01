import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Animated,
  ActivityIndicator,
  TextInput,
  TextStyle,
  ImageStyle,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import { RecipeAPI, IngredientAPI } from '../../api/ApiRequests';
import { API_BASE_URL } from '../../config/api';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { StackNavigationProp } from '@react-navigation/stack';
import { UploadStackParamList } from '../../navigation/UploadNavigator';
import { pickImageFromCamera, pickImageFromGallery } from '../../utils/imagePicker';
import { Alert, Modal } from 'react-native';
import CustomGallery from '../../components/CustomGallery';
import AddIngredientModal from '../../components/upload/AddIngredientModal';
import { requestPermission } from '../../utils/permission';

type CategoryScreenNavigationProp = StackNavigationProp<UploadStackParamList, 'Category'>;
type CategoryScreenRouteProp = RouteProp<UploadStackParamList, 'Category'>;

/**
 * 카테고리 선택 화면 (업로드 첫 번째 단계)
 */
const CategoryScreen: React.FC = () => {
  const navigation = useNavigation<CategoryScreenNavigationProp>();
  const route = useRoute<CategoryScreenRouteProp>();
  const [selectedSituation, setSelectedSituation] = useState<string>('');
  const [selectedSituationId, setSelectedSituationId] = useState<number | null>(null);
  const [selectedMethod, setSelectedMethod] = useState<string>('');
  const [selectedMethodId, setSelectedMethodId] = useState<number>(0); // 디폴트값 0
  const [selectedMainIngredients, setSelectedMainIngredients] = useState<string[]>([]);
  const [selectedMainIngredientIds, setSelectedMainIngredientIds] = useState<
    number[]
  >([]);
  const [mainIngredientSearch, setMainIngredientSearch] = useState('');
  const hasAppliedInitialSelections = useRef(false);

  const situationScrollRef = useRef<ScrollView>(null);
  const situationLayoutRef = useRef<Record<number, { x: number; width: number }>>({});
  const methodScrollRef = useRef<ScrollView>(null);
  const methodLayoutRef = useRef<Record<number, { x: number; width: number }>>({});
  const mainIngredientScrollRef = useRef<ScrollView>(null);
  const mainIngredientLayoutRef = useRef<Record<number, { x: number; width: number }>>({});

  const scrollToChip = (
    scrollViewRef: React.RefObject<ScrollView | null>,
    layoutRef: React.MutableRefObject<Record<number, { x: number; width: number }>>,
    id?: number | null,
  ) => {
    if (!scrollViewRef.current || !id) {
      return;
    }
    const layout = layoutRef.current[id];
    if (!layout) {
      return;
    }
    const offset = Math.max(layout.x - spacing.l, 0);
    scrollViewRef.current.scrollTo({ x: offset, animated: true });
  };

  const mode = route.params?.mode ?? 'create';
  const isEditMode = mode === 'edit';
  const editingRecipePostId = route.params?.recipePostId || null;
  const initialRecipeName = route.params?.initialRecipeName || '';
  const initialSituationId = route.params?.initialSituationId ?? null;
  const initialMethodId = route.params?.initialMethodId ?? null;
  const initialMainIngredientIds = route.params?.initialMainIngredientIds || [];

  // 애니메이션 값들
  const methodOpacity = useState(new Animated.Value(0))[0];
  const methodTranslateY = useState(new Animated.Value(20))[0];
  const mainIngredientOpacity = useState(new Animated.Value(0))[0];
  const mainIngredientTranslateY = useState(new Animated.Value(20))[0];
  const recommendOpacity = useState(new Animated.Value(1))[0]; // AI 버튼은 바로 표시되도록 초기값 1
  const recommendTranslateY = useState(new Animated.Value(0))[0]; // AI 버튼은 바로 표시되도록 초기값 0

  // 카테고리 데이터 (API에서 가져온 데이터로 설정)
  const [situationCategories, setSituationCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [methodCategories, setMethodCategories] = useState<Array<{ id: number; name: string }>>([]);
  const [mainIngredientCategories, setMainIngredientCategories] = useState<Array<{ id: number; ingredient_id?: number; name: string; default_unit?: string }>>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [recommendedDishes, setRecommendedDishes] = useState<Array<{ id: string; name: string; image?: any }>>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(false);
  const [recipeSearchQuery, setRecipeSearchQuery] = useState(''); // 추천 레시피 검색어
  const [showRecommendedDishes, setShowRecommendedDishes] = useState(false); // 추천 레시피 표시 여부 (기본: 접힘)
  const [showCustomGallery, setShowCustomGallery] = useState(false); // 커스텀 갤러리 표시 여부
  const [showAddIngredientModal, setShowAddIngredientModal] = useState(false); // 재료 추가 모달 표시 여부
  const [addingIngredient, setAddingIngredient] = useState(false); // 재료 추가 중 상태
  const [showRecipeNameModal, setShowRecipeNameModal] = useState(false); // 요리 이름 입력 모달 표시 여부
  const [tempRecipeName, setTempRecipeName] = useState(''); // 임시 요리 이름 (AI 분석 전 입력)

  // 진입 시 권한 요청 (JIT)
  useEffect(() => {
    const checkPermissions = async () => {
      // 위치 권한 요청
      await requestPermission('location');

      // 사진 권한 요청
      await requestPermission('photo', {
        title: '사진 접근 권한 필요',
        message: '요리 사진을 업로드하거나 AI 분석을 위해 갤러리 접근 권한이 필요합니다.',
      });
    };
    checkPermissions();
  }, []);

  // 카테고리 데이터 로드
  useEffect(() => {
    const loadCategories = async () => {
      try {
        setLoadingCategories(true);
        situationLayoutRef.current = {};
        methodLayoutRef.current = {};
        mainIngredientLayoutRef.current = {};
        console.log('📥 [CategoryScreen] 카테고리 데이터 로드 시작');

        const response = await RecipeAPI.getCategories();
        console.log('📥 [CategoryScreen] 카테고리 응답:', JSON.stringify(response, null, 2));

        if (response.success && response.data) {
          // situations 데이터 설정
          if (response.data.situation && Array.isArray(response.data.situation)) {
            const situations = response.data.situation.map((s: any) => ({
              id: s.situation_id,
              name: s.name,
            }));
            setSituationCategories(situations);
            console.log('📥 [CategoryScreen] 상황 카테고리 설정:', situations);
          }

          // cooking_methods 데이터 설정
          if (response.data.cooking_method && Array.isArray(response.data.cooking_method)) {
            const methods = response.data.cooking_method.map((m: any) => ({
              id: m.method_id,
              name: m.name,
            }));
            setMethodCategories(methods);
            console.log('📥 [CategoryScreen] 방법 카테고리 설정:', methods);
          }

          // main_ingredients 데이터 설정
          if (response.data.main_ingredient && Array.isArray(response.data.main_ingredient)) {
            const ingredients = response.data.main_ingredient.map((m: any) => ({
              id: m.main_ingredient_id,
              ingredient_id: m.ingredient_id, // 실제 재료 ID 저장
              name: m.name,
              default_unit: m.default_unit || '',
            }));
            setMainIngredientCategories(ingredients);
            console.log('📥 [CategoryScreen] 주재료 카테고리 설정:', ingredients);
          }
        } else {
          console.warn('⚠️ [CategoryScreen] 카테고리 응답 형식이 올바르지 않습니다:', response);
        }
      } catch (error) {
        console.error('❌ [CategoryScreen] 카테고리 로드 실패:', error);
      } finally {
        setLoadingCategories(false);
      }
    };

    loadCategories();
  }, []);

  // 추천 레시피 로드
  useEffect(() => {
    if (isEditMode) {
      return;
    }

    const loadRecommendations = async () => {
      // 검색어가 있으면 주재료 선택 없이도 검색 가능
      const hasSearchQuery = recipeSearchQuery.trim().length > 0;

      // 검색어가 없을 때는 주재료 선택이 필수
      if (!hasSearchQuery && (!selectedSituationId || selectedMainIngredientIds.length === 0)) {
        setRecommendedDishes([]);
        return;
      }

      try {
        setLoadingRecommendations(true);
        console.log('📥 [CategoryScreen] 추천 레시피 로드 시작');
        console.log('📥 [CategoryScreen] 검색어:', recipeSearchQuery);
        console.log('📥 [CategoryScreen] 선택된 카테고리:', {
          situation_id: selectedSituationId,
          cooking_method_id: 0, // 디폴트값 0
          main_ingredient_id: selectedMainIngredientIds,
        });

        let responses;

        // 검색어가 있으면 모든 추천 레시피에서 검색
        if (hasSearchQuery) {
          const response = await RecipeAPI.getRecommendations({
            search: recipeSearchQuery.trim(),
          });
          responses = [response];
        } else {
          // 검색어가 없으면 주재료로 필터링
          const recommendationPromises = selectedMainIngredientIds.map(mainIngredientId =>
            RecipeAPI.getRecommendations({
              situation_id: selectedSituationId || undefined,
              cooking_method_id: 0, // 디폴트값 0
              main_ingredient_id: mainIngredientId,
            })
          );
          responses = await Promise.all(recommendationPromises);
        }

        console.log('📥 [CategoryScreen] 추천 레시피 응답:', responses);

        // 모든 응답에서 레시피를 수집 (중복 제거)
        const allRecipesMap = new Map<string, { id: string; name: string; image?: any }>();

        responses.forEach((response, index) => {
          if (response.success && response.data && Array.isArray(response.data)) {
            response.data.forEach((recipe: any) => {
              const recipeId = recipe.recipe_post_id || recipe.id;
              if (!recipeId || allRecipesMap.has(recipeId)) {
                return; // 이미 추가된 레시피는 스킵
              }

              // 이미지 URL 구성: 공공 데이터 API 이미지 또는 로컬 이미지 처리
              let imageUri = undefined;
              if (recipe.images && recipe.images[0]) {
                const imageUrl = recipe.images[0];
                // 외부 URL인 경우 (http:// 또는 https://로 시작)
                if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                  imageUri = imageUrl;
                } else {
                  // 로컬 이미지인 경우
                  const imagePath = imageUrl.startsWith('/uploads/')
                    ? imageUrl.substring('/uploads/'.length)
                    : imageUrl;
                  imageUri = `${API_BASE_URL}/uploads/${imagePath}`;
                }
              } else if (recipe.represent_photo_url) {
                const imageUrl = recipe.represent_photo_url;
                // 외부 URL인 경우 (http:// 또는 https://로 시작)
                if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
                  imageUri = imageUrl;
                } else {
                  // 로컬 이미지인 경우
                  const imagePath = imageUrl.startsWith('/uploads/')
                    ? imageUrl.substring('/uploads/'.length)
                    : imageUrl;
                  imageUri = `${API_BASE_URL}/uploads/${imagePath}`;
                }
              }

              allRecipesMap.set(recipeId, {
                id: recipeId,
                name: recipe.title || recipe.name || '레시피',
                image: imageUri ? { uri: imageUri } : undefined,
              });
            });
          }
        });

        const allRecipes = Array.from(allRecipesMap.values());
        setRecommendedDishes(allRecipes);
        console.log('📥 [CategoryScreen] 추천 레시피 설정:', allRecipes);
      } catch (error) {
        console.error('❌ [CategoryScreen] 추천 레시피 로드 실패:', error);
        setRecommendedDishes([]);
      } finally {
        setLoadingRecommendations(false);
      }
    };

    loadRecommendations();
  }, [selectedSituationId, selectedMainIngredientIds, recipeSearchQuery, isEditMode]);

  const navigateToPostRecipe = (overrides?: UploadStackParamList['PostRecipe']) => {
    // 주재료 이름 -> 기본 단위 매핑 생성
    const mainIngredientUnits: Record<string, string> = {};
    // 주재료 이름 -> ingredient_id 매핑 생성
    const mainIngredientIngredientIds: Record<string, number> = {};
    selectedMainIngredients.forEach((name: string) => {
      const category = mainIngredientCategories.find(cat => cat.name === name);
      if (category?.default_unit) {
        mainIngredientUnits[name] = category.default_unit;
      }
      if (category?.ingredient_id) {
        mainIngredientIngredientIds[name] = category.ingredient_id;
      }
    });

    navigation.navigate('PostRecipe', {
      recipeName: overrides?.recipeName ?? (isEditMode ? initialRecipeName : undefined),
      recipe_post_id: isEditMode
        ? editingRecipePostId ?? undefined
        : overrides?.recipe_post_id,
      selectedSituation: selectedSituation || undefined,
      selectedSituationId: selectedSituationId ?? undefined,
      selectedMethodId: 0, // 디폴트값 0
      selectedMainIngredientIds: selectedMainIngredientIds,
      selectedMainIngredientNames: selectedMainIngredients,
      selectedMainIngredientUnits: mainIngredientUnits,
      selectedMainIngredientIngredientIds: mainIngredientIngredientIds, // 실제 재료 ID 매핑 추가
      mode: mode,
      ...overrides,
    });
  };

  const toggleMainIngredient = (ingredient: string, ingredientId: number) => {
    setSelectedMainIngredients(prev =>
      prev.includes(ingredient)
        ? prev.filter(item => item !== ingredient)
        : [...prev, ingredient],
    );
    setSelectedMainIngredientIds(prev =>
      prev.includes(ingredientId)
        ? prev.filter(id => id !== ingredientId)
        : [...prev, ingredientId],
    );
  };

  // 재료 직접 추가 함수
  const handleAddIngredient = async (ingredient: { name: string; unit: string }) => {
    if (!ingredient || !ingredient.name) {
      console.error('❌ [CategoryScreen] 재료 정보가 올바르지 않습니다:', ingredient);
      Alert.alert('오류', '재료 정보가 올바르지 않습니다.');
      return;
    }

    try {
      setAddingIngredient(true);
      console.log('📤 [CategoryScreen] 재료 추가 시작:', ingredient);
      console.log('📤 [CategoryScreen] IngredientAPI.createIngredient 함수 확인:', typeof IngredientAPI.createIngredient);

      // API 호출로 재료 생성
      const response = await IngredientAPI.createIngredient({
        name: ingredient.name.trim(),
        default_unit: ingredient.unit,
      });

      if (response.success && response.data) {
        const newIngredient = response.data;
        console.log('✅ [CategoryScreen] 재료 추가 성공:', newIngredient);

        // 새로 추가된 재료를 주재료 목록에 추가
        // 백엔드에서 main_ingredient 테이블에도 자동으로 추가되므로
        // main_ingredient_id를 id로 사용합니다.
        const mainIngredientId = newIngredient.main_ingredient_id;
        const ingredientId = newIngredient.ingredient_id || newIngredient.id;

        if (!mainIngredientId) {
          console.error('❌ [CategoryScreen] main_ingredient_id가 없습니다:', newIngredient);
          Alert.alert('오류', '재료 추가는 성공했으나 주재료 ID를 받지 못했습니다.');
          return;
        }

        const newMainIngredient = {
          id: mainIngredientId, // main_ingredient_id를 id로 사용
          name: newIngredient.name,
          default_unit: newIngredient.default_unit || ingredient.unit,
          ingredient_id: ingredientId,
        };

        console.log('📦 [CategoryScreen] 새 주재료 객체:', newMainIngredient);

        // 주재료 목록에 추가
        setMainIngredientCategories(prev => {
          // 중복 체크 (main_ingredient_id 기준)
          const exists = prev.some(item => item.id === mainIngredientId);
          if (exists) {
            console.warn('⚠️ [CategoryScreen] 이미 존재하는 재료입니다:', mainIngredientId);
            return prev;
          }
          return [...prev, newMainIngredient];
        });

        // 자동으로 선택 상태로 만들기
        toggleMainIngredient(newMainIngredient.name, newMainIngredient.id);

        // 검색어 초기화
        setMainIngredientSearch('');

        // 모달 닫기
        setShowAddIngredientModal(false);

        Alert.alert('성공', `"${newMainIngredient.name}" 재료가 추가되었습니다.`);
      } else {
        throw new Error(response.message || '재료 추가에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [CategoryScreen] 재료 추가 실패:', error);
      Alert.alert(
        '오류',
        error.message || '재료 추가 중 오류가 발생했습니다.',
      );
    } finally {
      setAddingIngredient(false);
    }
  };

  // 상황 카테고리 선택 시 애니메이션
  useEffect(() => {
    if (selectedSituation) {
      Animated.parallel([
        Animated.timing(mainIngredientOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(mainIngredientTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedSituation]);

  // 주재료 선택 시 애니메이션
  useEffect(() => {
    if (selectedMainIngredients.length > 0) {
      Animated.parallel([
        Animated.timing(recommendOpacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(recommendTranslateY, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [selectedMainIngredients]);

  // 상황 카테고리를 5개씩 묶어서 여러 줄로 나누기
  const getSituationCategoriesRows = () => {
    if (!situationCategories || situationCategories.length === 0) {
      return [];
    }
    const rows: Array<Array<{ id: number; name: string }>> = [];
    for (let i = 0; i < situationCategories.length; i += 5) {
      rows.push(situationCategories.slice(i, i + 5));
    }
    return rows;
  };

  const situationRows = getSituationCategoriesRows();

  // 방법 카테고리를 5개씩 묶어서 여러 줄로 나누기
  const getMethodCategoriesRows = () => {
    if (!methodCategories || methodCategories.length === 0) {
      return [];
    }
    const rows: Array<Array<{ id: number; name: string }>> = [];
    for (let i = 0; i < methodCategories.length; i += 5) {
      rows.push(methodCategories.slice(i, i + 5));
    }
    return rows;
  };

  const methodRows = getMethodCategoriesRows();

  // 주재료 카테고리를 5개씩 묶어서 여러 줄로 나누기
  const getMainIngredientCategoriesRows = (
    source: Array<{ id: number; name: string; default_unit?: string }>,
  ) => {
    if (!source || source.length === 0) {
      return [];
    }
    const rows: Array<Array<{ id: number; name: string }>> = [];
    for (let i = 0; i < source.length; i += 5) {
      rows.push(source.slice(i, i + 5));
    }
    return rows;
  };
  const filteredMainIngredientCategories = mainIngredientCategories.filter(
    item =>
      item.name
        .toLowerCase()
        .includes(mainIngredientSearch.trim().toLowerCase()),
  );
  const mainIngredientRows = getMainIngredientCategoriesRows(
    filteredMainIngredientCategories,
  );

  useEffect(() => {
    if (!isEditMode || loadingCategories || hasAppliedInitialSelections.current) {
      return;
    }

    if (
      situationCategories.length === 0 &&
      methodCategories.length === 0 &&
      mainIngredientCategories.length === 0
    ) {
      return;
    }

    if (initialSituationId) {
      const situation = situationCategories.find(cat => cat.id === initialSituationId);
      if (situation) {
        setSelectedSituation(situation.name);
        setSelectedSituationId(situation.id);
      }
    }

    // cooking_methods는 더 이상 사용하지 않음 (디폴트값 0)
    // if (initialMethodId) {
    //   const method = methodCategories.find(cat => cat.id === initialMethodId);
    //   if (method) {
    //     setSelectedMethod(method.name);
    //     setSelectedMethodId(method.id);
    //   }
    // }

    if (initialMainIngredientIds.length > 0) {
      const matched = mainIngredientCategories.filter(cat =>
        initialMainIngredientIds.includes(cat.id),
      );
      if (matched.length > 0) {
        setSelectedMainIngredientIds(matched.map(cat => cat.id));
        setSelectedMainIngredients(matched.map(cat => cat.name));
      }
    }

    hasAppliedInitialSelections.current = true;
  }, [
    isEditMode,
    loadingCategories,
    situationCategories,
    methodCategories,
    mainIngredientCategories,
    initialSituationId,
    initialMethodId,
    initialMainIngredientIds,
  ]);

  useEffect(() => {
    if (!selectedSituationId) {
      return;
    }
    const timer = setTimeout(() => {
      scrollToChip(situationScrollRef, situationLayoutRef, selectedSituationId);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedSituationId]);

  // cooking_methods는 더 이상 사용하지 않음
  // useEffect(() => {
  //   if (!selectedMethodId) {
  //     return;
  //   }
  //   const timer = setTimeout(() => {
  //     scrollToChip(methodScrollRef, methodLayoutRef, selectedMethodId);
  //   }, 100);
  //   return () => clearTimeout(timer);
  // }, [selectedMethodId]);

  useEffect(() => {
    if (selectedMainIngredientIds.length === 0) {
      return;
    }
    const targetId = selectedMainIngredientIds[selectedMainIngredientIds.length - 1];
    const timer = setTimeout(() => {
      scrollToChip(mainIngredientScrollRef, mainIngredientLayoutRef, targetId);
    }, 100);
    return () => clearTimeout(timer);
  }, [selectedMainIngredientIds]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.cancelButton}>취소</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>오늘의 요리 등록</Text>
        <TouchableOpacity
          onPress={() => navigateToPostRecipe()}
          disabled={
            !selectedSituation ||
            selectedMainIngredients.length === 0
          }>
          <Text
            style={[
              styles.registerButton,
              (!selectedSituation ||
                selectedMainIngredients.length === 0) &&
              styles.registerButtonDisabled,
            ]}>
            등록
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.scrollView}>
        {/* 상황 카테고리 선택 */}
        <View style={styles.section}>
          {!selectedSituation && !isEditMode && (
            <Text style={styles.sectionTitle}>어떤 요리를 하셨나요?</Text>
          )}
          {loadingCategories ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>카테고리 로딩 중...</Text>
            </View>
          ) : !selectedSituation ? (
            <>
              {situationRows.map((row, rowIndex) => (
                <ScrollView
                  key={rowIndex}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipContainerScroll}
                  style={styles.chipRow}>
                  {row.map((category) => (
                    <TouchableOpacity
                      key={category.id}
                      style={[
                        styles.chip,
                        selectedSituation === category.name && styles.chipSelected,
                      ]}
                      onPress={() => {
                        setSelectedSituation(category.name);
                        setSelectedSituationId(category.id);
                      }}>
                      <Text
                        style={[
                          styles.chipText,
                          selectedSituation === category.name && styles.chipTextSelected,
                        ]}>
                        {category.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              ))}
            </>
          ) : (
            // 선택된 후에는 1줄로 표시
            <ScrollView
              ref={situationScrollRef}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chipContainerScroll}>
              {situationCategories.map((category) => (
                <TouchableOpacity
                  key={category.id}
                  style={[
                    styles.chip,
                    selectedSituation === category.name && styles.chipSelected,
                  ]}
                  onPress={() => {
                    setSelectedSituation(category.name);
                    setSelectedSituationId(category.id);
                  }}
                  onLayout={({ nativeEvent }) => {
                    situationLayoutRef.current[category.id] = {
                      x: nativeEvent.layout.x,
                      width: nativeEvent.layout.width,
                    };
                  }}>
                  <Text
                    style={[
                      styles.chipText,
                      selectedSituation === category.name && styles.chipTextSelected,
                    ]}>
                    {category.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>

        {/* 주재료 카테고리 선택 */}
        {selectedSituation && (
          <Animated.View
            style={[
              styles.section,
              {
                opacity: mainIngredientOpacity,
                transform: [{ translateY: mainIngredientTranslateY }],
              },
            ]}>
            {selectedMainIngredients.length === 0 && !isEditMode && (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>주재료는 무엇인가요?</Text>
              </View>
            )}
            <View style={styles.mainIngredientSearchContainer}>
              <TextInput
                style={styles.mainIngredientSearchInput}
                value={mainIngredientSearch}
                onChangeText={setMainIngredientSearch}
                placeholder="주재료를 검색해보세요"
                placeholderTextColor={colors.textTertiary}
                maxLength={30}
              />
              <Icon name="search" size={16} color={colors.textSecondary} />
            </View>
            {/* 선택된 주재료 표시 */}
            {selectedMainIngredients.length > 0 && (
              <View style={styles.selectedIngredientsContainer}>
                <ScrollView
                  ref={mainIngredientScrollRef}
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.chipContainerScroll}>
                  {filteredMainIngredientCategories
                    .filter(category => selectedMainIngredients.includes(category.name))
                    .map((category) => (
                      <TouchableOpacity
                        key={category.id}
                        style={[styles.chip, styles.chipSelected]}
                        onPress={() => toggleMainIngredient(category.name, category.id)}
                        onLayout={({ nativeEvent }) => {
                          mainIngredientLayoutRef.current[category.id] = {
                            x: nativeEvent.layout.x,
                            width: nativeEvent.layout.width,
                          };
                        }}>
                        <Text style={[styles.chipText, styles.chipTextSelected]}>
                          {category.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                </ScrollView>
              </View>
            )}

            {/* 검색 결과 표시 - 검색어가 있을 때만 */}
            {mainIngredientSearch.trim() && (
              <>
                {filteredMainIngredientCategories.length === 0 ? (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>일치하는 주재료가 없습니다.</Text>
                    <TouchableOpacity
                      style={styles.addIngredientButton}
                      onPress={() => setShowAddIngredientModal(true)}
                      disabled={addingIngredient}>
                      <Text style={styles.addIngredientButtonText}>
                        재료가 없나요? 직접 추가하기
                      </Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.chipContainerScroll}>
                    {filteredMainIngredientCategories
                      .filter(category => !selectedMainIngredients.includes(category.name))
                      .map((category) => (
                        <TouchableOpacity
                          key={category.id}
                          style={styles.chip}
                          onPress={() => toggleMainIngredient(category.name, category.id)}
                          onLayout={({ nativeEvent }) => {
                            mainIngredientLayoutRef.current[category.id] = {
                              x: nativeEvent.layout.x,
                              width: nativeEvent.layout.width,
                            };
                          }}>
                          <Text style={styles.chipText}>
                            {category.name}
                          </Text>
                        </TouchableOpacity>
                      ))}
                  </ScrollView>
                )}
              </>
            )}

            {/* 검색어가 없고 선택된 주재료도 없을 때 안내 메시지 */}
            {!mainIngredientSearch.trim() && selectedMainIngredients.length === 0 && (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>주재료를 검색해보세요.</Text>
              </View>
            )}
          </Animated.View>
        )}

        {/* AI 쉐프 분석 및 직접 추가 버튼 */}
        {selectedMainIngredients.length > 0 && !isEditMode && (
          <Animated.View
            style={[
              styles.section,
              {
                opacity: recommendOpacity,
                transform: [{ translateY: recommendTranslateY }],
              },
            ]}>
            <View style={styles.actionButtonsContainer}>
              <TouchableOpacity
                style={styles.aiChefButton}
                activeOpacity={0.7}
                onPress={() => {
                  // 먼저 요리 이름 입력 모달 표시
                  setTempRecipeName('');
                  setShowRecipeNameModal(true);
                }}>
                <View style={styles.aiChefIconContainer}>
                  <Image
                    source={require('../../../assets/icon/recipe/ai_chef.png')}
                    style={styles.aiChefIcon}
                    resizeMode="contain"
                  />
                </View>
                <Text style={styles.aiChefText}>AI 쉐프에게 분석하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.addDirectButton}
                onPress={() =>
                  navigateToPostRecipe({
                    recipeName: '',
                  })
                }>
                <View style={styles.addDirectIconContainer}>
                  <Icon name="plus" size={24} color={colors.primary} />
                </View>
                <Text style={styles.addDirectText}>직접 추가</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        )}

        {/* 추천 요리 */}
        {!isEditMode && (selectedMainIngredients.length > 0 || recipeSearchQuery.trim().length > 0) && (
          <Animated.View
            style={[
              styles.section,
              {
                opacity: recommendOpacity,
                transform: [{ translateY: recommendTranslateY }],
              },
            ]}>
            <TouchableOpacity
              style={styles.recommendedDishesHeader}
              onPress={() => setShowRecommendedDishes(!showRecommendedDishes)}>
              <Text style={styles.sectionTitle}>이 요리를 하셨나요?</Text>
              <Icon
                name={showRecommendedDishes ? "chevron-up" : "chevron-down"}
                size={20}
                color={colors.textPrimary}
              />
            </TouchableOpacity>

            {showRecommendedDishes && (
              <>
                {/* 추천 레시피 검색 입력 필드 */}
                <View style={styles.recipeSearchContainer}>
                  <TextInput
                    style={styles.recipeSearchInput}
                    value={recipeSearchQuery}
                    onChangeText={setRecipeSearchQuery}
                    placeholder="추천 레시피 검색"
                    placeholderTextColor={colors.textTertiary}
                    maxLength={30}
                  />
                  <Icon name="search" size={16} color={colors.textSecondary} />
                </View>

                {loadingRecommendations ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="small" color={colors.primary} />
                    <Text style={styles.loadingText}>추천 레시피 로딩 중...</Text>
                  </View>
                ) : recommendedDishes.length > 0 ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.dishContainerScroll}>
                    {recommendedDishes.map((dish) => (
                      <TouchableOpacity
                        key={dish.id}
                        style={styles.dishCard}
                        onPress={() =>
                          navigateToPostRecipe({
                            recipe_post_id: dish.id,
                            recipeName: dish.name,
                            fromDefaultTemplate: true, // 추천 레시피에서 가져온 경우
                          })
                        }>
                        {dish.image && (
                          <Image source={dish.image} style={styles.dishImage} />
                        )}
                        <Text style={styles.dishName} numberOfLines={2}>
                          {dish.name}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.emptyContainer}>
                    <Text style={styles.emptyText}>추천 레시피가 없습니다.</Text>
                  </View>
                )}
              </>
            )}
          </Animated.View>
        )}

        {/* 편집 모드일 때만 직접 추가 버튼 표시 */}
        {selectedMainIngredients.length > 0 && isEditMode && (
          <Animated.View
            style={[
              styles.section,
              { marginTop: spacing.m },
              {
                opacity: recommendOpacity,
                transform: [{ translateY: recommendTranslateY }],
              },
            ]}>
            <Text style={styles.sectionTitle}>
              레시피를 수정하시겠어요?
            </Text>
            <TouchableOpacity
              style={styles.addDirectButton}
              onPress={() =>
                navigateToPostRecipe({
                  recipeName: isEditMode ? initialRecipeName : '',
                })
              }>
              <View style={styles.addDirectIconContainer}>
                <Icon name="plus" size={24} color={colors.primary} />
              </View>
              <Text style={styles.addDirectText}>수정 계속하기</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </View>

      {/* 커스텀 갤러리 모달 */}
      {/* 요리 이름 입력 모달 */}
      <Modal
        visible={showRecipeNameModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setShowRecipeNameModal(false);
          setTempRecipeName('');
        }}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setShowRecipeNameModal(false);
              setTempRecipeName('');
            }}
          />
          <View style={styles.modalContent} onStartShouldSetResponder={() => true}>
            <Text style={styles.modalTitle}>요리 이름 입력</Text>
            <Text style={styles.modalDescription}>
              AI 쉐프가 분석할 요리의 이름을 입력해주세요.{'\n'}
              (예: 김치찌개, 된장찌개, 파스타 등)
            </Text>
            <TextInput
              style={styles.modalInput}
              value={tempRecipeName}
              onChangeText={setTempRecipeName}
              placeholder="요리 이름을 입력하세요"
              placeholderTextColor={colors.lightGray}
              autoFocus={true}
              maxLength={30}
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonCancel]}
                onPress={() => {
                  setShowRecipeNameModal(false);
                  setTempRecipeName('');
                }}>
                <Text style={styles.modalButtonTextCancel}>취소</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalButtonConfirm, !tempRecipeName.trim() && styles.modalButtonDisabled]}
                onPress={() => {
                  if (tempRecipeName.trim()) {
                    setShowRecipeNameModal(false);
                    // 완성 사진 선택 팝업
                    Alert.alert(
                      '완성 사진 선택',
                      'AI 쉐프가 분석할 완성 사진을 선택해주세요.',
                      [
                        {
                          text: '취소', style: 'cancel', onPress: () => {
                            setTempRecipeName('');
                          }
                        },
                        {
                          text: '카메라',
                          onPress: async () => {
                            console.log('카메라 선택');
                            try {
                              const result = await pickImageFromCamera({
                                cropping: true,
                                compressImageQuality: 0.5,
                                cropperToolbarTitle: '완성 사진 편집',
                              });
                              console.log('카메라 결과:', result?.uri);
                              if (result?.uri) {
                                navigateToPostRecipe({
                                  recipeName: tempRecipeName.trim(),
                                  aiAnalysisImageUri: result.uri,
                                  aiAnalysisMode: true,
                                  selectedMainIngredientNames: selectedMainIngredients,
                                  aiAnalysisRecipeName: tempRecipeName.trim(), // AI 분석용 요리 이름
                                });
                                setTempRecipeName('');
                              }
                            } catch (error) {
                              console.error('❌ [CategoryScreen] 카메라 이미지 선택 오류:', error);
                              setTempRecipeName('');
                            }
                          },
                        },
                        {
                          text: '갤러리',
                          onPress: () => {
                            console.log('갤러리 선택 - 커스텀 갤러리 열기');
                            setShowCustomGallery(true);
                          },
                        },
                      ],
                      { cancelable: true, onDismiss: () => setTempRecipeName('') },
                    );
                  }
                }}
                disabled={!tempRecipeName.trim()}>
                <Text style={[styles.modalButtonTextConfirm, !tempRecipeName.trim() && styles.modalButtonTextDisabled]}>다음</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <CustomGallery
        visible={showCustomGallery}
        onClose={() => {
          setShowCustomGallery(false);
          setTempRecipeName('');
        }}
        onSelectImage={(imageUri) => {
          console.log('커스텀 갤러리에서 선택된 이미지:', imageUri);
          setShowCustomGallery(false);
          navigateToPostRecipe({
            recipeName: tempRecipeName.trim(),
            aiAnalysisImageUri: imageUri,
            aiAnalysisMode: true,
            selectedMainIngredientNames: selectedMainIngredients,
            aiAnalysisRecipeName: tempRecipeName.trim(), // AI 분석용 요리 이름
          });
          setTempRecipeName('');
        }}
        cropperToolbarTitle="완성 사진 편집"
        allowCropping={true}
        compressImageQuality={0.5}
      />

      {/* 재료 추가 모달 */}
      <Modal
        visible={showAddIngredientModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowAddIngredientModal(false)}>
        <View style={styles.modalOverlay}>
          <AddIngredientModal
            ingredientName={mainIngredientSearch.trim()}
            onClose={() => {
              console.log('📤 [CategoryScreen] 재료 추가 모달 닫기');
              setShowAddIngredientModal(false);
            }}
            onAdd={(ingredient) => {
              console.log('📤 [CategoryScreen] onAdd 호출됨:', ingredient);
              console.log('📤 [CategoryScreen] handleAddIngredient 함수 확인:', typeof handleAddIngredient);
              if (handleAddIngredient) {
                return handleAddIngredient(ingredient);
              } else {
                console.error('❌ [CategoryScreen] handleAddIngredient 함수가 정의되지 않았습니다.');
                Alert.alert('오류', '재료 추가 함수가 정의되지 않았습니다.');
              }
            }}
          />
        </View>
      </Modal>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  cancelButton: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  registerButton: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
  },
  registerButtonDisabled: {
    color: colors.textSecondary,
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: spacing.l,
    paddingTop: spacing.xl,
  },
  section: {
    marginBottom: spacing.m,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  chipContainerScroll: {
    gap: spacing.m,
  },
  chipRow: {
    marginBottom: spacing.m,
  },
  chip: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.m,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  chipSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  chipText: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.textPrimary,
  },
  chipTextSelected: {
    color: colors.white,
  },
  dishContainerScroll: {
    gap: spacing.m,
    paddingRight: spacing.l,
  },
  dishCard: {
    width: 120,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
  },
  dishImage: {
    width: '100%',
    height: 80,
    backgroundColor: colors.background,
  } as ImageStyle,
  dishName: {
    ...(typography.captionRegular as TextStyle),
    color: colors.textPrimary,
    padding: spacing.m,
    textAlign: 'center',
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'stretch', // 버튼 높이를 맞추기 위해 stretch 사용
    gap: spacing.m,
  },
  aiChefButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, // 동일한 너비로 설정
    minHeight: 120, // 최소 높이 설정 (긴 텍스트에 맞춤)
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.m,
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  aiChefIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  aiChefIcon: {
    width: 28,
    height: 28,
  },
  aiChefText: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  addDirectButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1, // 동일한 너비로 설정
    minHeight: 120, // 최소 높이 설정 (긴 텍스트에 맞춤)
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.m,
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recommendedDishesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  addDirectIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.white,
    borderWidth: 2,
    borderColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  addDirectText: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.textPrimary,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    padding: spacing.l,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    ...(typography.headingMedium as TextStyle),
    color: colors.textPrimary,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  modalDescription: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.textSecondary,
    marginBottom: spacing.m,
    textAlign: 'center',
    lineHeight: 20,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    color: colors.textPrimary,
    marginBottom: spacing.l,
    ...(Platform.OS === 'ios'
      ? {
        paddingVertical: spacing.s, // 위아래 패딩 추가
        textAlignVertical: 'center',
        fontSize: typography.bodyMedium.fontSize,
        lineHeight: typography.bodyMedium.fontSize + 4, // fontSize보다 약간 크게 설정하여 텍스트 잘림 방지
        fontFamily: typography.bodyMedium.fontFamily,
        fontWeight: typography.bodyMedium.fontWeight,
      }
      : {
        padding: spacing.m,
        ...(typography.bodyMedium as TextStyle),
      }),
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.m,
  },
  modalButton: {
    flex: 1,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalButtonCancel: {
    backgroundColor: colors.offWhite,
  },
  modalButtonConfirm: {
    backgroundColor: colors.primary,
  },
  modalButtonDisabled: {
    backgroundColor: colors.lightGray,
    opacity: 0.5,
  },
  modalButtonTextCancel: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.textPrimary,
    fontWeight: '600',
  },
  modalButtonTextConfirm: {
    ...(typography.bodyMedium as TextStyle),
    color: colors.white,
    fontWeight: '600',
  },
  modalButtonTextDisabled: {
    color: colors.mediumGray,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.l,
    gap: spacing.s,
  },
  loadingText: {
    ...(typography.bodyRegular as TextStyle),
    color: colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  emptyText: {
    ...(typography.bodyRegular as TextStyle),
    color: colors.textSecondary,
  },
  mainIngredientSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    marginBottom: spacing.m,
  },
  selectedIngredientsContainer: {
    marginBottom: spacing.l,
  },
  mainIngredientSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '400',
    marginRight: spacing.xs,
    paddingVertical: spacing.xs, // 위아래 패딩 추가
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        lineHeight: 16, // fontSize보다 약간 크게 설정하여 텍스트 잘림 방지
      }
      : {
        lineHeight: 20,
      }),
  },
  recipeSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background,
    marginBottom: spacing.m,
  },
  recipeSearchInput: {
    flex: 1,
    fontSize: 14,
    color: colors.textPrimary,
    fontWeight: '400',
    paddingVertical: 0,
    marginRight: spacing.xs,
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        lineHeight: 14, // iOS에서 fontSize와 동일하게 설정하여 중앙 정렬
      }
      : {
        lineHeight: 20,
      }),
  },
  recommendedDishesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  addIngredientButton: {
    marginTop: spacing.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addIngredientButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.white,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default CategoryScreen;


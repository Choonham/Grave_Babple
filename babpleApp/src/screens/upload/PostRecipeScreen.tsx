import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  Dimensions,
  Animated,
  Platform,
  KeyboardAvoidingView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import { launchCamera, launchImageLibrary, ImagePickerResponse, MediaType } from 'react-native-image-picker';
import CustomGallery from '../../components/CustomGallery';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { PinchGestureHandler, State, GestureHandlerRootView } from 'react-native-gesture-handler';
import Video from 'react-native-video';
import { CommonActions, useNavigation } from '@react-navigation/native';
import ReactNativeBlobUtil from 'react-native-blob-util';
import Geolocation from '@react-native-community/geolocation';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import AddIngredientModal from '../../components/upload/AddIngredientModal';
import { useOverlay } from '../../components/OverlayProvider';
import { RecipeAPI, IngredientAPI } from '../../api/ApiRequests';
import { useAlert } from '../../contexts/AlertContext';
import LoadingOverlay from '../../components/common/LoadingOverlay';
import { requestPermission } from '../../utils/permission';

import { API_BASE_URL } from '../../config/api';

interface PostRecipeScreenProps {
  navigation: any;
  route: any;
}

const PostRecipeScreen: React.FC<PostRecipeScreenProps> = ({
  navigation,
  route,
}) => {
  const { alert, confirm } = useAlert();
  const insets = useSafeAreaInsets();
  const keyboardVerticalOffset = Platform.OS === 'ios' ? 0 : 0;
  const params = route?.params;
  const recipePostId = params?.recipe_post_id;
  const isFromDefaultTemplate = params?.fromDefaultTemplate === true; // 추천 레시피에서 가져온 경우
  const isDirectAdd = params?.selectedSituation && !params?.recipeName && !recipePostId;
  const isAIAnalysisMode = params?.aiAnalysisMode === true; // AI 분석 모드
  const aiAnalysisImageUri = params?.aiAnalysisImageUri; // AI 분석용 이미지 URI

  // 편집 모드 판단: 추천 레시피를 선택한 경우는 항상 새로운 레시피로 등록 (편집 모드 아님)
  // 명시적으로 'edit' 모드이고, 추천 레시피가 아닌 경우만 편집 모드
  const isEditMode = !isFromDefaultTemplate && params?.mode === 'edit';

  // Redux에서 유저 정보 가져오기
  const userInfo = useSelector((state: RootState) => state.userState.userInfo);
  const userNickname = (userInfo?.nickname || '').trim();

  const buildRecipeName = (nickname: string, situation: string) =>
    nickname ? `${nickname}의 ${situation}` : `${situation}`;

  const [recipeName, setRecipeName] = useState(() => {
    if (params?.recipeName) {
      return params.recipeName;
    }
    if (params?.selectedSituation) {
      return buildRecipeName(userNickname, params.selectedSituation);
    }
    return '';
  });

  // userNickname이 업데이트되면 recipeName도 업데이트
  useEffect(() => {
    if (params?.selectedSituation && !params?.recipeName && !recipePostId) {
      setRecipeName(buildRecipeName(userNickname, params.selectedSituation));
    }
  }, [userNickname, params?.selectedSituation, params?.recipeName, recipePostId]);
  const [searchQuery, setSearchQuery] = useState('');
  const [newIngredientName, setNewIngredientName] = useState('');
  const { showOverlay, hideOverlay } = useOverlay();
  const ingredientsScrollRef = useRef<ScrollView>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [focusedStep, setFocusedStep] = useState(1);
  const [recipeSteps, setRecipeSteps] = useState<Array<{ id: number; description: string; imageUrl?: string | null; videoUrl?: string | null }>>([]);
  const [nextStepId, setNextStepId] = useState(1);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isRecording, setIsRecording] = useState(false);
  const [addedIngredients, setAddedIngredients] = useState<Array<{ id: string; name: string; value: string; unit: string }>>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [searchResults, setSearchResults] = useState<Array<{ ingredient_id: number; name: string; default_unit: string }>>([]);
  const [searching, setSearching] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImageUri, setViewingImageUri] = useState<string | null>(null);
  const [viewingStepId, setViewingStepId] = useState<number | null>(null);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [viewingVideoUri, setViewingVideoUri] = useState<string | null>(null);
  const [completedImages, setCompletedImages] = useState<Array<string>>([]); // 완성 사진 배열
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [customGalleryStepId, setCustomGalleryStepId] = useState<number | null>(null); // 레시피 단계 사진용
  const [customGalleryType, setCustomGalleryType] = useState<'step' | 'completed' | null>(null); // 갤러리 타입
  const [recipeDescription, setRecipeDescription] = useState(''); // 레시피 설명
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false); // AI 분석 중 여부
  const [analysisMessage, setAnalysisMessage] = useState(''); // AI 분석 메시지

  // Redux에서 전역 위치 가져오기 (레시피 등록 시 사용)
  const userLocation = useSelector((state: RootState) => state.userState.userInfo?.location);
  const scale = useRef(new Animated.Value(1)).current;
  const baseScale = useRef(new Animated.Value(1)).current;
  const lastScale = useRef(1);
  const magnifyingGlassOrbit = useRef(new Animated.Value(0)).current; // 돋보기 원형 궤도 애니메이션
  const recipeNameInputRef = useRef<TextInput>(null);
  const initialRecipeNameRef = useRef<string>('');
  const stepInputRefs = useRef<Record<number, TextInput | null>>({});
  const mainIngredientsAddedRef = useRef(false); // 주재료 추가 여부 추적
  const initialDataRef = useRef<{
    recipeName: string;
    ingredientsCount: number;
    stepsCount: number;
    completedImagesCount: number;
    recipeDescription: string;
  } | null>(null); // 초기 데이터 추적
  const isRecipeSubmittedRef = useRef(false); // 레시피 등록 성공 여부 추적

  const buildMediaUrl = (path?: string | null) => {
    if (!path || typeof path !== 'string') {
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

  const toBackendMediaUri = (uri?: string | null) => {
    if (!uri) {
      return null;
    }
    const uploadsIndex = uri.indexOf('/uploads/');
    if (uploadsIndex >= 0) {
      return uri.substring(uploadsIndex + '/uploads/'.length);
    }
    return uri;
  };

  // 주재료를 재료 서랍과 추가된 재료에 추가
  useEffect(() => {
    // 편집 모드이거나 이미 추가했거나 주재료 이름이 없으면 스킵
    if (
      isEditMode ||
      mainIngredientsAddedRef.current ||
      !params?.selectedMainIngredientNames ||
      params.selectedMainIngredientNames.length === 0
    ) {
      return;
    }

    // 주재료 이름들을 재료로 추가 (중복 체크)
    const mainIngredientNames = params.selectedMainIngredientNames;
    const mainIngredientUnits = params?.selectedMainIngredientUnits || {};
    const mainIngredientIngredientIds = params?.selectedMainIngredientIngredientIds || {}; // 실제 재료 ID 매핑

    setAddedIngredients(prev => {
      const existingNames = prev.map(ing => ing.name);
      const newIngredients = mainIngredientNames
        .filter((name: string) => !existingNames.includes(name))
        .map((name: string, index: number) => {
          // 실제 ingredient_id가 있으면 사용, 없으면 임시 ID 생성
          const ingredientId = mainIngredientIngredientIds[name];
          return {
            id: ingredientId ? String(ingredientId) : `main-${Date.now()}-${index}`, // 실제 ingredient_id 사용
            name: name,
            value: '',
            unit: mainIngredientUnits[name] || '', // 기본 단위 설정
          };
        });

      if (newIngredients.length > 0) {
        console.log('📦 [PostRecipeScreen] 주재료를 재료에 추가:', newIngredients);
        mainIngredientsAddedRef.current = true; // 추가 완료 표시
        return [...prev, ...newIngredients];
      }
      return prev;
    });
  }, [params?.selectedMainIngredientNames, params?.selectedMainIngredientUnits, params?.selectedMainIngredientIngredientIds, isEditMode]);

  // 레시피 기본 데이터 로드
  useEffect(() => {
    const loadRecipeData = async () => {
      if (!recipePostId || isDirectAdd) {
        // 직접 추가인 경우 빈 상태로 시작
        if (isDirectAdd) {
          setRecipeSteps([{ id: 1, description: '', imageUrl: null, videoUrl: null }]);
          setNextStepId(2);
        }
        return;
      }

      try {
        setLoadingData(true);
        console.log('📥 [PostRecipeScreen] 레시피 데이터 로드 시작:', recipePostId);

        // 기본 재료와 스텝을 동시에 로드
        const [ingredientsResponse, stepsResponse, detailResponse] = await Promise.all([
          RecipeAPI.getDefaultIngredients(recipePostId),
          RecipeAPI.getDefaultSteps(recipePostId),
          RecipeAPI.getRecipeDetail(recipePostId),
        ]);

        console.log('📥 [PostRecipeScreen] 재료 응답:', ingredientsResponse);
        console.log('📥 [PostRecipeScreen] 스텝 응답:', stepsResponse);

        // 재료 데이터 설정
        if (ingredientsResponse.success && ingredientsResponse.data) {
          const formattedIngredients = ingredientsResponse.data.map((ing: any, index: number) => ({
            id: ing.id || (index + 1).toString(),
            name: ing.name || '',
            value: ing.value || '',
            unit: ing.unit || '',
          }));
          setAddedIngredients(formattedIngredients);
          console.log('📥 [PostRecipeScreen] 재료 설정:', formattedIngredients);
        }

        let detailStepsApplied = false;
        if (detailResponse.success && detailResponse.data) {
          const detail = detailResponse.data;
          if (!params?.recipeName) {
            setRecipeName(detail.title || '');
          }
          setRecipeDescription(detail.description || '');

          // 추천 레시피에서 가져온 경우 완성 사진 제거
          if (isFromDefaultTemplate) {
            setCompletedImages([]); // 명시적으로 빈 배열로 초기화
          } else {
            const existingCompletedImages = (detail.recipe_images || [])
              .map((img: any) => buildMediaUrl(img.image_url))
              .filter(Boolean) as string[];
            if (existingCompletedImages.length > 0) {
              setCompletedImages(existingCompletedImages);
            }
          }

          if (detail.recipe_steps && detail.recipe_steps.length > 0) {
            const formattedDetailSteps = detail.recipe_steps.map((step: any, index: number) => ({
              id: index + 1,
              description: step.instruction || step.description || step.content || step.text || '',
              // 추천 레시피에서 가져온 경우 이미지/비디오 제거 (설명만 유지)
              imageUrl: isFromDefaultTemplate ? null : buildMediaUrl(step.image_url || step.imageUrl || null),
              videoUrl: isFromDefaultTemplate ? null : buildMediaUrl(step.video_url || step.videoUrl || null),
            }));
            setRecipeSteps(formattedDetailSteps);
            setNextStepId(formattedDetailSteps.length + 1);
            detailStepsApplied = true;
            console.log('📥 [PostRecipeScreen] 상세 스텝 설정 (Raw):', detail.recipe_steps);
            console.log('📥 [PostRecipeScreen] 상세 스텝 설정 (Formatted):', formattedDetailSteps);
          }
        }

        if (!detailStepsApplied && stepsResponse.success && stepsResponse.data) {
          const formattedSteps = stepsResponse.data.map((step: any, index: number) => ({
            id: index + 1,
            description: step.description || step.instruction || step.content || step.text || '',
            // 추천 레시피에서 가져온 경우 이미지/비디오 제거 (설명만 유지)
            imageUrl: isFromDefaultTemplate ? null : buildMediaUrl(step.imageUrl || step.image_url || null),
            videoUrl: isFromDefaultTemplate ? null : buildMediaUrl(step.videoUrl || step.video_url || null),
          }));
          setRecipeSteps(formattedSteps);
          setNextStepId(formattedSteps.length + 1);
          console.log('📥 [PostRecipeScreen] 스텝 설정:', formattedSteps);
        }
      } catch (error) {
        console.error('❌ [PostRecipeScreen] 레시피 데이터 로드 실패:', error);
      } finally {
        setLoadingData(false);
      }
    };

    loadRecipeData();
  }, [recipePostId, isDirectAdd]);

  // AI 분석 모드: 이미지 분석 시작
  useEffect(() => {
    if (isAIAnalysisMode && aiAnalysisImageUri && !isAnalyzing) {
      const analyzeImage = async () => {
        try {
          setIsAnalyzing(true);

          // 완성 사진에 이미지 추가
          setCompletedImages([aiAnalysisImageUri]);

          // 이미지를 base64로 변환
          const convertImageToBase64 = async (uri: string): Promise<string | null> => {
            try {
              if (uri.startsWith('data:')) {
                // 이미 base64인 경우
                const base64Index = uri.indexOf(',');
                return base64Index >= 0 ? uri.substring(base64Index + 1) : null;
              }

              // 파일 경로에서 base64로 변환
              let filePath: string = uri;

              // file:// prefix 제거
              if (filePath.startsWith('file://')) {
                filePath = filePath.replace('file://', '');
              }

              // iOS에서 ph://로 시작하는 경우 처리
              if (filePath.startsWith('ph://') || filePath.startsWith('content://')) {
                console.error('❌ [PostRecipeScreen] AI 분석 이미지: 지원하지 않는 URI 스킴:', filePath);
                return null;
              }

              console.log(`📁 [PostRecipeScreen] AI 분석 이미지 읽기 시도: ${filePath} (Platform: ${Platform.OS})`);

              // 파일 존재 확인
              const exists = await ReactNativeBlobUtil.fs.exists(filePath);
              if (!exists) {
                // 원본 URI로도 시도
                const originalPath = uri.startsWith('file://') ? uri : `file://${uri}`;
                console.log(`🔄 [PostRecipeScreen] AI 분석 이미지 원본 경로로 재시도: ${originalPath}`);
                const existsOriginal = await ReactNativeBlobUtil.fs.exists(originalPath);
                if (!existsOriginal) {
                  console.error('❌ [PostRecipeScreen] AI 분석 이미지 파일이 존재하지 않음:', { filePath, originalPath });
                  return null;
                }
                filePath = originalPath;
              }

              const base64 = await ReactNativeBlobUtil.fs.readFile(filePath, 'base64');

              // base64가 비어있거나 너무 작으면 오류
              if (!base64 || base64.length < 100) {
                console.error('❌ [PostRecipeScreen] AI 분석 이미지 base64 변환 결과가 비정상적:', {
                  filePath,
                  originalUri: uri,
                  base64Length: base64?.length || 0,
                  platform: Platform.OS,
                });
                return null;
              }

              console.log(`✅ [PostRecipeScreen] AI 분석 이미지 base64 변환 성공: ${base64.length} bytes`);
              return base64;
            } catch (error) {
              console.error('❌ [PostRecipeScreen] 이미지 base64 변환 실패:', error);
              return null;
            }
          };

          const imageBase64 = await convertImageToBase64(aiAnalysisImageUri);
          if (!imageBase64) {
            throw new Error('이미지를 변환할 수 없습니다.');
          }

          // 기본 메시지 배열 (모두 한 번씩 표시)
          const baseMessages = [
            'AI 쉐프가 도착하셨습니다...',
            'AI 쉐프가 요리를 맛보고 있습니다...',
            '입에서 재료를 하나하나 확인하고 있어요...',
            '레시피를 떠올리고 있습니다...',
            '거의 다 됐어요! 조금만 기다려주세요...',
          ];

          // 추가 메시지 배열 (기본 메시지 이후에 순환 표시)
          const additionalMessages = [
            'AI 쉐프가 킥을 찾고 있어요!',
            '진짜 거의 다 했어요!',
          ];

          let messageIndex = 0;
          let hasShownAllBaseMessages = false;
          let additionalMessageIndex = 0;
          const MESSAGE_INTERVAL = 2000; // 2초마다 메시지 변경

          const messageInterval = setInterval(() => {
            if (!hasShownAllBaseMessages) {
              // 기본 메시지 모두 표시
              if (messageIndex < baseMessages.length) {
                setAnalysisMessage(baseMessages[messageIndex]);
                messageIndex++;
              } else {
                // 기본 메시지 모두 표시 완료
                hasShownAllBaseMessages = true;
                additionalMessageIndex = 0; // 추가 메시지 인덱스 초기화
                if (additionalMessages.length > 0) {
                  setAnalysisMessage(additionalMessages[0]);
                  additionalMessageIndex = 1;
                }
              }
            } else {
              // 추가 메시지 순환 (처음으로 돌아가지 않음)
              if (additionalMessages.length > 0) {
                const index = additionalMessageIndex % additionalMessages.length;
                setAnalysisMessage(additionalMessages[index]);
                additionalMessageIndex++;
              }
            }
          }, MESSAGE_INTERVAL);

          // AI 분석 API 호출 (선택된 주재료 이름들과 요리 이름도 함께 전달)
          const mainIngredientNames = params?.selectedMainIngredientNames || [];
          const recipeName = params?.aiAnalysisRecipeName || params?.recipeName || '';
          console.log('📤 [PostRecipeScreen] AI 분석 요청 - 주재료 정보:', mainIngredientNames);
          console.log('📤 [PostRecipeScreen] AI 분석 요청 - 요리 이름:', recipeName);
          const response = await RecipeAPI.analyzeImageWithAI(imageBase64, mainIngredientNames, recipeName);

          clearInterval(messageInterval);

          if (response.success && response.data) {
            const analysisData = response.data;

            // 레시피 이름 설정
            if (analysisData.title) {
              setRecipeName(analysisData.title);
            }

            // 레시피 설명 설정
            if (analysisData.description) {
              setRecipeDescription(analysisData.description);
            }

            // 재료 설정
            if (analysisData.ingredients && Array.isArray(analysisData.ingredients)) {
              console.log('📦 [PostRecipeScreen] AI 분석 재료 데이터:', analysisData.ingredients);
              const formattedIngredients = analysisData.ingredients.map((ing: any, index: number) => {
                const ingredientId = ing.ingredient_id;
                console.log(`📦 [PostRecipeScreen] 재료 ${index}:`, {
                  ingredient_id: ingredientId,
                  name: ing.name,
                  quantity: ing.quantity,
                  unit: ing.unit,
                });

                if (!ingredientId || ingredientId <= 0) {
                  console.error(`❌ [PostRecipeScreen] 재료 ${index}에 유효한 ingredient_id가 없습니다:`, ing);
                }

                return {
                  id: ingredientId ? String(ingredientId) : `ai-${Date.now()}-${index}`,
                  name: ing.name || '',
                  value: ing.quantity ? String(ing.quantity) : '',
                  unit: ing.unit || '',
                };
              });
              console.log('📦 [PostRecipeScreen] 포맷된 재료:', formattedIngredients);
              setAddedIngredients(formattedIngredients);
            } else {
              console.warn('⚠️ [PostRecipeScreen] AI 분석 결과에 재료가 없습니다:', analysisData);
            }

            // 레시피 스텝 설정
            if (analysisData.recipe_steps && Array.isArray(analysisData.recipe_steps)) {
              const formattedSteps = analysisData.recipe_steps.map((step: any, index: number) => ({
                id: index + 1,
                description: step.instruction || step.description || '',
                imageUrl: null,
                videoUrl: null,
              }));
              setRecipeSteps(formattedSteps);
              setNextStepId(formattedSteps.length + 1);
            }

            setAnalysisMessage('분석 완료! 레시피를 확인하고 수정해주세요.');
            setTimeout(() => {
              setAnalysisMessage('');
            }, 3000);
          } else {
            throw new Error(response.message || 'AI 분석에 실패했습니다.');
          }
        } catch (error: any) {
          console.error('❌ [PostRecipeScreen] AI 분석 실패:', error);

          // 서버에서 보낸 에러 메시지 추출
          let errorMessage = 'AI 분석 중 오류가 발생했습니다.';

          if (error.response?.data?.message) {
            // 서버에서 보낸 상세 메시지 (예: "이미지의 요리가 '콩불'과(와) 일치하지 않습니다...")
            errorMessage = error.response.data.message;
          } else if (error.message) {
            // 일반 에러 메시지
            errorMessage = error.message;
          }

          alert('AI 쉐프', errorMessage);
          setAnalysisMessage('');
        } finally {
          setIsAnalyzing(false);
        }
      };

      analyzeImage();
    }
  }, [isAIAnalysisMode, aiAnalysisImageUri]);

  useEffect(() => {
    if (!isEditMode && initialRecipeNameRef.current === '' && recipeName) {
      initialRecipeNameRef.current = recipeName;
    }
  }, [recipeName, isEditMode]);

  // 초기 데이터 저장 (데이터 변경 감지용)
  useEffect(() => {
    // 데이터 로딩이 완료된 후에만 초기 데이터 저장
    if (initialDataRef.current === null && !loadingData) {
      // 약간의 지연을 두어 초기 상태가 완전히 설정된 후 저장
      const timer = setTimeout(() => {
        initialDataRef.current = {
          recipeName: recipeName,
          ingredientsCount: addedIngredients.length,
          stepsCount: recipeSteps.length,
          completedImagesCount: completedImages.length,
          recipeDescription: recipeDescription,
        };
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [loadingData, recipeName, addedIngredients.length, recipeSteps.length, completedImages.length, recipeDescription]);

  // 뒤로가기 시 입력 데이터 확인
  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (e: any) => {
      // 레시피 등록 성공 후에는 경고 표시하지 않음
      if (isRecipeSubmittedRef.current) {
        return;
      }

      // 편집 모드이거나 초기 데이터가 설정되지 않았으면 경고 없이 진행
      if (isEditMode || initialDataRef.current === null) {
        return;
      }

      const initial = initialDataRef.current;

      // 입력 데이터 변경 확인
      const hasChanges =
        recipeName.trim() !== initial.recipeName.trim() ||
        addedIngredients.length > initial.ingredientsCount ||
        recipeSteps.length > initial.stepsCount ||
        recipeSteps.some(step =>
          step.description.trim() ||
          step.imageUrl ||
          step.videoUrl
        ) ||
        completedImages.length > initial.completedImagesCount ||
        recipeDescription.trim() !== initial.recipeDescription.trim() ||
        addedIngredients.some(ing => ing.value.trim()); // 수량이 입력된 재료가 있는지

      if (!hasChanges) {
        // 변경사항이 없으면 경고 없이 진행
        return;
      }

      // 변경사항이 있으면 경고 표시
      e.preventDefault();

      confirm(
        '입력한 내용이 삭제됩니다',
        '뒤로가기를 하면 입력한 모든 데이터가 삭제됩니다. 정말 뒤로 가시겠어요?',
      ).then((shouldGoBack) => {
        if (shouldGoBack) {
          navigation.dispatch(e.data.action);
        }
      });
    });

    return unsubscribe;
  }, [navigation, recipeName, addedIngredients, recipeSteps, completedImages, recipeDescription, isEditMode]);

  useEffect(() => {
    if (!isEditMode) {
      const timer = setTimeout(() => {
        recipeNameInputRef.current?.focus();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isEditMode]);

  // 비정확한 위치 획득 (프라이버시 보호)
  const requestInaccurateLocation = () =>
    new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
      const geoOptions: any = {
        enableHighAccuracy: false, // 비정확한 위치 사용 (프라이버시 보호)
        timeout: 10000, // 10초로 증가 (더 안정적인 위치 획득)
        maximumAge: 300000, // 5분간 캐시된 위치 사용
        distanceFilter: 0,
        accuracy: {
          android: 'balanced', // 중간 정확도
          ios: 'reduced', // iOS에서 비정확한 위치
        },
        forceRequestLocation: false,
        showLocationDialog: true,
      };

      Geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        error => {
          console.log('⚠️ [PostRecipeScreen] 위치 가져오기 실패:', error);
          reject(error);
        },
        geoOptions,
      );
    });

  // 위치 재획득 로직은 제거 - 레시피 제출 시 직접 요청함

  // 재료 검색 (디바운싱)
  useEffect(() => {
    const searchTimer = setTimeout(async () => {
      if (!searchQuery || searchQuery.trim().length === 0) {
        setSearchResults([]);
        return;
      }

      try {
        setSearching(true);
        console.log('🔍 [PostRecipeScreen] 재료 검색:', searchQuery);
        const response = await IngredientAPI.searchIngredients(searchQuery.trim());
        console.log('🔍 [PostRecipeScreen] 검색 결과:', response);

        if (response.success && response.data) {
          setSearchResults(response.data);
        } else {
          setSearchResults([]);
        }
      } catch (error) {
        console.error('❌ [PostRecipeScreen] 재료 검색 실패:', error);
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 300); // 300ms 디바운싱

    return () => clearTimeout(searchTimer);
  }, [searchQuery]);

  // 재료 이름을 태그로 감싸는 함수
  const wrapIngredientName = (name: string) => {
    return name;
  };

  // 재료 서랍은 추가된 재료와 동일
  const drawerIngredients = addedIngredients;

  const removeIngredient = (id: string) => {
    setAddedIngredients(prev => prev.filter(item => item.id !== id));
  };

  const addIngredient = (ingredient: { ingredient_id?: number; name: string; default_unit?: string } | string) => {
    // 문자열인 경우 (기존 호환성) 또는 객체인 경우 처리
    const ingredientName = typeof ingredient === 'string' ? ingredient : ingredient.name;
    const ingredientId = typeof ingredient === 'string' ? undefined : ingredient.ingredient_id;
    const defaultUnit = typeof ingredient === 'string' ? '' : (ingredient.default_unit || '');

    const isAlreadyAdded = addedIngredients.some(
      ing => ing.name === ingredientName,
    );
    if (!isAlreadyAdded) {
      setAddedIngredients(prev => [
        ...prev,
        {
          id: ingredientId?.toString() || Date.now().toString(),
          name: ingredientName,
          value: '',
          unit: defaultUnit,
        },
      ]);
    }
    setSearchQuery('');
  };

  const units = ['g', 'mg', '개', '컵', 'ml', 'L', '큰술', '작은술', '꼬집', '적당량'];
  const [unitModalVisible, setUnitModalVisible] = useState(false);
  const [selectedIngredientId, setSelectedIngredientId] = useState<string>('');

  const showUnitSelector = (ingredientId: string) => {
    setSelectedIngredientId(ingredientId);
    setUnitModalVisible(true);
  };

  const selectUnit = (unit: string) => {
    setAddedIngredients(prev =>
      prev.map(item =>
        item.id === selectedIngredientId ? { ...item, unit: unit } : item,
      ),
    );
    setUnitModalVisible(false);
  };

  // 카메라/갤러리 선택 (CustomGallery 또는 launchCamera 사용)
  const handleTakePhoto = (stepId: number) => {
    Alert.alert(
      '사진 업로드',
      '사진을 어디서 가져오시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '카메라 촬영',
          onPress: async () => {
            // 카메라 권한 요청
            const hasPermission = await requestPermission('camera', {
              title: '카메라 권한 필요',
              message: '사진 촬영을 위해 카메라 접근 권한이 필요합니다.',
            });
            if (!hasPermission) return;

            const options = {
              mediaType: 'photo' as MediaType,
              saveToPhotos: false,
              cameraType: 'back' as const,
              quality: 0.8 as any, // Type definition mismatch workaround
            };

            launchCamera(options, (response: ImagePickerResponse) => {
              if (response.didCancel) {
                console.log('사용자가 사진 촬영을 취소했습니다.');
              } else if (response.errorCode) {
                Alert.alert('오류', '사진 촬영을 할 수 없습니다.');
                console.error('사진 촬영 오류:', response.errorMessage);
              } else if (response.assets && response.assets[0]) {
                const imageUri = response.assets[0].uri;
                if (imageUri) {
                  setRecipeSteps(prev =>
                    prev.map(step =>
                      step.id === stepId ? { ...step, imageUrl: imageUri, videoUrl: null } : step,
                    ),
                  );
                }
              }
            });
          }
        },
        {
          text: '갤러리 선택',
          onPress: () => {
            setCustomGalleryStepId(stepId);
            setCustomGalleryType('step');
            setShowCustomGallery(true);
          }
        },
      ],
      { cancelable: true }
    );
  };

  // 동영상 촬영
  const handleRecordVideo = async (stepId: number) => {
    // 카메라 권한 요청
    const hasCameraPermission = await requestPermission('camera', {
      title: '카메라 권한 필요',
      message: '동영상을 촬영하려면 카메라 권한이 필요합니다.',
    });
    if (!hasCameraPermission) return;

    // 마이크 권한 요청 (iOS 필수)
    /*
    const hasMicPermission = await requestPermission('microphone', {
      title: '마이크 권한 필요',
      message: '동영상 촬영 시 소리를 녹음하기 위해 마이크 권한이 필요합니다.',
    });
    if (!hasMicPermission) return;
    */

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'medium' as const, // 품질 낮춤 (high -> medium)
      durationLimit: 6, // 6초 제한
      saveToPhotos: false,
      cameraType: 'back' as const, // 후면 카메라
    };

    setIsRecording(true);
    setRecordingTime(0);

    // 6초 카운트다운 시작
    const countdownInterval = setInterval(() => {
      setRecordingTime(prev => {
        if (prev >= 6) {
          clearInterval(countdownInterval);
          return 6;
        }
        return prev + 0.1;
      });
    }, 100);

    launchCamera(options, (response: ImagePickerResponse) => {
      clearInterval(countdownInterval);
      setIsRecording(false);
      setRecordingTime(0);

      if (response.didCancel) {
        console.log('사용자가 동영상 촬영을 취소했습니다.');
      } else if (response.errorCode) {
        alert('오류', '동영상 촬영을 할 수 없습니다.');
        console.error('동영상 촬영 오류:', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const videoUri = response.assets[0].uri;
        if (videoUri) {
          setRecipeSteps(prev =>
            prev.map(step =>
              step.id === stepId ? { ...step, videoUrl: videoUri, imageUrl: null } : step,
            ),
          );
        }
      }
    });
  };

  // 완성 사진 추가 (CustomGallery 또는 launchCamera 사용)
  const handleAddCompletedImage = () => {
    Alert.alert(
      '완성 사진 추가',
      '사진을 어디서 가져오시겠습니까?',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '카메라 촬영',
          onPress: async () => {
            // 카메라 권한 요청
            const hasPermission = await requestPermission('camera', {
              title: '카메라 권한 필요',
              message: '사진 촬영을 위해 카메라 접근 권한이 필요합니다.',
            });
            if (!hasPermission) return;

            const options = {
              mediaType: 'photo' as MediaType,
              saveToPhotos: false,
              cameraType: 'back' as const,
              quality: 0.8 as any,
            };

            launchCamera(options, (response: ImagePickerResponse) => {
              if (response.didCancel) {
                console.log('사용자가 사진 촬영을 취소했습니다.');
              } else if (response.errorCode) {
                Alert.alert('오류', '사진 촬영을 할 수 없습니다.');
                console.error('사진 촬영 오류:', response.errorMessage);
              } else if (response.assets && response.assets[0]) {
                const imageUri = response.assets[0].uri;
                if (imageUri) {
                  setCompletedImages(prev => [...prev, imageUri]);
                }
              }
            });
          }
        },
        {
          text: '갤러리 선택',
          onPress: () => {
            setCustomGalleryStepId(null);
            setCustomGalleryType('completed');
            setShowCustomGallery(true);
          }
        },
      ],
      { cancelable: true }
    );
  };

  // 갤러리에서 사진 선택 (CustomGallery 사용)
  const handleSelectPhotoFromGallery = (stepId: number) => {
    setCustomGalleryStepId(stepId);
    setCustomGalleryType('step');
    setShowCustomGallery(true);
  };

  // 갤러리에서 동영상 선택 (기존 방식 유지)
  const handleSelectVideoFromGallery = async (stepId: number) => {
    // 권한 요청
    const hasPermission = await requestPermission('photo', {
      title: '갤러리 접근 권한 필요',
      message: '동영상을 선택하려면 갤러리 접근 권한이 필요합니다.',
    });
    if (!hasPermission) return;

    const options = {
      mediaType: 'video' as MediaType,
      videoQuality: 'medium' as const,
      selectionLimit: 1,
    };

    launchImageLibrary(options, (response: ImagePickerResponse) => {
      if (response.didCancel) {
        console.log('사용자가 갤러리 선택을 취소했습니다.');
      } else if (response.errorCode) {
        alert('오류', '파일을 선택할 수 없습니다.');
        console.error('갤러리 오류:', response.errorMessage);
      } else if (response.assets && response.assets[0]) {
        const asset = response.assets[0];
        const uri = asset.uri;
        const duration = asset.duration || 0;

        if (!uri) {
          return;
        }

        // 동영상 길이 확인 (6초 이하만 허용)
        if (duration > 6) {
          alert('동영상 길이 초과', '6초 이하의 동영상만 업로드할 수 있습니다.');
          return;
        }

        // 동영상 저장
        setRecipeSteps(prev =>
          prev.map(step =>
            step.id === stepId ? { ...step, videoUrl: uri, imageUrl: null } : step,
          ),
        );
      }
    });
  };

  // 갤러리에서 사진/동영상 선택 (기존 호환성을 위해 유지, 사진만 편집 기능 사용)
  const handleSelectFromGallery = (stepId: number) => {
    // 미디어 선택은 다른 방식으로 처리 (Alert 대신)
    // TODO: BottomSheetMenu로 교체 가능
    alert('미디어 선택', '사진 또는 동영상을 선택하세요');
  };

  // 이미지 뷰어 열기
  const openImageViewer = (imageUri: string, stepId: number) => {
    setViewingImageUri(imageUri);
    setViewingStepId(stepId);
    setImageViewerVisible(true);
    // 스케일 초기화
    scale.setValue(1);
    baseScale.setValue(1);
    lastScale.current = 1;
  };

  // 핀치 제스처 핸들러
  const onPinchEvent = Animated.event(
    [{ nativeEvent: { scale: scale } }],
    { useNativeDriver: true }
  );

  const onPinchStateChange = (event: any) => {
    if (event.nativeEvent.oldState === State.ACTIVE) {
      lastScale.current *= event.nativeEvent.scale;
      baseScale.setValue(lastScale.current);
      scale.setValue(1);
    }
  };

  const validateRequiredFields = () => {
    const missingFields: string[] = [];

    if (!recipeName.trim()) {
      missingFields.push('레시피 이름');
    }

    if (addedIngredients.length === 0) {
      missingFields.push('재료');
    }

    const ingredientsWithoutQuantity = addedIngredients.filter(ing => !ing.value.trim());
    if (ingredientsWithoutQuantity.length > 0) {
      missingFields.push('모든 재료 수량');
    }

    const invalidIngredientQuantity = addedIngredients.filter(ing => ing.value.trim() && isNaN(Number(ing.value)));
    if (invalidIngredientQuantity.length > 0) {
      missingFields.push('재료 수량은 숫자로 입력');
    }

    if (recipeSteps.length === 0) {
      missingFields.push('레시피 조리 단계');
    }

    const emptyStep = recipeSteps.find(step => !step.description.trim());
    if (emptyStep) {
      missingFields.push('각 레시피 단계의 조리 설명');
    }

    if (!recipeDescription.trim()) {
      missingFields.push('레시피 설명');
    }

    if (completedImages.length === 0) {
      missingFields.push('대표 이미지');
    }

    if (missingFields.length > 0) {
      const message = missingFields
        .map(field => `• ${field}`)
        .join('\n');
      alert('입력이 필요한 항목이 있어요', `${message}`);
      return false;
    }

    const negativeQuantity = addedIngredients.find(ing => ing.value.trim() && Number(ing.value) <= 0);
    if (negativeQuantity) {
      alert('입력 오류', '재료 수량은 0보다 큰 숫자로 입력해주세요.');
      return false;
    }

    return true;
  };

  // 레시피 등록
  const handleSubmitRecipe = async () => {
    if (!isEditMode && initialRecipeNameRef.current && recipeName.trim() === initialRecipeNameRef.current.trim()) {
      const shouldProceed = await confirm('알림', '레시피 이름이 수정되지 않았습니다. 정말 등록하시겠습니까?');
      if (!shouldProceed) {
        setTimeout(() => recipeNameInputRef.current?.focus(), 100);
        return;
      }
    }

    // 일반 등록 프로세스 진행
    await proceedWithRecipeSubmission();
  };

  // 실제 레시피 등록 로직 (공통 함수로 분리)
  const proceedWithRecipeSubmission = async () => {
    if (!validateRequiredFields()) {
      return;
    }

    try {
      setIsSubmitting(true);

      // CategoryScreen에서 전달받은 카테고리 정보
      const situationId = params?.selectedSituationId;
      const methodId = params?.selectedMethodId;
      const mainIngredientIds = params?.selectedMainIngredientIds || []; // 모든 메인 재료 ID

      console.log('📤 [PostRecipeScreen] 카테고리 정보:', {
        situationId,
        methodId,
        mainIngredientIds,
        params: params,
      });

      // 재료 데이터 변환 및 검증
      console.log('📤 [PostRecipeScreen] 레시피 등록 전 재료 검증:', addedIngredients);
      const ingredients = addedIngredients
        .map((ing, index) => {
          // ingredient_id 파싱 및 검증
          let ingredientId: number | null = null;

          if (typeof ing.id === 'number') {
            ingredientId = ing.id;
          } else if (ing.id) {
            // 문자열 ID 파싱
            const idStr = String(ing.id);
            // "ai-"로 시작하는 임시 ID는 건너뛰기
            if (idStr.startsWith('ai-')) {
              console.warn(`⚠️ [PostRecipeScreen] 재료 ${index}에 임시 ID가 있습니다 (ingredient_id 없음):`, ing);
              return null;
            }
            ingredientId = parseInt(idStr, 10);
          } else {
            console.warn(`⚠️ [PostRecipeScreen] 재료 ${index}에 ID가 없습니다:`, ing);
            return null;
          }

          // NaN 또는 0 이하인 경우 필터링
          if (isNaN(ingredientId) || ingredientId <= 0) {
            console.warn(`⚠️ [PostRecipeScreen] 재료 ${index}에 유효하지 않은 ID:`, ing, '파싱된 ID:', ingredientId);
            return null;
          }

          const quantity = parseFloat(ing.value) || 0;
          const unit = ing.unit || '개';

          console.log(`✅ [PostRecipeScreen] 재료 ${index} 검증 통과:`, {
            ingredient_id: ingredientId,
            name: ing.name,
            quantity,
            unit,
          });

          return {
            ingredient_id: ingredientId,
            quantity: quantity,
            unit: unit,
          };
        })
        .filter((ing): ing is { ingredient_id: number; quantity: number; unit: string } => ing !== null); // null 제거

      console.log('📤 [PostRecipeScreen] 최종 재료 목록:', ingredients);

      // 유효한 재료가 하나도 없으면 에러
      if (ingredients.length === 0) {
        console.error('❌ [PostRecipeScreen] 유효한 재료가 없습니다. addedIngredients:', addedIngredients);
        alert('오류', '유효한 재료가 없습니다. 재료를 다시 추가해주세요.');
        setIsSubmitting(false);
        return;
      }

      // 이미지 파일을 base64로 변환하는 함수
      const convertImageToBase64 = async (imageUri: string | null): Promise<string | null> => {
        if (!imageUri) {
          return null;
        }

        // 서버 URL인 경우 스킵
        if (
          imageUri.startsWith('http') ||
          imageUri.startsWith('https') ||
          imageUri.startsWith('/uploads')
        ) {
          return null;
        }

        // 이미 base64인 경우 (data:로 시작)
        if (imageUri.startsWith('data:')) {
          const base64Index = imageUri.indexOf(',');
          return base64Index >= 0 ? imageUri.substring(base64Index + 1) : imageUri;
        }

        // 지원하지 않는 URI 스킴 체크
        if (imageUri.startsWith('ph://') || imageUri.startsWith('content://')) {
          console.error('❌ [PostRecipeScreen] 지원하지 않는 URI 스킴:', imageUri);
          throw new Error('이미지 URI 형식이 지원되지 않습니다.');
        }

        try {
          // react-native-image-crop-picker가 반환하는 경로 처리
          // iOS: 절대 경로 (file:// 없음) - 예: /var/mobile/Containers/...
          // Android: file:// 포함 - 예: file:///data/...
          let filePath: string = imageUri;

          // file:// prefix 제거 (있는 경우)
          if (filePath.startsWith('file://')) {
            filePath = filePath.replace('file://', '');
          }

          // 파일 존재 확인
          const exists = await ReactNativeBlobUtil.fs.exists(filePath);
          if (!exists) {
            // iOS에서 file:// 접두사가 필요할 수 있으므로 재시도
            if (Platform.OS === 'ios' && !imageUri.startsWith('file://')) {
              const retryPath = `file://${imageUri}`;
              const retryExists = await ReactNativeBlobUtil.fs.exists(retryPath);
              if (retryExists) {
                filePath = retryPath;
              } else {
                throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
              }
            } else {
              throw new Error(`파일을 찾을 수 없습니다: ${filePath}`);
            }
          }

          // 파일 읽기
          const base64 = await ReactNativeBlobUtil.fs.readFile(filePath, 'base64');

          // base64가 비어있거나 너무 작으면 오류
          if (!base64 || base64.length < 100) {
            throw new Error('이미지 파일을 읽을 수 없습니다.');
          }

          return base64;
        } catch (error) {
          console.error('❌ [PostRecipeScreen] 이미지 변환 오류:', error);
          throw error;
        }
      };

      // 외부 URL인지 확인하는 헬퍼 함수
      const isExternalUrl = (url: string | null | undefined): boolean => {
        if (!url || typeof url !== 'string') {
          return false;
        }
        return url.startsWith('http://') || url.startsWith('https://');
      };

      // 레시피 스텝 데이터 변환 (이미지/동영상 base64 변환)
      // 추천 레시피에서 가져온 외부 URL 이미지/비디오는 제외하되, 사용자가 새로 추가한 로컬 파일은 포함
      const recipe_steps = await Promise.all(
        recipeSteps.map(async (step) => {
          let imageBase64 = null;
          let videoBase64 = null;
          let imageUrl = null; // 기존 이미지 URL
          let videoUrl = null; // 기존 비디오 URL

          if (step.imageUrl) {
            if (isExternalUrl(step.imageUrl)) {
              imageUrl = toBackendMediaUri(step.imageUrl);
              console.log(`[Submit] Step ${step.id} existing image URL preserved: ${imageUrl} (Original: ${step.imageUrl})`);
            } else {
              try {
                imageBase64 = await convertImageToBase64(step.imageUrl);
                console.log(`[Submit] Step ${step.id} new image converted to base64`);
              } catch (e) {
                console.error(`Step ${step.id} image conversion failed:`, e);
              }
            }
          }

          if (step.videoUrl) {
            if (isExternalUrl(step.videoUrl)) {
              videoUrl = toBackendMediaUri(step.videoUrl);
              console.log(`[Submit] Step ${step.id} existing video URL preserved: ${videoUrl}`);
            } else {
              // 로컬 비디오 처리 (현재는 스킵)
            }
          }

          return {
            step_number: step.id,
            instruction: step.description, // API expects 'instruction', not 'description'
            image_base64: imageBase64,
            video_base64: videoBase64,
            image_uri: imageUrl, // Changed from image_url to image_uri
            video_uri: videoUrl, // Changed from video_url to video_uri
          };
        })
      );

      console.log('📤 [PostRecipeScreen] 스텝 데이터 생성 완료:', recipe_steps);

      // 완성 사진 base64 변환
      // 외부 URL인 경우 제외하고, 사용자가 새로 추가한 로컬 파일만 포함
      // 완성 사진 처리
      // 기존 이미지(URL)는 그대로 유지하고, 새 이미지(로컬 URI)는 Base64로 변환
      const completedImagesBase64 = await Promise.all(
        completedImages.map(async (imageUri) => {
          if (isExternalUrl(imageUri)) {
            // 기존 이미지: URL을 그대로 전송 (백엔드에서 상대 경로로 변환 처리 필요할 수 있음)
            // toBackendMediaUri를 사용하여 /uploads/ 형태의 상대 경로로 변환
            return {
              uri: toBackendMediaUri(imageUri),
              base64: null, // 기존 이미지는 base64 없음
            };
          } else {
            // 새 이미지: Base64 변환
            let base64 = null;
            try {
              base64 = await convertImageToBase64(imageUri);
            } catch (error) {
              console.error('완성 사진 변환 실패:', error);
            }
            return {
              base64: base64,
              uri: imageUri, // 로컬 URI (참고용)
            };
          }
        })
      );

      // 위치 정보 획득 (제출 시점에 새로 요청)
      let finalLocation: { latitude: number; longitude: number } | undefined = undefined;

      console.log('📍 [PostRecipeScreen] 레시피 제출 시점 위치 획득 시작...');

      try {
        // 1. 위치 권한 확인 및 요청 (JIT)
        const hasLocationPermission = await requestPermission('location');

        if (hasLocationPermission) {
          console.log('📍 [PostRecipeScreen] 위치 권한 획득 성공, 위치 조회 시도...');

          // 2. 새로운 비정확한 위치 요청 (빠른 응답 우선)
          // requestInaccurateLocation 함수 재사용 (내부적으로 타임아웃 10초)
          try {
            const currentLocation = await Promise.race([
              requestInaccurateLocation(),
              new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error('Location request timeout')), 5000), // 5초로 단축
              ),
            ]);

            finalLocation = {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
            };

            // AsyncStorage에 저장 (캐싱 용도)
            await AsyncStorage.setItem('userLocation', JSON.stringify(finalLocation));
            console.log('✅ [PostRecipeScreen] 위치 획득 성공:', finalLocation);
          } catch (locError) {
            console.log('⚠️ [PostRecipeScreen] 위치 획득 실패 (타임아웃 또는 에러):', locError);
            // 실패 시에만 기존 저장된 위치 시도 (Fallback)
            const storedLocation = await AsyncStorage.getItem('userLocation');
            if (storedLocation) {
              const parsed = JSON.parse(storedLocation);
              if (parsed && typeof parsed.latitude === 'number' && typeof parsed.longitude === 'number') {
                finalLocation = {
                  latitude: parsed.latitude,
                  longitude: parsed.longitude,
                };
                console.log('📍 [PostRecipeScreen] Fallback: AsyncStorage 위치 사용:', finalLocation);
              }
            }
          }
        } else {
          console.log('⚠️ [PostRecipeScreen] 위치 권한 거부됨, 위치 정보 없이 진행');
        }
      } catch (error) {
        console.log('⚠️ [PostRecipeScreen] 위치 로직 중 오류:', error);
      }

      const recipeData = {
        title: recipeName.trim(),
        description: recipeDescription.trim(),
        ingredients: ingredients,
        recipe_steps: recipe_steps,
        situation_id: situationId || undefined,
        cooking_method_id: methodId || undefined,
        main_ingredient_ids: mainIngredientIds.length > 0 ? mainIngredientIds : undefined, // 모든 메인 재료 ID 배열
        completed_images: completedImagesBase64,
        location: finalLocation,
      };

      console.log('📤 [PostRecipeScreen] 레시피 등록 요청 데이터:', {
        title: recipeData.title,
        situation_id: recipeData.situation_id,
        cooking_method_id: recipeData.cooking_method_id,
        main_ingredient_ids: recipeData.main_ingredient_ids,
        location: recipeData.location,
        ingredients_count: recipeData.ingredients.length,
        recipe_steps_count: recipeData.recipe_steps.length,
        completed_images_count: recipeData.completed_images.length,
      });

      // 추천 레시피에서 가져온 경우는 항상 새로운 레시피로 등록 (편집 아님)
      // isEditMode가 false이면 (추천 레시피 포함) createRecipe 호출
      const response = isEditMode && recipePostId
        ? await RecipeAPI.updateRecipe(recipePostId, recipeData)
        : await RecipeAPI.createRecipe(recipeData);

      console.log('📥 [PostRecipeScreen] 레시피 등록 응답:', response);

      if (response.success) {
        // 레시피 등록/수정 성공 플래그 설정 (뒤로가기 경고 방지)
        isRecipeSubmittedRef.current = true;

        const successMessage = isEditMode ? '레시피가 수정되었습니다.' : '레시피가 등록되었습니다.';
        alert('성공', successMessage).then(() => {
          // 메인 페이지(Home)로 이동
          navigation.dispatch(
            CommonActions.reset({
              index: 0,
              routes: [
                {
                  name: 'Main',
                  state: {
                    routes: [{ name: 'Home' }],
                  },
                },
              ],
            }),
          );
        });
      } else {
        const errorMessage = response.message || '레시피 등록에 실패했습니다.';
        console.error('❌ [PostRecipeScreen] 레시피 등록 실패:', errorMessage);
        alert('오류', errorMessage);
      }
    } catch (error: any) {
      console.error('❌ [PostRecipeScreen] 레시피 등록 오류:', error);
      console.error('❌ [PostRecipeScreen] 오류 상세:', error?.response?.data);

      // 413 Payload Too Large 에러 처리
      let errorMessage: string;
      if (error?.response?.status === 413 || error?.userMessage) {
        errorMessage = error?.userMessage || error?.response?.data?.message || '업로드하려는 파일의 용량이 너무 큽니다. 최대 100MB까지 업로드 가능합니다. 이미지를 조금 줄여서 다시 시도해주세요.';
      } else {
        errorMessage =
          error?.response?.data?.message ||
          error?.message ||
          '레시피 등록 중 오류가 발생했습니다.';
      }
      alert('오류', errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 이미지/동영상 삭제
  const deleteImage = (stepId: number) => {
    confirm('미디어 삭제', '이미지/동영상을 삭제하시겠습니까?').then((shouldDelete) => {
      if (shouldDelete) {
        setRecipeSteps(prev =>
          prev.map(step =>
            step.id === stepId ? { ...step, imageUrl: null, videoUrl: null } : step,
          ),
        );
        setImageViewerVisible(false);
        setViewingImageUri(null);
        setViewingStepId(null);
      }
    });
  };

  // 돋보기 원형 궤도 애니메이션 시작/중지
  useEffect(() => {
    if (isAnalyzing) {
      // 원형 궤도 애니메이션 시작 (무한 반복)
      const orbitAnimation = Animated.loop(
        Animated.timing(magnifyingGlassOrbit, {
          toValue: 1,
          duration: 2000, // 2초에 한 바퀴
          useNativeDriver: true,
        }),
      );
      orbitAnimation.start();

      return () => {
        orbitAnimation.stop();
        magnifyingGlassOrbit.setValue(0);
      };
    } else {
      // 분석 종료 시 애니메이션 중지
      magnifyingGlassOrbit.setValue(0);
    }
  }, [isAnalyzing, magnifyingGlassOrbit]);

  // 원형 궤도 위치 계산
  // 중심: (86.4, 72.5) - 원본 기준 (324, 272) 위치
  // 반지름: 4px 정도로 작은 원형 궤도
  const ORBIT_RADIUS = 4;
  const CENTER_X = 86.4;
  const CENTER_Y = 72.5;

  // 원형 궤도를 만들기 위해 여러 점을 계산
  // 0도, 90도, 180도, 270도, 360도 위치를 계산
  const magnifyingGlassTranslateX = magnifyingGlassOrbit.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      ORBIT_RADIUS * Math.cos(0),           // 0도
      ORBIT_RADIUS * Math.cos(Math.PI / 2), // 90도
      ORBIT_RADIUS * Math.cos(Math.PI),     // 180도
      ORBIT_RADIUS * Math.cos(3 * Math.PI / 2), // 270도
      ORBIT_RADIUS * Math.cos(2 * Math.PI), // 360도
    ],
  });

  const magnifyingGlassTranslateY = magnifyingGlassOrbit.interpolate({
    inputRange: [0, 0.25, 0.5, 0.75, 1],
    outputRange: [
      ORBIT_RADIUS * Math.sin(0),           // 0도
      ORBIT_RADIUS * Math.sin(Math.PI / 2), // 90도
      ORBIT_RADIUS * Math.sin(Math.PI),     // 180도
      ORBIT_RADIUS * Math.sin(3 * Math.PI / 2), // 270도
      ORBIT_RADIUS * Math.sin(2 * Math.PI), // 360도
    ],
  });

  // AI 분석 중 로딩 화면
  if (isAnalyzing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.aiAnalysisContainer}>
          <View style={styles.aiAnalysisContent}>
            {/* AI 쉐프 이미지와 돋보기 컨테이너 */}
            <View style={styles.aiChefImageContainer}>
              <Image
                source={require('../../../assets/icon/recipe/ai_chef_analizing.png')}
                style={styles.aiChefAnalyzingIcon}
                resizeMode="contain"
              />
              {/* 돋보기 이미지 (원형 궤도 애니메이션) */}
              <Animated.View
                style={[
                  styles.magnifyingGlassContainer,
                  {
                    transform: [
                      { translateX: magnifyingGlassTranslateX },
                      { translateY: magnifyingGlassTranslateY },
                    ],
                  },
                ]}>
                <Image
                  source={require('../../../assets/icon/recipe/ai_chef_tool.png')}
                  style={styles.magnifyingGlass}
                  resizeMode="contain"
                />
              </Animated.View>
            </View>
            <Text style={styles.aiAnalysisTitle}>AI 쉐프가 분석 중입니다</Text>
            <Text style={styles.aiAnalysisMessage}>
              {analysisMessage || '입력 받은 사진을 AI 쉐프가 먹어보고, 분석하는 중입니다...'}
            </Text>
            <ActivityIndicator size="large" color={colors.primary} style={styles.aiAnalysisLoader} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.keyboardAvoiding}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardVerticalOffset}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <TextInput
            style={styles.headerTitle}
            ref={recipeNameInputRef}
            value={recipeName}
            onChangeText={setRecipeName}
            placeholder="레시피 이름"
            maxLength={30}
            multiline={false}
          />
          <TouchableOpacity
            onPress={handleSubmitRecipe}
            disabled={isSubmitting}>
            <Text style={[styles.registerButton, isSubmitting && styles.registerButtonDisabled]}>
              {isSubmitting ? '등록 중...' : '등록'}
            </Text>
          </TouchableOpacity>
        </View>

        {loadingData ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>레시피 데이터 로딩 중...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            contentInsetAdjustmentBehavior="always">
            <View style={styles.instructionContainer}>
              <Text style={styles.instructionText}>재료를 알려주세요.</Text>
            </View>

            <View style={styles.searchContainer}>
              <TextInput
                style={styles.searchInput}
                placeholder="재료 검색..."
                value={searchQuery}
                onChangeText={setSearchQuery}
                maxLength={30}
              />
              <Icon name="search" size={20} color={colors.textSecondary} />
            </View>

            {searchQuery && (
              <View style={styles.searchResultsContainer}>
                {searching ? (
                  <View style={styles.searchResultItem}>
                    <Text style={styles.searchResultText}>검색 중...</Text>
                  </View>
                ) : (
                  <View style={styles.searchResults}>
                    {searchResults.map((ingredient, index) => (
                      <TouchableOpacity
                        key={ingredient.ingredient_id}
                        style={[
                          styles.searchResultItem,
                          index !== searchResults.length - 1 &&
                          styles.searchResultItemWithBorder,
                        ]}
                        onPress={() => addIngredient(ingredient)}>
                        <Text style={styles.searchResultText}>{ingredient.name}</Text>
                        <View style={styles.searchResultAddIcon}>
                          <Icon name="plus" size={18} color={colors.textPrimary} />
                        </View>
                      </TouchableOpacity>
                    ))}
                    {/* 검색 키워드와 정확히 일치하는 결과가 없을 때 "직접 추가하기" 표시 */}
                    {searchQuery.trim().length > 0 &&
                      !searchResults.some(ing => ing.name.toLowerCase() === searchQuery.trim().toLowerCase()) && (
                        <TouchableOpacity
                          style={styles.searchResultItem}
                          onPress={() => {
                            setNewIngredientName(searchQuery);
                            showOverlay(
                              <AddIngredientModal
                                ingredientName={searchQuery}
                                onClose={hideOverlay}
                                onAdd={async (ingredient: { name: string; category?: string; unit: string }) => {
                                  try {
                                    console.log('➕ [PostRecipeScreen] 재료 추가:', ingredient);
                                    const response = await IngredientAPI.createIngredient({
                                      name: ingredient.name,
                                      sub_category_id: undefined, // TODO: category를 sub_category_id로 변환
                                      default_unit: ingredient.unit || undefined,
                                    });

                                    if (response.success && response.data) {
                                      // 추가된 재료를 즉시 검색 결과에 반영하고 선택
                                      addIngredient({
                                        ingredient_id: response.data.ingredient_id,
                                        name: response.data.name,
                                        default_unit: response.data.default_unit || '',
                                      });
                                      setSearchQuery(''); // 검색창 초기화
                                      hideOverlay();
                                    } else {
                                      console.error('❌ [PostRecipeScreen] 재료 추가 실패:', response);
                                    }
                                  } catch (error) {
                                    console.error('❌ [PostRecipeScreen] 재료 추가 오류:', error);
                                  }
                                }}
                              />
                            );
                          }}>
                          <Text style={styles.searchResultText}>"{searchQuery}" 직접 추가하기</Text>
                          <View style={styles.searchResultAddIcon}>
                            <Icon name="plus" size={18} color={colors.textPrimary} />
                          </View>
                        </TouchableOpacity>
                      )}
                  </View>
                )}
              </View>
            )}

            <View style={styles.section}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>추가된 재료</Text>
                <View style={styles.dividerLine} />
              </View>

              <ScrollView
                ref={ingredientsScrollRef}
                style={styles.ingredientsScrollView}
                nestedScrollEnabled={true}
                showsVerticalScrollIndicator={true}>
                {addedIngredients.map(ingredient => (
                  <View key={ingredient.id} style={styles.ingredientItem}>
                    <Text style={styles.ingredientName}>{ingredient.name}</Text>
                    <View style={styles.ingredientRight}>
                      <TextInput
                        style={styles.ingredientValue}
                        value={ingredient.value}
                        onChangeText={(text) => {
                          setAddedIngredients(prev =>
                            prev.map(item =>
                              item.id === ingredient.id ? { ...item, value: text } : item,
                            ),
                          );
                        }}
                        placeholder="수량"
                        keyboardType="numeric"
                        maxLength={10}
                      />
                      <TouchableOpacity style={styles.ingredientUnit} onPress={() => showUnitSelector(ingredient.id)}>
                        <Text style={styles.ingredientUnitText}>{ingredient.unit}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        onPress={() => removeIngredient(ingredient.id)}
                        style={styles.removeButton}>
                        <Icon name="x" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>

            <View style={styles.section}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>재료 서랍</Text>
                <View style={styles.dividerLine} />
              </View>

              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.drawerContainer}>
                {drawerIngredients.map((ingredient, index) => (
                  <TouchableOpacity
                    key={ingredient.id}
                    style={styles.drawerTag}
                    onPress={() => {
                      // 현재 포커스된 레시피 카드에 재료 이름 추가 (두껍게 표시를 위한 태그로 감싸기)
                      setRecipeSteps(prev =>
                        prev.map(step =>
                          step.id === focusedStep
                            ? { ...step, description: step.description + (step.description ? ' ' : '') + wrapIngredientName(ingredient.name) }
                            : step,
                        ),
                      );
                      // 재료 추가 후 해당 스텝의 입력창에 포커스
                      setTimeout(() => {
                        const inputRef = stepInputRefs.current[focusedStep];
                        if (inputRef) {
                          inputRef.focus();
                        }
                      }, 100);
                    }}>
                    <Text style={styles.drawerTagText}>{ingredient.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* 레시피 단계 카드 섹션 */}
            <View style={styles.recipeStepsSection}>
              {recipeSteps.map((step, index) => (
                <View
                  key={step.id}
                  style={[
                    styles.recipeStepCard,
                    focusedStep === step.id && styles.recipeStepCardFocused,
                  ]}>
                  <TouchableOpacity onPress={() => setFocusedStep(step.id)}>
                    <View style={styles.stepCardHeader}>
                      <Text style={styles.stepCardTitle}>Step {index + 1}</Text>
                      <TouchableOpacity
                        style={styles.stepDeleteButton}
                        onPress={(e) => {
                          e.stopPropagation();
                          const newSteps = recipeSteps.filter(s => s.id !== step.id);
                          // ID 재정렬
                          const reorderedSteps = newSteps.map((s, idx) => ({ ...s, id: idx + 1 }));
                          setRecipeSteps(reorderedSteps);
                          setNextStepId(reorderedSteps.length + 1);

                          if (focusedStep === step.id) {
                            setFocusedStep(reorderedSteps.length > 0 ? reorderedSteps[0].id : 1);
                          }
                        }}>
                        <Text style={styles.stepDeleteText}>삭제</Text>
                      </TouchableOpacity>
                    </View>
                  </TouchableOpacity>
                  <View style={styles.stepDescriptionContainer}>
                    <TextInput
                      ref={(ref) => {
                        stepInputRefs.current[step.id] = ref;
                      }}
                      style={styles.stepDescriptionInput}
                      placeholder="레시피를 설명해주세요. (재료 서랍의 재료를 탭하여 추가할 수 있어요!)"
                      placeholderTextColor={colors.textTertiary}
                      value={recipeSteps.find(s => s.id === step.id)?.description || ''}
                      onChangeText={(text) => {
                        setRecipeSteps(prev =>
                          prev.map(s =>
                            s.id === step.id ? { ...s, description: text } : s,
                          ),
                        );
                      }}
                      multiline
                      onFocus={() => setFocusedStep(step.id)}
                      maxLength={500}
                    />
                  </View>
                  {step.imageUrl ? (
                    <TouchableOpacity
                      style={styles.stepMediaPreview}
                      onPress={() => openImageViewer(step.imageUrl!, step.id)}>
                      <Image
                        source={{ uri: step.imageUrl }}
                        style={styles.stepMediaPreviewImage}
                        resizeMode="cover"
                      />
                    </TouchableOpacity>
                  ) : step.videoUrl ? (
                    <TouchableOpacity
                      style={styles.stepMediaPreview}
                      onPress={() => {
                        setViewingVideoUri(step.videoUrl!);
                        setViewingStepId(step.id);
                        setVideoViewerVisible(true);
                      }}>
                      <Video
                        source={{ uri: step.videoUrl }}
                        style={styles.stepMediaPreviewImage}
                        paused={true}
                        resizeMode="cover"
                        muted={true}
                      />
                      <View style={styles.videoPreviewOverlay}>
                        <Icon name="play" size={24} color={colors.white} />
                      </View>
                    </TouchableOpacity>
                  ) : null}
                  {!step.imageUrl && !step.videoUrl && (
                    <View style={styles.mediaButtonsContainer}>
                      <TouchableOpacity
                        style={styles.mediaButton}
                        onPress={() => handleTakePhoto(step.id)}>
                        <Icon name="camera" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                      {/* 동영상 기능 임시 비활성화
                      <TouchableOpacity
                        style={styles.mediaButton}
                        onPress={() => handleRecordVideo(step.id)}>
                        <Icon name="video" size={20} color={colors.textSecondary} />
                      </TouchableOpacity>
                      */}
                      {isRecording && focusedStep === step.id && (
                        <View style={styles.recordingTimerContainer}>
                          <View style={styles.recordingTimer}>
                            <View style={styles.recordingDot} />
                            <Text style={styles.recordingTimerText}>
                              {Math.ceil(6 - recordingTime)}초
                            </Text>
                          </View>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              ))}

              {/* 레시피 추가 버튼 */}
              <TouchableOpacity
                style={styles.addStepButton}
                onPress={() => {
                  const newStep = { id: nextStepId, description: '', imageUrl: null, videoUrl: null };
                  setRecipeSteps(prev => [...prev, newStep]);
                  setNextStepId(prev => prev + 1);
                  setFocusedStep(newStep.id);
                }}>
                <Text style={styles.addStepButtonText}>레시피 추가하기</Text>
                <View style={styles.addStepIcon}>
                  <Icon name="plus" size={20} color={colors.white} />
                </View>
              </TouchableOpacity>
            </View>

            {/* 구분선 */}
            <View style={[styles.section, styles.completedImagesSection]}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>완성 사진</Text>
                <View style={styles.dividerLine} />
              </View>

              {/* 완성 사진 그리드 */}
              <View style={styles.completedImagesGrid}>
                {completedImages.map((imageUri, index) => (
                  <View key={index} style={styles.completedImageContainer}>
                    <Image
                      source={{ uri: imageUri }}
                      style={styles.completedImage}
                      resizeMode="cover"
                    />
                    <TouchableOpacity
                      style={styles.completedImageDeleteButton}
                      onPress={() => {
                        setCompletedImages(prev => prev.filter((_, i) => i !== index));
                      }}>
                      <Icon name="x" size={16} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                ))}
                {completedImages.length < 10 && (
                  <TouchableOpacity
                    style={styles.addCompletedImageButton}
                    onPress={async () => {
                      const hasPermission = await requestPermission('photo');
                      if (!hasPermission) return;
                      handleAddCompletedImage();
                    }}>
                    <Icon name="plus" size={24} color={colors.textSecondary} />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* 레시피 설명 */}
            <View style={styles.section}>
              <View style={styles.divider}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>레시피 설명</Text>
                <View style={styles.dividerLine} />
              </View>
              <TextInput
                style={styles.descriptionInput}
                placeholder="레시피에 대한 짧은 설명을 입력해주세요."
                placeholderTextColor={colors.textTertiary}
                value={recipeDescription}
                onChangeText={setRecipeDescription}
                multiline
                numberOfLines={4}
                maxLength={200}
              />
            </View>
          </ScrollView>
        )}
      </KeyboardAvoidingView>

      {/* 토스트 메시지 */}
      {toastVisible && (
        <View style={[styles.toastContainer, { top: insets.top + 60 }]}>
          <Text style={styles.toastText}>{toastMessage}</Text>
        </View>
      )}

      {/* 단위 선택 모달 */}
      <Modal
        visible={unitModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setUnitModalVisible(false)}>
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setUnitModalVisible(false)}>
          <View style={styles.unitModalContent} onStartShouldSetResponder={() => true}>
            <View style={styles.unitModalHeader}>
              <Text style={styles.unitModalTitle}>단위 선택</Text>
              <TouchableOpacity onPress={() => setUnitModalVisible(false)} style={styles.unitModalClose}>
                <Icon name="x" size={20} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.unitList} showsVerticalScrollIndicator={false}>
              {units.map(u => (
                <TouchableOpacity
                  key={u}
                  style={styles.unitOption}
                  onPress={() => selectUnit(u)}>
                  <Text style={styles.unitOptionText}>{u}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>

      {/* 이미지 뷰어 모달 */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <View style={styles.imageViewerContainer}>
            <TouchableOpacity
              style={styles.imageViewerCloseButton}
              onPress={() => setImageViewerVisible(false)}>
              <Icon name="x" size={24} color={colors.white} />
            </TouchableOpacity>
            <ScrollView
              contentContainerStyle={styles.imageViewerScrollContent}
              showsVerticalScrollIndicator={false}
              showsHorizontalScrollIndicator={false}
              bouncesZoom={true}
              maximumZoomScale={5}
              minimumZoomScale={1}>
              <PinchGestureHandler
                onGestureEvent={onPinchEvent}
                onHandlerStateChange={onPinchStateChange}>
                <Animated.View style={styles.imageViewerImageContainer}>
                  <Animated.Image
                    source={{ uri: viewingImageUri || '' }}
                    style={[
                      styles.fullScreenImage,
                      {
                        transform: [
                          { scale: Animated.multiply(baseScale, scale) },
                        ],
                      },
                    ]}
                    resizeMode="contain"
                  />
                </Animated.View>
              </PinchGestureHandler>
            </ScrollView>
            {viewingStepId && (
              <TouchableOpacity
                style={styles.imageDeleteButton}
                onPress={() => deleteImage(viewingStepId)}>
                <Text style={styles.imageDeleteButtonText}>삭제</Text>
              </TouchableOpacity>
            )}
          </View>
        </GestureHandlerRootView>
      </Modal>

      {/* 동영상 뷰어 모달 */}
      <Modal
        visible={videoViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setVideoViewerVisible(false)}>
        <View style={styles.videoViewerContainer}>
          <TouchableOpacity
            style={styles.videoViewerCloseButton}
            onPress={() => setVideoViewerVisible(false)}>
            <Icon name="x" size={24} color={colors.white} />
          </TouchableOpacity>
          {viewingVideoUri && (
            <Video
              source={{ uri: viewingVideoUri }}
              style={styles.videoPlayer}
              controls={true}
              resizeMode="contain"
              paused={false}
              repeat={false}
            />
          )}
          {viewingStepId && (
            <TouchableOpacity
              style={styles.imageDeleteButton}
              onPress={() => {
                deleteImage(viewingStepId);
                setVideoViewerVisible(false);
              }}>
              <Text style={styles.imageDeleteButtonText}>삭제</Text>
            </TouchableOpacity>
          )}
        </View>
      </Modal>

      {/* 레시피 등록 로딩 */}
      <LoadingOverlay
        visible={isSubmitting}
        message={isEditMode ? '레시피 수정 중...' : '레시피 등록 중...'}
      />

      {/* 커스텀 갤러리 */}
      <CustomGallery
        visible={showCustomGallery}
        onClose={() => {
          setShowCustomGallery(false);
          setCustomGalleryStepId(null);
          setCustomGalleryType(null);
        }}
        onSelectImage={(imageUri) => {
          if (customGalleryType === 'step' && customGalleryStepId !== null) {
            // 레시피 단계 사진
            setRecipeSteps(prev =>
              prev.map(step =>
                step.id === customGalleryStepId ? { ...step, imageUrl: imageUri, videoUrl: null } : step,
              ),
            );
          } else if (customGalleryType === 'completed') {
            // 완성 사진
            setCompletedImages(prev => [...prev, imageUri]);
          }
          setShowCustomGallery(false);
          setCustomGalleryStepId(null);
          setCustomGalleryType(null);
        }}
        cropperToolbarTitle={customGalleryType === 'completed' ? '완성 사진 편집' : '레시피 단계 사진 편집'}
        allowCropping={true}
        compressImageQuality={Platform.OS === 'ios' ? 1.0 : 0.8}
      />
    </SafeAreaView >
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  aiAnalysisContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  aiAnalysisContent: {
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  aiAnalysisTitle: {
    ...typography.h1,
    fontWeight: '700',
    color: colors.textPrimary,
    marginTop: spacing.l,
    marginBottom: spacing.m,
  },
  aiAnalysisMessage: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
  },
  aiAnalysisLoader: {
    marginTop: spacing.l,
  },
  aiChefImageContainer: {
    position: 'relative',
    width: 120,
    height: 120,
    marginBottom: spacing.l,
  },
  aiChefAnalyzingIcon: {
    width: 120,
    height: 120,
  },
  magnifyingGlassContainer: {
    position: 'absolute',
    // 원본 이미지: 450x450, 표시 이미지: 120x120
    // 원본 기준 (324, 272) 위치 -> 표시 기준 (324/450 * 120, 272/450 * 120) = (86.4, 72.5)
    // tool 원본 크기: 150x150 -> 표시 크기: 150/450 * 120 = 40
    // tool의 중앙이 (86.4, 72.5)에 오려면: left = 86.4 - 40/2, top = 72.5 - 40/2
    left: 86.4 - 20, // 66.4 (중심 위치)
    top: 72.5 - 20,  // 52.5 (중심 위치)
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  magnifyingGlass: {
    width: 40,
    height: 40,
  },
  keyboardAvoiding: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: spacing.m,
    padding: 0,
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        lineHeight: 24, // 텍스트 잘림 방지를 위해 fontSize보다 약간 크게 설정
      }
      : {
        lineHeight: 28,
      }),
  },
  registerButton: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: colors.primary,
  },
  registerButtonDisabled: {
    color: colors.textSecondary,
    opacity: 0.5,
  },
  completedImagesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
  },
  completedImageContainer: {
    width: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    height: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    position: 'relative',
  },
  completedImage: {
    width: '100%',
    height: '100%',
  },
  completedImageDeleteButton: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  addCompletedImageButton: {
    width: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    height: (Dimensions.get('window').width - spacing.l * 2 - spacing.s * 2) / 3,
    borderRadius: borderRadius.m,
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderStyle: 'dashed',
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  completedImagesSection: {
    marginTop: spacing.xl,
  },
  descriptionInput: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    color: colors.textPrimary,
    backgroundColor: colors.backgroundPress,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
  },
  instructionContainer: {
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  instructionText: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.textPrimary,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginBottom: spacing.l,
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
    padding: 0,
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        lineHeight: 16, // iOS에서 fontSize와 동일하게 설정하여 중앙 정렬
      }
      : {
        lineHeight: 24,
      }),
  },
  searchResultsContainer: {
    marginBottom: spacing.m,
  },
  searchResults: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.s,
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
  },
  searchResultItemWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  searchResultText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.textPrimary,
    flex: 1,
  },
  searchResultAddIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultAddIconNew: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchResultNewText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.primary,
    marginLeft: spacing.s,
    flex: 1,
  },
  section: {
    marginBottom: spacing.xl,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightGray,
  },
  dividerText: {
    fontSize: 14,
    fontWeight: '400',
    lineHeight: 20,
    color: colors.textSecondary,
    marginHorizontal: spacing.m,
  },
  ingredientsScrollView: {
    maxHeight: 300,
  },
  ingredientItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.s,
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  ingredientName: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: colors.textPrimary,
  },
  ingredientRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  ingredientValue: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
    minWidth: 50,
    textAlign: 'center',
    paddingHorizontal: spacing.s,
    backgroundColor: colors.backgroundPress,
    borderRadius: borderRadius.s,
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'center',
        paddingVertical: 0,
        lineHeight: 16, // iOS에서 fontSize와 동일하게 설정하여 중앙 정렬
        height: 36, // 적절한 높이 유지
      }
      : {
        paddingVertical: spacing.xs,
        lineHeight: 24,
      }),
  },
  ingredientUnit: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.s,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.s,
  },
  ingredientUnitText: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 24,
    color: colors.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unitModalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    minWidth: '80%',
    maxWidth: 420,
    maxHeight: '70%',
  },
  unitModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.s,
  },
  unitModalTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
  },
  unitModalClose: {
    padding: spacing.xs,
  },
  unitList: {
    paddingTop: spacing.s,
  },
  unitOption: {
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.s,
  },
  unitOptionText: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
  },
  removeButton: {
    padding: spacing.xs,
  },
  drawerContainer: {
    gap: spacing.m,
  },
  drawerTag: {
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.secondary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.l,
  },
  drawerTagText: {
    fontSize: 16,
    fontWeight: '500',
    lineHeight: 24,
    color: colors.textSecondary,
  },
  toastContainer: {
    position: 'absolute',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.m,
    zIndex: 1000,
  },
  toastText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.white,
  },
  recipeStepsSection: {
    marginTop: spacing.l,
  },
  recipeStepCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.s,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.almostBlack,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  recipeStepCardFocused: {
    borderColor: colors.primary,
  },
  stepCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  stepCardTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  stepDeleteButton: {
    padding: spacing.xs,
  },
  stepDeleteText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.error,
  },
  stepDescriptionContainer: {
    marginBottom: spacing.m,
    backgroundColor: colors.backgroundPress,
    borderRadius: borderRadius.s,
    minHeight: 100,
  },
  stepDescriptionInput: {
    fontSize: 16,
    fontWeight: '400',
    color: colors.textPrimary,
    padding: spacing.s,
    ...(Platform.OS === 'ios'
      ? {
        textAlignVertical: 'top',
        lineHeight: 22, // iOS에서 multiline일 때 약간의 여백을 위해 약간 크게 설정
      }
      : {
        lineHeight: 24,
      }),
  },
  stepImageContainer: {
    marginBottom: spacing.m,
  },
  stepImagePlaceholder: {
    width: 60,
    height: 60,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  stepImagePlaceholderText: {
    fontSize: 12,
    fontWeight: '400',
    color: colors.textSecondary,
  },
  mediaButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.s,
    marginTop: spacing.s,
  },
  mediaButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.s,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  thumbnailButton: {
    width: 40,
    height: 40,
    borderRadius: borderRadius.s,
    overflow: 'hidden',
    backgroundColor: colors.background,
  },
  thumbnailImage: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailContainer: {
    width: '100%',
    height: '100%',
    backgroundColor: colors.almostBlack,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  videoThumbnail: {
    width: '100%',
    height: '100%',
  },
  videoThumbnailOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoRecordingIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
    zIndex: 10,
  },
  recordingIndicator: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  recordingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.error,
  },
  recordingTimerContainer: {
    position: 'absolute',
    top: -30,
    left: 0,
  },
  recordingTimer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.s,
    gap: spacing.xs,
  },
  recordingTimerText: {
    fontSize: 12,
    fontWeight: '600',
    color: colors.white,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImageContainer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageDeleteButton: {
    position: 'absolute',
    bottom: 50,
    alignSelf: 'center',
    backgroundColor: colors.error,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
  },
  imageDeleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.white,
  },
  videoViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoViewerCloseButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    zIndex: 1000,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingModalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  loadingModalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    padding: spacing.xl,
    alignItems: 'center',
    minWidth: 200,
  },
  loadingModalText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
    marginTop: spacing.m,
    textAlign: 'center',
  },
  loadingModalSubText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  videoPlayer: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  addStepButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: borderRadius.s,
    borderWidth: 2,
    borderColor: colors.primary,
    gap: spacing.s,
  },
  addStepButtonText: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.primary,
  },
  addStepIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  loadingText: {
    marginTop: spacing.m,
    fontSize: 16,
    color: colors.textSecondary,
  },
  stepMediaPreview: {
    width: '100%',
    aspectRatio: 1,
    marginTop: spacing.m,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
  },
  stepMediaPreviewImage: {
    width: '100%',
    height: '100%',
  },
  videoPreviewOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
});

export default PostRecipeScreen;

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  Modal,
  TextInput,
  Animated,
  ActivityIndicator,
  Easing,
  ImageStyle,
  TextStyle,
  Platform,
  Dimensions,
  BackHandler,
  KeyboardAvoidingView,
  StatusBar,
  FlatList,
  Keyboard,
  Alert,
} from 'react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Avatar from '../../components/common/Avatar';
import ImageWithLottie from '../../components/common/ImageWithLottie';
import {colors, spacing, borderRadius, typography} from '../../styles/commonStyles';
import {RecipeAPI, AdAPI, ReportAPI} from '../../api/ApiRequests';
import RecipeCardAd from '../../components/ads/RecipeCardAd';
import Video from 'react-native-video';
import {BottomSheetMenu} from '../../components/common';
import {useSelector} from 'react-redux';
import {RootState} from '../../redux';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {useAlert} from '../../contexts/AlertContext';
import {formatIngredientAmount} from '../../utils/numberFormatter';

import {API_BASE_URL, WEB_BASE_URL} from '../../config/api';

type CommentNode = {
  comment_id: string;
  parent_comment_id?: string | null;
  content: string;
  created_at?: string;
  user?: {
    user_id?: string;
    nickname?: string;
    profile_image_url?: string | null;
  };
  sub_comments?: CommentNode[];
  isPending?: boolean;
};

type PendingComment = {
  tempId: string;
  parentId: string | null;
  content: string;
};

const appendCommentToTree = (
  list: CommentNode[],
  parentId: string | null,
  newComment: CommentNode,
): {list: CommentNode[]; inserted: boolean} => {
  const preparedComment: CommentNode = {
    ...newComment,
    sub_comments: newComment.sub_comments ? [...newComment.sub_comments] : [],
  };

  if (!parentId) {
    return {list: [...list, preparedComment], inserted: true};
  }

  let inserted = false;
  const nextList = list.map(comment => {
    if (comment.comment_id === parentId) {
      inserted = true;
      const subComments = comment.sub_comments ? [...comment.sub_comments, preparedComment] : [preparedComment];
      return {...comment, sub_comments: subComments};
    }

    if (comment.sub_comments?.length) {
      const result = appendCommentToTree(comment.sub_comments, parentId, preparedComment);
      if (result.inserted) {
        inserted = true;
        return {...comment, sub_comments: result.list};
      }
    }

    return comment;
  });

  if (!inserted) {
    return {list: [...list, preparedComment], inserted: true};
  }

  return {list: nextList, inserted};
};

const replaceCommentInTree = (
  list: CommentNode[],
  targetId: string,
  updater: (comment: CommentNode) => CommentNode,
): {list: CommentNode[]; updated: boolean} => {
  let updated = false;

  const nextList = list.map(comment => {
    if (comment.comment_id === targetId) {
      updated = true;
      return updater(comment);
    }

    if (comment.sub_comments?.length) {
      const result = replaceCommentInTree(comment.sub_comments, targetId, updater);
      if (result.updated) {
        updated = true;
        return {...comment, sub_comments: result.list};
      }
    }

    return comment;
  });

  return {list: nextList, updated};
};

const removeCommentFromTree = (
  list: CommentNode[],
  targetId: string,
): {list: CommentNode[]; removed: boolean} => {
  let removed = false;

  const filtered = list
    .map(comment => {
      if (comment.comment_id === targetId) {
        removed = true;
        return null;
      }

      if (comment.sub_comments?.length) {
        const result = removeCommentFromTree(comment.sub_comments, targetId);
        if (result.removed) {
          removed = true;
          return {...comment, sub_comments: result.list};
        }
      }

      return comment;
    })
    .filter(Boolean) as CommentNode[];

  return {list: filtered, removed};
};

const countCommentsDeep = (list: CommentNode[]): number =>
  list.reduce(
    (acc, comment) =>
      acc + 1 + (comment.sub_comments && comment.sub_comments.length ? countCommentsDeep(comment.sub_comments) : 0),
    0,
  );

const formatDateTime = (isoString?: string) => {
  if (!isoString) {
    return '';
  }
  const date = new Date(isoString);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleString();
};

interface RecipeDetailModalProps {
  visible: boolean;
  onClose: () => void;
  recipeId?: string;
  recipe?: any;
  onRecipeDeleted?: (recipeId: string) => void;
  onUserProfilePress?: (userId: string, nickname: string) => void;
}

interface IngredientItem {
  id: string;
  name: string;
  value: string;
  unit: string;
}

const RecipeDetailModal: React.FC<RecipeDetailModalProps> = ({
  visible,
  onClose,
  recipeId,
  recipe: recipeProp,
  onRecipeDeleted,
  onUserProfilePress,
}) => {
  const {alert, confirm} = useAlert();
  const navigation = useNavigation<any>();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<'ingredients' | 'recipe' | 'comments'>('ingredients');
  const [commentText, setCommentText] = useState('');
  const [isImageCollapsed, setIsImageCollapsed] = useState(false);
  const [isImageViewerVisible, setIsImageViewerVisible] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const imageHeight = useRef(new Animated.Value(260)).current;
  const topSectionHeight = useRef(new Animated.Value(1)).current; // 0: 숨김, 1: 보임 (opacity)
  const [currentImageIndex, setCurrentImageIndex] = useState(0); // 현재 보고 있는 이미지 인덱스
  const [viewerImageIndex, setViewerImageIndex] = useState(0); // 전체화면 뷰어의 이미지 인덱스
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detail, setDetail] = useState<any | null>(recipeProp || null);
  const [playingStepIndex, setPlayingStepIndex] = useState<number | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportReasonMenuVisible, setReportReasonMenuVisible] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const likeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingLikeState = useRef<{recipeId: string; liked: boolean} | null>(null);
  const [comments, setComments] = useState<CommentNode[]>([]);
  const commentTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingCommentsRef = useRef<PendingComment[]>([]);
  const [replyTarget, setReplyTarget] = useState<{comment_id: string; nickname: string} | null>(null);
  const commentInputRef = useRef<TextInput>(null);
  const commentsScrollViewRef = useRef<ScrollView>(null);
  const [recipeCardAd, setRecipeCardAd] = useState<any | null>(null); // 레시피 카드 광고 (1개만)
  const recipeCardAdRateLimiter = useRef({lastLoadTime: 0, loading: false}).current; // Rate limiter
  const loadedRecipeIdRef = useRef<string | null>(null); // 이미 로드한 레시피 ID 추적
  const currentRecipePostId = useMemo(
    () =>
      detail?.recipe_post_id ||
      detail?.id ||
      recipeProp?.recipe_post_id ||
      recipeProp?.id ||
      recipeId ||
      null,
    [detail?.recipe_post_id, detail?.id, recipeProp?.recipe_post_id, recipeProp?.id, recipeId],
  );

  const collapseImage = () => {
    if (!isImageCollapsed) {
      setIsImageCollapsed(true);
      Animated.timing(imageHeight, {
        toValue: 26,
        duration: 180,
        useNativeDriver: false,
      }).start();
    }
  };

  const expandImage = () => {
    if (isImageCollapsed) {
      setIsImageCollapsed(false);
      Animated.timing(imageHeight, {
        toValue: 260,
        duration: 220,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      }).start();
    }
  };

  // 탭 전환 핸들러 (탭 전환 시 이미지 축소)
  const handleTabChange = (tab: 'ingredients' | 'recipe' | 'comments') => {
    setActiveTab(tab);
    
    // 댓글 탭이 아닌 다른 탭으로 이동 시 키보드 숨김
    if (tab !== 'comments') {
      Keyboard.dismiss();
    }
    
    if (!isImageCollapsed) {
      collapseImage();
    }
  };

  useEffect(() => {
    let isMounted = true;

    const fetchDetail = async () => {
      if (!visible) {
        return;
      }

      if (recipeProp) {
        setDetail(recipeProp);
        return;
      }

      if (!recipeId) {
        setDetail(null);
        return;
      }

      try {
        setLoading(true);
        setErrorMessage(null);
        const response = await RecipeAPI.getRecipeDetail(recipeId);
        if (!isMounted) {
          return;
        }

        if (response?.success && response.data) {
          setDetail(response.data);
        } else {
          setDetail(null);
          setErrorMessage(response?.message || '레시피 정보를 불러오지 못했습니다.');
        }
      } catch (error) {
        console.error('레시피 상세 조회 오류:', error);
        if (isMounted) {
          setDetail(null);
          setErrorMessage('레시피 정보를 불러오지 못했습니다.');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDetail();

    return () => {
      isMounted = false;
    };
  }, [recipeId, recipeProp, visible]);

  useEffect(() => {
    if (!visible) {
      setCommentText('');
      setMenuVisible(false);
      setImageError(false); // 이미지 에러 상태 초기화
      setCurrentImageIndex(0); // 이미지 인덱스 초기화
      setViewerImageIndex(0); // 뷰어 인덱스 초기화
      // 모달이 닫힐 때 광고 초기화
      setRecipeCardAd(null);
      loadedRecipeIdRef.current = null;
      setIsKeyboardVisible(false);
    }
  }, [visible]);

  // 키보드 이벤트 리스너
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setIsKeyboardVisible(true);
        // 댓글 탭일 때만 topSection 숨김
        if (activeTab === 'comments') {
          Animated.timing(topSectionHeight, {
            toValue: 0,
            duration: 250,
            useNativeDriver: false,
          }).start();
        }
      },
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        // topSection 다시 표시
        Animated.timing(topSectionHeight, {
          toValue: 1,
          duration: 250,
          useNativeDriver: false,
        }).start();
      },
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, [activeTab, topSectionHeight]);

  // 탭 변경 시 키보드 상태에 따라 topSection 표시/숨김
  useEffect(() => {
    if (activeTab === 'comments' && isKeyboardVisible) {
      // 댓글 탭이고 키보드가 표시되어 있으면 topSection 숨김
      Animated.timing(topSectionHeight, {
        toValue: 0,
        duration: 250,
        useNativeDriver: false,
      }).start();
    } else if (!isKeyboardVisible) {
      // 키보드가 숨겨져 있으면 topSection 표시
      Animated.timing(topSectionHeight, {
        toValue: 1,
        duration: 250,
        useNativeDriver: false,
      }).start();
    }
  }, [activeTab, isKeyboardVisible, topSectionHeight]);
  
  // detail이 변경되면 이미지 에러 상태 초기화
  useEffect(() => {
    setImageError(false);
  }, [detail?.recipe_post_id, detail?.id]);

  /**
   * 레시피 카드 광고 로드 (레시피 상세가 로드될 때 한 번만)
   */
  useEffect(() => {
    // 모달이 보이지 않거나 레시피 ID가 없으면 스킵
    if (!visible || !currentRecipePostId) {
      return;
    }

    // 이미 같은 레시피의 광고를 로드했다면 스킵
    if (loadedRecipeIdRef.current === currentRecipePostId) {
      return;
    }

    // Rate limiting 체크 (5초 간격)
    const now = Date.now();
    if (recipeCardAdRateLimiter.loading || now - recipeCardAdRateLimiter.lastLoadTime < 5000) {
      return;
    }

    const loadRecipeCardAd = async () => {
      try {
        recipeCardAdRateLimiter.loading = true;
        recipeCardAdRateLimiter.lastLoadTime = now;
        
        const response = await AdAPI.getRecipeCardAd(currentRecipePostId);
        if (response.success && response.data) {
          setRecipeCardAd(response.data);
          loadedRecipeIdRef.current = currentRecipePostId;
        }
      } catch (error: any) {
        // 429 에러는 조용히 처리
        if (error?.response?.status !== 429) {
          console.error('❌ [RecipeDetailModal] 레시피 카드 광고 로드 실패:', error);
        }
      } finally {
        recipeCardAdRateLimiter.loading = false;
      }
    };

    loadRecipeCardAd();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, currentRecipePostId]); // detail이 변경될 때만 실행

  const isOwnRecipe = useMemo(() => {
    const ownerId = detail?.user?.user_id || recipeProp?.user?.user_id;
    return !!ownerId && ownerId === currentUser?.user_id;
  }, [detail?.user?.user_id, recipeProp?.user?.user_id, currentUser?.user_id]);

  const flushPendingLike = useCallback(async () => {
    const pending = pendingLikeState.current;
    if (!pending) {
      return;
    }

    pendingLikeState.current = null;
    if (likeTimeoutRef.current) {
      clearTimeout(likeTimeoutRef.current);
      likeTimeoutRef.current = null;
    }

    try {
      if (pending.liked) {
        await RecipeAPI.likeRecipe(pending.recipeId);
      } else {
        await RecipeAPI.unlikeRecipe(pending.recipeId);
      }
    } catch (error) {
      console.error('❌ [RecipeDetailModal] 좋아요 동기화 실패:', error);
      alert('오류', '좋아요 상태를 저장하지 못했습니다. 다시 시도해 주세요.');

      if (currentRecipePostId === pending.recipeId) {
        setIsLiked(prev => {
          if (prev === pending.liked) {
            return !pending.liked;
          }
          return prev;
        });
        setLikeCount(prev => {
          return Math.max(0, prev + (pending.liked ? -1 : 1));
        });
      }
    }
  }, [currentRecipePostId]);

  const flushPendingComments = useCallback(async () => {
    if (commentTimeoutRef.current) {
      clearTimeout(commentTimeoutRef.current);
      commentTimeoutRef.current = null;
    }

    if (!currentRecipePostId) {
      pendingCommentsRef.current = [];
      return;
    }

    if (pendingCommentsRef.current.length === 0) {
      return;
    }

    const toSend = pendingCommentsRef.current.slice();
    pendingCommentsRef.current = [];

    for (const pending of toSend) {
      try {
        const response = await RecipeAPI.createComment(currentRecipePostId, {
          content: pending.content,
          parent_comment_id: pending.parentId || undefined,
        });

        if (response?.success && response.data) {
          const formatted: CommentNode = {
            ...response.data,
            sub_comments: response.data.sub_comments || [],
            isPending: false,
          };

          setComments(prev => {
            const result = replaceCommentInTree(prev, pending.tempId, () => formatted);
            return result.updated ? result.list : prev;
          });
        } else {
          setComments(prev => {
            const result = removeCommentFromTree(prev, pending.tempId);
            return result.removed ? result.list : prev;
          });

          if (response?.message) {
            alert('오류', response.message);
          }
        }
      } catch (error) {
        console.error('❌ [RecipeDetailModal] 댓글 동기화 실패:', error);
        setComments(prev => {
          const result = removeCommentFromTree(prev, pending.tempId);
          return result.removed ? result.list : prev;
        });
        alert('오류', '댓글 작성 중 문제가 발생했습니다.');
      }
    }
  }, [currentRecipePostId]);

  useEffect(() => {
    pendingCommentsRef.current = [];
    if (commentTimeoutRef.current) {
      clearTimeout(commentTimeoutRef.current);
      commentTimeoutRef.current = null;
    }

    if (detail) {
      const liked = detail.is_liked ?? detail.isLiked ?? detail.liked ?? false;
      setLikeCount(detail.like_count ?? detail.likeCount ?? 0);
      setIsLiked(!!liked);
      setComments(detail.comments || []);
      return;
    }

    if (recipeProp) {
      const liked = recipeProp.is_liked ?? recipeProp.isLiked ?? recipeProp.liked ?? false;
      setLikeCount(recipeProp.like_count ?? recipeProp.likeCount ?? 0);
      setIsLiked(!!liked);
      setComments(recipeProp.comments || []);
      return;
    }

    setLikeCount(0);
    setIsLiked(false);
    setComments([]);
  }, [detail, recipeProp]);

  useEffect(() => {
    if (!visible) {
      flushPendingLike();
      flushPendingComments();
    }
  }, [visible, flushPendingComments, flushPendingLike]);

  useEffect(() => {
    return () => {
      flushPendingLike();
      flushPendingComments();
    };
  }, [flushPendingComments, flushPendingLike]);

  // Android 뒤로가기 버튼 처리
  useFocusEffect(
    useCallback(() => {
      if (!visible) {
        return;
      }

      const onBackPress = () => {
        onClose();
        return true; // 기본 동작 방지
      };

      if (Platform.OS === 'android') {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
      }
    }, [visible, onClose]),
  );

  const convertMediaUrl = (path?: string | null) => {
    if (!path) {
      return null;
    }
    if (typeof path !== 'string') {
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

  const data = useMemo(() => {
    const source = detail || recipeProp;
    if (!source) {
      return null;
    }

    const recipeImages =
      source.recipe_images?.map((img: any) => convertMediaUrl(img.image_url)) ||
      source.images?.map((img: any) => convertMediaUrl(img?.image_url || img?.uri)) ||
      [];

    const ingredients =
      (source.ingredients as IngredientItem[])?.map((ing: any) => ({
        id: (ing.ingredient_id ?? ing.id ?? Math.random().toString()).toString(),
        name: ing.name || '',
        value:
          typeof ing.quantity === 'number'
            ? ing.quantity.toString()
            : ing.value || '',
        unit: ing.unit || '',
      })) || [];

    const steps =
      source.recipe_steps?.map((step: any) => ({
        description: step.instruction || step.description || '',
        imageUrl: convertMediaUrl(step.image_url || step.imageUrl || null),
        videoUrl: convertMediaUrl(step.video_url || step.videoUrl || null),
      })) ||
      source.steps ||
      [];

    return {
      id: currentRecipePostId || recipeId || source.id || source.recipe_post_id || 'recipe',
      author: {
        userId: source.user?.user_id || source.author?.userId || null,
        name: source.user?.nickname || source.author?.name || '이웃',
        avatar: source.user?.profile_image_url
          ? convertMediaUrl(source.user.profile_image_url)
          : source.author?.avatar
          ? (typeof source.author.avatar === 'string' ? convertMediaUrl(source.author.avatar) : undefined)
          : undefined,
      },
      title: source.title || '레시피',
      subtitle: source.description || '',
      likeCount: source.like_count ?? source.likeCount ?? 0,
      images: recipeImages.filter(Boolean),
      ingredients,
      steps,
      comments: source.comments || [],
    };
  }, [detail, recipeId, recipeProp, currentRecipePostId]);

  const handleLikeToggle = () => {
    if (!currentRecipePostId) {
      return;
    }

    if (!currentUser?.user_id) {
      alert('로그인이 필요합니다', '좋아요 기능은 로그인 후 이용할 수 있습니다.');
      return;
    }

    const nextLiked = !isLiked;
    setIsLiked(nextLiked);
    setLikeCount(prev => Math.max(0, prev + (nextLiked ? 1 : -1)));

    if (likeTimeoutRef.current) {
      clearTimeout(likeTimeoutRef.current);
      likeTimeoutRef.current = null;
    }

    pendingLikeState.current = {recipeId: currentRecipePostId, liked: nextLiked};
    likeTimeoutRef.current = setTimeout(() => {
      flushPendingLike();
    }, 5000);
  };

  const navigateToEdit = useCallback(() => {
    if (!detail) {
      return;
    }

    const relations = detail.relations || {};

    onClose();
    navigation.navigate('Upload', {
      screen: 'Category',
      params: {
        mode: 'edit',
        recipePostId: detail.recipe_post_id || detail.id || recipeId,
        initialRecipeName: detail.title || '',
        initialSituationId: relations.situation_id ?? null,
        initialMethodId: relations.cooking_method_id ?? null,
        initialMainIngredientIds: relations.main_ingredient_ids || [],
        recipeDetail: detail,
      },
    });
  }, [detail, navigation, onClose, recipeId]);

  const handleDelete = useCallback(async () => {
    const targetId = detail?.recipe_post_id || detail?.id || recipeId;
    if (!targetId) {
      return;
    }

    try {
      setActionLoading(true);
      const response = await RecipeAPI.deleteRecipe(targetId);
      if (response?.success) {
        onRecipeDeleted?.(targetId);
        onClose();
      } else if (response?.message) {
        alert('오류', response.message);
      }
    } catch (error) {
      console.error('❌ [RecipeDetailModal] 레시피 삭제 실패:', error);
      alert('오류', '레시피 삭제 중 문제가 발생했습니다.');
    } finally {
      setActionLoading(false);
    }
  }, [detail?.id, detail?.recipe_post_id, onRecipeDeleted, onClose, recipeId]);

  const confirmDelete = useCallback(async () => {
    // useAlert를 사용하여 플랫폼별 최적 Alert 표시
    const confirmed = await confirm(
      '레시피 삭제',
      '정말 이 레시피를 삭제하시겠어요?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
        },
      ],
    );
    
    if (confirmed) {
      handleDelete();
    }
  }, [handleDelete, confirm]);

  const handleShare = useCallback(() => {
    if (!currentRecipePostId) {
      alert('오류', '레시피 정보를 불러올 수 없습니다.');
      return;
    }

    // babpleWeb 공유 링크 생성
    const shareUrl = `${WEB_BASE_URL}/share/${currentRecipePostId}`;
    
    // 클립보드에 복사
    Clipboard.setString(shareUrl);
    
    // 토스트 메시지 표시
    alert('복사 완료', '클립 보드에 복사되었어요!');
  }, [currentRecipePostId, alert]);

  const menuOptions = useMemo(
    () =>
      isOwnRecipe
        ? [
            {id: 'edit', icon: 'edit', label: '수정하기'},
            {id: 'share', icon: 'share-2', label: '공유하기'},
            {id: 'delete', icon: 'trash-2', label: '삭제하기', color: colors.error},
          ]
        : [
            {id: 'share', icon: 'share-2', label: '공유하기'},
            {id: 'report', icon: 'alert-triangle', label: '신고하기', color: colors.error},
          ],
    [isOwnRecipe],
  );

  const handleMenuOption = useCallback(
    (optionId: string) => {
      if (optionId === 'edit') {
        navigateToEdit();
        return;
      }

      if (optionId === 'delete') {
        confirmDelete();
        return;
      }

      if (optionId === 'share') {
        handleShare();
        return;
      }

      if (optionId === 'report') {
        setReportReasonMenuVisible(true);
      }
    },
    [confirmDelete, navigateToEdit, handleShare],
  );

  /**
   * 게시글 신고 처리
   */
  const handleReportRecipe = useCallback(async (reason: string) => {
    if (!detail && !recipeProp) {
      await alert('오류', '게시글 정보를 찾을 수 없습니다.');
      return;
    }

    const recipePostId = currentRecipePostId;
    const reportedUserId = detail?.user?.user_id || recipeProp?.user?.user_id;

    if (!recipePostId) {
      await alert('오류', '게시글 ID를 찾을 수 없습니다.');
      return;
    }

    if (!reportedUserId) {
      await alert('오류', '작성자 정보를 찾을 수 없습니다.');
      return;
    }

    try {
      const response = await ReportAPI.reportUser(
        reportedUserId,
        reason,
        undefined,
        'POST',
        recipePostId,
      );

      if (response?.success) {
        await alert('완료', '신고가 접수되었습니다. 검토 후 처리하겠습니다.');
        setReportReasonMenuVisible(false);
      } else {
        await alert('오류', response?.message || '신고 처리에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('게시글 신고 오류:', error);
      await alert('오류', error?.response?.data?.message || '신고 처리 중 오류가 발생했습니다.');
    }
  }, [detail, recipeProp, currentRecipePostId, alert]);

  const totalCommentCount = useMemo(() => countCommentsDeep(comments), [comments]);

  const handleStartReply = useCallback(
    (comment: CommentNode) => {
      if (!currentUser?.user_id) {
        alert('로그인이 필요합니다', '댓글 기능은 로그인 후 이용할 수 있습니다.');
        return;
      }

      setReplyTarget({
        comment_id: comment.comment_id,
        nickname: comment.user?.nickname || '이웃',
      });

      setTimeout(() => {
        commentInputRef.current?.focus();
      }, 100);
    },
    [currentUser?.user_id],
  );

  const cancelReplyTarget = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const handleSendComment = useCallback(() => {
    const trimmed = commentText.trim();

    if (!currentUser?.user_id) {
      alert('로그인이 필요합니다', '댓글 기능은 로그인 후 이용할 수 있습니다.');
      return;
    }

    if (!trimmed) {
      return;
    }

    if (!currentRecipePostId) {
      alert('오류', '레시피 정보를 찾을 수 없습니다.');
      return;
    }

    const parentId = replyTarget?.comment_id ?? null;
    const tempId = `temp-${Date.now()}`;
    const optimistic: CommentNode = {
      comment_id: tempId,
      parent_comment_id: parentId,
      content: trimmed,
      created_at: new Date().toISOString(),
      user: {
        user_id: currentUser.user_id,
        nickname: currentUser?.nickname || '나',
        profile_image_url: currentUser?.profile_image_url || null,
      },
      sub_comments: [],
      isPending: true,
    };

    setComments(prev => {
      const result = appendCommentToTree(prev, parentId, optimistic);
      return result.inserted ? result.list : prev;
    });

    setCommentText('');
    setReplyTarget(null);

    // 댓글 작성 후 스크롤을 맨 아래로 이동 (댓글 탭일 때만)
    if (activeTab === 'comments') {
      setTimeout(() => {
        commentsScrollViewRef.current?.scrollToEnd({animated: true});
      }, 100);
    }

    pendingCommentsRef.current.push({
      tempId,
      parentId,
      content: trimmed,
    });

    if (commentTimeoutRef.current) {
      clearTimeout(commentTimeoutRef.current);
    }

    commentTimeoutRef.current = setTimeout(() => {
      flushPendingComments();
    }, 1000);
  }, [commentText, currentRecipePostId, currentUser?.nickname, currentUser?.profile_image_url, currentUser?.user_id, flushPendingComments, replyTarget, activeTab]);

  const renderCommentItem = (comment: CommentNode, depth: number = 0): React.ReactNode => {
    const avatarUri = comment.user?.profile_image_url
      ? convertMediaUrl(comment.user.profile_image_url) || comment.user.profile_image_url
      : undefined;
    const avatarSource = avatarUri ? {uri: avatarUri} : undefined;

    return (
      <View key={comment.comment_id} style={depth > 0 ? styles.subCommentWrapper : undefined}>
        <View style={[styles.commentItem, depth > 0 && styles.commentItemReply]}>
          <TouchableOpacity
            style={styles.commentHeader}
            onPress={() => {
              if (onUserProfilePress && comment.user?.user_id) {
                onUserProfilePress(comment.user.user_id, comment.user.nickname || '이웃');
              }
            }}
            disabled={!onUserProfilePress || !comment.user?.user_id}>
            <Avatar size={32} source={avatarSource} />
            <View style={styles.commentHeaderText}>
              <Text style={styles.commentUserName}>{comment.user?.nickname || '이웃'}</Text>
              <Text style={styles.commentTimeAgo}>
                {comment.isPending ? '전송 대기 중' : formatDateTime(comment.created_at)}
              </Text>
            </View>
          </TouchableOpacity>
          <View style={styles.commentBubbleWrapper}>
            <View
              style={[
                styles.commentBubble,
                depth > 0 && styles.commentBubbleReply,
                comment.isPending && styles.commentBubblePending,
              ]}>
              <Text style={styles.commentText}>{comment.content}</Text>
            </View>
            <TouchableOpacity style={styles.replyButton} onPress={() => handleStartReply(comment)}>
              <Text style={styles.replyButtonText}>답글 달기</Text>
            </TouchableOpacity>
          </View>
        </View>
        {comment.sub_comments && comment.sub_comments.length > 0 ? (
          <View style={styles.subCommentsContainer}>
            {comment.sub_comments.map(sub => renderCommentItem(sub, depth + 1))}
          </View>
        ) : null}
      </View>
    );
  };

  const renderCommentsSection = () => {
    if (comments.length === 0) {
      return <Text style={styles.emptyText}>첫 번째 댓글을 남겨보세요.</Text>;
    }

    return comments.map(comment => renderCommentItem(comment));
  };

  // 완성 사진 여러 장 스와이프 기능
  const renderTopSection = () => {
    if (!data) {
      return null;
    }

    const images = data.images?.filter(Boolean) || [];
    const hasMultipleImages = images.length > 1;

    const animatedTopSectionStyle = {
      opacity: topSectionHeight,
      maxHeight: topSectionHeight.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1000], // 충분히 큰 값으로 설정
      }),
      overflow: 'hidden' as const,
    };

    return (
      <Animated.View style={animatedTopSectionStyle}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            // topSection 전체를 터치하면 사진이 원래 크기로 돌아옴
            if (isImageCollapsed) {
              expandImage();
            }
          }}>
          <View style={styles.topSection}>
          <Animated.View style={[styles.imageContainer, {height: imageHeight}]}>
            {images.length > 0 && !imageError ? (
              <View style={styles.imageCarouselContainer}>
                <FlatList
                  data={images}
                  horizontal
                  pagingEnabled
                  showsHorizontalScrollIndicator={false}
                  onMomentumScrollEnd={(event) => {
                    const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                    setCurrentImageIndex(index);
                  }}
                  renderItem={({item: imageUri}) => (
                    <TouchableOpacity
                      activeOpacity={1}
                      onPress={() => {
                        // 사진이 원래 크기일 때만 전체화면으로 줌
                        if (!isImageCollapsed) {
                          setViewerImageIndex(currentImageIndex);
                          setIsImageViewerVisible(true);
                        }
                      }}
                      style={styles.carouselImageContainer}>
                      <ImageWithLottie
                        source={{uri: imageUri}}
                        style={styles.coverImage as ImageStyle}
                        resizeMode="cover"
                        onError={() => {
                          console.warn('❌ [RecipeDetailModal] 이미지 로딩 실패:', imageUri);
                          setImageError(true);
                        }}
                      />
                    </TouchableOpacity>
                  )}
                  keyExtractor={(item, index) => `image-${index}`}
                />
                {hasMultipleImages && (
                  <View style={styles.imageIndicatorContainer}>
                    {images.map((_: any, index: number) => (
                      <View
                        key={`indicator-${index}`}
                        style={[
                          styles.imageIndicator,
                          currentImageIndex === index && styles.imageIndicatorActive,
                        ]}
                      />
                    ))}
                  </View>
                )}
              </View>
            ) : (
              <View style={styles.coverPlaceholder}>
                <Icon name="image" size={32} color={colors.textSecondary} />
                {imageError && (
                  <Text style={styles.placeholderText}>이미지를 불러올 수 없습니다{'\n'}(이미지가 너무 큽니다)</Text>
                )}
              </View>
            )}
          </Animated.View>

          {/* 작성자 */}
          <TouchableOpacity
            style={styles.authorRow}
            onPress={() => {
              if (onUserProfilePress && data.author?.userId) {
                onUserProfilePress(data.author.userId, data.author.name || '이웃');
              }
            }}
            disabled={!onUserProfilePress || !data.author?.userId}>
          <View style={styles.avatarCircle}>
            {data.author?.avatar ? (
              <Avatar
                size={36}
                source={
                  typeof data.author.avatar === 'string'
                    ? {uri: data.author.avatar}
                    : data.author.avatar
                }
              />
            ) : (
              <Icon name="user" size={18} color={colors.textSecondary} />
            )}
          </View>
          <Text style={styles.authorName}>{data.author?.name || '이웃'}</Text>
        </TouchableOpacity>

        {/* 제목/부제목 */}
        <Text style={styles.title}>{data.title}</Text>
        {data.subtitle ? <Text style={styles.subtitle}>{data.subtitle}</Text> : null}

        {/* 좋아요 버튼 */}
        <View style={styles.likeRow}>
          <TouchableOpacity
            style={[styles.likePill, isLiked && styles.likePillActive]}
            onPress={handleLikeToggle}>
            <Icon
              name="heart"
              size={16}
              color={isLiked ? colors.white : colors.primary}
            />
            <Text style={[styles.likePillText, isLiked && styles.likePillTextActive]}>
              {likeCount} 맛있어요!
            </Text>
          </TouchableOpacity>
        </View>

          {/* 구분선 */}
          <View style={styles.divider} />
        </View>
      </TouchableOpacity>
      </Animated.View>
    );
  };

  const renderBody = () => {
    if (!data) {
      return null;
    }

    return (
      <View style={styles.bodyContainer}>
        {renderTopSection()}

        <TouchableOpacity
          activeOpacity={1}
          onPress={() => {
            if (!isImageCollapsed) {
              collapseImage();
            }
          }}>
          <View style={styles.tabsRow}>
            <TouchableOpacity onPress={() => handleTabChange('ingredients')}>
              <Text style={[styles.tabText, activeTab === 'ingredients' ? styles.tabActive : undefined]}>재료</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('recipe')}>
              <Text style={[styles.tabText, activeTab === 'recipe' ? styles.tabActive : undefined]}>레시피</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleTabChange('comments')}>
              <Text style={[styles.tabText, activeTab === 'comments' ? styles.tabActive : undefined]}>댓글</Text>
            </TouchableOpacity>
          </View>
        </TouchableOpacity>

        <ScrollView
          ref={commentsScrollViewRef}
          style={styles.bottomScroll}
          contentContainerStyle={styles.bottomScrollContent}
          showsVerticalScrollIndicator={false}
          onScrollBeginDrag={() => {
            if (!isImageCollapsed) {
              collapseImage();
            }
          }}
          onTouchStart={() => {
            if (!isImageCollapsed) {
              collapseImage();
            }
          }}>
          {activeTab === 'ingredients' && (
            <View style={styles.sectionContainer}>
              <Text style={styles.sectionTitle}>필요한 재료</Text>
              <View style={styles.ingredientCard}>
                {data.ingredients.map((ing, idx) => (
                  <View
                    key={ing.id}
                    style={[
                      styles.ingredientRow,
                      idx !== data.ingredients.length - 1 && styles.ingredientRowDivider,
                    ]}>
                    <Text style={styles.ingredientName}>{ing.name}</Text>
                    <Text style={styles.ingredientAmount}>
                      {formatIngredientAmount(ing.value, ing.unit)}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {activeTab === 'recipe' && (
            <View style={styles.sectionContainer}>
              {data.steps.map((step: any, i: number) => {
                const stepDescription =
                  typeof step === 'string' ? step : step.description || '';
                const stepImageUrl =
                  typeof step === 'string'
                    ? null
                    : step.imageUrl
                    ? {uri: step.imageUrl}
                    : null;
                const stepVideoUrl =
                  typeof step === 'string'
                    ? null
                    : step.videoUrl
                    ? {uri: step.videoUrl}
                    : null;
                const isPlaying = playingStepIndex === i;

                return (
                  <React.Fragment key={i}>
                    <View style={styles.stepCard}>
                      <Text style={styles.stepTitle}>Step {i + 1}</Text>
                      <View style={styles.stepDescriptionContainer}>
                        <Text style={styles.stepDescription}>{stepDescription}</Text>
                      </View>
                      {stepImageUrl ? (
                        <ImageWithLottie 
                          source={stepImageUrl} 
                          style={styles.stepImage as ImageStyle} 
                          resizeMode="contain"
                          // 외부 URL 이미지의 원본 화질 유지
                          // React Native가 자동으로 이미지를 최적화하지 않도록
                        />
                      ) : stepVideoUrl ? (
                        <TouchableOpacity
                          activeOpacity={0.8}
                          onPress={() =>
                            setPlayingStepIndex(prev => (prev === i ? null : i))
                          }
                          style={styles.videoWrapper}>
                          <Video
                            source={stepVideoUrl}
                            style={styles.stepVideo}
                            paused={!isPlaying}
                            resizeMode="contain"
                            repeat
                          />
                          <View style={styles.videoOverlay}>
                            <Icon
                              name={isPlaying ? 'pause' : 'play'}
                              size={20}
                              color={colors.white}
                            />
                          </View>
                        </TouchableOpacity>
                      ) : null}
                    </View>
                    
                    {/* 첫 번째 step 다음에만 광고 삽입 (1개만) */}
                    {i === 0 && recipeCardAd && (
                      <RecipeCardAd
                        key="recipe-card-ad"
                        creative_id={recipeCardAd.creative_id}
                        ad_title={recipeCardAd.ad_title}
                        ad_image_url={recipeCardAd.ad_image_url}
                        landing_page_url={recipeCardAd.landing_page_url}
                        creater_name={recipeCardAd.creater_name}
                        recipe_post_id={currentRecipePostId || undefined}
                      />
                    )}
                  </React.Fragment>
                );
              })}
            </View>
          )}

          {activeTab === 'comments' && (
            <View style={styles.commentsContainer}>
              <Text style={styles.commentsHeader}>댓글 ({totalCommentCount}개)</Text>
              {renderCommentsSection()}
            </View>
          )}
        </ScrollView>
      </View>
    );
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      presentationStyle="fullScreen" 
      onRequestClose={onClose}
      statusBarTranslucent={false}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        <View style={styles.headerWrapper}>
          <View style={[styles.header, {paddingTop: insets.top + spacing.m}]}>
            <TouchableOpacity onPress={onClose}>
              <Icon name="chevron-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMenuVisible(true)}>
              <Icon name="more-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        {loading && (
          <View style={styles.loadingWrapper}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        )}

        {!loading && errorMessage && !data && (
          <View style={styles.loadingWrapper}>
            <Text style={styles.errorText}>{errorMessage}</Text>
          </View>
        )}

        {!loading && data && renderBody()}

        {activeTab === 'comments' && data && (
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
            <View style={styles.commentInputContainer}>
              <View style={styles.commentInputBox}>
                {replyTarget && (
                  <View style={styles.replyInfoRow}>
                    <Text style={styles.replyInfoText}>
                      @{replyTarget.nickname} 님에게 답글 작성 중
                    </Text>
                    <TouchableOpacity onPress={cancelReplyTarget} style={styles.replyInfoCancel}>
                      <Icon name="x" size={16} color={colors.textSecondary} />
                    </TouchableOpacity>
                  </View>
                )}
                <TextInput
                  ref={commentInputRef}
                  style={styles.commentInput}
                  placeholder={
                    replyTarget
                      ? `@${replyTarget.nickname} 님에게 답글을 남겨보세요.`
                      : '댓글을 입력하세요.'
                  }
                  placeholderTextColor={colors.textTertiary}
                  value={commentText}
                  onChangeText={setCommentText}
                  returnKeyType="send"
                  onSubmitEditing={handleSendComment}
                />
              </View>
              <TouchableOpacity
                style={styles.sendButton}
                onPress={handleSendComment}
                disabled={!commentText.trim()}>
                <Icon
                  name="send"
                  size={20}
                  color={commentText.trim() ? colors.primary : colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
      <BottomSheetMenu
        visible={menuVisible}
        options={menuOptions}
        onClose={() => setMenuVisible(false)}
        onOptionPress={handleMenuOption}
      />
      {actionLoading && (
        <View style={styles.actionOverlay}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      )}

      {/* 전체화면 이미지 뷰어 */}
      {data?.images?.length > 0 && (
        <Modal
          visible={isImageViewerVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setIsImageViewerVisible(false)}>
          <View style={styles.imageViewerContainer}>
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                onPress={() => setIsImageViewerVisible(false)}
                style={styles.imageViewerCloseButton}>
                <Icon name="x" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={data!.images}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={viewerImageIndex}
              getItemLayout={(itemData: any, index: number) => ({
                length: Dimensions.get('window').width,
                offset: Dimensions.get('window').width * index,
                index,
              })}
              onMomentumScrollEnd={(event) => {
                const index = Math.round(event.nativeEvent.contentOffset.x / Dimensions.get('window').width);
                setViewerImageIndex(index);
              }}
              renderItem={({item: imageUri}) => (
                <TouchableOpacity
                  activeOpacity={1}
                  onPress={() => setIsImageViewerVisible(false)}
                  style={styles.imageViewerImageWrapper}>
                  <ImageWithLottie
                    source={{uri: imageUri}}
                    style={styles.imageViewerImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}
              keyExtractor={(item, index) => `viewer-image-${index}`}
            />
            {data!.images.length > 1 && (
              <View style={styles.imageViewerIndicatorContainer}>
                {data!.images.map((_: any, index: number) => (
                  <View
                    key={`viewer-indicator-${index}`}
                    style={[
                      styles.imageViewerIndicator,
                      viewerImageIndex === index && styles.imageViewerIndicatorActive,
                    ]}
                  />
                ))}
              </View>
            )}
          </View>
        </Modal>
      )}

      {/* 신고 사유 선택 메뉴 */}
      <BottomSheetMenu
        visible={reportReasonMenuVisible}
        options={[
          {id: 'cancel', icon: 'x', label: '취소'},
          {id: 'spam', icon: 'alert-triangle', label: '스팸/홍보', color: colors.error},
          {id: 'inappropriate', icon: 'alert-triangle', label: '부적절한 콘텐츠', color: colors.error},
          {id: 'harassment', icon: 'alert-triangle', label: '욕설/혐오 표현', color: colors.error},
          {id: 'sexual_content', icon: 'alert-triangle', label: '성적인 표현', color: colors.error},
          {id: 'child_safety', icon: 'alert-triangle', label: '아동 보호 정책 위반', color: colors.error},
          {id: 'other', icon: 'alert-triangle', label: '기타', color: colors.error},
        ]}
        onClose={() => setReportReasonMenuVisible(false)}
        onOptionPress={async item => {
          if (item === 'cancel') {
            return;
          }

          const reasonMap: {[key: string]: string} = {
            spam: '스팸/홍보',
            inappropriate: '부적절한 콘텐츠',
            harassment: '욕설/혐오 표현',
            sexual_content: '성적인 표현',
            child_safety: '아동 보호 정책 위반',
            other: '기타',
          };

          const reason = reasonMap[item] || '기타';
          await handleReportRecipe(reason);
        }}
      />
    </Modal>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  headerWrapper: {
    backgroundColor: colors.white,
    zIndex: 10,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    minHeight: 56,
  },
  bodyContainer: {
    flex: 1,
  },
  topSection: {
    backgroundColor: colors.white,
  },
  bottomScroll: {
    flex: 1,
  },
  bottomScrollContent: {
    paddingBottom: spacing.xl,
  },
  imageContainer: {
    width: '100%',
    overflow: 'hidden',
  },
  imageCarouselContainer: {
    position: 'relative',
    width: '100%',
    height: '100%',
  },
  carouselImageContainer: {
    width: Dimensions.get('window').width,
    height: '100%',
  },
  coverImage: {
    width: '100%',
    height: 260,
    backgroundColor: colors.background,
    borderRadius: borderRadius.m,
  } as ImageStyle,
  coverPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    gap: spacing.s,
  },
  imageIndicatorContainer: {
    position: 'absolute',
    bottom: spacing.m,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
  },
  imageIndicator: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageIndicatorActive: {
    backgroundColor: colors.white,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  placeholderText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: spacing.s,
  },
  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  avatarCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.s,
  },
  authorName: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  } as TextStyle,
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    lineHeight: 30,
    color: colors.textPrimary,
    paddingHorizontal: spacing.l,
    marginTop: spacing.s,
    textAlign: 'center',
  } as TextStyle,
  subtitle: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    paddingHorizontal: spacing.l,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
  likeRow: {
    paddingHorizontal: spacing.l,
    marginTop: spacing.m,
    alignItems: 'center',
  },
  likePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    backgroundColor: colors.white,
    borderRadius: borderRadius.full,
    borderWidth: 1,
    borderColor: colors.lightGray,
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  likePillActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  likePillText: {
    ...typography.bodyRegular,
    color: colors.primary,
    fontWeight: 'bold',
  } as TextStyle,
  likePillTextActive: {
    color: colors.white,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginVertical: spacing.l,
    marginHorizontal: spacing.l,
  },
  tabsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingVertical: spacing.s,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  tabText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  } as TextStyle,
  tabActive: {
    color: colors.primary,
    fontWeight: 'bold',
  } as TextStyle,
  sectionContainer: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    textAlign: 'center',
    marginBottom: spacing.m,
  } as TextStyle,
  ingredientCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    borderWidth: 1,
    borderColor: colors.lightGray,
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    overflow: 'hidden',
  },
  ingredientRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    backgroundColor: colors.white,
  },
  ingredientRowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  ingredientName: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  } as TextStyle,
  ingredientAmount: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    fontWeight: 'bold',
  } as TextStyle,
  stepCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.s,
    borderWidth: 2,
    borderColor: 'transparent',
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textSecondary,
    marginBottom: spacing.s,
  } as TextStyle,
  stepDescriptionContainer: {
    backgroundColor: colors.backgroundPress,
    borderRadius: borderRadius.s,
    minHeight: 100,
    padding: spacing.m,
  },
  stepDescription: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    lineHeight: 24,
    marginBottom: spacing.m,
  },
  stepImage: {
    width: '100%',
    minHeight: 300,
    maxHeight: 500,
    borderRadius: borderRadius.m,
    marginTop: spacing.m,
  },
  stepVideo: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: borderRadius.m,
    backgroundColor: colors.almostBlack,
  },
  videoWrapper: {
    width: '100%',
    marginTop: spacing.m,
  },
  videoOverlay: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    paddingVertical: spacing.l,
  },
  commentsContainer: {
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.xl,
  },
  commentsHeader: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginBottom: spacing.l,
  } as TextStyle,
  commentItem: {
    marginBottom: spacing.l,
  },
  commentItemReply: {
    marginBottom: spacing.l,
  },
  commentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  commentHeaderText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.s,
    gap: spacing.s,
  },
  commentUserName: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    fontWeight: 'bold',
  } as TextStyle,
  commentTimeAgo: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  } as TextStyle,
  commentBubbleWrapper: {
    marginLeft: 44,
    gap: spacing.xs,
  },
  commentBubble: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  commentBubbleReply: {
    backgroundColor: colors.background,
  },
  commentBubblePending: {
    opacity: 0.6,
  },
  commentText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    lineHeight: 22,
    marginBottom: spacing.s,
  } as TextStyle,
  replyButton: {
    alignSelf: 'flex-end',
    paddingHorizontal: spacing.xs,
  },
  replyButtonText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  } as TextStyle,
  commentInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    backgroundColor: colors.white,
    gap: spacing.s,
  },
  commentInputBox: {
    flex: 1,
    gap: spacing.xs,
  },
  replyInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  replyInfoText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  replyInfoCancel: {
    padding: spacing.xs,
  },
  commentInput: {
    flexGrow: 1,
    width: '100%',
    ...typography.bodyRegular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    paddingVertical: Platform.OS === 'ios' ? spacing.s : spacing.xs,
    minHeight: 40,
    textAlignVertical: 'center',
  } as TextStyle,
  sendButton: {
    padding: spacing.xs,
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.m,
  },
  imageViewerCloseButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImageWrapper: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: Dimensions.get('window').width,
    height: Dimensions.get('window').height,
  },
  imageViewerIndicatorContainer: {
    position: 'absolute',
    bottom: spacing.xl * 2,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.s,
  },
  imageViewerIndicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },
  imageViewerIndicatorActive: {
    backgroundColor: colors.white,
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subCommentsContainer: {
    marginLeft: spacing.xl,
    marginTop: spacing.m,
    marginBottom: spacing.l,
    gap: spacing.m,
  },
  subCommentWrapper: {
    marginLeft: spacing.xl,
  },
  subCommentItem: {
    marginBottom: spacing.m,
  },
  subCommentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  subCommentHeaderText: {
    flexDirection: 'row',
    alignItems: 'center',
    marginLeft: spacing.xs,
    gap: spacing.xs,
  },
  subCommentUserName: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  subCommentTimeAgo: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  subCommentBubble: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.s,
    marginLeft: 36,
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subCommentText: {
    fontSize: 14,
    color: colors.textPrimary,
    lineHeight: 20,
  } as TextStyle,
  loadingWrapper: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  } as TextStyle,
});

export default RecipeDetailModal;




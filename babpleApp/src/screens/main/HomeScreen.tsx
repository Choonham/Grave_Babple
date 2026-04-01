import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, RefreshControl, BackHandler, Platform } from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ScreenWrapper from '../../components/common/ScreenWrapper';
import { BottomSheetMenu, LottieSpinner } from '../../components/common';
import FeedCard from '../../components/feed/FeedCard';
import UserProfileScreen from '../profile/UserProfileScreen';
import RecipeDetailModal from '../post/RecipeDetailModal';
import NotificationListScreen from './notification/NotificationListScreen';
import ChatListScreen from './chat/ChatListScreen';
import { colors, spacing, typography, borderRadius } from '../../styles/commonStyles';
import { RecipeAPI, ChatAPI, NotificationAPI, AdAPI, ReportAPI } from '../../api/ApiRequests';
import FeedAdCard from '../../components/ads/FeedAdCard';
import { useSelector } from 'react-redux';
import { RootState } from '../../redux';
import { useNavigation } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useRef } from 'react';
import { useRateLimiter } from '../../utils/rateLimiter';
import { useAlert } from '../../contexts/AlertContext';
import { API_BASE_URL } from '../../config/api';
import firebaseService from '../../services/FirebaseService';
import { buildMediaUrl } from '../../utils/imageUtils';
import { requestPermission } from '../../utils/permission';

interface FeedItem {
  recipe_post_id: string;
  title: string;
  description?: string;
  like_count: number;
  comment_count: number;
  images: string[];
  user: {
    user_id: string;
    nickname: string;
    profile_image_url?: string | null;
  } | null;
}

/**
 * 홈 화면 (피드)
 */
const HomeScreen: React.FC = () => {
  const navigation = useNavigation<any>();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const { alert, confirm } = useAlert();
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedPost, setSelectedPost] = useState<{
    isOwnPost: boolean;
    postId: string;
    userId?: string;
  } | null>(null);
  const [isUserProfileVisible, setIsUserProfileVisible] = useState(false);
  const [selectedUserNickname, setSelectedUserNickname] = useState('');
  const [selectedUserId, setSelectedUserId] = useState('');
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [isChatListVisible, setIsChatListVisible] = useState(false);
  const [isNotificationVisible, setIsNotificationVisible] = useState(false);
  const [feedItems, setFeedItems] = useState<FeedItem[]>([]);
  const [loadingFeed, setLoadingFeed] = useState(true);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [feedAds, setFeedAds] = useState<Map<number, any>>(new Map()); // 인덱스별 광고 저장
  const [initialChatRoomId, setInitialChatRoomId] = useState<string | undefined>(undefined);
  const [initialNotificationId, setInitialNotificationId] = useState<string | undefined>(undefined);
  const [chatToastVisible, setChatToastVisible] = useState(false);
  const [chatToastMessage, setChatToastMessage] = useState('');
  const [chatToastSenderName, setChatToastSenderName] = useState('');
  const [chatToastRoomId, setChatToastRoomId] = useState<string | null>(null);
  const [notificationToastVisible, setNotificationToastVisible] = useState(false);
  const [notificationToastMessage, setNotificationToastMessage] = useState('');
  const [notificationToastData, setNotificationToastData] = useState<any>(null);
  const feedAdRateLimiter = useRateLimiter(5000); // 5초마다 한 번만 광고 로드 (더 엄격하게)
  const loadingAdIndicesRef = useRef<Set<number>>(new Set()); // 로딩 중인 광고 인덱스 추적
  const loadedAdIndicesRef = useRef<Set<number>>(new Set()); // 이미 로드된 광고 인덱스 추적 (중복 방지)
  const hasInitialAdLoadRef = useRef(false); // 초기 광고 로드 여부 추적
  const prevChatListVisibleRef = useRef(false); // 이전 채팅 화면 표시 상태
  const prevNotificationVisibleRef = useRef(false); // 이전 알림 화면 표시 상태
  const canExitRef = useRef(false); // 앱 종료 가능 여부

  const loadFeed = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoadingFeed(true);
      }
      setFeedError(null);
      const response = await RecipeAPI.getFeed();
      if (response?.success && Array.isArray(response.data)) {
        const formatted = response.data.map((item: FeedItem) => {
          const profilePhoto = item?.user?.profile_image_url
            ? buildMediaUrl(item.user.profile_image_url)
            : null;

          // buildMediaUrl에서 이미 iOS 캐시 처리를 하므로 추가 처리 불필요
          const images = (item.images || [])
            .map(img => buildMediaUrl(img))
            .filter(Boolean) as string[];

          return {
            ...item,
            images,
            user: item.user
              ? {
                ...item.user,
                profile_image_url: profilePhoto,
              }
              : null,
          };
        });
        setFeedItems(formatted);
      } else {
        setFeedItems([]);
      }
    } catch (error) {
      console.error('❌ [HomeScreen] 피드 로딩 실패:', error);
      setFeedError('피드를 불러오지 못했습니다.');
    } finally {
      if (showLoading) {
        setLoadingFeed(false);
      }
    }
  }, []);

  // 초기 로드 (마운트 시 한 번만 실행)
  useEffect(() => {
    loadFeed();

    // 알림 권한 요청 (JIT - 홈 진입 시)
    const checkNotificationPermission = async () => {
      // 차단되었을 때만 설정으로 유도하는 메시지 표시 (시스템 팝업이 뜨는 상황에서는 뜨지 않음)
      await requestPermission('notification', {
        title: '알림 설정',
        message: '채팅 및 서비스 알림을 받으려면 알림 권한이 필요합니다. 설정에서 알림을 허용해주세요.',
      });
    };
    checkNotificationPermission();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 읽지 않은 채팅 메시지 개수 조회
  const loadUnreadChatCount = useCallback(async () => {
    try {
      const response = await ChatAPI.getRooms();
      if (response?.success && Array.isArray(response.data)) {
        const totalUnread = response.data.reduce(
          (sum: number, room: { unread_count?: number }) => sum + (room.unread_count || 0),
          0,
        );
        setUnreadChatCount(totalUnread);
      }
    } catch (error) {
      console.error('읽지 않은 채팅 개수 조회 오류:', error);
    }
  }, []);

  // 읽지 않은 알림 개수 조회
  const loadUnreadNotificationCount = useCallback(async () => {
    try {
      const response = await NotificationAPI.getUnreadCount();
      if (response?.success && response.data?.count !== undefined) {
        setUnreadNotificationCount(response.data.count);
      }
    } catch (error: any) {
      // 429 에러(Too Many Requests)는 조용히 처리 (rate limit)
      if (error?.response?.status === 429) {
        // rate limit에 걸렸을 때는 조용히 무시
        return;
      }
      // 다른 에러는 경고로만 로깅
      console.warn('읽지 않은 알림 개수 조회 오류:', error?.message || error);
    }
  }, []);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);

    // 광고 인덱스 초기화 (새로고침 시에만)
    loadedAdIndicesRef.current.clear();
    loadingAdIndicesRef.current.clear();
    hasInitialAdLoadRef.current = false; // 새로고침 시 초기 로드 플래그도 리셋
    setFeedAds(new Map());

    await loadFeed(false);

    // 읽지 않은 채팅 및 알림 개수도 새로고침
    await Promise.all([loadUnreadChatCount(), loadUnreadNotificationCount()]);
    setRefreshing(false);

    // 새로고침 후 광고는 메인 useEffect가 처리하도록 함 (지연 없이)
  }, [loadFeed, loadUnreadChatCount, loadUnreadNotificationCount]);

  // Firebase 푸시 알림 핸들러 등록
  useEffect(() => {
    // 채팅 알림 핸들러
    firebaseService.registerNotificationHandler('chat', (data) => {
      console.log('📱 [HomeScreen] 채팅 알림 수신:', data);
      // 읽지 않은 채팅 개수 새로고침
      loadUnreadChatCount();

      // 강제 이동 대신 토스트 알림 표시
      if (data.roomId) {
        const senderName = data.senderName || data.senderNickname || '알 수 없음';
        const message = data.message || '새 메시지';
        setChatToastSenderName(senderName);
        setChatToastMessage(message);
        setChatToastRoomId(data.roomId);
        setChatToastVisible(true);

        // 5초 후 자동으로 토스트 숨김
        setTimeout(() => {
          setChatToastVisible(false);
        }, 5000);
      }
    });

    // 일반 알림 핸들러
    firebaseService.registerNotificationHandler('notification', (data) => {
      console.log('📱 [HomeScreen] 알림 수신:', data);
      // 읽지 않은 알림 개수 새로고침
      loadUnreadNotificationCount();

      // 토스트로 알림 표시 (강제 모달 제거)
      const message = data.message || data.title || '새 알림이 있습니다';
      setNotificationToastMessage(message);
      setNotificationToastData(data);
      setNotificationToastVisible(true);

      // 5초 후 자동으로 토스트 숨김
      setTimeout(() => {
        setNotificationToastVisible(false);
      }, 5000);
    });

    return () => {
      // 컴포넌트 언마운트 시 핸들러 제거
      firebaseService.unregisterNotificationHandler('chat');
      firebaseService.unregisterNotificationHandler('notification');
    };
  }, [isChatListVisible, isNotificationVisible, loadUnreadChatCount, loadUnreadNotificationCount]);

  // 화면 포커스 시 읽지 않은 채팅 및 알림 개수 조회 (자동 새로고침 제거)
  useFocusEffect(
    useCallback(() => {
      loadUnreadChatCount();
      loadUnreadNotificationCount();
      // 자동 새로고침 제거 - 사용자가 명시적으로 새로고침할 때만 업데이트
    }, [loadUnreadChatCount, loadUnreadNotificationCount]),
  );

  // 화면 포커스가 해제될 때 (다른 탭으로 이동할 때) 모달 닫기
  useFocusEffect(
    useCallback(() => {
      // 포커스 해제 시 실행되는 cleanup 함수
      return () => {
        // 다른 탭으로 이동할 때 열려있는 모달들을 닫음
        if (isChatListVisible) {
          setIsChatListVisible(false);
          setInitialChatRoomId(undefined);
        }
        if (isNotificationVisible) {
          setIsNotificationVisible(false);
          setInitialNotificationId(undefined);
        }
        if (isUserProfileVisible) {
          setIsUserProfileVisible(false);
        }
        if (modalVisible) {
          setModalVisible(false);
        }
      };
    }, [isChatListVisible, isNotificationVisible, isUserProfileVisible, modalVisible]),
  );

  // 채팅 화면이 닫힐 때 개수 새로고침
  useEffect(() => {
    const wasVisible = prevChatListVisibleRef.current;
    prevChatListVisibleRef.current = isChatListVisible;

    // 모달이 열렸다가 닫힌 경우에만 개수 새로고침
    if (wasVisible && !isChatListVisible) {
      loadUnreadChatCount();
    }
  }, [isChatListVisible, loadUnreadChatCount]);

  // 알림 화면이 닫힐 때 개수 새로고침
  useEffect(() => {
    const wasVisible = prevNotificationVisibleRef.current;
    prevNotificationVisibleRef.current = isNotificationVisible;

    // 모달이 열렸다가 닫힌 경우에만 개수 새로고침
    if (wasVisible && !isNotificationVisible) {
      loadUnreadNotificationCount();
    }
  }, [isNotificationVisible, loadUnreadNotificationCount]);

  /**
   * 피드 광고 로드 (특정 인덱스에 삽입할 광고)
   */
  const loadFeedAd = useCallback(async (index: number) => {
    // 이미 로딩 중이거나 이미 로드된 광고는 스킵
    if (loadingAdIndicesRef.current.has(index) || loadedAdIndicesRef.current.has(index)) {
      return;
    }

    await feedAdRateLimiter.execute(async () => {
      try {
        loadingAdIndicesRef.current.add(index);
        const response = await AdAPI.getFeedAd();
        if (response.success && response.data) {
          loadedAdIndicesRef.current.add(index); // 로드 완료 표시
          setFeedAds(prev => {
            // 이미 로드된 광고인지 다시 확인
            if (prev.has(index)) {
              return prev;
            }
            const newMap = new Map(prev);
            newMap.set(index, response.data);
            return newMap;
          });
        }
      } catch (error: any) {
        // 429 에러는 조용히 처리하고, 다음 광고 로드를 시도하지 않음
        if (error?.response?.status !== 429) {
          console.error('❌ [HomeScreen] 피드 광고 로드 실패:', error);
        }
      } finally {
        loadingAdIndicesRef.current.delete(index);
      }
    });
    // feedAds를 dependency에서 제거하여 무한 루프 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedAdRateLimiter]);

  const formattedFeed = useMemo(
    () =>
      feedItems.map((item, index) => {
        const isOwnPost = !!(currentUser?.user_id && item.user?.user_id === currentUser.user_id);
        return {
          ...item,
          isOwnPost,
          index,
        };
      }),
    [feedItems, currentUser?.user_id],
  );

  /**
   * 피드 아이템과 광고를 섞어서 표시
   * 3개 피드마다 1개 광고 삽입
   */
  const feedWithAds = useMemo(() => {
    const result: Array<{ type: 'feed' | 'ad'; data: any; index?: number }> = [];

    formattedFeed.forEach((item, index) => {
      // 피드 아이템 추가
      result.push({ type: 'feed', data: item, index: item.index });

      // 3개 피드마다 광고 삽입 (마지막 아이템 제외)
      if ((index + 1) % 3 === 0 && index < formattedFeed.length - 1) {
        const adIndex = index + 1;
        const ad = feedAds.get(adIndex);
        if (ad) {
          result.push({ type: 'ad', data: ad, index: adIndex });
        }
      }
    });

    return result;
  }, [formattedFeed, feedAds]);

  /**
   * 광고가 필요한 인덱스에 대해 광고 로드
   * 피드가 처음 로드될 때만 실행되도록 최적화
   */
  useEffect(() => {
    // 피드가 없거나 이미 초기 광고 로드를 완료했으면 스킵
    if (formattedFeed.length === 0 || hasInitialAdLoadRef.current) {
      return;
    }

    // 이미 광고를 로드했거나 로딩 중이면 스킵
    if (loadedAdIndicesRef.current.size > 0 || loadingAdIndicesRef.current.size > 0) {
      return;
    }

    // 필요한 광고 인덱스 계산 (3개 피드마다 1개 광고)
    const neededAdIndices: number[] = [];
    formattedFeed.forEach((item, index) => {
      if ((index + 1) % 3 === 0 && index < formattedFeed.length - 1) {
        const adIndex = index + 1;
        neededAdIndices.push(adIndex);
      }
    });

    // 한 번에 하나씩만 로드 (첫 번째 필요한 광고만)
    if (neededAdIndices.length > 0) {
      hasInitialAdLoadRef.current = true;
      loadFeedAd(neededAdIndices[0]);
    }
    // 피드 길이만 의존성으로 두되, ref로 중복 실행 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feedItems.length]);

  /**
   * 메뉴 열기
   */
  const handleMenuPress = (postId: string, isOwnPost: boolean, userId?: string) => {
    setSelectedPost({ isOwnPost, postId, userId });
    setMenuVisible(true);
  };

  /**
   * 메뉴 옵션 처리
   */
  const handleOptionPress = async (optionId: string) => {
    if (!selectedPost?.postId) {
      setMenuVisible(false);
      return;
    }

    const targetPostId = selectedPost.postId;
    const targetUserId = selectedPost.userId;
    setMenuVisible(false);

    if (optionId === 'edit') {
      handleEditRecipe(targetPostId);
      return;
    }

    if (optionId === 'delete') {
      confirmDeleteRecipe(targetPostId);
      return;
    }

    if (optionId === 'hide') {
      if (!targetUserId) {
        await alert('사용자 정보를 찾을 수 없습니다.', '오류');
        return;
      }
      try {
        setActionLoading(true);
        const response = await ReportAPI.hideUser(targetUserId);
        if (response?.success) {
          await alert('사용자가 숨김 처리되었습니다.', '완료');
          // 피드 새로고침
          await loadFeed(false);
        } else {
          await alert(response?.message || '숨김 처리에 실패했습니다.', '오류');
        }
      } catch (error: any) {
        console.error('사용자 숨김 처리 오류:', error);
        await alert(error?.response?.data?.message || '숨김 처리 중 오류가 발생했습니다.', '오류');
      } finally {
        setActionLoading(false);
      }
      return;
    }

    if (optionId === 'report') {
      if (!targetUserId) {
        await alert('사용자 정보를 찾을 수 없습니다.', '오류');
        return;
      }
      if (!targetPostId) {
        await alert('게시글 정보를 찾을 수 없습니다.', '오류');
        return;
      }
      // 신고 사유 선택 모달
      await alert(
        '신고 사유를 선택해주세요.',
        '신고 사유 선택',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '스팸/홍보',
            onPress: () => handleReportPost(targetUserId, targetPostId, '스팸/홍보'),
          },
          {
            text: '부적절한 콘텐츠',
            onPress: () => handleReportPost(targetUserId, targetPostId, '부적절한 콘텐츠'),
          },
          {
            text: '욕설/혐오 표현',
            onPress: () => handleReportPost(targetUserId, targetPostId, '욕설/혐오 표현'),
          },
          {
            text: '성적인 표현',
            onPress: () => handleReportPost(targetUserId, targetPostId, '성적인 표현'),
          },
          {
            text: '아동 보호 정책 위반',
            onPress: () => handleReportPost(targetUserId, targetPostId, '아동 보호 정책 위반'),
          },
          {
            text: '기타',
            onPress: () => handleReportPostWithDetail(targetUserId, targetPostId),
          },
        ],
      );
      return;
    }

    console.log(`옵션 선택: ${optionId}, 게시글 ID: ${targetPostId}`);
  };

  /**
   * 사용자 신고 (사유만)
   */
  const handleReportUser = async (userId: string, reason: string) => {
    try {
      setActionLoading(true);
      const response = await ReportAPI.reportUser(userId, reason);
      if (response?.success) {
        await alert('신고가 접수되었습니다. 검토 후 처리하겠습니다.', '완료');
      } else {
        await alert(response?.message || '신고 처리에 실패했습니다.', '오류');
      }
    } catch (error: any) {
      console.error('사용자 신고 오류:', error);
      await alert(error?.response?.data?.message || '신고 처리 중 오류가 발생했습니다.', '오류');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 사용자 신고 (상세 내용 포함)
   */
  const handleReportUserWithDetail = (userId: string) => {
    // 상세 내용 입력을 위한 Alert.prompt는 React Native에서 제한적이므로
    // 간단한 Alert로 처리하거나 별도 모달을 만들어야 함
    // 여기서는 기본 사유로 처리
    handleReportUser(userId, '기타');
  };

  /**
   * 게시글 신고 처리
   */
  const handleReportPost = async (userId: string, postId: string, reason: string) => {
    try {
      setActionLoading(true);
      const response = await ReportAPI.reportUser(userId, reason, undefined, 'POST', postId);
      if (response?.success) {
        await alert('신고가 접수되었습니다. 검토 후 처리하겠습니다.', '완료');
      } else {
        await alert(response?.message || '신고 처리에 실패했습니다.', '오류');
      }
    } catch (error: any) {
      console.error('게시글 신고 오류:', error);
      await alert(error?.response?.data?.message || '신고 처리 중 오류가 발생했습니다.', '오류');
    } finally {
      setActionLoading(false);
    }
  };

  /**
   * 게시글 신고 (상세 내용 포함)
   */
  const handleReportPostWithDetail = (userId: string, postId: string) => {
    // 상세 내용 입력을 위한 Alert.prompt는 React Native에서 제한적이므로
    // 간단한 Alert로 처리하거나 별도 모달을 만들어야 함
    // 여기서는 기본 사유로 처리
    handleReportPost(userId, postId, '기타');
  };

  /**
   * 본인 게시글 메뉴 옵션
   */
  const getOwnPostMenuOptions = () => [
    { id: 'edit', icon: 'edit', label: '수정하기' },
    { id: 'delete', icon: 'trash-2', label: '삭제하기', color: colors.error },
  ];

  /**
   * 타인 게시글 메뉴 옵션
   */
  const getOtherPostMenuOptions = () => [
    { id: 'share', icon: 'share-2', label: '공유하기' },
    { id: 'hide', icon: 'eye-off', label: '이 사용자 숨기기' },
    { id: 'report', icon: 'alert-triangle', label: '신고하기', color: colors.error },
  ];

  const handleEditRecipe = async (postId: string) => {
    try {
      setActionLoading(true);
      const response = await RecipeAPI.getRecipeDetail(postId);
      if (response?.success && response.data) {
        navigation.navigate('Upload', {
          screen: 'Category',
          params: {
            mode: 'edit',
            recipePostId: postId,
            initialRecipeName: response.data.title || '',
            initialSituationId: response.data.relations?.situation_id ?? null,
            initialMethodId: response.data.relations?.cooking_method_id ?? null,
            initialMainIngredientIds: response.data.relations?.main_ingredient_ids ?? [],
            recipeDetail: response.data,
          },
        });
      } else {
        await alert(response?.message || '레시피 정보를 불러오지 못했습니다.', '알림');
      }
    } catch (error) {
      console.error('❌ [HomeScreen] 레시피 수정 데이터 로드 실패:', error);
      await alert('레시피 정보를 불러오지 못했습니다.', '오류');
    } finally {
      setSelectedPost(null);
      setActionLoading(false);
    }
  };

  const confirmDeleteRecipe = async (postId: string) => {
    const shouldDelete = await confirm('정말 이 레시피를 삭제하시겠어요?', '레시피 삭제');
    if (shouldDelete) {
      handleDeleteRecipe(postId);
    } else {
      setSelectedPost(null);
    }
  };

  const handleDeleteRecipe = async (postId: string) => {
    try {
      setActionLoading(true);
      const response = await RecipeAPI.deleteRecipe(postId);
      if (response?.success) {
        setFeedItems(prev => prev.filter(item => item.recipe_post_id !== postId));
      } else {
        await alert(response?.message || '레시피 삭제에 실패했습니다.', '알림');
      }
    } catch (error) {
      console.error('❌ [HomeScreen] 레시피 삭제 실패:', error);
      await alert('레시피 삭제 중 오류가 발생했습니다.', '오류');
    } finally {
      setSelectedPost(null);
      setActionLoading(false);
    }
  };

  const handleRecipeDeletedFromModal = (postId: string) => {
    setFeedItems(prev => prev.filter(item => item.recipe_post_id !== postId));
    if (selectedRecipeId === postId) {
      setModalVisible(false);
    }
  };

  return (
    <ScreenWrapper>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Babple</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setIsNotificationVisible(true)}>
            <Icon name="bell" size={24} color={colors.textPrimary} />
            {unreadNotificationCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadNotificationCount > 9 ? '9+' : unreadNotificationCount.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIcon} onPress={() => setIsChatListVisible(true)}>
            <Icon name="send" size={24} color={colors.textPrimary} />
            {unreadChatCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>
                  {unreadChatCount > 9 ? '9+' : unreadChatCount.toString()}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* 피드 리스트 */}
      <ScrollView
        style={styles.feedList}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[colors.primary]}
            tintColor={colors.primary}
          />
        }>
        {loadingFeed ? (
          <View style={styles.loadingContainer}>
            <LottieSpinner size="large" />
          </View>
        ) : feedError ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{feedError}</Text>
          </View>
        ) : formattedFeed.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>아직 등록된 레시피가 없어요.</Text>
          </View>
        ) : (
          feedWithAds.map((item, displayIndex) => {
            if (item.type === 'ad') {
              return (
                <FeedAdCard
                  key={`ad-${item.data.creative_id}-${item.index}`}
                  creative_id={item.data.creative_id}
                  ad_title={item.data.ad_title}
                  ad_body={item.data.ad_body}
                  ad_image_url={item.data.ad_image_url}
                  landing_page_url={item.data.landing_page_url}
                  creater_name={item.data.creater_name}
                  creater_image_url={item.data.creater_image_url}
                />
              );
            }

            const feedItem = item.data;
            return (
              <FeedCard
                key={feedItem.recipe_post_id}
                nickname={feedItem.user?.nickname || '이웃'}
                isOwnPost={feedItem.isOwnPost}
                images={feedItem.images.length > 0 ? feedItem.images : [require('../../../assets/dev/images/feed01.png')]}
                title={feedItem.title}
                description={feedItem.description || ''}
                likeCount={feedItem.like_count ?? 0}
                commentCount={feedItem.comment_count ?? 0}
                profilePhotoUrl={feedItem.user?.profile_image_url || undefined}
                userId={feedItem.user?.user_id}
                onPress={() => {
                  setSelectedRecipeId(feedItem.recipe_post_id);
                  setModalVisible(true);
                }}
                onMenuPress={() => handleMenuPress(feedItem.recipe_post_id, feedItem.isOwnPost, feedItem.user?.user_id)}
                onUserProfilePress={(userId, nickname) => {
                  if (userId && currentUser?.user_id && userId === currentUser.user_id) {
                    // 자기 자신인 경우 마이페이지로 이동
                    navigation.navigate('Profile');
                  } else if (userId) {
                    // 다른 유저인 경우 UserProfileScreen 표시
                    setSelectedUserId(userId);
                    setSelectedUserNickname(nickname);
                    setIsUserProfileVisible(true);
                  }
                }}
              />
            );
          })
        )}
      </ScrollView>

      {/* 하단 메뉴 */}
      <BottomSheetMenu
        visible={menuVisible}
        options={
          selectedPost?.isOwnPost
            ? getOwnPostMenuOptions()
            : getOtherPostMenuOptions()
        }
        onClose={() => setMenuVisible(false)}
        onOptionPress={handleOptionPress}
      />

      {/* 유저 프로필 화면 */}
      <UserProfileScreen
        visible={isUserProfileVisible}
        userId={selectedUserId}
        userName={selectedUserNickname}
        onClose={() => setIsUserProfileVisible(false)}
      />

      {/* RecipeDetailModal */}
      <RecipeDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        recipeId={selectedRecipeId}
        onRecipeDeleted={handleRecipeDeletedFromModal}
        onUserProfilePress={(userId, nickname) => {
          if (userId && currentUser?.user_id && userId === currentUser.user_id) {
            // 자기 자신인 경우 마이페이지로 이동
            setModalVisible(false);
            navigation.navigate('Profile');
          } else if (userId) {
            // 다른 유저인 경우 UserProfileScreen 표시
            setModalVisible(false);
            setSelectedUserId(userId);
            setSelectedUserNickname(nickname);
            setIsUserProfileVisible(true);
          }
        }}
      />

      {actionLoading && (
        <View style={styles.actionOverlay}>
          <LottieSpinner size="large" />
        </View>
      )}

      {/* 채팅 목록 화면 (설정 화면과 동일한 오버레이 방식) */}
      <ChatListScreen
        visible={isChatListVisible}
        onClose={() => {
          setIsChatListVisible(false);
          setInitialChatRoomId(undefined); // 닫을 때 초기화
        }}
        initialRoomId={initialChatRoomId}
        onInitialRoomProcessed={() => {
          // initialRoomId 처리가 완료되면 즉시 초기화 (한 번만 사용)
          setInitialChatRoomId(undefined);
        }}
      />

      {/* 알림 목록 화면 */}
      <NotificationListScreen
        visible={isNotificationVisible}
        onClose={() => {
          setIsNotificationVisible(false);
          setInitialNotificationId(undefined); // 닫을 때 초기화
        }}
        initialNotificationId={initialNotificationId}
      />

      {/* 채팅 토스트 알림 */}
      {chatToastVisible && chatToastRoomId && (
        <TouchableOpacity
          style={styles.chatToastContainer}
          activeOpacity={0.8}
          onPress={() => {
            // 토스트 터치 시 채팅 화면으로 이동
            setChatToastVisible(false);
            setInitialChatRoomId(chatToastRoomId);
            setIsChatListVisible(true);
          }}
        >
          <View style={styles.chatToastContent}>
            <Text style={styles.chatToastSenderName}>{chatToastSenderName}</Text>
            <Text style={styles.chatToastMessage} numberOfLines={2}>
              {chatToastMessage}
            </Text>
          </View>
        </TouchableOpacity>
      )}

      {/* 일반 알림 토스트 */}
      {notificationToastVisible && (
        <TouchableOpacity
          style={styles.notificationToastContainer}
          activeOpacity={0.8}
          onPress={() => {
            // 토스트 터치 시 알림 화면으로 이동
            setNotificationToastVisible(false);

            // 알림 ID가 있으면 해당 알림으로 스크롤
            if (notificationToastData?.notificationId) {
              setInitialNotificationId(notificationToastData.notificationId);
            }

            setIsNotificationVisible(true);
          }}
        >
          <View style={styles.notificationToastContent}>
            <Icon name="bell" size={18} color={colors.primary} style={styles.notificationToastIcon} />
            <Text style={styles.notificationToastMessage} numberOfLines={2}>
              {notificationToastMessage}
            </Text>
          </View>
        </TouchableOpacity>
      )}
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  headerIcon: {
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: colors.error,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.white,
  },
  feedList: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  emptyText: {
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatToastContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.m,
    right: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  chatToastContent: {
    flexDirection: 'column',
  },
  chatToastSenderName: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.primary,
    marginBottom: spacing.xs,
  },
  chatToastMessage: {
    ...typography.bodySmall,
    color: colors.textPrimary,
  },
  notificationToastContainer: {
    position: 'absolute',
    top: 60,
    left: spacing.m,
    right: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  notificationToastContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  notificationToastIcon: {
    marginRight: spacing.s,
  },
  notificationToastMessage: {
    ...typography.bodySmall,
    color: colors.textPrimary,
    flex: 1,
  },
});

export default HomeScreen;


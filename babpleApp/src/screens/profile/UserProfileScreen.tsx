import React, {useState, useRef, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  useWindowDimensions,
  Image,
  Modal,
  Dimensions,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSelector} from 'react-redux';
import {RootState} from '../../redux';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import Avatar from '../../components/common/Avatar';
import BottomSheetMenu from '../../components/common/BottomSheetMenu';
import FollowerListScreen from './FollowerListScreen';
import FollowingListScreen from './FollowingListScreen';
import RecipeDetailModal from '../post/RecipeDetailModal';
import UnfollowModal from './UnfollowModal';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {UserAPI, ChatAPI, ReportAPI} from '../../api/ApiRequests';
import {API_BASE_URL} from '../../config/api';
import {LottieSpinner} from '../../components/common';
import {useOverlay} from '../../components/OverlayProvider';
import {useAlert} from '../../contexts/AlertContext';
import ChatRoomScreen from '../main/chat/ChatRoomScreen';

interface UserProfileScreenProps {
  visible: boolean;
  userId: string;
  userName: string;
  onClose: () => void;
  onFollowChange?: (isFollowing: boolean) => void; // 팔로우/언팔로우 변경 시 호출될 콜백 (isFollowing: 팔로우 여부)
}

/**
 * 다른 유저 프로필 화면
 */
const UserProfileScreen: React.FC<UserProfileScreenProps> = ({
  visible,
  userId,
  userName = '노영준',
  onClose,
  onFollowChange,
}) => {
  const insets = useSafeAreaInsets();
  const {alert} = useAlert();
  const navigation = useNavigation<any>();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const isOwnProfile = currentUser?.user_id && userId === currentUser.user_id;
  const {showOverlay, hideOverlay} = useOverlay();
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    nickname: string;
    profile_image_url: string | null;
    bio: string[];
    location_text: string | null;
    stats: {
      recipes: number;
      regularCustomers: number;
      regularStores: number;
    };
    isFollowing: boolean;
  } | null>(null);
  const [userRecipes, setUserRecipes] = useState<any[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<any[]>([]);
  const [menuVisible, setMenuVisible] = useState(false);
  const [selectedTab, setSelectedTab] = useState<'grid' | 'likes'>('grid');
  const [isFollowerListVisible, setIsFollowerListVisible] = useState(false);
  const [isFollowingListVisible, setIsFollowingListVisible] = useState(false);
  const [followerListRefreshKey, setFollowerListRefreshKey] = useState(0);
  const [followingListRefreshKey, setFollowingListRefreshKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [chatRoomVisible, setChatRoomVisible] = useState(false);
  const [chatRoomId, setChatRoomId] = useState('');
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [shouldShowBioExpand, setShouldShowBioExpand] = useState(false);
  const {width} = useWindowDimensions();
  const {width: screenWidth, height: screenHeight} = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(-1)).current;

  const buildMediaUrl = (path?: string | null) => {
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

  // 프로필 데이터 로드
  useEffect(() => {
    if (visible && userId) {
      loadProfileData();
      setIsBioExpanded(false); // 프로필 로드 시 접기 상태로 초기화
      setShouldShowBioExpand(false); // 프로필 로드 시 초기화
    }
  }, [visible, userId]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (visible && userId && profileData) {
      if (selectedTab === 'grid') {
        loadUserRecipes();
      } else {
        loadUserLikedRecipes();
      }
    }
  }, [selectedTab, visible, userId, profileData]);

  /**
   * 사용자 신고
   */
  const handleReportUser = async (reason: string) => {
    try {
      const response = await ReportAPI.reportUser(userId, reason);
      if (response?.success) {
        alert('완료', '신고가 접수되었습니다. 검토 후 처리하겠습니다.');
      } else {
        alert('오류', response?.message || '신고 처리에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('사용자 신고 오류:', error);
      alert('오류', error?.response?.data?.message || '신고 처리 중 오류가 발생했습니다.');
    }
  };

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const response = await UserAPI.getUserProfile(userId);
      if (response.success && response.data) {
        setProfileData({
          nickname: response.data.nickname,
          profile_image_url: response.data.profile_image_url,
          bio: response.data.bio || [],
          location_text: response.data.location_text,
          stats: response.data.stats,
          isFollowing: response.data.isFollowing || false,
        });
        await loadUserRecipes();
      }
    } catch (error) {
      console.error('프로필 데이터 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserRecipes = async () => {
    try {
      const response = await UserAPI.getUserRecipes(userId);
      if (response.success && response.data) {
        setUserRecipes(response.data);
      }
    } catch (error) {
      console.error('레시피 데이터 로드 오류:', error);
    }
  };

  const loadUserLikedRecipes = async () => {
    try {
      const response = await UserAPI.getUserLikedRecipes(userId);
      if (response.success && response.data) {
        setLikedRecipes(response.data);
      }
    } catch (error) {
      console.error('좋아요한 레시피 데이터 로드 오류:', error);
    }
  };

  // 팔로우 처리 함수
  const handleFollowUser = async () => {
    try {
      if (!profileData) return;
      
      const wasFollowing = profileData.isFollowing;
      // 즉시 UI 업데이트 (낙관적 업데이트)
      setProfileData({
        ...profileData,
        isFollowing: true,
        stats: {
          ...profileData.stats,
          regularCustomers: profileData.stats.regularCustomers + 1,
        },
      });

      const response = await UserAPI.followUser(userId);
      if (!response.success) {
        // 실패 시 원래 상태로 복구
        setProfileData({
          ...profileData,
          isFollowing: wasFollowing,
          stats: {
            ...profileData.stats,
            regularCustomers: profileData.stats.regularCustomers,
          },
        });
        alert('오류', response.message || '팔로우에 실패했습니다.');
      } else {
        // 성공 시 콜백 호출하여 리스트 새로고침 (팔로우했으므로 true)
        if (onFollowChange) {
          onFollowChange(true);
        }
        // UserProfileScreen의 팔로워 리스트도 새로고침
        if (isFollowerListVisible) {
          setFollowerListRefreshKey(prev => prev + 1);
        }
        // UserProfileScreen의 팔로잉 리스트도 새로고침
        if (isFollowingListVisible) {
          setFollowingListRefreshKey(prev => prev + 1);
        }
      }
    } catch (error: any) {
      // 에러 발생 시 원래 상태로 복구
      if (!profileData) return;
      const wasFollowing = profileData.isFollowing;
      setProfileData({
        ...profileData,
        isFollowing: wasFollowing,
        stats: {
          ...profileData.stats,
          regularCustomers: profileData.stats.regularCustomers,
        },
      });
      console.error('팔로우 오류:', error);
      alert('오류', '팔로우 처리 중 오류가 발생했습니다.');
    }
  };

  // 언팔로우 처리 함수
  const handleUnfollowUser = async () => {
    try {
      if (!profileData) return;
      
      const wasFollowing = profileData.isFollowing;
      // 즉시 UI 업데이트 (낙관적 업데이트)
      setProfileData({
        ...profileData,
        isFollowing: false,
        stats: {
          ...profileData.stats,
          regularCustomers: profileData.stats.regularCustomers - 1,
        },
      });

      const response = await UserAPI.unfollowUser(userId);
      if (!response.success) {
        // 실패 시 원래 상태로 복구
        setProfileData({
          ...profileData,
          isFollowing: wasFollowing,
          stats: {
            ...profileData.stats,
            regularCustomers: profileData.stats.regularCustomers,
          },
        });
        alert('오류', response.message || '언팔로우에 실패했습니다.');
      } else {
        // 성공 시 콜백 호출하여 리스트 새로고침 (언팔로우했으므로 false)
        if (onFollowChange) {
          onFollowChange(false);
        }
        // UserProfileScreen의 팔로워 리스트도 새로고침
        if (isFollowerListVisible) {
          setFollowerListRefreshKey(prev => prev + 1);
        }
        // UserProfileScreen의 팔로잉 리스트도 새로고침
        if (isFollowingListVisible) {
          setFollowingListRefreshKey(prev => prev + 1);
        }
      }
    } catch (error: any) {
      // 에러 발생 시 원래 상태로 복구
      if (!profileData) return;
      const wasFollowing = profileData.isFollowing;
      setProfileData({
        ...profileData,
        isFollowing: wasFollowing,
        stats: {
          ...profileData.stats,
          regularCustomers: profileData.stats.regularCustomers,
        },
      });
      console.error('언팔로우 오류:', error);
      alert('오류', '언팔로우 처리 중 오류가 발생했습니다.');
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  // Android 뒤로가기 버튼 처리
  useFocusEffect(
    useCallback(() => {
      if (!visible) {
        return;
      }

      const onBackPress = () => {
        handleClose();
        return true; // 기본 동작 방지
      };

      if (Platform.OS === 'android') {
        const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => backHandler.remove();
      }
    }, [visible, handleClose]),
  );

  const handleClose = () => {
    Animated.timing(slideAnim, {
      toValue: 1,
      duration: 250,
      useNativeDriver: true,
    }).start(() => {
      onClose();
    });
  };

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-400, 0, -400],
  });

  const currentRecipes = selectedTab === 'grid' ? userRecipes : likedRecipes;

  // 그리드 계산
  const gap = 2;
  const itemWidth = Math.floor((width - gap * 4) / 3);
  const sidePadding = Math.floor((width - (itemWidth * 3 + gap * 2)) / 2);

  // 메뉴 아이템 (다른 유저의 게시글에 대한 더보기 메뉴)
  const menuItems = [
    {id: 'share', icon: 'share-2', label: '공유하기'},
    {id: 'hide', icon: 'eye-off', label: '이 사용자 숨기기'},
    {id: 'report', icon: 'alert-triangle', label: '신고하기', color: colors.error},
  ];

  // 자기 자신인 경우 마이페이지로 이동
  useEffect(() => {
    if (visible && isOwnProfile) {
      handleClose();
      navigation.navigate('Profile');
    }
  }, [visible, isOwnProfile, navigation]);

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={handleClose}>
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          {
            transform: [{translateX}],
          },
        ]}>
        <SafeAreaView style={styles.container} edges={[]}>
          {/* 헤더 */}
          <View style={[styles.header, {paddingTop: insets.top + spacing.m}]}>
            <TouchableOpacity style={styles.backButton} onPress={handleClose}>
              <Icon name="chevron-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <View style={styles.headerSpacer} />
            {!isOwnProfile && (
              <TouchableOpacity
                style={styles.moreButton}
                onPress={() => setMenuVisible(true)}>
                <Icon name="more-vertical" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            )}
          </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 프로필 섹션 */}
          {loading ? (
            <View style={styles.loadingWrapper}>
              <LottieSpinner size="large" />
            </View>
          ) : profileData ? (
            <View style={styles.profileSection}>
              {/* 아바타 */}
              <TouchableOpacity
                onPress={() => {
                  if (profileData.profile_image_url) {
                    setImageViewerVisible(true);
                  }
                }}
                activeOpacity={profileData.profile_image_url ? 0.7 : 1}>
                <Avatar
                  size={80}
                  style={styles.avatar}
                  source={
                    profileData.profile_image_url
                      ? (() => {
                          const url = buildMediaUrl(profileData.profile_image_url);
                          return url ? {uri: url} : undefined;
                        })()
                      : undefined
                  }
                />
              </TouchableOpacity>

              {/* 닉네임 */}
              <Text style={styles.nickname}>{profileData.nickname}</Text>

              {/* 자기소개 */}
              {profileData.bio.length > 0 && (() => {
                const fullBio = profileData.bio.join('\n');
                
                return (
                  <View style={styles.bioContainer}>
                    {/* 실제 표시되는 텍스트 */}
                    <Text 
                      style={styles.bioText}
                      numberOfLines={isBioExpanded ? undefined : 2}
                    >
                      {fullBio}
                    </Text>
                    {/* 숨겨진 텍스트로 실제 줄 수 측정 */}
                    <Text 
                      style={[styles.bioText, styles.hiddenBioText]}
                      onTextLayout={(e) => {
                        const { lines } = e.nativeEvent;
                        if (lines.length > 2) {
                          setShouldShowBioExpand(true);
                        } else {
                          setShouldShowBioExpand(false);
                        }
                      }}
                    >
                      {fullBio}
                    </Text>
                    {shouldShowBioExpand && (
                      <TouchableOpacity
                        onPress={() => setIsBioExpanded(!isBioExpanded)}
                        style={styles.bioExpandButton}>
                        <Text style={styles.bioExpandText}>
                          {isBioExpanded ? '접기' : '더 보기'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                );
              })()}

              {/* 위치 */}
              {profileData.location_text && (
                <View style={styles.locationContainer}>
                  <Icon name="map-pin" size={16} color={colors.textSecondary} />
                  <Text style={styles.locationText}>{profileData.location_text}</Text>
                </View>
              )}

              {/* 통계 */}
              <View style={styles.statsContainer}>
                <TouchableOpacity style={styles.statItem}>
                  <Text style={styles.statValue}>{profileData.stats.recipes}</Text>
                  <Text style={styles.statLabel}>레시피</Text>
                </TouchableOpacity>
                <View style={styles.statsDivider} />
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => setIsFollowerListVisible(true)}>
                  <Text style={styles.statValue}>
                    {profileData.stats.regularCustomers}
                  </Text>
                  <Text style={styles.statLabel}>팔로워</Text>
                </TouchableOpacity>
                <View style={styles.statsDivider} />
                <TouchableOpacity
                  style={styles.statItem}
                  onPress={() => setIsFollowingListVisible(true)}>
                  <Text style={styles.statValue}>{profileData.stats.regularStores}</Text>
                  <Text style={styles.statLabel}>팔로잉</Text>
                </TouchableOpacity>
              </View>

              {/* 액션 버튼 - 자기 자신인 경우 표시하지 않음 */}
              {!isOwnProfile && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={[
                      styles.actionButton,
                      profileData.isFollowing
                        ? styles.actionButtonSelected
                        : styles.actionButtonGray,
                    ]}
                    onPress={() => {
                      if (!profileData) return;
                      
                      const wasFollowing = profileData.isFollowing;
                      
                      if (wasFollowing) {
                        // 언팔로우: UnfollowModal 표시
                        showOverlay(
                          <UnfollowModal
                            visible={true}
                            userName={userName}
                            onClose={() => hideOverlay()}
                            onConfirm={async () => {
                              await handleUnfollowUser();
                              hideOverlay();
                            }}
                          />,
                        );
                      } else {
                        // 팔로우: 바로 실행 (확인 모달 없이)
                        handleFollowUser();
                      }
                    }}>
                    <Icon
                      name={profileData.isFollowing ? 'check' : 'plus'}
                      size={16}
                      color={profileData.isFollowing ? colors.primary : colors.textPrimary}
                    />
                    <Text
                      style={[
                        styles.actionButtonText,
                        profileData.isFollowing
                          ? styles.actionButtonTextSelected
                          : styles.actionButtonTextGray,
                      ]}>
                      {profileData.isFollowing ? '팔로잉' : '팔로우'}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionButton, styles.actionButtonGray]}
                    onPress={async () => {
                      try {
                        // 채팅방 생성 또는 가져오기
                        const response = await ChatAPI.createOrGetRoom(userId);
                        if (response?.success && response.data?.room_id) {
                          setChatRoomId(response.data.room_id);
                          setChatRoomVisible(true);
                        } else {
                          alert('오류', '채팅방을 열 수 없습니다.');
                        }
                      } catch (error) {
                        console.error('채팅방 생성 오류:', error);
                        alert('오류', '채팅방을 열 수 없습니다.');
                      }
                    }}>
                    <Icon name="send" size={16} color={colors.textPrimary} />
                    <Text style={[styles.actionButtonText, styles.actionButtonTextGray]}>
                      1:1 채팅
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}

          {/* 탭 메뉴 */}
          <View style={styles.tabsContainer}>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'grid' && styles.tabActive]}
              onPress={() => setSelectedTab('grid')}>
              <Icon
                name="grid"
                size={24}
                color={selectedTab === 'grid' ? colors.primary : colors.textSecondary}
              />
              {selectedTab === 'grid' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, selectedTab === 'likes' && styles.tabActive]}
              onPress={() => setSelectedTab('likes')}>
              <Icon
                name="heart"
                size={24}
                color={selectedTab === 'likes' ? colors.primary : colors.textSecondary}
              />
              {selectedTab === 'likes' && <View style={styles.tabIndicator} />}
            </TouchableOpacity>
          </View>

          {/* 이미지 그리드 */}
          {currentRecipes.length > 0 ? (
            <View
              style={[
                styles.gridContainer,
                {paddingHorizontal: sidePadding, paddingBottom: gap},
              ]}>
              {currentRecipes.map((recipe, index) => {
                const thumbnailUrl = buildMediaUrl(recipe.thumbnail_url);
                return (
                  <TouchableOpacity
                    key={recipe.recipe_post_id || index}
                    style={[
                      styles.gridItem,
                      {
                        width: itemWidth,
                        marginRight: index % 3 === 2 ? 0 : gap,
                        marginTop: index > 2 ? gap : 0,
                      },
                    ]}
                    onPress={() => {
                      setSelectedRecipeId(recipe.recipe_post_id);
                      setModalVisible(true);
                    }}>
                    <View style={styles.gridImageContainer}>
                      {thumbnailUrl ? (
                        <Image
                          source={{uri: thumbnailUrl}}
                          style={styles.gridImage}
                          defaultSource={require('../../../assets/dev/images/feed01.png')}
                        />
                      ) : (
                        <View style={[styles.gridImage, styles.placeholderImage]}>
                          <Icon name="image" size={24} color={colors.textSecondary} />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          ) : (
            <View style={styles.emptyGridWrapper}>
              <Icon name="image" size={32} color={colors.textSecondary} />
              <Text style={styles.emptyGridText}>
                {selectedTab === 'grid' ? '등록한 레시피가 없습니다.' : '좋아요한 레시피가 없습니다.'}
              </Text>
            </View>
          )}
        </ScrollView>

        {/* 더보기 메뉴 */}
        <BottomSheetMenu
          visible={menuVisible}
          options={menuItems}
          onClose={() => setMenuVisible(false)}
          onOptionPress={async item => {
            setMenuVisible(false);
            
            if (item === 'share') {
              // 공유하기 기능 (추후 구현)
              alert('알림', '공유하기 기능은 준비 중입니다.');
              return;
            }

            if (item === 'hide') {
              try {
                const response = await ReportAPI.hideUser(userId);
                if (response?.success) {
                  alert('완료', '사용자가 숨김 처리되었습니다.').then(() => {
                    handleClose();
                  });
                } else {
                  alert('오류', response?.message || '숨김 처리에 실패했습니다.');
                }
              } catch (error: any) {
                console.error('사용자 숨김 처리 오류:', error);
                alert('오류', error?.response?.data?.message || '숨김 처리 중 오류가 발생했습니다.');
              }
              return;
            }

            if (item === 'report') {
              // 신고 사유 선택 - BottomSheetMenu로 변경 필요하지만 일단 alert로 처리
              alert('신고 사유 선택', '신고 사유를 선택해주세요.');
              // TODO: BottomSheetMenu로 신고 사유 선택 구현
              return;
            }
          }}
        />

        {/* RecipeDetailModal */}
        <RecipeDetailModal
          visible={modalVisible}
          onClose={() => setModalVisible(false)}
          recipeId={selectedRecipeId}
        />
      </SafeAreaView>
      </Animated.View>

      {/* 팔로워 화면 - Modal로 감싸서 별도 레이어에 렌더링 */}
      {isFollowerListVisible && (
        <Modal visible={true} transparent animationType="none" onRequestClose={() => setIsFollowerListVisible(false)}>
          <FollowerListScreen
            visible={true}
            onClose={() => setIsFollowerListVisible(false)}
            refreshKey={followerListRefreshKey}
            targetUserId={userId}
          />
        </Modal>
      )}

      {/* 팔로잉 화면 - Modal로 감싸서 별도 레이어에 렌더링 */}
      {isFollowingListVisible && (
        <Modal visible={true} transparent animationType="none" onRequestClose={() => setIsFollowingListVisible(false)}>
          <FollowingListScreen
            visible={true}
            onClose={() => setIsFollowingListVisible(false)}
            refreshKey={followingListRefreshKey}
            targetUserId={userId}
          />
        </Modal>
      )}

      {/* 프로필 이미지 확대 보기 모달 */}
      <Modal
        visible={imageViewerVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setImageViewerVisible(false)}>
        <View style={styles.imageViewerContainer}>
          <TouchableOpacity
            style={styles.imageViewerBackdrop}
            activeOpacity={1}
            onPress={() => setImageViewerVisible(false)}
          />
          <View style={styles.imageViewerContent}>
            <View style={styles.imageViewerHeader}>
              <TouchableOpacity
                onPress={() => setImageViewerVisible(false)}
                style={styles.imageViewerCloseButton}>
                <Icon name="x" size={24} color={colors.white} />
              </TouchableOpacity>
            </View>
            <ScrollView
              contentContainerStyle={styles.imageViewerScrollContent}
              maximumZoomScale={3}
              minimumZoomScale={1}
              showsHorizontalScrollIndicator={false}
              showsVerticalScrollIndicator={false}>
              <View style={[styles.imageViewerImageContainer, {width: screenWidth, height: screenHeight}]}>
                <Image
                  source={{
                    uri: profileData?.profile_image_url
                      ? buildMediaUrl(profileData.profile_image_url) || undefined
                      : undefined,
                  }}
                  style={{width: '100%', height: '100%'}}
                  resizeMode="contain"
                />
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* 채팅방 화면 */}
      <ChatRoomScreen
        visible={chatRoomVisible}
        onClose={() => setChatRoomVisible(false)}
        roomId={chatRoomId}
        peerName={profileData?.nickname || userName}
        peerId={userId}
      />
    </Modal>
  );
};

const styles = StyleSheet.create<any>({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerSpacer: {
    flex: 1,
  },
  moreButton: {
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingBottom: 0,
    backgroundColor: colors.white,
    flexGrow: 1,
  },
  profileSection: {
    backgroundColor: colors.white,
    alignItems: 'center',
    paddingVertical: spacing.xl,
  },
  avatar: {
    marginBottom: spacing.m,
  },
  nickname: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 22,
    marginBottom: spacing.s,
  },
  bioContainer: {
    alignItems: 'center',
    marginBottom: spacing.s,
    paddingHorizontal: spacing.l,
    maxWidth: '85%', // width를 줄여서 텍스트가 더 쉽게 2줄을 넘도록
  },
  bioText: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    fontFamily: 'Pretendard-Regular',
    color: colors.textSecondary,
    textAlign: 'center' as const,
  },
  bioExpandButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  bioExpandText: {
    fontSize: 14,
    fontWeight: '600' as const,
    color: colors.primary,
    textAlign: 'center' as const,
  },
  hiddenBioText: {
    position: 'absolute',
    opacity: 0,
    zIndex: -1,
  },
  locationContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  locationText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.l,
    paddingHorizontal: spacing.xl * 2,
  },
  statsDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.primary,
    marginHorizontal: spacing.l,
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.xs,
  },
  statLabel: {
    fontSize: 12,
    fontWeight: '300' as const,
    lineHeight: 18,
    fontFamily: 'Pretendard-Regular',
    color: colors.textSecondary,
    textAlign: 'center',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.l,
    borderWidth: 1,
  },
  actionButtonSelected: {
    borderColor: colors.primary,
  },
  actionButtonGray: {
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  actionButtonTextSelected: {
    ...typography.bodyMedium,
    color: colors.primary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  actionButtonTextGray: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  tabsContainer: {
    flexDirection: 'row',
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: colors.lightGray,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    position: 'relative',
  },
  tabActive: {},
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    width: 40,
    height: 2,
    backgroundColor: colors.primary,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    backgroundColor: colors.white,
  },
  gridItem: {
    aspectRatio: 1,
  },
  gridImageContainer: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.s,
    overflow: 'hidden',
  },
  gridImage: {
    width: '100%',
    height: '100%',
  },
  placeholderImage: {
    backgroundColor: colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingWrapper: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyGridWrapper: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.white,
  },
  emptyGridText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerContent: {
    flex: 1,
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
  imageViewerScrollContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImageContainer: {
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default UserProfileScreen;


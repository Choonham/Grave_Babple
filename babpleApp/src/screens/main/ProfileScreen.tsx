import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  useWindowDimensions,
  Modal,
  Dimensions,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import Avatar from '../../components/common/Avatar';
import {LottieSpinner} from '../../components/common';
import ProfileEditModal from '../profile/ProfileEditModal';
import TitlesModal from '../profile/TitlesModal';
import SettingsScreen from '../profile/SettingsScreen';
import FollowerListScreen from '../profile/FollowerListScreen';
import FollowingListScreen from '../profile/FollowingListScreen';
import UserProfileScreen from '../profile/UserProfileScreen';
import RecipeDetailModal from '../post/RecipeDetailModal';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {UserAPI} from '../../api/ApiRequests';

import {buildMediaUrl} from '../../utils/imageUtils';

/**
 * 마이페이지 화면
 */
const ProfileScreen: React.FC = () => {
  const [selectedTab, setSelectedTab] = useState<'grid' | 'likes'>('grid');
  const [isEditModalVisible, setIsEditModalVisible] = useState(false);
  const [isTitlesModalVisible, setIsTitlesModalVisible] = useState(false);
  const [isSettingsVisible, setIsSettingsVisible] = useState(false);
  const [isFollowerListVisible, setIsFollowerListVisible] = useState(false);
  const [isFollowingListVisible, setIsFollowingListVisible] = useState(false);
  const [isUserProfileVisible, setIsUserProfileVisible] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedUserName, setSelectedUserName] = useState('');
  const [followerListRefreshKey, setFollowerListRefreshKey] = useState(0);
  const [followingListRefreshKey, setFollowingListRefreshKey] = useState(0);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [isBioExpanded, setIsBioExpanded] = useState(false);
  const [shouldShowBioExpand, setShouldShowBioExpand] = useState(false);
  const {width} = useWindowDimensions();
  const {width: screenWidth, height: screenHeight} = Dimensions.get('window');

  // 상태 관리
  const [loading, setLoading] = useState(true);
  const [profileData, setProfileData] = useState<{
    nickname: string;
    profile_image_url: string | null;
    bio: string[];
    location_text: string | null;
    gender?: string | null;
    age_group?: string | null;
    stats: {
      recipes: number;
      regularCustomers: number;
      regularStores: number;
    };
  } | null>(null);
  const [myRecipes, setMyRecipes] = useState<any[]>([]);
  const [likedRecipes, setLikedRecipes] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  // 그리드 계산: 3열, 양쪽 padding과 item 사이 gap 동일
  const gap = 2;
  const itemWidth = Math.floor((width - gap * 4) / 3); // 화면 너비에서 4개 gap 뺀 뒤 3으로 나눔
  const sidePadding = Math.floor((width - (itemWidth * 3 + gap * 2)) / 2);

  // 프로필 데이터 로드
  useEffect(() => {
    loadProfileData();
    setIsBioExpanded(false); // 프로필 로드 시 접기 상태로 초기화
    setShouldShowBioExpand(false); // 프로필 로드 시 초기화
  }, []);


  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (selectedTab === 'grid') {
      loadMyRecipes();
    } else {
      loadLikedRecipes();
    }
  }, [selectedTab]);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    setIsBioExpanded(false); // 새로고침 시 접기 상태로 초기화
    setShouldShowBioExpand(false); // 새로고침 시 초기화
    await loadProfileData(false);
    if (selectedTab === 'grid') {
      await loadMyRecipes();
    } else {
      await loadLikedRecipes();
    }
    setRefreshing(false);
  }, [selectedTab]);

  const loadProfileData = async (showLoading: boolean = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await UserAPI.getMyProfile();
      if (response.success && response.data) {
        setProfileData({
          nickname: response.data.nickname,
          profile_image_url: response.data.profile_image_url,
          bio: response.data.bio || [],
          location_text: response.data.location_text,
          gender: response.data.gender,
          age_group: response.data.age_group,
          stats: response.data.stats,
        });
        // 등록한 레시피도 함께 로드 (첫 로드 시에만)
        if (showLoading) {
          await loadMyRecipes();
        }
      }
    } catch (error) {
      console.error('프로필 데이터 로드 오류:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  const loadMyRecipes = async () => {
    try {
      const response = await UserAPI.getMyRecipes();
      if (response.success && response.data) {
        setMyRecipes(response.data);
      }
    } catch (error) {
      console.error('내 레시피 로드 오류:', error);
    }
  };

  const loadLikedRecipes = async () => {
    try {
      const response = await UserAPI.getMyLikedRecipes();
      if (response.success && response.data) {
        setLikedRecipes(response.data);
      }
    } catch (error) {
      console.error('좋아요한 레시피 로드 오류:', error);
    }
  };

  if (loading || !profileData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>마이페이지</Text>
        </View>
        <View style={styles.loadingContainer}>
          <LottieSpinner size="large" />
        </View>
      </SafeAreaView>
    );
  }

  const currentRecipes = selectedTab === 'grid' ? myRecipes : likedRecipes;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>마이페이지</Text>
        <TouchableOpacity
          style={styles.settingsButton}
          onPress={() => setIsSettingsVisible(true)}>
          <Icon name="settings" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
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
          {/* 아바타 */}
          <TouchableOpacity
            onPress={() => {
              if (profileData.profile_image_url) {
                setImageViewerVisible(true);
              }
            }}
            activeOpacity={profileData.profile_image_url ? 0.7 : 1}>
            <Avatar
              source={
                profileData.profile_image_url
                  ? {uri: buildMediaUrl(profileData.profile_image_url) || undefined}
                  : require('../../../assets/dev/images/feedProfile01.png')
              }
              size={80}
              style={styles.avatar}
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

          {/* 액션 버튼 */}
          <View style={styles.actionButtons}>
            <TouchableOpacity
              style={[styles.actionButton, styles.actionButtonSelected]}
              onPress={() => setIsEditModalVisible(true)}>
              <Icon name="edit" size={16} color={colors.primary} />
              <Text style={styles.actionButtonTextSelected}>프로필 수정</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => {
                console.log('타이틀 보기 버튼 클릭');
                setIsTitlesModalVisible(true);
                console.log('isTitlesModalVisible:', true);
              }}>
              <Icon name="award" size={16} color={colors.textPrimary} />
              <Text style={styles.actionButtonText}>타이틀 보기</Text>
            </TouchableOpacity>
          </View>
        </View>

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
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>

      {/* 프로필 수정 모달 */}
      <ProfileEditModal
        visible={isEditModalVisible}
        onClose={() => setIsEditModalVisible(false)}
        onSave={() => {
          // 프로필 수정 후 접기 상태로 초기화
          setIsBioExpanded(false);
          setShouldShowBioExpand(false);
          // 모달 먼저 닫기
          setIsEditModalVisible(false);
          // 약간의 딜레이 후 프로필 데이터 다시 로드 (Modal이 완전히 닫힌 후)
          setTimeout(() => {
            loadProfileData();
          }, 300);
        }}
        initialData={
          profileData
            ? {
                nickname: profileData.nickname,
                introduction: profileData.bio.join('\n'),
                gender: profileData.gender || undefined,
                age_group: profileData.age_group || undefined,
                location_text: profileData.location_text || undefined,
                profile_image_url: profileData.profile_image_url,
              }
            : undefined
        }
      />

      {/* 타이틀 모달 */}
      <TitlesModal
        visible={isTitlesModalVisible}
        onClose={() => setIsTitlesModalVisible(false)}
      />

      {/* 설정 화면 */}
      <SettingsScreen
        visible={isSettingsVisible}
        onClose={() => setIsSettingsVisible(false)}
      />

      {/* 팔로워 화면 */}
      {isFollowerListVisible && (
        <FollowerListScreen
          visible={true}
          onClose={() => setIsFollowerListVisible(false)}
          onUserProfilePress={(userId, userName) => {
            setSelectedUserId(userId);
            setSelectedUserName(userName);
            setIsUserProfileVisible(true);
          }}
          refreshKey={followerListRefreshKey}
        />
      )}

      {/* 팔로잉 화면 */}
      {isFollowingListVisible && (
        <FollowingListScreen
          visible={true}
          onClose={() => setIsFollowingListVisible(false)}
          onUserProfilePress={(userId, userName) => {
            setSelectedUserId(userId);
            setSelectedUserName(userName);
            setIsUserProfileVisible(true);
          }}
          refreshKey={followingListRefreshKey}
          onUnfollowChange={() => {
            // 언팔로우 시 카운트만 업데이트 (로딩 없이)
            if (profileData) {
              setProfileData({
                ...profileData,
                stats: {
                  ...profileData.stats,
                  regularStores: Math.max(0, profileData.stats.regularStores - 1),
                },
              });
            }
          }}
        />
      )}

      {/* 다른 유저 프로필 화면 */}
      {isUserProfileVisible && (
        <UserProfileScreen
          visible={true}
          userId={selectedUserId}
          userName={selectedUserName}
          onClose={() => {
            setIsUserProfileVisible(false);
            // UserProfileScreen이 닫힌 후 프로필 데이터 새로고침하여 카운트 업데이트
            setTimeout(() => {
              loadProfileData(false);
            }, 200);
          }}
          onFollowChange={(isFollowing: boolean) => {
            // 팔로우/언팔로우 변경 시 팔로잉 카운트 즉시 업데이트
            if (profileData) {
              setProfileData({
                ...profileData,
                stats: {
                  ...profileData.stats,
                  regularStores: isFollowing
                    ? profileData.stats.regularStores + 1
                    : Math.max(0, profileData.stats.regularStores - 1),
                },
              });
            }
            // 팔로우/언팔로우 변경 시 팔로워 리스트 새로고침
            if (isFollowerListVisible) {
              setFollowerListRefreshKey((prev: number) => prev + 1);
            }
            // 팔로잉 리스트도 새로고침 (내가 팔로우하는 사람이 변경되었으므로)
            if (isFollowingListVisible) {
              setFollowingListRefreshKey((prev: number) => prev + 1);
            }
          }}
        />
      )}

      {/* RecipeDetailModal */}
      <RecipeDetailModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        recipeId={selectedRecipeId}
        onUserProfilePress={(userId, nickname) => {
          setSelectedUserId(userId);
          setSelectedUserName(nickname);
          setIsUserProfileVisible(true);
          setModalVisible(false);
        }}
      />

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
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    backgroundColor: colors.white,
    position: 'relative',
    minHeight: 50,
  },
  headerTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: 20,
  },
  settingsButton: {
    position: 'absolute',
    right: spacing.s,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.xs,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingBottom: 0, // 하단 네비게이션 바 공간
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
    ...typography.bodyRegular,
    color: colors.textSecondary,
    fontSize: 14,
    textAlign: 'center',
  },
  bioExpandButton: {
    marginTop: spacing.xs,
    paddingVertical: spacing.xxs,
  },
  bioExpandText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
    textAlign: 'center',
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
    ...typography.h3,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xxs,
  },
  statLabel: {
    ...typography.bodySmall,
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
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  actionButtonSelected: {
    borderColor: colors.primary,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginLeft: spacing.xs,
    fontWeight: '600',
  },
  actionButtonTextSelected: {
    ...typography.bodyMedium,
    color: colors.primary,
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
  tabActive: {
    // 활성화 상태 추가 스타일 (필요시)
  },
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
  gridImage: {
    width: '100%',
    height: '100%',
    borderRadius: borderRadius.s,
  },
  placeholderImage: {
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
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

export default ProfileScreen;


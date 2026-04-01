import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  BackHandler,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LottieSpinner} from '../../components/common';
import Avatar from '../../components/common/Avatar';
import FollowModal from './FollowModal';
import UnfollowModal from './UnfollowModal';
import NotificationModal from './NotificationModal';
import UserProfileScreen from './UserProfileScreen';
import {useOverlay} from '../../components/OverlayProvider';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {UserAPI} from '../../api/ApiRequests';
import {useAlert} from '../../contexts/AlertContext';

import {API_BASE_URL} from '../../config/api';
import {buildMediaUrl} from '../../utils/imageUtils';

interface Follower {
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
  introduction: string | null;
  isFollowing: boolean;
  notificationEnabled: boolean;
}

interface FollowerListScreenProps {
  visible: boolean;
  onClose?: () => void;
  onUserProfilePress?: (userId: string, userName: string) => void;
  refreshKey?: number; // 데이터 새로고침을 위한 키
  targetUserId?: string; // 특정 유저의 팔로워를 조회할 때 사용 (없으면 현재 사용자)
}

/**
 * 팔로워 화면
 */
const FollowerListScreen: React.FC<FollowerListScreenProps> = ({
  visible,
  onClose,
  onUserProfilePress,
  refreshKey,
  targetUserId,
}) => {
  const {alert} = useAlert();
  const {showOverlay, hideOverlay} = useOverlay();
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-1)).current;

  const loadFollowers = async () => {
    try {
      setLoading(true);
      // targetUserId가 있으면 해당 유저의 팔로워를 조회, 없으면 내 팔로워를 조회
      const response = targetUserId
        ? await UserAPI.getUserFollowers(targetUserId)
        : await UserAPI.getMyFollowers();
      if (response.success && response.data) {
        // getUserFollowers API는 이미 isFollowing을 포함하고 있음
        // getMyFollowers API는 isFollowing을 포함하지 않으므로 각각 확인 필요
        const followersWithFollowingStatus = targetUserId
          ? response.data.map((follower: any) => ({
              user_id: follower.user_id,
              nickname: follower.nickname,
              profile_image_url: follower.profile_image_url,
              introduction: follower.introduction,
              isFollowing: follower.isFollowing || false,
              notificationEnabled: false,
            }))
          : await Promise.all(
              response.data.map(async (follower: any) => {
                try {
                  // 각 팔로워의 프로필을 조회하여 isFollowing 확인
                  const profileResponse = await UserAPI.getUserProfile(follower.user_id);
                  return {
                    user_id: follower.user_id,
                    nickname: follower.nickname,
                    profile_image_url: follower.profile_image_url,
                    introduction: follower.introduction,
                    isFollowing: profileResponse.success && profileResponse.data?.isFollowing || false,
                    notificationEnabled: false,
                  };
                } catch (error) {
                  console.error('팔로워 프로필 조회 오류:', error);
                  return {
                    user_id: follower.user_id,
                    nickname: follower.nickname,
                    profile_image_url: follower.profile_image_url,
                    introduction: follower.introduction,
                    isFollowing: false,
                    notificationEnabled: false,
                  };
                }
              }),
            );
        setFollowers(followersWithFollowingStatus);
      }
    } catch (error) {
      console.error('팔로워 리스트 로드 오류:', error);
      alert('오류', '팔로워 리스트를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadFollowers();
    }
  }, [visible, refreshKey, targetUserId]);

  const handleFollowButtonPress = async (follower: Follower) => {
    try {
      const response = await UserAPI.followUser(follower.user_id);
      if (response.success) {
        setFollowers(prev =>
          prev.map(f =>
            f.user_id === follower.user_id
              ? {...f, isFollowing: true, notificationEnabled: false}
              : f,
          ),
        );
      } else {
        alert('오류', response.message || '팔로우에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('팔로우 오류:', error);
      alert('오류', '팔로우 처리 중 오류가 발생했습니다.');
    }
  };

  const handleUnfollowPress = async (follower: Follower) => {
    try {
      const response = await UserAPI.unfollowUser(follower.user_id);
      if (response.success) {
        setFollowers(prev =>
          prev.map(f =>
            f.user_id === follower.user_id
              ? {...f, isFollowing: false, notificationEnabled: false}
              : f,
          ),
        );
      } else {
        alert('오류', response.message || '언팔로우에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('언팔로우 오류:', error);
      alert('오류', '언팔로우 처리 중 오류가 발생했습니다.');
    }
  };

  const handleNotificationPress = (follower: Follower) => {
    const currentFollower = follower;
    showOverlay(
      <NotificationModal
        visible={true}
        userName={currentFollower.nickname}
        isEnabled={currentFollower.notificationEnabled}
        onClose={() => hideOverlay()}
        onConfirm={() => {
          setFollowers(prev =>
            prev.map(f =>
              f.user_id === currentFollower.user_id
                ? {...f, notificationEnabled: !f.notificationEnabled}
                : f,
            ),
          );
          hideOverlay();
        }}
      />,
    );
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
  useEffect(() => {
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
  }, [visible, handleClose]);

  const handleClose = () => {
    if (onClose) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-400, 0, -400],
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{translateX}],
        },
      ]}>
      <SafeAreaView style={styles.container} edges={['top']}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>팔로워</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <LottieSpinner size="large" />
            </View>
          ) : followers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>팔로워가 없습니다.</Text>
            </View>
          ) : (
            followers.map((follower, index) => {
              const avatarUrl = buildMediaUrl(follower.profile_image_url);
              const bio = follower.introduction
                ? follower.introduction.split('\n')[0]
                : '자기 소개가 없습니다.';
              return (
                <TouchableOpacity
                  key={follower.user_id}
                  style={[styles.followerItem, index !== followers.length - 1 && styles.followerItemBorder]}
                  onPress={() => onUserProfilePress && onUserProfilePress(follower.user_id, follower.nickname)}>
                  {/* 프로필 이미지 */}
                  <Avatar
                    size={56}
                    source={avatarUrl ? {uri: avatarUrl} : undefined}
                  />

                  {/* 유저 정보 */}
                  <View style={styles.userInfo}>
                    <Text style={styles.nickname}>{follower.nickname}</Text>
                    <Text style={styles.bio} numberOfLines={1} ellipsizeMode="tail">
                      {bio}
                    </Text>
                  </View>

              {/* 액션 버튼 - targetUserId가 있으면 다른 유저의 팔로워 리스트이므로 버튼 표시 안 함 */}
              {/* 내 팔로워 리스트에서도 이미 팔로우한 사람은 버튼 표시 안 함 */}
              {!targetUserId && !follower.isFollowing && (
                <View style={styles.actionButtons}>
                  <TouchableOpacity
                    style={styles.followButton}
                    onPress={e => {
                      e.stopPropagation();
                      handleFollowButtonPress(follower);
                    }}>
                    <Icon name="plus" size={24} color={colors.white} />
                  </TouchableOpacity>
                </View>
              )}
            </TouchableOpacity>
            );
          })
          )}
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
    backgroundColor: colors.white,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  followerItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.white,
  },
  followerItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  userInfo: {
    flex: 1,
    marginLeft: spacing.m,
  },
  nickname: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  bio: {
    fontSize: 13,
    fontWeight: '400' as const,
    lineHeight: 18,
    fontFamily: 'Pretendard-Regular',
    color: colors.textSecondary,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  icon: {
    marginLeft: spacing.xs,
  },
  followButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xl * 2,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    fontFamily: 'Pretendard-Regular',
    color: colors.textSecondary,
  },
});

export default FollowerListScreen;


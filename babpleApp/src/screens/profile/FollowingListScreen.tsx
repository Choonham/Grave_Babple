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
import UnfollowModal from './UnfollowModal';
import NotificationModal from './NotificationModal';
import UserProfileScreen from './UserProfileScreen';
import {useOverlay} from '../../components/OverlayProvider';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {UserAPI} from '../../api/ApiRequests';
import {useAlert} from '../../contexts/AlertContext';

import {API_BASE_URL} from '../../config/api';
import {buildMediaUrl} from '../../utils/imageUtils';

interface Following {
  user_id: string;
  nickname: string;
  profile_image_url: string | null;
  introduction: string | null;
  notificationEnabled: boolean;
}

interface FollowingListScreenProps {
  visible: boolean;
  onClose?: () => void;
  onUserProfilePress?: (userId: string, userName: string) => void;
  refreshKey?: number; // 데이터 새로고침을 위한 키
  targetUserId?: string; // 특정 유저의 팔로잉을 조회할 때 사용 (없으면 현재 사용자)
  onUnfollowChange?: () => void; // 언팔로우 시 호출될 콜백 (카운트 업데이트용)
}

/**
 * 팔로잉 화면 (내가 팔로우하는 유저 리스트)
 */
const FollowingListScreen: React.FC<FollowingListScreenProps> = ({
  visible,
  onClose,
  onUserProfilePress,
  refreshKey,
  targetUserId,
  onUnfollowChange,
}) => {
  const {alert} = useAlert();
  const {showOverlay, hideOverlay} = useOverlay();
  const [followings, setFollowings] = useState<Following[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-1)).current;

  const loadFollowings = async () => {
    try {
      setLoading(true);
      // targetUserId가 있으면 해당 유저의 팔로잉을 조회, 없으면 내 팔로잉을 조회
      const response = targetUserId
        ? await UserAPI.getUserFollowing(targetUserId)
        : await UserAPI.getMyFollowing();
      if (response.success && response.data) {
        const formatted = response.data.map((following: any) => ({
          user_id: following.user_id,
          nickname: following.nickname,
          profile_image_url: following.profile_image_url,
          introduction: following.introduction,
          notificationEnabled: false, // TODO: 알림 설정은 나중에 구현
        }));
        setFollowings(formatted);
      }
    } catch (error) {
      console.error('팔로잉 리스트 로드 오류:', error);
      alert('오류', '팔로잉 리스트를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadFollowings();
    }
  }, [visible, refreshKey, targetUserId]);

  const handleUnfollowPress = (following: Following) => {
    // targetUserId가 있으면 다른 유저의 팔로잉 리스트이므로 언팔로우 불가
    if (targetUserId) {
      return;
    }
    // UnfollowModal 표시
    showOverlay(
      <UnfollowModal
        visible={true}
        userName={following.nickname}
        onClose={() => hideOverlay()}
        onConfirm={async () => {
          try {
            const response = await UserAPI.unfollowUser(following.user_id);
            if (response.success) {
              setFollowings(prev => prev.filter(f => f.user_id !== following.user_id));
              // 콜백 호출하여 프로필 카운트 업데이트
              if (onUnfollowChange) {
                onUnfollowChange();
              }
            } else {
              alert('오류', response.message || '언팔로우에 실패했습니다.');
            }
          } catch (error: any) {
            console.error('언팔로우 오류:', error);
            alert('오류', '언팔로우 처리 중 오류가 발생했습니다.');
          }
          hideOverlay();
        }}
      />,
    );
  };

  const handleNotificationPress = (following: Following) => {
    const currentFollowing = following;
    showOverlay(
      <NotificationModal
        visible={true}
        userName={currentFollowing.nickname}
        isEnabled={currentFollowing.notificationEnabled}
        onClose={() => hideOverlay()}
        onConfirm={() => {
          setFollowings(prev =>
            prev.map(f =>
              f.user_id === currentFollowing.user_id
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
          <Text style={styles.headerTitle}>팔로잉</Text>
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
          ) : followings.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyText}>팔로잉이 없습니다.</Text>
            </View>
          ) : (
            followings.map((following, index) => {
              const avatarUrl = buildMediaUrl(following.profile_image_url);
              const bio = following.introduction
                ? following.introduction.split('\n')[0]
                : '자기 소개가 없습니다.';
              return (
                <TouchableOpacity
                  key={following.user_id}
                  style={[
                    styles.followingItem,
                    index !== followings.length - 1 && styles.followingItemBorder,
                  ]}
                  onPress={() => onUserProfilePress && onUserProfilePress(following.user_id, following.nickname)}>
                  {/* 프로필 이미지 */}
                  <Avatar
                    size={56}
                    source={avatarUrl ? {uri: avatarUrl} : undefined}
                  />

                  {/* 유저 정보 */}
                  <View style={styles.userInfo}>
                    <Text style={styles.nickname}>{following.nickname}</Text>
                    <Text style={styles.bio} numberOfLines={1} ellipsizeMode="tail">
                      {bio}
                    </Text>
                  </View>

                  {/* 액션 버튼 - targetUserId가 있으면 다른 유저의 팔로잉 리스트이므로 버튼 표시 안 함 */}
                  {!targetUserId && (
                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        onPress={e => {
                          e.stopPropagation();
                          handleUnfollowPress(following);
                        }}>
                        <Icon
                          name="check"
                          size={20}
                          color={colors.primary}
                          style={styles.icon}
                        />
                      </TouchableOpacity>
                      {/* TODO: 알림 설정 기능 나중에 구현 */}
                      {/* <TouchableOpacity
                        onPress={e => {
                          e.stopPropagation();
                          handleNotificationPress(following);
                        }}>
                        <Icon
                          name={following.notificationEnabled ? 'bell' : 'bell-off'}
                          size={20}
                          color={colors.primary}
                          style={styles.icon}
                        />
                      </TouchableOpacity> */}
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
  followingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.white,
  },
  followingItemBorder: {
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

export default FollowingListScreen;


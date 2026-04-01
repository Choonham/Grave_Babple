import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import Avatar from '../../components/common/Avatar';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {ReportAPI} from '../../api/ApiRequests';
import {useAlert} from '../../contexts/AlertContext';

import {API_BASE_URL} from '../../config/api';

const buildMediaUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }
  // 이미 절대 URL인 경우 그대로 반환
  if (path.startsWith('http://') || path.startsWith('https://')) {
    return path;
  }
  // 상대 경로인 경우 API_BASE_URL과 결합
  const normalizedPath = path.startsWith('/') ? path : `/${path}`;
  return `${API_BASE_URL}${normalizedPath}`;
};

interface HiddenUser {
  hidden_id: string;
  user: {
    user_id: string;
    nickname: string;
    profile_image_url: string | null;
  } | null;
  created_at: Date;
}

interface HiddenUsersScreenProps {
  visible: boolean;
  onClose?: () => void;
  onUserProfilePress?: (userId: string, userName: string) => void;
}

/**
 * 차단한 사용자 목록 화면
 */
const HiddenUsersScreen: React.FC<HiddenUsersScreenProps> = ({
  visible,
  onClose,
  onUserProfilePress,
}) => {
  const {alert, confirm} = useAlert();
  const [hiddenUsers, setHiddenUsers] = useState<HiddenUser[]>([]);
  const [loading, setLoading] = useState(false);
  const slideAnim = useRef(new Animated.Value(-1)).current;

  const loadHiddenUsers = async () => {
    try {
      setLoading(true);
      const response = await ReportAPI.getHiddenUsers();
      if (response.success && response.data) {
        setHiddenUsers(response.data);
      }
    } catch (error) {
      console.error('차단한 사용자 목록 로드 오류:', error);
      alert('오류', '차단한 사용자 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible) {
      loadHiddenUsers();
    }
  }, [visible]);

  const handleUnhideUser = async (hiddenUser: HiddenUser) => {
    if (!hiddenUser.user) {
      return;
    }

    const shouldUnhide = await confirm('차단 해제', `${hiddenUser.user.nickname} 님의 차단을 해제하시겠습니까?`);
    if (!shouldUnhide) {
      return;
    }

    try {
      const response = await ReportAPI.unhideUser(hiddenUser.user!.user_id);
      if (response.success) {
        alert('완료', '차단이 해제되었습니다.');
        // 목록에서 제거
        setHiddenUsers(prev => prev.filter(h => h.hidden_id !== hiddenUser.hidden_id));
      } else {
        alert('오류', response.message || '차단 해제에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('차단 해제 오류:', error);
      alert('오류', error?.response?.data?.message || '차단 해제 중 오류가 발생했습니다.');
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
          <Text style={styles.headerTitle}>차단한 사용자</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : hiddenUsers.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Icon name="user-x" size={64} color={colors.textTertiary} />
              <Text style={styles.emptyText}>차단한 사용자가 없습니다.</Text>
            </View>
          ) : (
            hiddenUsers.map((hiddenUser, index) => {
              if (!hiddenUser.user) {
                return null; // 사용자 정보가 없으면 표시하지 않음
              }

              const avatarUrl = buildMediaUrl(hiddenUser.user.profile_image_url);
              return (
                <TouchableOpacity
                  key={hiddenUser.hidden_id}
                  style={[
                    styles.hiddenUserItem,
                    index !== hiddenUsers.length - 1 && styles.hiddenUserItemBorder,
                  ]}
                  onPress={() =>
                    onUserProfilePress &&
                    onUserProfilePress(hiddenUser.user!.user_id, hiddenUser.user!.nickname)
                  }>
                  {/* 프로필 이미지 */}
                  <Avatar size={56} source={avatarUrl ? {uri: avatarUrl} : undefined} />

                  {/* 유저 정보 */}
                  <View style={styles.userInfo}>
                    <Text style={styles.nickname}>{hiddenUser.user.nickname}</Text>
                  </View>

                  {/* 차단 해제 버튼 */}
                  <TouchableOpacity
                    style={styles.unhideButton}
                    onPress={e => {
                      e.stopPropagation();
                      handleUnhideUser(hiddenUser);
                    }}>
                    <Text style={styles.unhideButtonText}>차단 해제</Text>
                  </TouchableOpacity>
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
  hiddenUserItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.white,
  },
  hiddenUserItemBorder: {
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
  unhideButton: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.s,
    backgroundColor: colors.lightGray,
  },
  unhideButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
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
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
});

export default HiddenUsersScreen;


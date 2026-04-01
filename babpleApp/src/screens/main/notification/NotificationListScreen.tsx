import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Modal} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {LottieSpinner} from '../../../components/common';
import {colors, spacing, typography, borderRadius} from '../../../styles/commonStyles';
import {NotificationAPI} from '../../../api/ApiRequests';

interface NotificationListScreenProps {
  visible: boolean;
  onClose: () => void;
  initialNotificationId?: string; // 푸시 알림에서 특정 알림으로 이동할 때 사용
}

type NotiType = 'like' | 'comment' | 'follow';

interface NotificationItem {
  notification_id: string;
  type: NotiType;
  title: string; // 메시지 본문
  time: string; // '오후 2:30'
  section: '오늘' | '어제' | '이전';
  is_read: boolean;
  target_id?: string;
  actor?: {
    user_id: string;
    nickname: string;
    profile_image_url?: string | null;
  } | null;
}

const typeIcon: Record<NotiType, {name: string; color: string}> = {
  like: {name: 'heart', color: colors.primary},
  comment: {name: 'message-square', color: colors.primary},
  follow: {name: 'user-plus', color: colors.primary},
};

const NotificationListScreen: React.FC<NotificationListScreenProps> = ({visible, onClose, initialNotificationId}) => {
  const insets = useSafeAreaInsets();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);

  const loadNotifications = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      setError(null);
      const response = await NotificationAPI.getNotifications();
      if (response?.success && Array.isArray(response.data)) {
        setNotifications(response.data);
      } else {
        setNotifications([]);
      }
    } catch (err) {
      console.error('❌ [NotificationListScreen] 알림 목록 로드 실패:', err);
      setError('알림을 불러오지 못했습니다.');
      setNotifications([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadNotifications(false);
    setRefreshing(false);
  }, [loadNotifications]);

  useEffect(() => {
    if (visible) {
      loadNotifications();
    }
  }, [visible, loadNotifications]);

  // initialNotificationId가 있으면 해당 알림으로 스크롤
  useEffect(() => {
    if (initialNotificationId && notifications.length > 0 && scrollViewRef.current) {
      const notificationIndex = notifications.findIndex(n => n.notification_id === initialNotificationId);
      if (notificationIndex >= 0) {
        // 알림이 로드된 후 스크롤 (약간의 지연 필요)
        setTimeout(() => {
          scrollViewRef.current?.scrollTo({
            y: notificationIndex * 80, // 대략적인 높이
            animated: true,
          });
        }, 500);
      }
    }
  }, [initialNotificationId, notifications]);

  const handleNotificationPress = async (notification: NotificationItem) => {
    // 읽지 않은 알림인 경우 읽음 처리
    if (!notification.is_read) {
      try {
        await NotificationAPI.markAsRead(notification.notification_id);
        setNotifications(prev =>
          prev.map(n =>
            n.notification_id === notification.notification_id ? {...n, is_read: true} : n,
          ),
        );
      } catch (err) {
        console.error('❌ [NotificationListScreen] 알림 읽음 처리 실패:', err);
      }
    }

    // TODO: 알림 타입에 따라 해당 화면으로 이동
    // if (notification.target_id) {
    //   // 레시피 상세 화면으로 이동
    //   navigation.navigate('RecipeDetail', {recipeId: notification.target_id});
    // }
  };

  // 섹션별로 그룹화
  const sections: Array<'오늘' | '어제' | '이전'> = ['오늘', '어제', '이전'];
  const notificationsBySection = {
    오늘: notifications.filter(n => n.section === '오늘'),
    어제: notifications.filter(n => n.section === '어제'),
    이전: notifications.filter(n => n.section === '이전'),
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent={false} 
      onRequestClose={onClose}
      statusBarTranslucent={false}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* 헤더 - insets.top을 직접 적용 */}
        <View style={[styles.header, {paddingTop: insets.top + spacing.m}]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>알림</Text>
          <View style={{width: 24}} />
        </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieSpinner size="large" />
          <Text style={styles.loadingText}>알림을 불러오는 중...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={loadNotifications}>
            <Text style={styles.retryButtonText}>다시 시도</Text>
          </TouchableOpacity>
        </View>
      ) : notifications.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>알림이 없습니다.</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollViewRef}
          style={styles.list}
          contentContainerStyle={{paddingBottom: spacing.xl}}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          {sections.map(section => {
            const sectionNotifications = notificationsBySection[section];
            if (sectionNotifications.length === 0) return null;

            return (
              <View key={section}>
                <Text style={styles.sectionHeader}>{section}</Text>
                {sectionNotifications.map(n => (
                  <TouchableOpacity
                    key={n.notification_id}
                    style={[styles.card, !n.is_read && styles.cardUnread]}
                    onPress={() => handleNotificationPress(n)}
                  >
                    <View style={[styles.iconCircle, {borderColor: typeIcon[n.type].color}]}>
                      <Icon name={typeIcon[n.type].name} size={16} color={typeIcon[n.type].color} />
                    </View>
                    <View style={styles.cardContent}>
                      <Text style={[styles.cardText, !n.is_read && styles.cardTextUnread]} numberOfLines={2}>
                        {n.title}
                      </Text>
                      <Text style={styles.timeText}>{n.time}</Text>
                    </View>
                    {!n.is_read && <View style={styles.unreadDot} />}
                  </TouchableOpacity>
                ))}
              </View>
            );
          })}
        </ScrollView>
      )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: colors.background},
  header: {
     flexDirection: 'row',
     alignItems: 'center',
     paddingHorizontal: spacing.m,
     paddingVertical: spacing.m,
   },
  backButton: {padding: spacing.xs},
  title: {...typography.h2, fontWeight: '700', color: colors.textPrimary, flex: 1, textAlign: 'center'},
  list: {flex: 1},
  sectionHeader: {
    ...typography.bodySmall,
    color: colors.textSecondary,
    textAlign: 'center',
    marginVertical: spacing.s,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    marginHorizontal: spacing.s,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    marginBottom: spacing.s,
    position: 'relative',
  },
  cardUnread: {
    backgroundColor: colors.background,
  },
  iconCircle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 2,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.m,
    backgroundColor: colors.white,
  },
  cardContent: {
    flex: 1,
  },
  cardText: {...typography.bodyRegular, color: colors.textPrimary},
  cardTextUnread: {
    fontWeight: '600',
  },
  timeText: {...typography.captionRegular, color: colors.textSecondary, marginTop: spacing.xs},
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginLeft: spacing.s,
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  errorText: {
    color: colors.error,
    textAlign: 'center',
    marginBottom: spacing.m,
  },
  retryButton: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.m,
  },
  retryButtonText: {
    color: colors.white,
    fontWeight: '600',
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
});

export default NotificationListScreen;





import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {LottieSpinner} from '../../components/common';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AnnouncementAPI} from '../../api/ApiRequests';
import NoticeDetailScreen from './NoticeDetailScreen';

interface Notice {
  announce_code: number;
  title: string;
  date: string;
  important: boolean;
  view_count: number;
}

interface NoticeScreenProps {
  visible: boolean;
  onClose?: () => void;
}

/**
 * 공지사항 화면
 */
const NoticeScreen: React.FC<NoticeScreenProps> = ({visible, onClose}) => {
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const [selectedNotice, setSelectedNotice] = useState<Notice | null>(null);
  const [isDetailVisible, setIsDetailVisible] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadAnnouncements = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await AnnouncementAPI.getAnnouncements();
      if (response?.success && Array.isArray(response.data)) {
        setNotices(response.data);
      } else {
        setNotices([]);
      }
    } catch (err) {
      console.error('❌ [NoticeScreen] 공지사항 로드 실패:', err);
      setError('공지사항을 불러오지 못했습니다.');
      setNotices([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadAnnouncements();
    }
  }, [visible, loadAnnouncements]);

  const handleNoticePress = (notice: Notice) => {
    setSelectedNotice(notice);
    setIsDetailVisible(true);
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
          <Text style={styles.headerTitle}>공지 사항</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <LottieSpinner size="large" />
            <Text style={styles.loadingText}>공지사항을 불러오는 중...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={loadAnnouncements}>
              <Text style={styles.retryButtonText}>다시 시도</Text>
            </TouchableOpacity>
          </View>
        ) : notices.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>공지사항이 없습니다.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {notices.map((notice, index) => (
              <TouchableOpacity
                key={notice.announce_code}
                style={[
                  styles.noticeItem,
                  index !== notices.length - 1 && styles.noticeItemBorder,
                ]}
                onPress={() => handleNoticePress(notice)}>
                <View style={styles.noticeItemContent}>
                  <View style={styles.noticeTitleRow}>
                    <Text style={styles.noticeTitle}>{notice.title}</Text>
                    {notice.important && (
                      <View style={styles.importantBadge}>
                        <Text style={styles.importantBadgeText}>중요</Text>
                      </View>
                    )}
                  </View>
                  <Text style={styles.noticeDate}>{notice.date}</Text>
                </View>
                <Icon name="chevron-right" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* 공지사항 상세 화면 */}
        {selectedNotice && (
          <NoticeDetailScreen
            visible={isDetailVisible}
            noticeData={{
              announce_code: selectedNotice.announce_code,
              title: selectedNotice.title,
              date: selectedNotice.date,
              important: selectedNotice.important,
            }}
            onClose={() => {
              setIsDetailVisible(false);
              setTimeout(() => {
                setSelectedNotice(null);
                loadAnnouncements(); // 상세 화면 닫을 때 목록 새로고침
              }, 300);
            }}
          />
        )}
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
    backgroundColor: colors.background,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  noticeItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
    backgroundColor: colors.white,
  },
  noticeItemBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  noticeItemContent: {
    flex: 1,
  },
  noticeTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xs,
  },
  noticeDate: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    fontSize: 12,
  },
  noticeTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  importantBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.s,
    marginLeft: spacing.s,
  },
  importantBadgeText: {
    ...typography.bodySmall,
    color: colors.white,
    fontSize: 11,
    fontWeight: '600',
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

export default NoticeScreen;


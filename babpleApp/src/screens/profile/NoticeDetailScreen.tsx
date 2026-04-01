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
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AnnouncementAPI} from '../../api/ApiRequests';

interface NoticeDetailScreenProps {
  visible: boolean;
  noticeData: {
    announce_code: number;
    title: string;
    date: string;
    important: boolean;
  } | null;
  onClose?: () => void;
}

/**
 * 공지사항 상세 화면
 */
const NoticeDetailScreen: React.FC<NoticeDetailScreenProps> = ({
  visible,
  noticeData,
  onClose,
}) => {
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible && noticeData) {
      loadAnnouncementDetail();
    }
  }, [visible, noticeData]);

  const loadAnnouncementDetail = async () => {
    if (!noticeData) return;
    
    try {
      setLoading(true);
      const response = await AnnouncementAPI.getAnnouncementDetail(noticeData.announce_code);
      if (response?.success && response.data) {
        setContent(response.data.content);
      }
    } catch (error) {
      console.error('❌ [NoticeDetailScreen] 공지사항 상세 로드 실패:', error);
    } finally {
      setLoading(false);
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

  if (!visible || !noticeData) {
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
          <Text style={styles.headerTitle}>공지사항</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 제목 영역 */}
          <View style={styles.titleSection}>
            <View style={styles.titleHeader}>
              <Text style={styles.title}>{noticeData.title}</Text>
              {noticeData.important && (
                <View style={styles.importantBadge}>
                  <Text style={styles.importantBadgeText}>중요</Text>
                </View>
              )}
            </View>
            <Text style={styles.date}>{noticeData.date}</Text>
          </View>

          {/* 구분선 */}
          <View style={styles.divider} />

          {/* 본문 영역 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>내용을 불러오는 중...</Text>
            </View>
          ) : (
            <View style={styles.contentSection}>
              <Text style={styles.content}>{content}</Text>
            </View>
          )}

          {/* 여백 */}
          <View style={styles.bottomSpacer} />
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
  titleSection: {
    padding: spacing.l,
  },
  titleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.s,
  },
  title: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
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
  date: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontSize: 14,
  },
  divider: {
    height: 8,
    backgroundColor: colors.background,
  },
  contentSection: {
    padding: spacing.l,
  },
  content: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    lineHeight: 24,
    fontSize: 15,
  },
  bottomSpacer: {
    height: spacing.xl,
  },
});

export default NoticeDetailScreen;


import React, {useState, useEffect, useRef, useCallback} from 'react';
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
import Markdown from 'react-native-markdown-display';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AuthAPI, TermPolicy} from '../../api/ApiRequests';

interface TermsScreenProps {
  visible: boolean;
  onClose?: () => void;
}

/**
 * 서비스 이용약관 화면
 */
const TermsScreen: React.FC<TermsScreenProps> = ({visible, onClose}) => {
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const [terms, setTerms] = useState<TermPolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTermId, setExpandedTermId] = useState<number | null>(null);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);
      // 일반 약관(type=0) 조회
      const response = await AuthAPI.getTermsPolicies([0]);
      if (response?.success && Array.isArray(response.data)) {
        setTerms(response.data);
      } else {
        setTerms([]);
      }
    } catch (err) {
      console.error('❌ [TermsScreen] 약관 로드 실패:', err);
      setTerms([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadTerms();
    }
  }, [visible, loadTerms]);

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
          <Text style={styles.headerTitle}>서비스 이용약관</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>약관을 불러오는 중...</Text>
          </View>
        ) : terms.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>약관 정보가 없습니다.</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {terms.map((term) => {
              const isExpanded = expandedTermId === term.id;
              return (
                <View key={term.id} style={styles.termContainer}>
                  <TouchableOpacity
                    style={styles.termItem}
                    onPress={() => {
                      setExpandedTermId(isExpanded ? null : term.id);
                    }}>
                    <View style={styles.termItemContent}>
                      <View style={styles.termTitleRow}>
                        <Text style={styles.termTitle}>{term.title}</Text>
                        {term.required && (
                          <View style={styles.requiredBadge}>
                            <Text style={styles.requiredBadgeText}>필수</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <Icon
                      name={isExpanded ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {isExpanded && (
                    <Animated.View style={styles.termContent}>
                      <ScrollView
                        style={styles.termContentScroll}
                        showsVerticalScrollIndicator={false}>
                        <Markdown style={markdownStyles}>
                          {term.content}
                        </Markdown>
                      </ScrollView>
                    </Animated.View>
                  )}
                </View>
              );
            })}
          </ScrollView>
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
  termContainer: {
    backgroundColor: colors.white,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  termItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.l,
  },
  termItemContent: {
    flex: 1,
  },
  termTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  termTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  requiredBadge: {
    backgroundColor: colors.error,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xxs,
    borderRadius: borderRadius.s,
    marginLeft: spacing.s,
  },
  requiredBadgeText: {
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
  termContent: {
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    backgroundColor: colors.background,
  },
  termContentText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    lineHeight: 24,
  },
  termContentScroll: {
    flex: 1,
  },
});

// 마크다운 스타일
const markdownStyles = {
  body: {
    color: colors.textPrimary,
    fontSize: 14,
    lineHeight: 24,
    fontFamily: 'System',
  },
  heading1: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 16,
    marginBottom: 8,
  },
  heading2: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 14,
    marginBottom: 7,
  },
  heading3: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 12,
    marginBottom: 6,
  },
  heading4: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.textPrimary,
    marginTop: 10,
    marginBottom: 5,
  },
  paragraph: {
    marginTop: 8,
    marginBottom: 8,
    color: colors.textPrimary,
  },
  listItem: {
    marginTop: 4,
    marginBottom: 4,
    color: colors.textPrimary,
  },
  bullet_list: {
    marginTop: 8,
    marginBottom: 8,
  },
  ordered_list: {
    marginTop: 8,
    marginBottom: 8,
  },
  code_inline: {
    backgroundColor: colors.lightGray,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: 'monospace',
  },
  code_block: {
    backgroundColor: colors.lightGray,
    padding: 12,
    borderRadius: 8,
    marginTop: 8,
    marginBottom: 8,
    fontFamily: 'monospace',
  },
  strong: {
    fontWeight: 'bold',
    color: colors.textPrimary,
  },
  em: {
    fontStyle: 'italic',
    color: colors.textPrimary,
  },
  link: {
    color: colors.primary,
    textDecorationLine: 'underline',
  },
  hr: {
    backgroundColor: colors.lightGray,
    height: 1,
    marginTop: 16,
    marginBottom: 16,
  },
  blockquote: {
    borderLeftWidth: 4,
    borderLeftColor: colors.primary,
    paddingLeft: 12,
    marginTop: 8,
    marginBottom: 8,
    backgroundColor: colors.background,
  },
  table: {
    marginTop: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  thead: {
    backgroundColor: colors.background,
  },
  th: {
    padding: 8,
    fontWeight: 'bold',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  td: {
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
};

export default TermsScreen;


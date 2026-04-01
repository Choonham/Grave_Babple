import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AppAPI} from '../../api/ApiRequests';

interface CustomerServiceScreenProps {
  visible: boolean;
  onClose?: () => void;
}

interface QnAItem {
  id: number;
  question: string;
  answer: string;
}

/**
 * 고객센터 및 도움말 화면
 */
const CustomerServiceScreen: React.FC<CustomerServiceScreenProps> = ({visible, onClose}) => {
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const [customerServiceInfo, setCustomerServiceInfo] = useState<{
    business_name: string;
    business_number: string;
    business_address: string;
    customer_service_phone: string;
    customer_service_email: string;
    operating_hours: string;
  } | null>(null);
  const [qnaList, setQnaList] = useState<QnAItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedQnA, setExpandedQnA] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [serviceInfoResponse, qnaResponse] = await Promise.all([
        AppAPI.getCustomerServiceInfo(),
        AppAPI.getQnA(),
      ]);

      if (serviceInfoResponse?.success && serviceInfoResponse.data) {
        setCustomerServiceInfo(serviceInfoResponse.data);
      }

      if (qnaResponse?.success && Array.isArray(qnaResponse.data)) {
        setQnaList(qnaResponse.data);
      }
    } catch (err) {
      console.error('❌ [CustomerServiceScreen] 데이터 로드 실패:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (visible) {
      loadData();
    }
  }, [visible, loadData]);

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

  const handlePhonePress = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleEmailPress = (email: string) => {
    Linking.openURL(`mailto:${email}`);
  };

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
          <Text style={styles.headerTitle}>고객센터 및 도움말</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>정보를 불러오는 중...</Text>
          </View>
        ) : (
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 사업자 정보 */}
            {customerServiceInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>사업자 정보</Text>
                <View style={styles.infoCard}>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>상호명</Text>
                    <Text style={styles.infoValue}>{customerServiceInfo.business_name}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>사업자등록번호</Text>
                    <Text style={styles.infoValue}>{customerServiceInfo.business_number}</Text>
                  </View>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>주소</Text>
                    <Text style={styles.infoValue}>{customerServiceInfo.business_address}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* 고객센터 연락처 */}
            {customerServiceInfo && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>고객센터</Text>
                <View style={styles.infoCard}>
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => handlePhonePress(customerServiceInfo.customer_service_phone)}>
                    <Icon name="phone" size={20} color={colors.primary} />
                    <Text style={styles.contactText}>{customerServiceInfo.customer_service_phone}</Text>
                    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.contactRow}
                    onPress={() => handleEmailPress(customerServiceInfo.customer_service_email)}>
                    <Icon name="mail" size={20} color={colors.primary} />
                    <Text style={styles.contactText}>{customerServiceInfo.customer_service_email}</Text>
                    <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                  </TouchableOpacity>
                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>운영시간</Text>
                    <Text style={styles.infoValue}>{customerServiceInfo.operating_hours}</Text>
                  </View>
                </View>
              </View>
            )}

            {/* QnA */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>자주 묻는 질문</Text>
              {qnaList.map((qna) => (
                <View key={qna.id} style={styles.qnaItem}>
                  <TouchableOpacity
                    style={styles.qnaQuestion}
                    onPress={() => {
                      setExpandedQnA(expandedQnA === qna.id ? null : qna.id);
                    }}>
                    <Text style={styles.qnaQuestionText}>{qna.question}</Text>
                    <Icon
                      name={expandedQnA === qna.id ? 'chevron-up' : 'chevron-down'}
                      size={20}
                      color={colors.textSecondary}
                    />
                  </TouchableOpacity>
                  {expandedQnA === qna.id && (
                    <View style={styles.qnaAnswer}>
                      <Text style={styles.qnaAnswerText}>{qna.answer}</Text>
                    </View>
                  )}
                </View>
              ))}
            </View>
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
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: spacing.l,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  infoCard: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.l,
    padding: spacing.m,
    borderRadius: borderRadius.m,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.m,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
    minWidth: 100,
  },
  infoValue: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'right',
  },
  contactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  contactText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    flex: 1,
    marginLeft: spacing.m,
  },
  qnaItem: {
    backgroundColor: colors.background,
    marginHorizontal: spacing.l,
    marginBottom: spacing.xs,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
  },
  qnaQuestion: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: spacing.m,
  },
  qnaQuestionText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    flex: 1,
  },
  qnaAnswer: {
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  qnaAnswerText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    lineHeight: 24,
    marginTop: spacing.s,
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
});

export default CustomerServiceScreen;


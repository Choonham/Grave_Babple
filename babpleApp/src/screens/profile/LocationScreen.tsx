import React, {useState, useEffect, useRef, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {TermsAPI} from '../../api/ApiRequests';

interface LocationScreenProps {
  visible: boolean;
  onClose?: () => void;
}

/**
 * 위치 서비스 설정 화면
 */
const LocationScreen: React.FC<LocationScreenProps> = ({visible, onClose}) => {
  const [locationEnabled, setLocationEnabled] = useState(true);
  const slideAnim = useRef(new Animated.Value(-1)).current;
  const [terms, setTerms] = useState<Array<{term_id: number; title: string; content: string}>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTerm, setSelectedTerm] = useState<{term_id: number; title: string; content: string} | null>(null);
  const [isTermDetailVisible, setIsTermDetailVisible] = useState(false);

  const loadTerms = useCallback(async () => {
    try {
      setLoading(true);
      const response = await TermsAPI.getTerms();
      if (response?.success && Array.isArray(response.data)) {
        // 위치 서비스 관련 약관만 필터링 (제목에 "위치"가 포함된 것)
        const locationTerms = response.data.filter((term: any) =>
          term.title.toLowerCase().includes('위치') || term.title.toLowerCase().includes('location')
        );
        setTerms(locationTerms);
      } else {
        setTerms([]);
      }
    } catch (err) {
      console.error('❌ [LocationScreen] 약관 로드 실패:', err);
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
          <Text style={styles.headerTitle}>위치 서비스 약관</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 위치 서비스 허용 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>위치 서비스 약관</Text>
            {/*<View style={styles.settingItem}>
              <View style={styles.settingItemLeft}>
                <Icon name="map-pin" size={24} color={colors.textPrimary} />
                <Text style={styles.settingItemText}>허용됨</Text>
              </View>
              <Switch
                value={locationEnabled}
                onValueChange={setLocationEnabled}
                trackColor={{false: colors.lightGray, true: '#FF7A5A'}}
                thumbColor={colors.white}
              />
            </View>*/}
          </View>

          {/* 위치 서비스 이용 약관 확인 */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>위치 서비스 이용 약관</Text>
            {loading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color={colors.primary} />
                <Text style={styles.loadingText}>약관을 불러오는 중...</Text>
              </View>
            ) : terms.length === 0 ? (
              <View style={styles.emptyContainer}>
                <Text style={styles.emptyText}>약관 정보가 없습니다.</Text>
              </View>
            ) : (
              terms.map((term) => (
                <TouchableOpacity
                  key={term.term_id}
                  style={styles.settingItem}
                  onPress={() => {
                    setSelectedTerm(term);
                    setIsTermDetailVisible(true);
                  }}>
                  <View style={styles.settingItemLeft}>
                    <Icon name="file-text" size={24} color={colors.textPrimary} />
                    <Text style={styles.settingItemText}>{term.title}</Text>
                  </View>
                  <Icon name="chevron-right" size={20} color={colors.textPrimary} />
                </TouchableOpacity>
              ))
            )}
          </View>
        </ScrollView>

        {/* 약관 상세 모달 */}
        {isTermDetailVisible && selectedTerm && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>{selectedTerm.title}</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIsTermDetailVisible(false);
                    setTimeout(() => setSelectedTerm(null), 300);
                  }}>
                  <Icon name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>
              <ScrollView style={styles.modalScrollView}>
                <Text style={styles.modalContentText}>{selectedTerm.content}</Text>
              </ScrollView>
            </View>
          </View>
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
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    backgroundColor: colors.offWhite,
    marginHorizontal: spacing.l,
    marginBottom: spacing.xs,
    borderRadius: 8,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginLeft: spacing.m,
  },
  loadingContainer: {
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: spacing.s,
    fontSize: 14,
    color: colors.textSecondary,
  },
  emptyContainer: {
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    width: '90%',
    maxHeight: '80%',
    padding: spacing.l,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  modalTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
  },
  modalScrollView: {
    maxHeight: 400,
  },
  modalContentText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    lineHeight: 24,
  },
});

export default LocationScreen;


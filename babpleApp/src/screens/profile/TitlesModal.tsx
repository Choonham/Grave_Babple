import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  ScrollView,
  Image,
  Dimensions,
  Platform,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {UserAPI} from '../../api/ApiRequests';

interface Title {
  title_id: number;
  name: string;
  description: string;
  icon_url: string | null;
  earned: boolean;
}

interface TitlesModalProps {
  visible: boolean;
  onClose: () => void;
}

import {API_BASE_URL} from '../../config/api';

const buildMediaUrl = (path?: string | null) => {
  if (!path) {
    console.log('⚠️ [TitlesModal] icon_url이 없습니다:', path);
    return null;
  }

  const trimmed = path.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    console.log('✅ [TitlesModal] 완전한 URL:', trimmed);
    return trimmed;
  }

  let normalized = trimmed.replace(/\\/g, '/');

  if (normalized.startsWith('/uploads')) {
    const finalUrl = `${API_BASE_URL}${normalized}`;
    console.log('✅ [TitlesModal] /uploads로 시작 → 최종 URL:', finalUrl);
    return finalUrl;
  }

  if (normalized.startsWith('uploads')) {
    normalized = normalized.replace(/^uploads/, '/uploads');
  } else {
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized.startsWith('/uploads')) {
      normalized = `/uploads${normalized}`;
    }
  }

  const finalUrl = `${API_BASE_URL}${normalized}`;
  console.log('✅ [TitlesModal] 변환된 URL:', {
    원본: path,
    정규화: normalized,
    최종: finalUrl
  });
  return finalUrl;
};

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

/**
 * 타이틀 모달
 */
const TitlesModal: React.FC<TitlesModalProps> = ({visible, onClose}) => {
  const [selectedTitle, setSelectedTitle] = useState<number | null>(null);
  const [toastVisible, setToastVisible] = useState(false);
  const [titles, setTitles] = useState<Title[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTitleDescription, setSelectedTitleDescription] = useState<string>('');
  const [imageErrors, setImageErrors] = useState<Set<number>>(new Set());

  // 타이틀 데이터 로드
  useEffect(() => {
    if (visible) {
      // 모달이 열릴 때 이미지 에러 상태 리셋
      setImageErrors(new Set());
      loadTitles();
    }
  }, [visible]);

  // Android 뒤로가기 버튼 처리
  useEffect(() => {
    if (!visible) {
      return;
    }

    const onBackPress = () => {
      onClose();
      return true; // 기본 동작 방지
    };

    if (Platform.OS === 'android') {
      const backHandler = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => backHandler.remove();
    }
  }, [visible, onClose]);

  const loadTitles = async () => {
    try {
      setLoading(true);
      const response = await UserAPI.getMyTitles();
      if (response.success && response.data) {
        console.log('📌 [TitlesModal] 타이틀 데이터:', response.data);
        setTitles(response.data);
      }
    } catch (error) {
      console.error('타이틀 로드 오류:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTitlePress = (title: Title) => {
    setSelectedTitle(title.title_id);
    setSelectedTitleDescription(title.description);

    // 토스트 메시지 표시
    setToastVisible(true);

    // 4초 후 토스트 숨김 (더 긴 시간으로 조정)
    setTimeout(() => {
      setToastVisible(false);
    }, 4000);
  };

  const handleImageError = (titleId: number, iconUrl: string | null) => {
    console.error('❌ [TitlesModal] 이미지 로딩 실패:', {
      titleId,
      iconUrl,
      생성된URL: buildMediaUrl(iconUrl)
    });
    setImageErrors(prev => new Set(prev).add(titleId));
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.modalContainer}>
        {/* 오버레이 */}
        <TouchableOpacity
          style={styles.overlay}
          activeOpacity={1}
          onPress={onClose}
        />
        {/* 모달 컨텐츠 */}
        <View style={styles.modalContent}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>나의 타이틀</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* 타이틀 그리드 */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.gridContainer}
              showsVerticalScrollIndicator={false}>
              {titles.map((title) => (
                <View key={title.title_id} style={styles.titleItem}>
                  <TouchableOpacity
                    style={[
                      styles.titleButton,
                      selectedTitle === title.title_id && styles.titleButtonSelected,
                    ]}
                    onPress={() => handleTitlePress(title)}>
                    {title.icon_url && !imageErrors.has(title.title_id) ? (
                      <Image
                        source={{uri: buildMediaUrl(title.icon_url) || undefined}}
                        style={[
                          styles.titleIcon as any,
                          !title.earned && styles.titleIconUnearned,
                        ]}
                        defaultSource={require('../../../assets/icon/title/title01.png')}
                        onLoadStart={() => console.log('🔄 [TitlesModal] 이미지 로딩 시작:', title.title_id, title.name)}
                        onLoadEnd={() => console.log('✅ [TitlesModal] 이미지 로딩 완료:', title.title_id, title.name)}
                        onError={() => handleImageError(title.title_id, title.icon_url)}
                      />
                    ) : (
                      <View
                        style={[
                          styles.titleIcon,
                          styles.titleIconPlaceholder,
                          !title.earned && styles.titleIconUnearned,
                        ]}>
                        <Icon name="award" size={30} color={title.earned ? colors.primary : colors.textTertiary} />
                      </View>
                    )}
                  </TouchableOpacity>
                  <Text
                    style={[
                      styles.titleLabel,
                      !title.earned && styles.titleLabelUnearned,
                    ]}>
                    {title.name}
                  </Text>
                </View>
              ))}
            </ScrollView>
          )}

          {/* 커스텀 토스트 */}
          {toastVisible && selectedTitleDescription && (
            <View style={styles.toastContainer}>
              <Text style={styles.toastText}>{selectedTitleDescription}</Text>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: colors.white,
    borderRadius: 20,
    width: '90%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.8,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700' as const,
    color: colors.textPrimary,
  },
  closeButton: {
    padding: spacing.xs,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: spacing.l,
    paddingTop: spacing.m,
  },
  titleItem: {
    width: '33.333%',
    alignItems: 'center',
    marginBottom: spacing.l,
  },
  titleButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#FFE4D6', // 어린이 아트 스타일 배경색
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'transparent',
  },
  titleButtonSelected: {
    borderColor: colors.primary,
  },
  titleIcon: {
    width: 60,
    height: 60,
  },
  titleIconUnearned: {
    opacity: 0.3,
  },
  titleLabel: {
    ...typography.infoRegular,
    color: colors.textPrimary,
    marginTop: spacing.xs,
    fontSize: 12,
    textAlign: 'center',
  },
  titleLabelUnearned: {
    color: colors.textTertiary,
  },
  toastContainer: {
    position: 'absolute',
    top: '20%',
    alignSelf: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    borderRadius: borderRadius.m,
    zIndex: 1000,
  },
  toastText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontSize: 13,
    fontWeight: '500' as const,
  },
  loadingContainer: {
    paddingVertical: spacing.xl * 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  titleIconPlaceholder: {
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default TitlesModal;


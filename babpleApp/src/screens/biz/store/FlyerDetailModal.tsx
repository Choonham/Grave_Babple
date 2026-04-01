import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  ActivityIndicator,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import FlyerModifyScreen from './FlyerModifyScreen';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {StoreAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

import {API_BASE_URL} from '../../../config/api';

/**
 * 이미지 URL 빌드 (상대 경로를 전체 URL로 변환)
 */
const buildImageUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  // 이미 완전한 URL인 경우
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 백슬래시를 슬래시로 변환
  let normalized = trimmed.replace(/\\/g, '/');

  // /uploads로 시작하는 경우 그대로 사용
  if (normalized.startsWith('/uploads')) {
    return `${API_BASE_URL}${normalized}`;
  }

  // uploads로 시작하는 경우 앞에 /만 추가
  if (normalized.startsWith('uploads')) {
    normalized = `/${normalized}`;
    return `${API_BASE_URL}${normalized}`;
  }

  // 그 외의 경우 /uploads/ 접두사 추가
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.startsWith('/uploads')) {
    normalized = `/uploads${normalized}`;
  }

  return `${API_BASE_URL}${normalized}`;
};

const {height: SCREEN_HEIGHT, width: SCREEN_WIDTH} = Dimensions.get('window');

interface FlyerDetailModalProps {
  visible: boolean;
  onClose: () => void;
  flyer: {
    flyer_id: string;
    title?: string | null;
    start_date?: Date | string;
    end_date?: Date | string;
    flyer_image_url?: string;
    view_count?: number;
    created_at?: Date;
    is_active?: boolean;
    store_id?: string; // store_id 추가
  };
  onModify?: () => void;
  onDelete?: () => void;
  isMine?: boolean; // 내 전단지인지 여부
}

/**
 * 전단지 상세 정보 모달
 */
const FlyerDetailModal: React.FC<FlyerDetailModalProps> = ({
  visible,
  onClose,
  flyer,
  onModify,
  onDelete,
  isMine = false,
}) => {
  const {alert, confirm} = useAlert();
  const [isModifyScreenVisible, setIsModifyScreenVisible] = useState(false);
  const [flyerData, setFlyerData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [isImageFullScreen, setIsImageFullScreen] = useState(false);

  /**
   * 전단지 상세 정보 로드
   */
  useEffect(() => {
    if (visible && flyer?.flyer_id) {
      loadFlyerDetail();
    }
  }, [visible, flyer?.flyer_id]);

  const loadFlyerDetail = async () => {
    try {
      setLoading(true);
      let response;
      if (isMine) {
        // 내 전단지인 경우
        response = await StoreAPI.getFlyer(flyer.flyer_id);
      } else if (flyer.store_id) {
        // 다른 유저의 전단지인 경우 (공개 API 사용)
        response = await StoreAPI.getStoreFlyer(flyer.store_id, flyer.flyer_id);
      } else {
        alert('오류', '전단지 정보를 불러올 수 없습니다.');
        return;
      }
      
      if (response.success && response.data) {
        setFlyerData(response.data);
        
        // view_count 증가 (모달이 열릴 때만)
        try {
          await StoreAPI.incrementFlyerViewCount(flyer.flyer_id);
        } catch (error) {
          console.error('❌ [전단지] view_count 증가 실패:', error);
          // view_count 증가 실패는 조용히 처리 (사용자에게 알리지 않음)
        }
      } else {
        alert('오류', '전단지 정보를 불러올 수 없습니다.');
      }
    } catch (error: any) {
      console.error('❌ [전단지 상세] 로드 오류:', error);
      alert('오류', '전단지 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleModify = () => {
    setIsModifyScreenVisible(true);
  };

  const handleModifyClose = () => {
    setIsModifyScreenVisible(false);
    // 전단지 정보 다시 로드
    if (flyer?.flyer_id) {
      loadFlyerDetail();
    }
    onClose();
  };

  const handleDelete = () => {
    // Modal 위에서는 native Alert 사용
    Alert.alert(
      '삭제 확인',
      '정말로 이 전단지를 삭제하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '삭제',
          style: 'destructive',
          onPress: () => {
            if (onDelete) {
              onDelete();
            }
            onClose();
          },
        },
      ],
    );
  };

  /**
   * 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
   */
  const formatDate = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // 기간 포맷팅
  const formatPeriod = () => {
    const data = flyerData || flyer;
    if (data.start_date && data.end_date) {
      return `${formatDate(data.start_date)} ~ ${formatDate(data.end_date)}`;
    }
    return '';
  };

  const displayData = flyerData || flyer;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={true}
      onRequestClose={onClose}>
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={onClose}>
        <View style={styles.modalContainer} onStartShouldSetResponder={() => true}>
          {/* 헤더 */}
          <View style={styles.header}>
            <Text style={styles.headerTitle}>
              {displayData.title || '전단지'}
            </Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.loadingText}>전단지 정보를 불러오는 중...</Text>
            </View>
          ) : (
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={false}>
              {/* 전단지 이미지 */}
              {displayData.flyer_image_url && (
                <TouchableOpacity
                  style={styles.imageContainer}
                  onPress={() => setIsImageFullScreen(true)}
                  activeOpacity={0.9}>
                  <Image
                    source={{
                      uri: buildImageUrl(displayData.flyer_image_url) || '',
                    }}
                    style={styles.flyerImage}
                    resizeMode="contain"
                  />
                </TouchableOpacity>
              )}

              {/* 기간 */}
              {formatPeriod() && (
                <Text style={styles.period}>기간: {formatPeriod()}</Text>
              )}
            </ScrollView>
          )}

          {/* 액션 버튼 (내 전단지인 경우에만 표시) */}
          {isMine && (
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.modifyButton}
                onPress={handleModify}>
                <Text style={styles.modifyButtonText}>수정하기</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}>
                <Text style={styles.deleteButtonText}>삭제하기</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </TouchableOpacity>

      {/* 전단지 수정 화면 */}
      {displayData && (
        <FlyerModifyScreen
          visible={isModifyScreenVisible}
          onClose={handleModifyClose}
          flyer={displayData}
        />
      )}

      {/* 전체화면 이미지 뷰어 */}
      {displayData.flyer_image_url && (
        <Modal
          visible={isImageFullScreen}
          transparent={true}
          animationType="fade"
          onRequestClose={() => setIsImageFullScreen(false)}>
          <View style={styles.fullScreenContainer}>
            <TouchableOpacity
              style={styles.fullScreenCloseButton}
              onPress={() => setIsImageFullScreen(false)}
              activeOpacity={0.7}>
              <Icon name="x" size={28} color={colors.white} />
            </TouchableOpacity>
            <Image
              source={{
                uri: buildImageUrl(displayData.flyer_image_url) || '',
              }}
              style={styles.fullScreenImage}
              resizeMode="contain"
            />
          </View>
        </Modal>
      )}
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    width: '90%',
    maxWidth: 400,
    maxHeight: SCREEN_HEIGHT * 0.9,
    overflow: 'hidden',
    flexDirection: 'column',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.m,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  closeButton: {
    padding: spacing.xs,
    position: 'absolute',
    right: spacing.l,
  },
  scrollView: {
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  scrollContent: {
    padding: spacing.l,
  },
  imageContainer: {
    width: '100%',
    marginBottom: spacing.m,
    alignItems: 'center',
  },
  flyerImage: {
    width: '100%',
    height: undefined,
    aspectRatio: 2 / 1, // 가로 2:세로 1 비율
    borderRadius: borderRadius.m,
  },
  period: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.m,
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.l,
    paddingTop: spacing.m,
    gap: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  modifyButton: {
    flex: 1,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modifyButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600' as const,
  },
  deleteButton: {
    flex: 1,
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  loadingContainer: {
    padding: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 200,
  },
  loadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
  fullScreenContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullScreenCloseButton: {
    position: 'absolute',
    top: spacing.xl,
    right: spacing.l,
    zIndex: 10,
    padding: spacing.m,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: borderRadius.l,
  },
  fullScreenImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
});

export default FlyerDetailModal;


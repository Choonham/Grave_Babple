import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Image,
  ScrollView,
  Dimensions,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import PromotionModifyScreen from './PromotionModifyScreen';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {useAlert} from '../../../contexts/AlertContext';

const {height: SCREEN_HEIGHT} = Dimensions.get('window');

interface PromotionDetailModalProps {
  visible: boolean;
  onClose: () => void;
  promotion: {
    id: string;
    promotion_id?: string;
    image: any;
    title: string;
    subtitle: string;
    quantity: string;
    originalPrice?: string;
    discountPrice: string;
    period: string;
  };
  onModify?: () => void;
  onDelete?: () => void;
  onModifySuccess?: () => void;
  isMine?: boolean; // 가게 소유자인지 여부
}

/**
 * 기획 상품 정보 모달
 */
const PromotionDetailModal: React.FC<PromotionDetailModalProps> = ({
  visible,
  onClose,
  promotion,
  onModify,
  onDelete,
  onModifySuccess,
  isMine = true, // 기본값은 true (기존 동작 유지)
}) => {
  const {alert, confirm} = useAlert();
  const [isModifyScreenVisible, setIsModifyScreenVisible] = useState(false);

  const handleModify = () => {
    setIsModifyScreenVisible(true);
  };

  const handleModifyClose = () => {
    setIsModifyScreenVisible(false);
    onClose();
  };

  const handleDelete = () => {
    // Modal 위에서는 native Alert 사용
    Alert.alert(
      '삭제 확인',
      '정말로 이 기획 상품을 삭제하시겠습니까?',
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
            <Text style={styles.headerTitle}>{promotion.title}</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>

          <View style={styles.contentContainer}>
            <ScrollView
              style={styles.scrollView}
              contentContainerStyle={styles.scrollContent}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}>
              {/* 상품 이미지 */}
              {promotion.image && (
                <View style={styles.imageContainer}>
                  <Image
                    source={
                      typeof promotion.image === 'string'
                        ? {uri: promotion.image}
                        : promotion.image
                    }
                    style={styles.productImage}
                    resizeMode="cover"
                  />
                </View>
              )}

              {/* 상품 설명 */}
              {promotion.subtitle && (
                <Text style={styles.productDescription}>
                  {promotion.subtitle}
                </Text>
              )}

              {/* 상품 정보 (수량) */}
              {promotion.quantity && (
                <Text style={styles.productInfo}>{promotion.quantity}</Text>
              )}

              {/* 가격 정보 */}
              <View style={styles.priceContainer}>
                {promotion.originalPrice && (
                  <Text style={styles.originalPrice}>{promotion.originalPrice}</Text>
                )}
                <Text style={styles.discountPrice}>{promotion.discountPrice}</Text>
              </View>

              {/* 기간 */}
              {promotion.period && (
                <Text style={styles.period}>{promotion.period}</Text>
              )}
            </ScrollView>
          </View>

          {/* 액션 버튼 (가게 소유자일 때만 표시) */}
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

      {/* 기획 상품 수정 화면 */}
      <PromotionModifyScreen
        visible={isModifyScreenVisible}
        onClose={handleModifyClose}
        promotion={promotion}
        onSuccess={() => {
          if (onModifySuccess) {
            onModifySuccess();
          }
          handleModifyClose();
        }}
      />
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
    height: SCREEN_HEIGHT * 0.8,
    maxHeight: SCREEN_HEIGHT * 0.8,
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
  contentContainer: {
    flex: 1,
    minHeight: 0,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.xl,
    flexGrow: 1,
  },
  imageContainer: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.m,
    overflow: 'hidden',
    marginBottom: spacing.m,
    backgroundColor: colors.lightGray,
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productDescription: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  productInfo: {
    fontSize: typography.bodyMedium.fontSize * 1.1,
    lineHeight: typography.bodyMedium.lineHeight * 1.1,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  priceContainer: {
    alignItems: 'center',
    marginBottom: spacing.m,
    gap: spacing.xs,
  },
  originalPrice: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textDecorationLine: 'line-through',
    textAlign: 'center',
  },
  discountPrice: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
    textAlign: 'center',
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
});

export default PromotionDetailModal;


import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';

interface UnfollowModalProps {
  visible: boolean;
  userName: string;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 팔로잉 취소 모달
 */
const UnfollowModal: React.FC<UnfollowModalProps> = ({
  visible,
  userName,
  onClose,
  onConfirm,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.modalContent}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>팔로잉 취소</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={styles.bodyContainer}>
        <Text style={styles.question}>
          {userName}님을 팔로잉에서 제거하시겠습니까?
        </Text>

        {/* 액션 버튼 */}
        <TouchableOpacity
          style={styles.actionButton}
          onPress={onConfirm}>
          <Icon name="user-minus" size={20} color={colors.error} style={styles.buttonIcon} />
          <Text style={styles.actionButtonText}>
            팔로잉 취소하기
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  modalContent: {
    width: '90%',
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  bodyContainer: {
    padding: spacing.l,
  },
  question: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: spacing.l,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    borderWidth: 1,
    borderColor: colors.error,
    backgroundColor: colors.white,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
    color: colors.error,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
});

export default UnfollowModal;


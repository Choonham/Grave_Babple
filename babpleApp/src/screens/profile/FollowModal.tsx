import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';

interface FollowModalProps {
  visible: boolean;
  userName: string;
  onClose: () => void;
  onRegisterWithNotification: () => void;
  onRegisterOnly: () => void;
}

/**
 * 팔로우 모달
 */
const FollowModal: React.FC<FollowModalProps> = ({
  visible,
  userName,
  onClose,
  onRegisterWithNotification,
  onRegisterOnly,
}) => {
  if (!visible) {
    return null;
  }

  return (
    <View style={styles.modalContent}>
      {/* 헤더 */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>팔로우</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={styles.bodyContainer}>
        <Text style={styles.question}>
          {userName}님을 팔로우하고 알림을 받으시겠습니까?
        </Text>

        {/* 액션 버튼들 */}
        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonPrimary]}
            onPress={onRegisterWithNotification}>
            <Icon name="bell" size={20} color={colors.primary} style={styles.buttonIcon} />
            <Text style={[styles.actionButtonText, styles.actionButtonTextPrimary]}>
              팔로우하고 알림 받기
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.actionButton, styles.actionButtonSecondary]}
            onPress={onRegisterOnly}>
            <View style={styles.plusIconContainer}>
              <Icon name="plus" size={16} color={colors.textSecondary} />
            </View>
            <Text style={[styles.actionButtonText, styles.actionButtonTextSecondary]}>
              팔로우만 하기
            </Text>
          </TouchableOpacity>
        </View>
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
  buttonContainer: {
    gap: spacing.xs,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
    borderRadius: borderRadius.m,
    borderWidth: 1,
  },
  actionButtonPrimary: {
    borderColor: colors.primary,
    backgroundColor: colors.white,
  },
  actionButtonSecondary: {
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  actionButtonText: {
    ...typography.bodyMedium,
    fontWeight: '600',
  },
  actionButtonTextPrimary: {
    color: colors.primary,
  },
  actionButtonTextSecondary: {
    color: colors.textSecondary,
  },
  buttonIcon: {
    marginRight: spacing.xs,
  },
  plusIconContainer: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.xs,
  },
});

export default FollowModal;


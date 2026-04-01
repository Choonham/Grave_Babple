import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';

interface NotificationModalProps {
  visible: boolean;
  userName: string;
  isEnabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

/**
 * 알림 설정 모달
 */
const NotificationModal: React.FC<NotificationModalProps> = ({
  visible,
  userName,
  isEnabled,
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
        <Text style={styles.headerTitle}>알림 설정</Text>
        <TouchableOpacity onPress={onClose}>
          <Icon name="x" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 내용 */}
      <View style={styles.bodyContainer}>
        <Text style={styles.question}>
          {userName}님의 알림을 {isEnabled ? '해제' : '등록'}하시겠습니까?
        </Text>

        {/* 액션 버튼 */}
        <TouchableOpacity
          style={[
            styles.actionButton,
            isEnabled ? styles.actionButtonSecondary : styles.actionButtonPrimary,
          ]}
          onPress={onConfirm}>
          <Icon
            name={isEnabled ? 'bell-off' : 'bell'}
            size={20}
            color={isEnabled ? colors.textSecondary : colors.primary}
            style={styles.buttonIcon}
          />
          <Text
            style={[
              styles.actionButtonText,
              isEnabled ? styles.actionButtonTextSecondary : styles.actionButtonTextPrimary,
            ]}>
            알림 {isEnabled ? '해제' : '등록'}하기
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
});

export default NotificationModal;


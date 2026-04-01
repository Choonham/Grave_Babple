import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';

/**
 * 사업자 회원가입 완료 화면
 */
const CompleteRegScreen: React.FC = () => {
  const navigation = useNavigation();

  /**
   * 확인 버튼 처리
   */
  const handleConfirm = () => {
    // PermissionRequest 화면으로 이동
    // @ts-ignore
    navigation.navigate('PermissionRequest');
  };

  /**
   * 닫기 버튼 처리
   */
  const handleClose = () => {
    // PermissionRequest 화면으로 이동
    // @ts-ignore
    navigation.navigate('PermissionRequest');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 헤더 - X 버튼 */}
        <View style={styles.header}>
          <View style={{flex: 1}} />
          <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
            <Icon name="x" size={24} color={colors.textTertiary} />
          </TouchableOpacity>
        </View>

        {/* 메인 콘텐츠 */}
        <View style={styles.content}>
          {/* 성공 아이콘 */}
          <View style={styles.successIconContainer}>
            <View style={styles.successIconCircle}>
              <Icon name="check" size={64} color={colors.success} />
            </View>
          </View>

          {/* 메인 메시지 */}
          <Text style={styles.primaryMessage}>신청이 완료되었습니다.</Text>

          {/* 보조 메시지 */}
          <Text style={styles.secondaryMessage}>
            사장님의 소중한 정보가{'\n'}안전하게 접수되었어요.
          </Text>

          {/* 안내 메시지 */}
          <Text style={styles.infoMessage}>
            관리자 검토 후, 영업일 기준 2~3일 내에{'\n'}가입 승인 여부를 알려드릴게요.
          </Text>
        </View>

        {/* 확인 버튼 - 고정 위치 */}
        <TouchableOpacity
          style={styles.confirmButton}
          onPress={handleConfirm}>
          <Text style={styles.confirmButtonText}>확인</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
  },
  closeButton: {
    padding: spacing.xs,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
  },
  successIconContainer: {
    marginBottom: spacing.xl,
  },
  successIconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: colors.success,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
  },
  primaryMessage: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.l,
    fontWeight: '700',
  },
  secondaryMessage: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    lineHeight: 24,
  },
  infoMessage: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  confirmButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.l,
    marginBottom: 30,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
});

export default CompleteRegScreen;


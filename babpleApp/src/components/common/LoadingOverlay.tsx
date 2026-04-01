import React from 'react';
import {View, Text, StyleSheet, Modal} from 'react-native';
import LottieView from 'lottie-react-native';
import {colors, spacing, typography} from '../../styles/commonStyles';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

/**
 * Lottie 애니메이션을 사용한 로딩 오버레이 컴포넌트
 */
const LoadingOverlay: React.FC<LoadingOverlayProps> = ({
  visible,
  message = '잠시만 기다려주세요...',
}) => {
  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => {}}>
      <View style={styles.container}>
        <View style={styles.content}>
          <LottieView
            source={require('../../../assets/icon/loading/cooking-loader.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
          {message && <Text style={styles.message}>{message}</Text>}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  lottie: {
    width: 200,
    height: 200,
  },
  message: {
    ...typography.bodyLarge,
    color: colors.white,
    textAlign: 'center',
    marginTop: spacing.m,
    fontWeight: '600',
  },
});

export default LoadingOverlay;



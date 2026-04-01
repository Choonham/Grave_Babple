import React from 'react';
import {View, StyleSheet, ViewStyle} from 'react-native';
import LottieView from 'lottie-react-native';

interface LottieSpinnerProps {
  size?: 'small' | 'large';
  style?: ViewStyle;
}

/**
 * ActivityIndicator를 대체하는 작은 Lottie 애니메이션 스피너
 * 인라인으로 사용 가능하며, 오버레이가 없습니다.
 */
const LottieSpinner: React.FC<LottieSpinnerProps> = ({
  size = 'small',
  style,
}) => {
  const spinnerSize = size === 'small' ? 80 : 120;

  return (
    <View style={[styles.container, style]}>
      <LottieView
        source={require('../../../assets/icon/loading/cooking-loader.json')}
        autoPlay
        loop
        style={{
          width: spinnerSize,
          height: spinnerSize,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default LottieSpinner;


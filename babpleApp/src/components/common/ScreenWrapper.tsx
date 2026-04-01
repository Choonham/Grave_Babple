import React from 'react';
import {View, ViewStyle} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, spacing} from '../../styles/commonStyles';

interface ScreenWrapperProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * 모든 화면의 최상위 래퍼 컴포넌트
 * SafeAreaView를 포함하여 시스템 UI 침범을 방지하고, 기본 배경색과 좌우 여백을 제공합니다.
 */
const ScreenWrapper: React.FC<ScreenWrapperProps> = ({children, style}) => {
  return (
    <SafeAreaView style={{flex: 1, backgroundColor: colors.background}} edges={['top']}>
      <View style={[{flex: 1, paddingHorizontal: spacing.l, paddingTop: spacing.l}, style]}>
        {children}
      </View>
    </SafeAreaView>
  );
};

export default ScreenWrapper;


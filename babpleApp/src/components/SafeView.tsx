import React from 'react';
import {StyleSheet, View, StatusBar, Platform} from 'react-native';

/**
 * SafeView - 화면을 안전하게 감싸는 Wrapper 컴포넌트
 * StatusBar 영역을 고려하여 안전한 영역에만 컨텐츠를 표시합니다.
 */
interface SafeViewProps {
  children: React.ReactNode;
  style?: any;
}

export const SafeView: React.FC<SafeViewProps> = ({children, style}) => {
  return (
    <View style={[styles.container, style]}>
      <StatusBar barStyle="dark-content" backgroundColor="#ffffff" />
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
    paddingTop: Platform.OS === 'ios' ? 0 : StatusBar.currentHeight,
  },
});

export default SafeView;

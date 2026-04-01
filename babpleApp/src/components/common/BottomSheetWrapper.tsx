import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ViewStyle,
  Dimensions,
  StyleSheet,
} from 'react-native';
import {colors, borderRadius, spacing} from '../../styles/commonStyles';

interface BottomSheetWrapperProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const {height} = Dimensions.get('window');

/**
 * 화면 하단에서 올라오는 모달의 기본 레이아웃 컴포넌트
 * 상단 핸들을 포함합니다.
 */
const BottomSheetWrapper: React.FC<BottomSheetWrapperProps> = ({
  visible,
  onClose,
  children,
  style,
}) => {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}>
      <TouchableOpacity
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
        activeOpacity={1}
        onPress={onClose}>
        <View
          style={{
            position: 'absolute',
            bottom: 0,
            backgroundColor: colors.white,
            borderTopLeftRadius: borderRadius.l,
            borderTopRightRadius: borderRadius.l,
            padding: spacing.l,
            width: '100%',
            maxHeight: height * 0.9,
          }}>
          {/* 핸들 */}
          <View
            style={{
              width: 48,
              height: 4,
              backgroundColor: colors.lightGray,
              borderRadius: 2,
              alignSelf: 'center',
              marginBottom: spacing.m,
            }}
          />
          {children}
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

export default BottomSheetWrapper;


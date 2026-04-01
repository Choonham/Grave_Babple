import React from 'react';
import {
  Modal,
  View,
  TouchableOpacity,
  ViewStyle,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {colors, borderRadius, spacing, shadows} from '../../styles/commonStyles';

interface ModalWrapperProps {
  visible: boolean;
  onClose: () => void;
  children: React.ReactNode;
  style?: ViewStyle;
}

const {width} = Dimensions.get('window');

/**
 * 화면 중앙에 팝업되는 모달의 기본 레이아웃 컴포넌트
 * 반투명 오버레이와 흰색 콘텐츠 박스를 포함합니다.
 */
const ModalWrapper: React.FC<ModalWrapperProps> = ({
  visible,
  onClose,
  children,
  style,
}) => {
  const maxWidth = 340;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
        }}>
        <TouchableOpacity
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
          }}
          activeOpacity={1}
          onPress={onClose}
        />
        <View
          style={[
            {
              width: width * 0.9,
              maxWidth,
              backgroundColor: colors.white,
              borderRadius: borderRadius.l,
              padding: spacing.l,
              ...shadows.modal,
            },
            style,
          ]}
          onStartShouldSetResponder={() => true}>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

export default ModalWrapper;


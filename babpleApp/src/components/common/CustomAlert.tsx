import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  Animated,
  Dimensions,
  ScrollView,
  Platform,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius, shadows} from '../../styles/commonStyles';

const {width: SCREEN_WIDTH} = Dimensions.get('window');

export interface AlertButton {
  text: string;
  onPress?: () => void;
  style?: 'default' | 'cancel' | 'destructive';
}

export interface AlertOptions {
  title?: string;
  message: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
}

interface CustomAlertProps {
  visible: boolean;
  title?: string;
  message: string;
  buttons?: AlertButton[];
  cancelable?: boolean;
  onDismiss?: () => void;
  usePortal?: boolean; // Portal 모드일 때 overFullScreen Modal로 렌더링 (다른 Modal 위에 표시)
}

const CustomAlert: React.FC<CustomAlertProps> = ({
  visible,
  title,
  message,
  buttons = [{text: '확인'}],
  cancelable = true,
  onDismiss,
  usePortal = false,
}) => {
  const fadeAnim = React.useRef(new Animated.Value(0)).current;
  const scaleAnim = React.useRef(new Animated.Value(0.9)).current;

  React.useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          tension: 50,
          friction: 7,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 150,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 0.9,
          duration: 150,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, fadeAnim, scaleAnim]);

  const handleButtonPress = (button: AlertButton) => {
    if (button.onPress) {
      button.onPress();
    }
    if (onDismiss) {
      onDismiss();
    }
  };

  const handleBackdropPress = () => {
    if (cancelable && onDismiss) {
      onDismiss();
    }
  };

  if (!visible) {
    return null;
  }

  // 버튼 스타일 결정
  const getButtonStyle = (buttonStyle?: string) => {
    if (buttonStyle === 'destructive') {
      return styles.destructiveButton;
    }
    if (buttonStyle === 'cancel') {
      return styles.cancelButton;
    }
    return styles.defaultButton;
  };

  const getButtonTextStyle = (buttonStyle?: string) => {
    if (buttonStyle === 'destructive') {
      return styles.destructiveButtonText;
    }
    if (buttonStyle === 'cancel') {
      return styles.cancelButtonText;
    }
    return styles.defaultButtonText;
  };

  // Alert 내용 (Modal 없이)
  const alertContent = (
    <Animated.View
      style={[styles.overlay, {opacity: fadeAnim}]}
      pointerEvents="box-none">
      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={handleBackdropPress}
      />
      <Animated.View
        style={[
          styles.alertContainer,
          {
            opacity: fadeAnim,
            transform: [{scale: scaleAnim}],
          },
        ]}>
        {/* 제목 */}
        {title && (
          <View style={styles.titleContainer}>
            <Text style={styles.title}>{title}</Text>
          </View>
        )}

        {/* 메시지 */}
        <View style={styles.messageContainer}>
          <Text style={styles.message}>{message}</Text>
        </View>

        {/* 버튼들 */}
        {buttons.length > 2 ? (
          <ScrollView 
            style={styles.buttonScrollContainer}
            contentContainerStyle={styles.buttonScrollContent}
            showsVerticalScrollIndicator={false}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button.style),
                  styles.verticalButton,
                  index === buttons.length - 1 && styles.lastVerticalButton,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}>
                <Text style={getButtonTextStyle(button.style)}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={[
            styles.buttonContainer,
          ]}>
            {buttons.map((button, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.button,
                  getButtonStyle(button.style),
                  buttons.length === 1 && styles.singleButton,
                  buttons.length === 2 && index === 0 && styles.firstButton,
                  buttons.length === 2 && index === 1 && styles.lastButton,
                  index > 0 && buttons.length === 2 && styles.buttonSeparator,
                ]}
                onPress={() => handleButtonPress(button)}
                activeOpacity={0.7}>
                <Text style={getButtonTextStyle(button.style)}>{button.text}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </Animated.View>
    </Animated.View>
  );

  // usePortal 모드: RootSiblings에서 렌더링 (overFullScreen Modal로 감싸서)
  // 이렇게 하면 다른 Modal 위에도 표시됨
  if (usePortal) {
    return (
      <Modal
        visible={visible}
        transparent
        animationType="none"
        presentationStyle="overFullScreen"
        statusBarTranslucent={true}
        onRequestClose={cancelable ? handleBackdropPress : undefined}>
        {alertContent}
      </Modal>
    );
  }

  // 일반 모드: Modal로 감싸서 렌더링
  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={cancelable ? handleBackdropPress : undefined}>
      {alertContent}
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertContainer: {
    width: SCREEN_WIDTH - spacing.xl * 2,
    maxWidth: 400,
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    overflow: 'hidden',
    ...shadows.large,
  },
  titleContainer: {
    paddingTop: spacing.l,
    paddingHorizontal: spacing.l,
    paddingBottom: spacing.s,
  },
  title: {
    ...typography.h3,
    color: colors.textPrimary,
    textAlign: 'center',
    fontWeight: '700',
    fontSize: 18,
  },
  messageContainer: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    minHeight: 50,
    justifyContent: 'center',
  },
  message: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    fontSize: 15,
  },
  buttonContainer: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    overflow: 'hidden',
    borderBottomLeftRadius: borderRadius.l,
    borderBottomRightRadius: borderRadius.l,
  },
  buttonScrollContainer: {
    maxHeight: 350,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  buttonScrollContent: {
    paddingBottom: 0,
  },
  button: {
    flex: 1,
    paddingVertical: spacing.m + 4,
    justifyContent: 'center',
    alignItems: 'center',
    minHeight: 52,
  },
  singleButton: {
    borderBottomLeftRadius: borderRadius.l,
    borderBottomRightRadius: borderRadius.l,
  },
  firstButton: {
    borderBottomLeftRadius: borderRadius.l,
  },
  lastButton: {
    borderBottomRightRadius: borderRadius.l,
  },
  verticalButton: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    flex: 0,
    width: '100%',
  },
  lastVerticalButton: {
    borderBottomWidth: 0,
    borderBottomLeftRadius: borderRadius.l,
    borderBottomRightRadius: borderRadius.l,
  },
  buttonSeparator: {
    borderLeftWidth: 1,
    borderLeftColor: colors.lightGray,
  },
  defaultButton: {
    backgroundColor: colors.white,
  },
  defaultButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '600',
    fontSize: 16,
  },
  cancelButton: {
    backgroundColor: colors.white,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '500',
    fontSize: 16,
  },
  destructiveButton: {
    backgroundColor: colors.white,
  },
  destructiveButtonText: {
    ...typography.bodyMedium,
    color: colors.error,
    fontWeight: '600',
    fontSize: 16,
  },
});

export default CustomAlert;


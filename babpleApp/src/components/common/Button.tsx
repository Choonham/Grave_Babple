import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  TextStyle,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
type ButtonSize = 'large' | 'small';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: string;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

/**
 * 사용자의 액션을 위한 버튼 컴포넌트
 * Primary, Secondary, Tertiary, Destructive 스타일과 Large, Small 사이즈를 지원합니다.
 */
const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'large',
  icon,
  loading = false,
  disabled = false,
  style,
}) => {
  const height = size === 'large' ? 48 : 40;
  const backgroundColor =
    variant === 'primary'
      ? colors.primary
      : variant === 'secondary'
      ? colors.white
      : variant === 'tertiary'
      ? colors.offWhite
      : colors.error;

  const textColor =
    variant === 'primary'
      ? colors.textPrimaryOnPrimary
      : variant === 'secondary'
      ? colors.textPrimary
      : variant === 'tertiary'
      ? colors.textPrimary
      : colors.textPrimaryOnPrimary;

  const borderColor =
    variant === 'secondary' ? colors.lightGray : 'transparent';
  const borderWidth = variant === 'secondary' ? 1 : 0;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={disabled || loading}
      style={[
        {
          height,
          backgroundColor,
          borderRadius: borderRadius.s,
          borderWidth,
          borderColor,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: spacing.l,
          opacity: disabled || loading ? 0.5 : 1,
        },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator size="small" color={textColor} />
      ) : (
        <>
          {icon && (
            <Icon
              name={icon}
              size={20}
              color={textColor}
              style={{marginRight: spacing.s}}
            />
          )}
          <Text
            style={[
              typography.bodyMedium,
              {color: textColor, textAlign: 'center'},
            ]}>
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

export default Button;


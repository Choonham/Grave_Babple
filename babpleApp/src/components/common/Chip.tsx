import React from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

interface ChipProps {
  label: string;
  active?: boolean;
  onPress: () => void;
  style?: ViewStyle;
}

/**
 * 카테고리 선택, 해시태그 등 짧은 텍스트를 나타내는 알약 모양 컴포넌트
 * active/inactive 상태를 지원합니다.
 */
const Chip: React.FC<ChipProps> = ({
  label,
  active = false,
  onPress,
  style,
}) => {
  const backgroundColor = active ? colors.primary : colors.white;
  const textColor = active
    ? colors.textPrimaryOnPrimary
    : colors.textPrimary;
  const borderColor = active ? colors.primary : colors.lightGray;

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          height: 44,
          paddingHorizontal: spacing.m,
          backgroundColor,
          borderRadius: 22,
          borderWidth: 1,
          borderColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text style={[typography.bodyRegular, {color: textColor}]}>
        {label}
      </Text>
    </TouchableOpacity>
  );
};

export default Chip;


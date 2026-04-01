import React from 'react';
import {View, Text, ViewStyle} from 'react-native';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

interface TagBadgeProps {
  label: string;
  style?: ViewStyle;
}

/**
 * "오늘의 특가" 등 작은 정보 라벨을 위한 알약 모양 뱃지 컴포넌트
 */
const TagBadge: React.FC<TagBadgeProps> = ({label, style}) => {
  return (
    <View
      style={[
        {
          height: 24,
          paddingHorizontal: spacing.s,
          backgroundColor: colors.primary,
          borderRadius: 12,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Text style={[typography.infoMedium, {color: colors.textWhite}]}>
        {label}
      </Text>
    </View>
  );
};

export default TagBadge;


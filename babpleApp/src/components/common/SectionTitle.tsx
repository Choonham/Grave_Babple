import React from 'react';
import {Text, ViewStyle, TextStyle} from 'react-native';
import {colors, typography, spacing} from '../../styles/commonStyles';

type SectionTitleVariant = 'primary' | 'secondary';

interface SectionTitleProps {
  title: string;
  variant?: SectionTitleVariant;
  style?: ViewStyle;
}

/**
 * H2 스타일의 기본 섹션 제목 컴포넌트
 * Primary와 Secondary(설정용) Variants를 지원합니다.
 */
const SectionTitle: React.FC<SectionTitleProps> = ({
  title,
  variant = 'primary',
  style,
}) => {
  const textColor =
    variant === 'primary' ? colors.textPrimary : colors.textSecondary;

  return (
    <Text style={[typography.h2, {color: textColor, marginBottom: spacing.s}, style]}>
      {title}
    </Text>
  );
};

export default SectionTitle;


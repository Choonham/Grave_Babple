import React, {useState} from 'react';
import {TextInput, TextInputProps, StyleSheet} from 'react-native';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

/**
 * 여러 줄 텍스트 입력 필드 컴포넌트
 */
const TextArea: React.FC<TextInputProps> = ({
  style,
  onFocus,
  onBlur,
  error,
  ...props
}) => {
  const [isFocused, setIsFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : isFocused
    ? colors.primary
    : colors.lightGray;

  return (
    <TextInput
      style={[
        {
          minHeight: 120,
          paddingHorizontal: spacing.m,
          paddingTop: spacing.m,
          backgroundColor: colors.white,
          borderRadius: borderRadius.s,
          borderWidth: 1,
          borderColor,
          textAlignVertical: 'top',
          lineHeight: typography.bodyRegular.fontSize * 1.6,
          ...typography.bodyRegular,
          color: colors.textPrimary,
        },
        style,
      ]}
      placeholderTextColor={colors.textTertiary}
      onFocus={e => {
        setIsFocused(true);
        onFocus?.(e);
      }}
      onBlur={e => {
        setIsFocused(false);
        onBlur?.(e);
      }}
      multiline
      {...props}
    />
  );
};

export default TextArea;


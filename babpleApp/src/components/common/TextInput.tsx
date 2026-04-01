import React, {useState} from 'react';
import {
  TextInput as RNTextInput,
  TextInputProps,
  StyleSheet,
  View,
  Platform,
} from 'react-native';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

interface TextInputCustomProps extends TextInputProps {
  error?: boolean;
}

/**
 * 한 줄 텍스트 입력 필드 컴포넌트
 * default, focused, error 상태를 지원합니다.
 */
const TextInput: React.FC<TextInputCustomProps> = ({
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
    <RNTextInput
      style={[
        {
          height: 56,
          paddingHorizontal: spacing.m,
          backgroundColor: colors.white,
          borderRadius: borderRadius.s,
          borderWidth: 1,
          borderColor,
          color: colors.textPrimary,
          ...(Platform.OS === 'ios'
            ? {
                // iOS에서 텍스트 중앙 정렬
                paddingTop: 2, // iOS에서 텍스트를 살짝 위로 조정
                paddingBottom: 2,
                textAlignVertical: 'center',
                fontSize: typography.bodyRegular.fontSize,
                lineHeight: typography.bodyRegular.fontSize, // lineHeight를 fontSize와 동일하게 설정하여 중앙 정렬 개선
                fontFamily: typography.bodyRegular.fontFamily,
              }
            : {
                // Android는 기본 스타일 유지
                ...typography.bodyRegular,
              }),
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
      {...props}
    />
  );
};

export default TextInput;


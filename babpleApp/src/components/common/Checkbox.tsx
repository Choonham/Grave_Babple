import React from 'react';
import {TouchableOpacity, View, Text, ViewStyle, TextStyle} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, borderRadius, spacing} from '../../styles/commonStyles';

interface CheckboxProps {
  label: string;
  checked: boolean;
  onPress: () => void;
  required?: boolean;
  labelColor?: string;
  style?: ViewStyle;
}

/**
 * 체크박스 컴포넌트
 */
const Checkbox: React.FC<CheckboxProps> = ({
  label,
  checked,
  onPress,
  required = false,
  labelColor = colors.textPrimary,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: spacing.xs,
        },
        style,
      ]}>
      <View
        style={{
          width: 20,
          height: 20,
          borderRadius: borderRadius.s / 2,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.lightGray,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: spacing.s,
        }}>
        {checked && (
          <Icon name="check" size={14} color={colors.white} />
        )}
      </View>
      <Text style={{color: labelColor, fontSize: 14}}>
        {label}
        {required && (
          <Text style={{color: colors.primary}}> (필수)</Text>
        )}
      </Text>
    </TouchableOpacity>
  );
};

export default Checkbox;


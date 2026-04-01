import React from 'react';
import {Switch} from 'react-native';
import {colors} from '../../styles/commonStyles';

interface ToggleProps {
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

/**
 * ON/OFF 상태를 전환하는 스위치 컴포넌트
 */
const Toggle: React.FC<ToggleProps> = ({
  value,
  onValueChange,
  disabled = false,
}) => {
  return (
    <Switch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{
        false: colors.lightGray,
        true: colors.primary,
      }}
      thumbColor={colors.white}
    />
  );
};

export default Toggle;


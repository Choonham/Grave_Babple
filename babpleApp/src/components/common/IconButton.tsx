import React from 'react';
import {TouchableOpacity, ViewStyle} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing} from '../../styles/commonStyles';

interface IconButtonProps {
  name: string;
  onPress: () => void;
  size?: number;
  color?: string;
  style?: ViewStyle;
}

/**
 * 아이콘만으로 구성된 버튼 컴포넌트
 * 터치 영역을 확보하여 사용자 경험을 개선합니다.
 * Feather 아이콘을 사용합니다.
 */
const IconButton: React.FC<IconButtonProps> = ({
  name,
  onPress,
  size = 24,
  color = colors.textPrimary,
  style,
}) => {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        {
          width: 40,
          height: 40,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}>
      <Icon name={name} size={size} color={color} />
    </TouchableOpacity>
  );
};

export default IconButton;


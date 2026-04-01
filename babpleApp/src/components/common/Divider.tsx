import React from 'react';
import {View, ViewStyle} from 'react-native';
import {colors} from '../../styles/commonStyles';

interface DividerProps {
  style?: ViewStyle;
}

/**
 * 콘텐츠를 구분하는 1px 높이의 가로선 컴포넌트
 */
const Divider: React.FC<DividerProps> = ({style}) => {
  return (
    <View
      style={[
        {
          height: 1,
          width: '100%',
          backgroundColor: colors.lightGray,
        },
        style,
      ]}
    />
  );
};

export default Divider;


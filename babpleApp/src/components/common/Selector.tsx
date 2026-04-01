import React, {useState} from 'react';
import {
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
  Modal,
  ScrollView,
  View,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {colors, typography, borderRadius, spacing} from '../../styles/commonStyles';

interface SelectorOption {
  label: string;
  value: string;
}

interface SelectorProps {
  placeholder?: string;
  value?: string;
  options: SelectorOption[];
  onSelect: (value: string) => void;
  style?: ViewStyle;
}

/**
 * 목록에서 항목을 선택하는 입력 필드 컴포넌트
 * 텍스트 입력 필드와 동일한 스타일이지만 오른쪽에 chevron-down 아이콘을 표시합니다.
 * 클릭하면 모달이 열리고 옵션 목록을 표시합니다.
 */
const Selector: React.FC<SelectorProps> = ({
  placeholder,
  value,
  options,
  onSelect,
  style,
}) => {
  const [modalVisible, setModalVisible] = useState(false);

  const handlePress = () => {
    setModalVisible(true);
  };

  const handleSelect = (selectedValue: string) => {
    onSelect(selectedValue);
    setModalVisible(false);
  };

  const selectedLabel = options.find((opt) => opt.value === value)?.label || value;

  return (
    <>
      <TouchableOpacity
        onPress={handlePress}
        style={[
          {
            height: 56,
            paddingHorizontal: spacing.m,
            backgroundColor: colors.white,
            borderRadius: borderRadius.s,
            borderWidth: 1,
            borderColor: colors.lightGray,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
          style,
        ]}>
        <Text
          style={[
            typography.bodyRegular,
            {
              color: value ? colors.textPrimary : colors.textTertiary,
              flex: 1,
            },
          ]}>
          {selectedLabel || placeholder}
        </Text>
        <Icon name="chevron-down" size={24} color={colors.textSecondary} />
      </TouchableOpacity>

      {/* 선택 모달 */}
      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setModalVisible(false)}>
        <TouchableOpacity
          style={{
            flex: 1,
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}>
          <View
            style={{
              backgroundColor: colors.white,
              borderRadius: borderRadius.m,
              padding: spacing.m,
              minWidth: '80%',
              maxHeight: '70%',
            }}
            onStartShouldSetResponder={() => true}>
            <ScrollView>
              {options.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  onPress={() => handleSelect(option.value)}
                  style={{
                    paddingVertical: spacing.m,
                    paddingHorizontal: spacing.m,
                    borderRadius: borderRadius.s,
                    backgroundColor:
                      value === option.value ? colors.secondary : 'transparent',
                  }}>
                  <Text
                    style={[
                      typography.bodyRegular,
                      {
                        color:
                          value === option.value
                            ? colors.primary
                            : colors.textPrimary,
                        fontWeight: value === option.value ? '600' : 'normal',
                      },
                    ]}>
                    {option.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
};

export default Selector;


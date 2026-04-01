import React, {useEffect, useRef} from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  TouchableWithoutFeedback,
  Animated,
  Platform,
} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {colors, spacing, typography, borderRadius, shadows} from '../../styles/commonStyles';

interface MenuOption {
  id: string;
  icon: string;
  label: string;
  color?: string;
}

interface BottomSheetMenuProps {
  visible: boolean;
  options: MenuOption[];
  onClose: () => void;
  onOptionPress: (optionId: string) => void;
}

/**
 * 하단 시트 메뉴 컴포넌트
 * "..." 아이콘을 눌렀을 때 표시되는 옵션 메뉴입니다.
 */
const BottomSheetMenu: React.FC<BottomSheetMenuProps> = ({
  visible,
  options,
  onClose,
  onOptionPress,
}) => {
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const insets = useSafeAreaInsets();
  
  // 하단 탭 네비게이션 높이 계산 (AppNavigator와 동일한 로직)
  // 하단 탭이 있는 경우를 대비하여 충분한 여백 확보
  const tabBarHeight = 68 + (Platform.OS === 'android' ? insets.bottom : 0);
  // 하단 탭 네비게이션 높이 + 추가 여백, 또는 SafeArea insets 중 더 큰 값 사용
  const bottomPadding = Math.max(insets.bottom + spacing.xs, tabBarHeight + spacing.m);

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible, slideAnim]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
            <Animated.View 
              style={[
                styles.menu, 
                {transform: [{translateY: slideAnim}]},
                {paddingBottom: bottomPadding}
              ]}>
              {/* 핸들 바 */}
              <View style={styles.handle} />

              {/* 메뉴 옵션 */}
              {options.map((option, index) => {
                // 구분선은 마지막 2개 항목 사이에만 표시 (삭제/신고 앞)
                const showDivider = index === options.length - 2;
                
                return (
                  <View key={option.id}>
                    <TouchableOpacity
                      style={styles.menuItem}
                      onPress={() => {
                        onOptionPress(option.id);
                        onClose();
                      }}>
                      <Icon
                        name={option.icon}
                        size={20}
                        color={option.color || colors.textPrimary}
                      />
                      <Text style={[styles.menuLabel, option.color && {color: option.color}]}>
                        {option.label}
                      </Text>
                    </TouchableOpacity>

                    {/* 구분선 */}
                    {showDivider && <View style={styles.divider} />}
                  </View>
                );
              })}
            </Animated.View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  menu: {
    backgroundColor: colors.white,
    borderTopLeftRadius: borderRadius.l,
    borderTopRightRadius: borderRadius.l,
    ...shadows.large,
  },
  handle: {
    width: 40,
    height: 4,
    backgroundColor: colors.lightGray,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: spacing.xs,
    marginBottom: spacing.m,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    gap: spacing.m,
  },
  menuLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  divider: {
    height: 1,
    backgroundColor: colors.lightGray,
    marginHorizontal: spacing.l,
  },
});

export default BottomSheetMenu;

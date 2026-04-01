import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView} from 'react-native-safe-area-context';
import {useSelector, useDispatch} from 'react-redux';
import {RootState} from '../../redux';
import {UserAPI} from '../../api/ApiRequests';
import {USER_PROFILE_UPDATE_SUCCESS} from '../../redux/states/userState';
import {useTheme} from '../../contexts/ThemeContext';
import {spacing, typography} from '../../styles/commonStyles';
import {useAlert} from '../../contexts/AlertContext';

interface ViewModeScreenProps {
  visible: boolean;
  onClose?: () => void;
}

/**
 * 화면 설정 화면
 */
const ViewModeScreen: React.FC<ViewModeScreenProps> = ({visible, onClose}) => {
  const {alert} = useAlert();
  const dispatch = useDispatch();
  const {theme, isDarkMode} = useTheme();
  const userInfo = useSelector((state: RootState) => state.userState.userInfo);
  const [darkModeEnabled, setDarkModeEnabled] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const slideAnim = useRef(new Animated.Value(-1)).current;

  // 다크모드 설정 로드 (userInfo.view_mode에서)
  useEffect(() => {
    if (userInfo?.view_mode !== undefined && userInfo.view_mode !== null) {
      setDarkModeEnabled(userInfo.view_mode === 1);
    } else {
      setDarkModeEnabled(false);
    }
  }, [userInfo?.view_mode]);

  // 다크모드 토글
  const handleDarkModeToggle = async (value: boolean) => {
    if (isUpdating) return;
    
    try {
      setIsUpdating(true);
      const viewMode = value ? 1 : 0;
      
      // API 호출하여 view_mode 업데이트
      const response = await UserAPI.updateProfile({
        view_mode: viewMode,
      });

      if (response.success) {
        setDarkModeEnabled(value);
        // Redux 상태 업데이트 - 즉시 반영되도록
        dispatch({
          type: USER_PROFILE_UPDATE_SUCCESS,
          payload: {view_mode: viewMode},
        });
        // ThemeContext가 즉시 반영되도록 약간의 지연 추가 (필요시)
        console.log('✅ [다크 모드] view_mode 업데이트 완료:', viewMode);
      } else {
        alert('오류', response.message || '다크 모드 설정을 변경하지 못했습니다.');
      }
    } catch (error: any) {
      console.error('다크모드 설정 저장 오류:', error);
      alert('오류', error?.response?.data?.message || '다크 모드 설정을 변경하는 중 오류가 발생했습니다.');
      // 실패 시 원래 상태로 되돌림
      setDarkModeEnabled(!value);
    } finally {
      setIsUpdating(false);
    }
  };

  useEffect(() => {
    if (visible) {
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        friction: 8,
        tension: 40,
      }).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start();
    }
  }, [visible, slideAnim]);

  const handleClose = () => {
    if (onClose) {
      Animated.timing(slideAnim, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }).start(() => {
        onClose();
      });
    }
  };

  const translateX = slideAnim.interpolate({
    inputRange: [-1, 0, 1],
    outputRange: [-400, 0, -400],
  });

  if (!visible) {
    return null;
  }

  return (
    <Animated.View
      style={[
        StyleSheet.absoluteFillObject,
        {
          transform: [{translateX}],
        },
      ]}>
      <SafeAreaView style={[styles.container, {backgroundColor: theme.background}]} edges={['top']}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleClose}>
            <Icon name="chevron-left" size={24} color={theme.textPrimary} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, {color: theme.textPrimary}]}>화면 설정</Text>
          <View style={styles.headerSpacer} />
        </View>

        <ScrollView
          style={[styles.scrollView, {backgroundColor: theme.background}]}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          {/* 화면 설정 변경 */}
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, {color: theme.textSecondary}]}>화면 설정 변경</Text>
            <View style={[styles.settingItem, {backgroundColor: theme.backgroundCard}]}>
              <View style={styles.settingItemLeft}>
                <Icon name="moon" size={24} color={theme.textPrimary} />
                <Text style={[styles.settingItemText, {color: theme.textPrimary}]}>다크 모드 켜기</Text>
              </View>
              <Switch
                value={darkModeEnabled}
                onValueChange={handleDarkModeToggle}
                trackColor={{false: theme.lightGray, true: theme.primary}}
                thumbColor={theme.white}
                disabled={isUpdating}
              />
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 100,
  },
  section: {
    marginTop: spacing.l,
  },
  sectionTitle: {
    ...typography.bodyMedium,
    fontWeight: '600',
    marginBottom: spacing.xs,
    paddingHorizontal: spacing.l,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    marginHorizontal: spacing.l,
    marginBottom: spacing.xs,
    borderRadius: 8,
  },
  settingItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingItemText: {
    ...typography.bodyMedium,
    marginLeft: spacing.m,
  },
});

export default ViewModeScreen;


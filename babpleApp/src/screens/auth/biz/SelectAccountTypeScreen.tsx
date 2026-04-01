import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {IconButton} from '../../../components/common';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {useAlert} from '../../../contexts/AlertContext';

type BusinessType = 'mart' | 'advertiser' | null;

/**
 * 사업자 계정 유형 선택 화면
 */
const SelectAccountTypeScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const [selectedType, setSelectedType] = useState<BusinessType>(null);

  /**
   * 비즈니스 유형 선택
   */
  const handleSelectType = (type: BusinessType) => {
    setSelectedType(type);
  };

  /**
   * 다음 버튼 처리 - 계정 유형 선택 후 이메일/비밀번호 입력 화면으로 이동
   */
  const handleNext = () => {
    if (!selectedType) {
      alert('오류', '비즈니스 유형을 선택해주세요.');
      return;
    }

    console.log('선택된 비즈니스 유형:', selectedType);
    // 선택된 계정 유형과 함께 이메일/비밀번호 입력 화면으로 이동
    // @ts-ignore
    navigation.navigate('BizBasicRegister', {account_type: selectedType});
  };

  /**
   * 개발용 백도어 - 더블 탭 처리
   */
  const [lastTapTime, setLastTapTime] = useState(0);
  const handleDoubleTap = () => {
    const now = Date.now();
    if (now - lastTapTime < 500) {
      setLastTapTime(0);
      console.log('✅ 개발 백도어: 다음 페이지로 이동');
      // 선택된 유형에 따라 다음 화면으로 이동 (백도어)
      if (selectedType === 'mart') {
        // @ts-ignore
        navigation.navigate('StoreRegister');
      } else if (selectedType === 'advertiser') {
        // @ts-ignore
        navigation.navigate('AdvertiserRegister');
      } else {
        // 선택 안된 경우 기본값으로 동네 마트로 이동
        // @ts-ignore
        navigation.navigate('StoreRegister');
      }
    } else {
      handleNext();
      setLastTapTime(now);
    }
  };

  const isNextButtonEnabled = selectedType !== null;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <IconButton
            name="arrow-left"
            onPress={() => navigation.goBack()}
            color={colors.textPrimary}
          />
          <Text style={styles.headerTitle}>사업자 회원가입</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* 인스트럭션 */}
          <Text style={styles.instruction}>비즈니스 유형을 선택해주세요.</Text>

          {/* 비즈니스 유형 카드들 */}
          <View style={styles.cardsContainer}>
            {/* 동네 마트 사장님 카드 */}
            <TouchableOpacity
              style={[
                styles.businessCard,
                selectedType === 'mart' && styles.businessCardSelected,
              ]}
              onPress={() => handleSelectType('mart')}>
              <View style={styles.cardIconContainer}>
                <Icon name="shopping-cart" size={48} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>동네 마트 사장님</Text>
              <Text style={styles.cardDescription}>
                우리 마트의 전단지를 등록하고, 기획 상품을 동네 사람들에게 알려주고 싶어요!
              </Text>
            </TouchableOpacity>

            {/* 광고주 카드 */}
            <TouchableOpacity
              style={[
                styles.businessCard,
                selectedType === 'advertiser' && styles.businessCardSelected,
              ]}
              onPress={() => handleSelectType('advertiser')}>
              <View style={styles.cardIconContainer}>
                <Icon name="trending-up" size={48} color={colors.primary} />
              </View>
              <Text style={styles.cardTitle}>광고주</Text>
              <Text style={styles.cardDescription}>
                음식점, 브랜드 등 내 가게나 상품을 앱 내 사용자에게 홍보하고 싶어요!
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 다음 버튼 - 고정 위치 */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            isNextButtonEnabled && styles.nextButtonActive,
          ]}
          onPress={handleDoubleTap}
          disabled={!isNextButtonEnabled}>
          <Text
            style={[
              styles.nextButtonText,
              isNextButtonEnabled && styles.nextButtonTextActive,
            ]}>
            다음
          </Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingTop: 12,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    lineHeight: 28,
    color: colors.textPrimary,
    fontFamily: 'Pretendard-Regular',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: spacing.m,
  },
  instruction: {
    ...typography.h2,
    color: colors.primary,
    textAlign: 'center',
    marginBottom: spacing.xl,
    fontWeight: '700',
  },
  cardsContainer: {
    gap: spacing.m,
    marginBottom: spacing.xl,
  },
  businessCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.xl,
    alignItems: 'center',
    minHeight: 200,
    justifyContent: 'center',
  },
  businessCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
    backgroundColor: colors.secondary,
  },
  cardIconContainer: {
    marginBottom: spacing.m,
  },
  cardTitle: {
    ...typography.h2,
    color: colors.primary,
    fontWeight: '700',
    marginBottom: spacing.s,
    textAlign: 'center',
  },
  cardDescription: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
  },
  nextButton: {
    height: 56,
    backgroundColor: colors.mediumGray,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.l,
    marginBottom: 30,
  },
  nextButtonActive: {
    backgroundColor: colors.primary,
  },
  nextButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  nextButtonTextActive: {
    color: colors.white,
  },
});

export default SelectAccountTypeScreen;


import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Modal,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {IconButton, TextInput} from '../../../../components/common';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../../styles/commonStyles';
import {AdvertiserAPI} from '../../../../api/ApiRequests';
import AddressSearchModal from '../../../../components/AddressSearchModal';
import LocationMapPicker from '../../../../components/LocationMapPicker';
import {useAlert} from '../../../../contexts/AlertContext';

interface RouteParams {
  user_id?: string;
  email?: string;
}

/**
 * 광고주 회원가입 화면
 */
const AdvertiserRegisterScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const route = useRoute();
  const {user_id} = (route.params as RouteParams) || {};

  const [isRegistering, setIsRegistering] = useState(false);

  const [bizName, setBizName] = useState('');
  const [bizOwner, setBizOwner] = useState('');
  const [bizRegNo, setBizRegNo] = useState('');
  const [bizAddress, setBizAddress] = useState('');
  const [isAddressSearchVisible, setIsAddressSearchVisible] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(null);
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(null);

  /**
   * 주소 검색 모달 열기
   */
  const handleSearchAddress = () => {
    setIsAddressSearchVisible(true);
  };

  /**
   * 주소 선택 시 호출
   */
  const handleAddressSelect = (address: string, coordinates?: {latitude: number; longitude: number}) => {
    setBizAddress(address);
    setIsAddressSearchVisible(false);
    
    // 좌표 정보가 있으면 미리 설정
    if (coordinates) {
      setSelectedLatitude(coordinates.latitude);
      setSelectedLongitude(coordinates.longitude);
      console.log('📍 [주소 선택] 좌표 정보 설정:', coordinates);
    }
    
    // 주소 선택 후 지도 모달 열기
    setIsMapModalVisible(true);
  };

  /**
   * 지도에서 위치 선택
   */
  const handleMapLocationSelect = (latitude: number, longitude: number) => {
    setSelectedLatitude(latitude);
    setSelectedLongitude(longitude);
    setIsMapModalVisible(false);
  };

  /**
   * 다음 버튼 처리 - 광고주 등록
   */
  const handleNext = async () => {
    // 필수 정보 검증
    if (!bizName || !bizRegNo) {
      alert('오류', '필수 정보를 모두 입력해주세요. (사업자명, 사업자 등록번호)');
      return;
    }

    // 사업자 등록번호 형식 검증 (10자리 숫자)
    const cleanedNumber = bizRegNo.replace(/[-\s]/g, '');
    if (!/^\d{10}$/.test(cleanedNumber)) {
      alert('오류', '사업자 등록번호는 10자리 숫자여야 합니다.');
      return;
    }

    // user_id 확인
    if (!user_id) {
      alert('오류', '사용자 정보를 찾을 수 없습니다. 다시 시도해주세요.');
      return;
    }

    try {
      setIsRegistering(true);

      console.log('📤 [광고주 등록] 요청 데이터:', {
        user_id,
        biz_name: bizName,
        biz_owner: bizOwner,
        biz_reg_no: cleanedNumber,
        biz_address: bizAddress,
      });

      // 광고주 등록 API 호출
      const response = await AdvertiserAPI.createAdvertiser({
        user_id,
        biz_name: bizName,
        biz_owner: bizOwner || undefined,
        biz_reg_no: cleanedNumber,
        biz_address: bizAddress || undefined,
      });

      if (response.success && response.data) {
        console.log('✅ [광고주 등록] 성공:', response.data.advertiser_id);
        alert('성공', '광고주가 등록되었습니다.').then(() => {
          // 완료 화면으로 이동
          // @ts-ignore
          navigation.navigate('CompleteReg');
        });
      } else {
        alert('실패', response.message || '광고주 등록에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [광고주 등록] 오류:', error);
      console.error('❌ [광고주 등록] 오류 응답:', error.response?.data);
      console.error('❌ [광고주 등록] 오류 상태:', error.response?.status);

      // 에러 응답에서 메시지 추출
      let errorMessage = '광고주 등록 중 오류가 발생했습니다.';

      if (error.response?.data) {
        // 백엔드에서 반환한 에러 메시지
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        // 네트워크 오류 등
        errorMessage = error.message;
      }

      alert('광고주 등록 실패', errorMessage);
    } finally {
      setIsRegistering(false);
    }
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
      // 완료 화면으로 이동
      // @ts-ignore
      navigation.navigate('CompleteReg');
    } else {
      handleNext();
      setLastTapTime(now);
    }
  };

  const isNextButtonEnabled = bizName && bizRegNo;

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
          <Text style={styles.headerTitle}>광고주 정보 등록</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* 안내 텍스트 */}
          <Text style={styles.instructionText}>광고주 정보를 입력해주세요.</Text>
          <Text style={styles.subInstructionText}>
            세금계산서 발행 등 광고 집행에 필요한 정보입니다.
          </Text>

          {/* 필수 정보 구분선 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>필수 정보</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 입력 필드 */}
          <View style={styles.inputSection}>
            <TextInput
              placeholder="사업자명 *"
              value={bizName}
              onChangeText={setBizName}
              style={styles.input}
            />
          </View>

          <View style={styles.inputSection}>
            <TextInput
              placeholder="사업자 등록 번호 *"
              value={bizRegNo}
              onChangeText={setBizRegNo}
              keyboardType="numeric"
              style={styles.input}
            />
          </View>

          <View style={styles.inputSection}>
            <TextInput
              placeholder="대표자명"
              value={bizOwner}
              onChangeText={setBizOwner}
              style={styles.input}
            />
          </View>

          {/* 회사 주소 */}
          <View style={styles.inputWithButtonRow}>
            <TextInput
              placeholder="회사 주소"
              value={bizAddress}
              onChangeText={setBizAddress}
              editable={false}
              style={[styles.input, styles.inputFlex]}
            />
            <TouchableOpacity
              style={styles.addressSearchButton}
              onPress={handleSearchAddress}>
              <Text style={styles.addressSearchButtonText}>주소 검색</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>

        {/* 다음 버튼 - 고정 위치 */}
        <TouchableOpacity
          style={[
            styles.nextButton,
            isNextButtonEnabled && styles.nextButtonActive,
            isRegistering && styles.nextButtonDisabled,
          ]}
          onPress={handleDoubleTap}
          disabled={!isNextButtonEnabled || isRegistering}>
          {isRegistering ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>다음</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 주소 검색 모달 */}
      <AddressSearchModal
        visible={isAddressSearchVisible}
        onClose={() => setIsAddressSearchVisible(false)}
        onSelect={handleAddressSelect}
        returnFullAddress={true}
      />

      {/* 지도 위치 선택 모달 */}
      <Modal
        visible={isMapModalVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setIsMapModalVisible(false)}>
        <SafeAreaView style={styles.mapModalContainer} edges={['top', 'bottom']}>
          <View style={styles.mapModalHeader}>
            <Text style={styles.mapModalTitle}>위치 선택</Text>
            <TouchableOpacity
              onPress={() => setIsMapModalVisible(false)}
              style={styles.mapModalCloseButton}>
              <Icon name="x" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          </View>
          <View style={styles.mapContainer}>
            <LocationMapPicker
              initialRegion={
                selectedLatitude && selectedLongitude
                  ? {
                      latitude: selectedLatitude,
                      longitude: selectedLongitude,
                      latitudeDelta: 0.01,
                      longitudeDelta: 0.01,
                    }
                  : undefined
              }
              onLocationSelect={handleMapLocationSelect}
            />
          </View>
          <View style={styles.mapModalFooter}>
            <Text style={styles.mapModalHint}>
              지도를 이동하여 정확한 위치를 선택하세요
            </Text>
            {selectedLatitude && selectedLongitude && (
              <Text style={styles.mapModalCoordinates}>
                선택된 위치: {selectedLatitude.toFixed(6)}, {selectedLongitude.toFixed(6)}
              </Text>
            )}
          </View>
        </SafeAreaView>
      </Modal>
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
    paddingBottom: 100, // 다음 버튼 공간 확보
  },
  instructionText: {
    ...typography.h2,
    color: colors.primary,
    marginBottom: spacing.s,
    fontWeight: '700',
  },
  subInstructionText: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textSecondary,
    marginBottom: spacing.xl,
  },
  inputSection: {
    marginBottom: spacing.m,
  },
  input: {
    marginBottom: 0,
  },
  inputFlex: {
    flex: 1,
    marginRight: spacing.s,
    marginBottom: 0,
  },
  inputWithButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  addressSearchButton: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.s,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 80,
  },
  addressSearchButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500',
  },
  inquireButton: {
    height: 56,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 90,
  },
  inquireButtonActive: {
    backgroundColor: '#FFF3EF',
  },
  inquireButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  inquireButtonTextActive: {
    color: colors.textTertiary,
  },
  infoSection: {
    marginTop: spacing.m,
    padding: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  infoLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  infoValue: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textSecondary,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: spacing.l,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: colors.lightGray,
  },
  dividerText: {
    fontSize: typography.captionRegular.fontSize,
    lineHeight: typography.captionRegular.lineHeight,
    fontFamily: typography.captionRegular.fontFamily,
    color: colors.textPrimary,
    marginHorizontal: spacing.m,
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
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  // 지도 모달 스타일
  mapModalContainer: {
    flex: 1,
    backgroundColor: colors.white,
  },
  mapModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  mapModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  mapModalCloseButton: {
    padding: spacing.xs,
  },
  mapContainer: {
    flex: 1,
  },
  mapModalFooter: {
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    gap: spacing.xs,
  },
  mapModalHint: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  mapModalCoordinates: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
});

export default AdvertiserRegisterScreen;

import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  Dimensions,
  ActivityIndicator,
  Image,
  Platform,
} from 'react-native';
import {useNavigation, useRoute} from '@react-navigation/native';
import {IconButton, TextInput, TextArea, Selector} from '../../../../components/common';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import CustomGallery from '../../../../components/CustomGallery';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../../styles/commonStyles';
import {StoreAPI, UploadAPI} from '../../../../api/ApiRequests';
import AddressSearchModal from '../../../../components/AddressSearchModal';
import LocationMapPicker from '../../../../components/LocationMapPicker';
import {useAlert} from '../../../../contexts/AlertContext';

const {width} = Dimensions.get('window');

interface RouteParams {
  user_id?: string;
  email?: string;
}

/**
 * 동네 마트 사장님 회원가입 화면
 */
const StoreRegisterScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const route = useRoute();
  const {user_id} = (route.params as RouteParams) || {};

  const [isRegistering, setIsRegistering] = useState(false);

  const [storeName, setStoreName] = useState('');
  const [businessNumber, setBusinessNumber] = useState('');
  const [tradeName, setTradeName] = useState('');
  const [representative, setRepresentative] = useState('');
  const [storeIntro, setStoreIntro] = useState('');
  const [storeContact, setStoreContact] = useState('');
  const [storeAddress, setStoreAddress] = useState('');
  const [detailedAddress, setDetailedAddress] = useState('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [profileImageUri, setProfileImageUri] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [isAddressSearchVisible, setIsAddressSearchVisible] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [isMapModalVisible, setIsMapModalVisible] = useState(false);
  const [selectedLatitude, setSelectedLatitude] = useState<number | null>(null);
  const [selectedLongitude, setSelectedLongitude] = useState<number | null>(null);

  // 시간 선택 모달 관련 상태
  const [timeModalVisible, setTimeModalVisible] = useState(false);
  const [currentDay, setCurrentDay] = useState<string>('');
  const [timeStep, setTimeStep] = useState<'opening' | 'closing'>('opening');
  const [selectedHour, setSelectedHour] = useState(7);
  const [selectedMinute, setSelectedMinute] = useState(0);
  const [isAM, setIsAM] = useState(true);
  const [openingTimes, setOpeningTimes] = useState<{[key: string]: {hour: number; minute: number; isAM: boolean}}>({});
  const [closingTimes, setClosingTimes] = useState<{[key: string]: {hour: number; minute: number; isAM: boolean}}>({});

  // 휴무일 관련 상태
  const [holidayWeek, setHolidayWeek] = useState('');
  const [holidayDay, setHolidayDay] = useState('');
  const [holidays, setHolidays] = useState<Array<{week: string; day: string}>>([]);

  const weekDays = ['월', '화', '수', '목', '금', '토', '일'];

  const weekOptions = [
    {label: '첫째주', value: '첫째주'},
    {label: '둘째주', value: '둘째주'},
    {label: '셋째주', value: '셋째주'},
    {label: '넷째주', value: '넷째주'},
    {label: '다섯째주', value: '다섯째주'},
  ];

  const dayOptions = weekDays.map(day => ({
    label: day,
    value: day,
  }));


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
    setStoreAddress(address);
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
   * 요일 선택 - 시간 설정 모달 열기
   */
  const handleDayToggle = (day: string) => {
    setCurrentDay(day);
    setTimeStep('opening');

    // 이미 설정된 시간이 있으면 불러오기
    if (openingTimes[day]) {
      const time = openingTimes[day];
      setSelectedHour(time.hour);
      setSelectedMinute(time.minute);
      setIsAM(time.isAM);
    } else {
      // 기본값
      setSelectedHour(7);
      setSelectedMinute(0);
      setIsAM(true);
    }

    setTimeModalVisible(true);
  };

  /**
   * 시간 선택 완료
   */
  const handleTimeComplete = () => {
    if (timeStep === 'opening') {
      // 여는 시간 저장하고 닫는 시간 선택으로
      setOpeningTimes(prev => ({
        ...prev,
        [currentDay]: {hour: selectedHour, minute: selectedMinute, isAM: isAM},
      }));
      setTimeStep('closing');

      // 닫는 시간이 이미 설정되어 있으면 불러오기
      if (closingTimes[currentDay]) {
        const time = closingTimes[currentDay];
        setSelectedHour(time.hour);
        setSelectedMinute(time.minute);
        setIsAM(time.isAM);
      } else {
        // 기본값 (여는 시간 + 2시간)
        let newHour = selectedHour + 2;
        if (newHour > 12) {
          newHour = newHour - 12;
          setIsAM(false);
        } else {
          setIsAM(selectedHour < 12 ? isAM : !isAM);
        }
        setSelectedHour(newHour);
        setSelectedMinute(selectedMinute);
      }
    } else {
      // 닫는 시간 저장하고 완료
      setClosingTimes(prev => ({
        ...prev,
        [currentDay]: {hour: selectedHour, minute: selectedMinute, isAM: isAM},
      }));

      // selectedDays에 추가
      setSelectedDays(prev => {
        if (!prev.includes(currentDay)) {
          return [...prev, currentDay];
        }
        return prev;
      });

      // 모달 닫기
      setTimeModalVisible(false);
      setTimeStep('opening');
    }
  };

  /**
   * 시간 선택 모달 닫기
   */
  const handleTimeModalClose = () => {
    setTimeModalVisible(false);
    setTimeStep('opening');
  };

  /**
   * 아날로그 시계에서 시간 선택
   */
  const handleHourSelect = (hour: number) => {
    setSelectedHour(hour);
  };

  /**
   * 아날로그 시계에서 분 선택
   */
  const handleMinuteSelect = (minute: number) => {
    setSelectedMinute(minute);
  };

  /**
   * 휴무일 추가
   */
  const handleAddHoliday = () => {
    if (!holidayWeek || !holidayDay) {
      alert('오류', '모든 항목을 선택해주세요.');
      return;
    }

    // 중복 확인
    const isDuplicate = holidays.some(
      h => h.week === holidayWeek && h.day === holidayDay
    );

    if (isDuplicate) {
      alert('오류', '이미 추가된 휴무일입니다.');
      return;
    }

    // 휴무일 추가
    setHolidays(prev => [...prev, {week: holidayWeek, day: holidayDay}]);

    // 초기화
    setHolidayWeek('');
    setHolidayDay('');
  };

  /**
   * 휴무일 삭제
   */
  const handleRemoveHoliday = (index: number) => {
    setHolidays(prev => prev.filter((_, i) => i !== index));
  };

  /**
   * 휴무일 추가 버튼 활성화 여부
   */
  const isHolidayButtonEnabled = holidayWeek && holidayDay;

  /**
   * 프로필 사진 선택 옵션 표시 (CustomGallery 사용)
   */
  const showImagePickerOptions = () => {
    setShowCustomGallery(true);
  };

  /**
   * 프로필 이미지 업로드
   */
  const uploadProfileImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'store_profile.jpg';
      const match = /\.(\w+)$/.exec(filename);
      const type = match ? `image/${match[1]}` : 'image/jpeg';

      formData.append('image', {
        uri: Platform.OS === 'ios' ? imageUri.replace('file://', '') : imageUri,
        type,
        name: filename,
      } as any);

      const response = await UploadAPI.uploadImage(formData);
      
      if (response.success && response.data?.image_url) {
        return response.data.image_url;
      } else {
        throw new Error(response.message || '이미지 업로드에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('프로필 이미지 업로드 오류:', error);
      alert('오류', error.message || '프로필 이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  /**
   * 시간을 24시간 형식으로 변환
   */
  const convertTo24Hour = (hour: number, minute: number, isAM: boolean): string => {
    let h24 = hour;
    if (!isAM && hour !== 12) {
      h24 = hour + 12;
    } else if (isAM && hour === 12) {
      h24 = 0;
    }
    return `${h24.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
  };

  /**
   * 다음 버튼 처리 - 상점 등록
   */
  const handleNext = async () => {
    // 필수 정보 검증
    if (!storeName || !businessNumber || !storeAddress || !tradeName || !representative) {
      alert('오류', '필수 정보를 모두 입력해주세요. (상점명, 사업자 등록번호, 상호명, 대표자명, 주소)');
      return;
    }

    // 사업자 등록번호 형식 검증 (10자리 숫자)
    const cleanedNumber = businessNumber.replace(/[-\s]/g, '');
    if (!/^\d{10}$/.test(cleanedNumber)) {
      alert('오류', '사업자 등록번호는 10자리 숫자여야 합니다.');
      return;
    }

    // 영업 시간이 설정된 요일이 있는지 확인
    if (selectedDays.length === 0) {
      alert('오류', '최소 하나의 요일의 영업 시간을 설정해주세요.');
      return;
    }

    // 각 요일별로 여는 시간과 닫는 시간이 모두 있는지 확인
    for (const day of selectedDays) {
      if (!openingTimes[day] || !closingTimes[day]) {
        alert('오류', `${day}요일의 영업 시간을 완전히 설정해주세요.`);
        return;
      }
    }

    try {
      setIsRegistering(true);

      // 프로필 이미지 업로드 (있는 경우)
      let uploadedImageUrl = profileImageUrl;
      if (profileImageUri && !profileImageUrl) {
        console.log('📤 [상점 등록] 프로필 이미지 업로드 시작');
        uploadedImageUrl = await uploadProfileImage(profileImageUri);
        if (!uploadedImageUrl) {
          alert('오류', '프로필 이미지 업로드에 실패했습니다.');
          return;
        }
        setProfileImageUrl(uploadedImageUrl);
      }

      // 영업 시간 데이터 구조화
      const operatingHours: {[key: string]: {opening: string; closing: string}} = {};
      selectedDays.forEach(day => {
        const opening = openingTimes[day];
        const closing = closingTimes[day];
        if (opening && closing) {
          operatingHours[day] = {
            opening: convertTo24Hour(opening.hour, opening.minute, opening.isAM),
            closing: convertTo24Hour(closing.hour, closing.minute, closing.isAM),
          };
        }
      });

      // 휴무일 데이터 구조화 (월 정보 제거)
      const offDays = holidays.map(h => ({
        week: h.week,
        day: h.day,
      }));

      // user_id 확인
      if (!user_id) {
        alert('오류', '사용자 정보를 찾을 수 없습니다. 다시 시도해주세요.');
        return;
      }

      console.log('📤 [상점 등록] 요청 데이터:', {
        user_id,
        name: storeName,
        biz_reg_no: businessNumber,
        owner: representative,
        address: storeAddress,
        detailed_address: detailedAddress,
        phone_number: storeContact,
        description: storeIntro,
        operating_hours: operatingHours,
        off_days: offDays,
      });

      // 상점 등록 API 호출
      console.log('📤 [상점 등록] 위치 정보:', {
        latitude: selectedLatitude,
        longitude: selectedLongitude,
      });

      // 상점 주소는 도로명 주소 전체를 그대로 저장
      // storeAddress는 AddressSearchModal에서 returnFullAddress=true로 받아온 전체 주소 (예: "인천광역시 연수구 용담로 14")
      // detailedAddress는 사용자가 별도로 입력한 상세 주소 (예: "104동 302호")
      // 백엔드에서 address와 detailed_address를 합쳐서 저장함
      
      const response = await StoreAPI.createStore({
        user_id, // 회원가입 중인 사용자 ID
        name: storeName,
        biz_reg_no: cleanedNumber, // 하이픈 제거한 번호 사용
        owner: representative,
        address: storeAddress, // 전체 도로명 주소 그대로
        detailed_address: detailedAddress || undefined, // 사용자 입력 상세 주소
        phone_number: storeContact || undefined,
        description: storeIntro || undefined,
        operating_hours: operatingHours,
        off_days: offDays.length > 0 ? offDays : undefined,
        profile_image_url: uploadedImageUrl || undefined,
        latitude: selectedLatitude || undefined,
        longitude: selectedLongitude || undefined,
      });

      if (response.success && response.data) {
        console.log('✅ [상점 등록] 성공:', response.data.store_id);
        alert('성공', '상점이 등록되었습니다.').then(() => {
          // 완료 화면으로 이동
          // @ts-ignore
          navigation.navigate('CompleteReg');
        });
      } else {
        alert('실패', response.message || '상점 등록에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [상점 등록] 오류:', error);
      console.error('❌ [상점 등록] 오류 응답:', error.response?.data);
      console.error('❌ [상점 등록] 오류 상태:', error.response?.status);

      // 에러 응답에서 메시지 추출
      let errorMessage = '상점 등록 중 오류가 발생했습니다.';

      if (error.response?.data) {
        // 백엔드에서 반환한 에러 메시지
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        // 네트워크 오류 등
        errorMessage = error.message;
      }

      alert('상점 등록 실패', errorMessage);
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
          <Text style={styles.headerTitle}>마트 정보 등록</Text>
          <View style={{width: 40}} />
        </View>

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled">
          {/* 인스트럭션 */}
          <Text style={styles.instruction}>
            사장님의 소중한 가게를 등록해주세요
          </Text>

          {/* 이미지 업로드 영역 */}
          <View style={styles.imageUploadContainer}>
            <TouchableOpacity
              style={styles.imageUploadCircle}
              onPress={showImagePickerOptions}
              disabled={uploadingImage}>
              {uploadingImage ? (
                <ActivityIndicator size="large" color={colors.primary} />
              ) : profileImageUri ? (
                <Image
                  source={{uri: profileImageUri}}
                  style={styles.profileImage}
                  resizeMode="cover"
                />
              ) : (
                <Icon name="plus" size={32} color={colors.primary} />
              )}
            </TouchableOpacity>
            <Text style={styles.imageUploadText}>
              {profileImageUri
                ? '사진을 탭하여 변경'
                : '가게 대표 사진을 등록해주세요.'}
            </Text>
          </View>

          {/* 필수 정보 구분선 */}
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Text style={styles.dividerText}>필수 정보</Text>
            <View style={styles.dividerLine} />
          </View>

          {/* 상점 이름 */}
          <TextInput
            placeholder="상점 이름"
            value={storeName}
            onChangeText={setStoreName}
            style={styles.input}
          />

          {/* 사업자 등록 번호 */}
          <TextInput
            placeholder="사업자 등록 번호"
            value={businessNumber}
            onChangeText={setBusinessNumber}
            keyboardType="numeric"
            style={styles.input}
          />

          {/* 상호명 */}
          <TextInput
            placeholder="상호명"
            value={tradeName}
            onChangeText={setTradeName}
            style={styles.input}
          />

          {/* 대표자명 */}
          <TextInput
            placeholder="대표자명"
            value={representative}
            onChangeText={setRepresentative}
            style={styles.input}
          />

          {/* 가게 소개 */}
          <View>
            <TextArea
              placeholder="가게 소개"
              value={storeIntro}
              onChangeText={setStoreIntro}
              style={styles.textArea}
              maxLength={300}
            />
            <Text style={styles.charCount}>
              {storeIntro.length}/300
            </Text>
          </View>

          {/* 가게 연락처 */}
          <TextInput
            placeholder="가게 연락처"
            value={storeContact}
            onChangeText={setStoreContact}
            keyboardType="phone-pad"
            style={styles.input}
          />

          {/* 가게 주소 */}
          <View style={styles.inputWithButtonRow}>
            <TextInput
              placeholder="가게 주소"
              value={storeAddress}
              onChangeText={setStoreAddress}
              editable={false}
              style={[styles.input, styles.inputFlex]}
            />
            <TouchableOpacity
              style={styles.addressSearchButton}
              onPress={handleSearchAddress}>
              <Text style={styles.addressSearchButtonText}>주소 검색</Text>
            </TouchableOpacity>
          </View>

          {/* 상세 주소 */}
          <TextInput
            placeholder="상세 주소"
            value={detailedAddress}
            onChangeText={setDetailedAddress}
            style={styles.input}
          />

          {/* 영업 시간 */}
          <View style={styles.operatingHoursContainer}>
            <Text style={styles.sectionLabel}>영업 시간</Text>
            <View style={styles.daysContainer}>
              {weekDays.map(day => (
                <TouchableOpacity
                  key={day}
                  style={[
                    styles.dayButton,
                    selectedDays.includes(day) && styles.dayButtonSelected,
                  ]}
                  onPress={() => handleDayToggle(day)}>
                  <Text
                    style={[
                      styles.dayButtonText,
                      selectedDays.includes(day) && styles.dayButtonTextSelected,
                    ]}>
                    {day}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* 휴무일 */}
          <View style={styles.daysOffContainer}>
            <Text style={styles.sectionLabel}>휴무일</Text>
            <View style={styles.daysOffButtonsContainer}>
              <Selector
                placeholder="주"
                value={holidayWeek}
                options={weekOptions}
                onSelect={setHolidayWeek}
                style={styles.holidaySelector}
              />
              <Selector
                placeholder="요일"
                value={holidayDay}
                options={dayOptions}
                onSelect={setHolidayDay}
                style={styles.holidaySelector}
              />
            </View>

            {/* 휴무일 추가하기 버튼 */}
            <TouchableOpacity
              style={[
                styles.addHolidayButton,
                isHolidayButtonEnabled && styles.addHolidayButtonActive,
              ]}
              onPress={handleAddHoliday}
              disabled={!isHolidayButtonEnabled}>
              <Text
                style={[
                  styles.addHolidayButtonText,
                  isHolidayButtonEnabled && styles.addHolidayButtonTextActive,
                ]}>
                휴무일 추가하기
              </Text>
              <View
                style={[
                  styles.addHolidayIcon,
                  isHolidayButtonEnabled && styles.addHolidayIconActive,
                ]}>
                <Icon
                  name="plus"
                  size={16}
                  color={isHolidayButtonEnabled ? colors.white : colors.textTertiary}
                />
              </View>
            </TouchableOpacity>

            {/* 추가된 휴무일 리스트 */}
            {holidays.length > 0 && (
              <View style={styles.holidaysList}>
                {holidays.map((holiday, index) => {
                  const weekLabel = weekOptions.find(opt => opt.value === holiday.week)?.label || '';
                  const dayLabel = holiday.day;

                  return (
                    <View key={index} style={styles.holidayItem}>
                      <Text style={styles.holidayItemText}>
                        {weekLabel} {dayLabel}요일
                      </Text>
                      <TouchableOpacity
                        onPress={() => handleRemoveHoliday(index)}
                        style={styles.removeHolidayButton}>
                        <Icon name="x" size={16} color={colors.textTertiary} />
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
          </View>
        </ScrollView>

          {/* 다음 버튼 - 고정 위치 */}
        <TouchableOpacity
          style={[styles.nextButton, isRegistering && styles.nextButtonDisabled]}
          onPress={handleDoubleTap}
          disabled={isRegistering}>
          {isRegistering ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.nextButtonText}>다음</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* 시간 선택 모달 */}
      <Modal
        visible={timeModalVisible}
        transparent
        animationType="slide"
        onRequestClose={handleTimeModalClose}>
        <View style={styles.modalOverlay}>
          <View style={styles.timeModalContainer}>
            {/* 헤더 */}
            <View style={styles.timeModalHeader}>
              <Text style={styles.timeModalTitle}>
                {currentDay}요일 영업 시간 선택
              </Text>
              <TouchableOpacity onPress={handleTimeModalClose}>
                <Icon name="x" size={24} color={colors.textPrimary} />
              </TouchableOpacity>
            </View>

            {/* 시간 타입 라벨 */}
            <Text style={styles.timeTypeLabel}>
              {timeStep === 'opening' ? '여는 시간' : '닫는 시간'}
            </Text>

            {/* 디지털 시계 */}
            <View style={styles.digitalClockContainer}>
              <Text style={styles.digitalTime}>
                <Text style={styles.digitalHour}>
                  {selectedHour.toString().padStart(2, '0')}
                </Text>
                <Text style={styles.digitalColon}> : </Text>
                <Text style={styles.digitalMinute}>
                  {selectedMinute.toString().padStart(2, '0')}
                </Text>
              </Text>
              <View style={styles.amPmContainer}>
                <TouchableOpacity
                  style={[
                    styles.amPmButton,
                    isAM && styles.amPmButtonActive,
                  ]}
                  onPress={() => setIsAM(true)}>
                  <Text
                    style={[
                      styles.amPmText,
                      isAM && styles.amPmTextActive,
                    ]}>
                    AM
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.amPmButton,
                    !isAM && styles.amPmButtonActive,
                  ]}
                  onPress={() => setIsAM(false)}>
                  <Text
                    style={[
                      styles.amPmText,
                      !isAM && styles.amPmTextActive,
                    ]}>
                    PM
                  </Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 아날로그 시계 */}
            <View style={styles.analogClockContainer}>
              {/* 시간 선택 */}
              <View style={styles.clockNumbersContainer}>
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map(num => {
                  const angle = ((num - 3) * 30) * (Math.PI / 180);
                  const radius = 100;
                  const x = radius * Math.cos(angle);
                  const y = radius * Math.sin(angle);

                  return (
                    <TouchableOpacity
                      key={num}
                      style={[
                        styles.clockNumber,
                        {
                          left: 140 + x,
                          top: 140 + y,
                        },
                        selectedHour === num && styles.clockNumberSelected,
                      ]}
                      onPress={() => handleHourSelect(num)}>
                      <Text
                        style={[
                          styles.clockNumberText,
                          selectedHour === num && styles.clockNumberTextSelected,
                        ]}>
                        {num}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 분 선택 (시계 외곽) */}
              <View style={styles.minuteContainer}>
                {[0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55].map(minute => {
                  const angle = ((minute / 5 - 3) * 30) * (Math.PI / 180);
                  const radius = 130;
                  const x = radius * Math.cos(angle);
                  const y = radius * Math.sin(angle);

                  const isSelected = Math.abs(selectedMinute - minute) < 3;

                  return (
                    <TouchableOpacity
                      key={minute}
                      style={[
                        styles.minuteDot,
                        {
                          left: 140 + x,
                          top: 140 + y,
                        },
                        isSelected && styles.minuteDotSelected,
                      ]}
                      onPress={() => handleMinuteSelect(minute)}>
                      <View
                        style={[
                          styles.minuteDotInner,
                          isSelected && styles.minuteDotInnerSelected,
                        ]}
                      />
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* 시계 바늘 */}
              <View style={styles.clockHands}>
                <View
                  style={[
                    styles.hourHand,
                    {
                      transform: [
                        {
                          rotate: `${(selectedHour % 12) * 30 + selectedMinute * 0.5}deg`,
                        },
                      ],
                    },
                  ]}
                />
                <View
                  style={[
                    styles.minuteHand,
                    {
                      transform: [{rotate: `${selectedMinute * 6}deg`}],
                    },
                  ]}
                />
              </View>
            </View>

            {/* 완료 버튼 */}
            <TouchableOpacity
              style={styles.completeButton}
              onPress={handleTimeComplete}>
              <Text style={styles.completeButtonText}>완료</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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

      {/* 커스텀 갤러리 */}
      <CustomGallery
        visible={showCustomGallery}
        onClose={() => setShowCustomGallery(false)}
        onSelectImage={(imageUri) => {
          setProfileImageUri(imageUri);
          setShowCustomGallery(false);
        }}
        cropperToolbarTitle="가게 사진 편집"
        allowCropping={true}
        compressImageQuality={0.5}
      />
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
  imageUploadContainer: {
    alignItems: 'center',
    marginBottom: spacing.xl,
  },
  imageUploadCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: '#FFF3EF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.m,
    overflow: 'hidden',
  },
  profileImage: {
    width: '100%',
    height: '100%',
  },
  imageUploadText: {
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
  input: {
    marginBottom: spacing.m,
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
  textArea: {
    marginBottom: spacing.xs,
  },
  charCount: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    textAlign: 'right',
    marginBottom: spacing.m,
    marginTop: -spacing.xs,
  },
  operatingHoursContainer: {
    marginTop: spacing.l,
    marginBottom: spacing.l,
  },
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    marginBottom: spacing.m,
    fontWeight: '500' as const,
  },
  daysContainer: {
    flexDirection: 'row',
    gap: spacing.s,
    flexWrap: 'wrap',
  },
  dayButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayButtonSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.primary,
  },
  dayButtonText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontWeight: '500',
  },
  dayButtonTextSelected: {
    color: colors.white,
  },
  daysOffContainer: {
    marginBottom: spacing.l,
  },
  daysOffButtonsContainer: {
    flexDirection: 'row',
    gap: spacing.s,
  },
  daysOffButton: {
    flex: 1,
    height: 56,
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
  },
  daysOffButtonText: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textTertiary,
  },
  holidaySelector: {
    flex: 1,
    marginBottom: 0,
  },
  addHolidayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.m,
    paddingVertical: spacing.m,
  },
  addHolidayButtonActive: {
    // 활성화 상태에서는 스타일 변경 없음 (텍스트와 아이콘 색상만 변경)
  },
  addHolidayButtonText: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textTertiary,
    marginRight: spacing.xs,
  },
  addHolidayButtonTextActive: {
    color: colors.primary,
  },
  addHolidayIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.lightGray,
    justifyContent: 'center',
    alignItems: 'center',
  },
  addHolidayIconActive: {
    backgroundColor: colors.primary,
  },
  holidaysList: {
    marginTop: spacing.m,
    gap: spacing.s,
  },
  holidayItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  holidayItemText: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textPrimary,
  },
  removeHolidayButton: {
    padding: spacing.xs,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
    paddingVertical: spacing.s,
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
  nextButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    marginHorizontal: spacing.l,
    marginBottom: 30,
  },
  nextButtonDisabled: {
    opacity: 0.6,
  },
  nextButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
  // 시간 선택 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  timeModalContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    width: width * 0.9,
    maxWidth: 400,
    padding: spacing.xl,
    maxHeight: '80%',
  },
  timeModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeModalTitle: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
  },
  timeTypeLabel: {
    fontSize: typography.bodyRegular.fontSize,
    lineHeight: typography.bodyRegular.lineHeight,
    fontFamily: typography.bodyRegular.fontFamily,
    color: colors.textSecondary,
    marginBottom: spacing.l,
  },
  digitalClockContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  digitalTime: {
    fontSize: 48,
    fontWeight: '600',
  },
  digitalHour: {
    color: colors.primary,
  },
  digitalColon: {
    color: colors.textPrimary,
  },
  digitalMinute: {
    color: colors.textPrimary,
  },
  amPmContainer: {
    marginLeft: spacing.l,
    gap: spacing.xs,
  },
  amPmButton: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  amPmButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  amPmText: {
    fontSize: typography.bodyMedium.fontSize,
    lineHeight: typography.bodyMedium.lineHeight,
    fontFamily: typography.bodyMedium.fontFamily,
    color: colors.textTertiary,
  },
  amPmTextActive: {
    color: colors.white,
  },
  analogClockContainer: {
    width: 280,
    height: 280,
    borderRadius: 140,
    borderWidth: 2,
    borderColor: colors.lightGray,
    backgroundColor: colors.white,
    alignSelf: 'center',
    marginBottom: spacing.xl,
    position: 'relative',
  },
  clockNumbersContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  clockNumber: {
    position: 'absolute',
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -20,
    marginTop: -20,
  },
  clockNumberSelected: {
    backgroundColor: colors.primary,
  },
  clockNumberText: {
    fontSize: typography.bodyMedium.fontSize,
    fontWeight: '500',
    color: colors.textPrimary,
  },
  clockNumberTextSelected: {
    color: colors.white,
  },
  minuteContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  minuteDot: {
    position: 'absolute',
    width: 12,
    height: 12,
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -6,
    marginTop: -6,
  },
  minuteDotSelected: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
    marginTop: -8,
  },
  minuteDotInner: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.lightGray,
  },
  minuteDotInnerSelected: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.primary,
  },
  clockHands: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  hourHand: {
    position: 'absolute',
    width: 4,
    height: 70,
    backgroundColor: colors.primary,
    borderRadius: 2,
    transformOrigin: 'bottom',
    bottom: '50%',
    marginLeft: -2,
  },
  minuteHand: {
    position: 'absolute',
    width: 3,
    height: 90,
    backgroundColor: colors.primary,
    borderRadius: 1.5,
    transformOrigin: 'bottom',
    bottom: '50%',
    marginLeft: -1.5,
  },
  completeButton: {
    height: 56,
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.primary,
  },
  completeButtonText: {
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

export default StoreRegisterScreen;

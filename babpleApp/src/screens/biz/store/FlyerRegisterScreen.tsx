import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Image,
  ActivityIndicator,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import CustomGallery from '../../../components/CustomGallery';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {StoreAPI, UploadAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';
import {API_BASE_URL} from '../../../config/api';

interface FlyerRegisterScreenProps {
  visible: boolean;
  onClose: () => void;
}

/**
 * 전단지 등록 화면
 * Full Screen Modal
 */
const FlyerRegisterScreen: React.FC<FlyerRegisterScreenProps> = ({
  visible,
  onClose,
}) => {
  const {alert} = useAlert();
  const [flyerImageUri, setFlyerImageUri] = useState<string | null>(null);
  const [flyerImageUrl, setFlyerImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [registering, setRegistering] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [flyerTitle, setFlyerTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 날짜 선택 모달
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [dateSelectType, setDateSelectType] = useState<'start' | 'end'>('start');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // 모달이 열릴 때마다 데이터 초기화
  useEffect(() => {
    if (visible) {
      // 모달이 열릴 때 초기화
      setFlyerImageUri(null);
      setFlyerImageUrl(null);
      setFlyerTitle('');
      setStartDate('');
      setEndDate('');
      setSelectedDate(new Date());
    }
  }, [visible]);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleOpenDateModal = (type: 'start' | 'end') => {
    setDateSelectType(type);
    // 시작일을 선택할 때는 오늘 날짜부터, 종료일을 선택할 때는 시작일 이후부터
    const minDate = new Date();
    if (type === 'end' && startDate) {
      // 시작일이 있으면 시작일 이후만 선택 가능
      const [year, month, day] = startDate.split('.').map(Number);
      minDate.setFullYear(year, month - 1, day);
      minDate.setHours(0, 0, 0, 0);
    } else {
      minDate.setHours(0, 0, 0, 0);
    }
    setSelectedDate(minDate);
    setDatePickerVisibility(true);
  };

  const handleConfirmDate = (date: Date) => {
    const formattedDate = formatDate(date);
    if (dateSelectType === 'start') {
      setStartDate(formattedDate);
      // 시작일이 종료일보다 늦으면 종료일 초기화
      if (endDate && date > new Date(endDate.replace(/\./g, '-'))) {
        setEndDate('');
      }
    } else {
      setEndDate(formattedDate);
    }
    setDatePickerVisibility(false);
  };

  const handleCancelDate = () => {
    setDatePickerVisibility(false);
  };

  /**
   * 이미지 선택 옵션 표시 (CustomGallery 사용)
   */
  const showImagePickerOptions = () => {
    setShowCustomGallery(true);
  };

  /**
   * 프로필 이미지 업로드
   */
  const uploadFlyerImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      
      const formData = new FormData();
      const filename = imageUri.split('/').pop() || 'flyer_image.jpg';
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
      console.error('전단지 이미지 업로드 오류:', error);
      alert('오류', error.message || '전단지 이미지 업로드에 실패했습니다.');
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRegister = async () => {
    // 필수 항목 체크
    if (!flyerImageUri && !flyerImageUrl) {
      alert('알림', '전단지 사진을 등록해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      alert('알림', '전단 기간을 선택해주세요.');
      return;
    }

    try {
      setRegistering(true);

      // 이미지 업로드 (새로 선택한 경우)
      let uploadedImageUrl = flyerImageUrl;
      if (flyerImageUri && !flyerImageUrl) {
        uploadedImageUrl = await uploadFlyerImage(flyerImageUri);
        if (!uploadedImageUrl) {
          alert('오류', '전단지 이미지 업로드에 실패했습니다.');
          return;
        }
        setFlyerImageUrl(uploadedImageUrl);
      }

      // 날짜 형식 변환 (YYYY.MM.DD -> YYYY-MM-DD)
      const startDateFormatted = startDate.replace(/\./g, '-');
      const endDateFormatted = endDate.replace(/\./g, '-');

      const response = await StoreAPI.createFlyer({
        title: flyerTitle || undefined,
        start_date: startDateFormatted,
        end_date: endDateFormatted,
        flyer_image_url: uploadedImageUrl!,
      });

      if (response.success) {
        // 등록 완료 후 데이터 초기화
        setFlyerImageUri(null);
        setFlyerImageUrl(null);
        setFlyerTitle('');
        setStartDate('');
        setEndDate('');
        setSelectedDate(new Date());
        
        alert('등록 완료', '전단지가 등록되었습니다.').then(() => {
          onClose();
        });
      } else {
        alert('등록 실패', response.message || '전단지 등록에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [전단지 등록] 오류:', error);
      alert('오류', error.response?.data?.message || '전단지 등록 중 오류가 발생했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>새 전단지 등록</Text>
            <View style={styles.headerRightPlaceholder} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 상품 대표 사진 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                상품 대표 사진 (필수)
              </Text>
              <TouchableOpacity
                style={styles.imageUploadContainer}
                onPress={showImagePickerOptions}
                disabled={uploadingImage}>
                {uploadingImage ? (
                  <ActivityIndicator size="large" color={colors.primary} />
                ) : flyerImageUri || flyerImageUrl ? (
                  <Image
                    source={{
                      uri: flyerImageUri || (flyerImageUrl?.startsWith('http') ? flyerImageUrl : `${API_BASE_URL}${flyerImageUrl?.startsWith('/') ? flyerImageUrl : `/${flyerImageUrl}`}`),
                    }}
                    style={styles.uploadedImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={styles.imagePlaceholder}>
                    <Icon name="camera" size={32} color={colors.lightGray} />
                    <Text style={styles.imagePlaceholderText}>
                      탭하여 사진 추가
                    </Text>
                  </View>
                )}
              </TouchableOpacity>
            </View>

            {/* 전단지 제목 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>전단지 제목 (선택)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="전단지 제목을 입력하세요"
                value={flyerTitle}
                onChangeText={setFlyerTitle}
              />
              <Text style={styles.hintText}>
                제목이 없으면 "전단 기간 - 전단지"로 표기됩니다.
              </Text>
            </View>

            {/* 전단 기간 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>전단 기간 (필수)</Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => handleOpenDateModal('start')}>
                  <Icon name="calendar" size={20} color={colors.textSecondary} />
                  <Text
                    style={[
                      styles.dateButtonText,
                      !startDate && styles.dateButtonTextPlaceholder,
                    ]}>
                    {startDate || '시작일'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.dateButton}
                  onPress={() => handleOpenDateModal('end')}>
                  <Icon name="calendar" size={20} color={colors.textSecondary} />
                  <Text
                    style={[
                      styles.dateButtonText,
                      !endDate && styles.dateButtonTextPlaceholder,
                    ]}>
                    {endDate || '종료일'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </ScrollView>

          {/* 등록하기 버튼 */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              styles.registerButtonActive,
              (registering || uploadingImage) && styles.registerButtonDisabled,
            ]}
            onPress={handleRegister}
            disabled={registering || uploadingImage}>
            {registering ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>등록하기</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* 날짜 선택 모달 */}
        <DatePicker
          modal
          open={isDatePickerVisible}
          date={selectedDate}
          mode="date"
          onConfirm={handleConfirmDate}
          onCancel={handleCancelDate}
          minimumDate={
            dateSelectType === 'end' && startDate
              ? new Date(startDate.replace(/\./g, '-'))
              : new Date()
          }
          title={dateSelectType === 'start' ? '시작일 선택' : '종료일 선택'}
          confirmText="확인"
          cancelText="취소"
          locale="ko"
        />

        {/* 커스텀 갤러리 */}
        <CustomGallery
          visible={showCustomGallery}
          onClose={() => setShowCustomGallery(false)}
          onSelectImage={(imageUri) => {
            setFlyerImageUri(imageUri);
            setShowCustomGallery(false);
          }}
          cropperToolbarTitle="전단지 사진 편집"
          allowCropping={true}
          compressImageQuality={0.5}
        />
      </SafeAreaView>
    </Modal>
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
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    backgroundColor: colors.white,
  },
  cancelButton: {
    padding: spacing.xs,
  },
  cancelText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '400' as const,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  headerRightPlaceholder: {
    width: 60,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: 100,
  },
  section: {
    marginBottom: spacing.xl,
  },
  sectionLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
  },
  imageUploadContainer: {
    width: 200,
    height: 200,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.lightGray,
    borderStyle: 'dashed',
    borderRadius: borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  imagePlaceholder: {
    alignItems: 'center',
    gap: spacing.s,
  },
  imagePlaceholderText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
  uploadedImage: {
    width: '100%',
    height: '100%',
  },
  textInput: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  hintText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  dateRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  dateButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.white,
  },
  dateButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '400' as const,
  },
  dateButtonTextPlaceholder: {
    color: colors.textSecondary,
  },
  registerButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.textTertiary,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonActive: {
    backgroundColor: colors.primary,
  },
  registerButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600' as const,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
});

export default FlyerRegisterScreen;


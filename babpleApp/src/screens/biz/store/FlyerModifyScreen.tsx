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

/**
 * 이미지 URL 빌드 (상대 경로를 전체 URL로 변환)
 */
const buildImageUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  // 이미 완전한 URL인 경우
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    return trimmed;
  }

  // 백슬래시를 슬래시로 변환
  let normalized = trimmed.replace(/\\/g, '/');

  // /uploads로 시작하는 경우 그대로 사용
  if (normalized.startsWith('/uploads')) {
    return `${API_BASE_URL}${normalized}`;
  }

  // uploads로 시작하는 경우 앞에 /만 추가
  if (normalized.startsWith('uploads')) {
    normalized = `/${normalized}`;
    return `${API_BASE_URL}${normalized}`;
  }

  // 그 외의 경우 /uploads/ 접두사 추가
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (!normalized.startsWith('/uploads')) {
    normalized = `/uploads${normalized}`;
  }

  return `${API_BASE_URL}${normalized}`;
};

interface FlyerModifyScreenProps {
  visible: boolean;
  onClose: () => void;
  flyer?: {
    flyer_id: string;
    title?: string | null;
    start_date?: Date | string;
    end_date?: Date | string;
    flyer_image_url?: string;
  };
}

/**
 * 전단지 수정 화면
 * Full Screen Modal
 * FlyerRegisterScreen과 동일하지만 데이터가 미리 채워져 있음
 */
const FlyerModifyScreen: React.FC<FlyerModifyScreenProps> = ({
  visible,
  onClose,
  flyer,
}) => {
  const {alert} = useAlert();
  const [flyerImageUri, setFlyerImageUri] = useState<string | null>(null);
  const [flyerImageUrl, setFlyerImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [modifying, setModifying] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [flyerTitle, setFlyerTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // 날짜 선택 모달
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [dateSelectType, setDateSelectType] = useState<'start' | 'end'>('start');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  /**
   * 날짜 포맷팅 (Date -> YYYY.MM.DD)
   */
  const formatDateForDisplay = (date: Date | string): string => {
    const d = typeof date === 'string' ? new Date(date) : date;
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  // flyer 데이터로 필드 초기화
  useEffect(() => {
    if (flyer) {
      // 이미지 URL 설정
      setFlyerImageUrl(flyer.flyer_image_url || null);
      setFlyerImageUri(null);

      // 제목 설정
      setFlyerTitle(flyer.title || '');

      // 날짜 설정
      if (flyer.start_date) {
        setStartDate(formatDateForDisplay(flyer.start_date));
      }
      if (flyer.end_date) {
        setEndDate(formatDateForDisplay(flyer.end_date));
      }

      // 날짜 선택 모달 초기값 설정
      if (flyer.start_date) {
        const d = typeof flyer.start_date === 'string' ? new Date(flyer.start_date) : flyer.start_date;
        setSelectedDate(d);
      }
    } else {
      // flyer가 없으면 초기화
      setFlyerImageUri(null);
      setFlyerImageUrl(null);
      setFlyerTitle('');
      setStartDate('');
      setEndDate('');
      setSelectedDate(new Date());
    }
  }, [flyer]);

  const formatDate = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleOpenDateModal = (type: 'start' | 'end') => {
    setDateSelectType(type);
    const minDate = new Date();
    let initialDate = new Date();
    
    // 현재 선택된 날짜가 있으면 그 날짜를 초기값으로 설정
    const currentDate = type === 'start' ? startDate : endDate;
    if (currentDate) {
      const [year, month, day] = currentDate.split('.').map(Number);
      initialDate = new Date(year, month - 1, day);
      initialDate.setHours(0, 0, 0, 0);
    } else if (type === 'end' && startDate) {
      // 종료일을 선택할 때 시작일 이후로 설정
      const [year, month, day] = startDate.split('.').map(Number);
      initialDate = new Date(year, month - 1, day);
      initialDate.setHours(0, 0, 0, 0);
      minDate.setFullYear(year, month - 1, day);
      minDate.setHours(0, 0, 0, 0);
    } else {
      minDate.setHours(0, 0, 0, 0);
      initialDate.setHours(0, 0, 0, 0);
    }
    
    setSelectedDate(initialDate);
    setDatePickerVisibility(true);
  };

  const handleConfirmDate = (date: Date) => {
    const formattedDate = formatDate(date);
    if (dateSelectType === 'start') {
      setStartDate(formattedDate);
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
   * 전단지 이미지 업로드
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

  const handleModify = async () => {
    if (!flyer?.flyer_id) {
      alert('오류', '전단지 정보를 찾을 수 없습니다.');
      return;
    }

    if (!flyerImageUri && !flyerImageUrl) {
      alert('알림', '전단지 사진을 등록해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      alert('알림', '전단 기간을 선택해주세요.');
      return;
    }

    try {
      setModifying(true);

      // 이미지 업로드 (새로 선택한 경우)
      let uploadedImageUrl = flyerImageUrl;
      if (flyerImageUri) {
        // 새 이미지가 선택되었으면 무조건 업로드
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

      const response = await StoreAPI.updateFlyer(flyer.flyer_id, {
        title: flyerTitle || undefined,
        start_date: startDateFormatted,
        end_date: endDateFormatted,
        flyer_image_url: uploadedImageUrl || undefined,
      });

      if (response.success) {
        alert('수정 완료', '전단지가 수정되었습니다.').then(() => {
          onClose();
        });
      } else {
        alert('수정 실패', response.message || '전단지 수정에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [전단지 수정] 오류:', error);
      alert('오류', error.response?.data?.message || '전단지 수정 중 오류가 발생했습니다.');
    } finally {
      setModifying(false);
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
            <Text style={styles.headerTitle}>전단지 수정</Text>
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
                      uri: flyerImageUri || buildImageUrl(flyerImageUrl) || '',
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

          {/* 수정하기 버튼 */}
          <TouchableOpacity
            style={[
              styles.registerButton,
              styles.registerButtonActive,
              (modifying || uploadingImage) && styles.registerButtonDisabled,
            ]}
            onPress={handleModify}
            disabled={modifying || uploadingImage}>
            {modifying ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.registerButtonText}>수정하기</Text>
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
            setFlyerImageUrl(null); // 새 이미지 선택 시 기존 URL 초기화
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

export default FlyerModifyScreen;


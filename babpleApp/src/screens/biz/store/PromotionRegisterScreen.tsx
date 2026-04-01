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
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
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
import {TextArea} from '../../../components/common';
import {StoreAPI, UploadAPI} from '../../../api/ApiRequests';
import {useAlert} from '../../../contexts/AlertContext';

interface PromotionRegisterScreenProps {
  visible: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

/**
 * 기획 상품 등록 화면
 * Full Screen Modal
 */
const PromotionRegisterScreen: React.FC<PromotionRegisterScreenProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const {alert} = useAlert();
  const [productImageUri, setProductImageUri] = useState<string | null>(null);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const [selectedIngredient, setSelectedIngredient] = useState<{
    ingredient_id: number;
    name: string;
  } | null>(null);
  const [promotionTitle, setPromotionTitle] = useState('');
  const [promotionDescription, setPromotionDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [quantityUnit, setQuantityUnit] = useState('개');
  const [originalPrice, setOriginalPrice] = useState('');
  const [discountPrice, setDiscountPrice] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registering, setRegistering] = useState(false);

  // 재료 선택 모달
  const [ingredientModalVisible, setIngredientModalVisible] = useState(false);
  const [ingredientSearchQuery, setIngredientSearchQuery] = useState('');
  const [ingredients, setIngredients] = useState<Array<{
    ingredient_id: number;
    name: string;
    default_unit: string | null;
  }>>([]);
  const [loadingIngredients, setLoadingIngredients] = useState(false);

  // 날짜 선택 모달
  const [isDatePickerVisible, setDatePickerVisibility] = useState(false);
  const [dateSelectType, setDateSelectType] = useState<'start' | 'end'>('start');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // 재료 목록 로드
  useEffect(() => {
    if (ingredientModalVisible && ingredientSearchQuery) {
      loadIngredients();
    }
  }, [ingredientModalVisible, ingredientSearchQuery]);

  const loadIngredients = async () => {
    try {
      setLoadingIngredients(true);
      const response = await StoreAPI.getIngredients(ingredientSearchQuery);
      if (response.success && response.data) {
        setIngredients(response.data);
      }
    } catch (error) {
      console.error('❌ [재료 목록] 로드 오류:', error);
    } finally {
      setLoadingIngredients(false);
    }
  };

  const handleSelectIngredient = (ingredient: {
    ingredient_id: number;
    name: string;
  }) => {
    setSelectedIngredient(ingredient);
    setIngredientModalVisible(false);
    setIngredientSearchQuery('');
  };

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
   * 프로모션 이미지 업로드
   */
  const uploadPromotionImage = async (imageUri: string): Promise<string | null> => {
    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('image', {
        uri: imageUri,
        type: 'image/jpeg',
        name: 'promotion.jpg',
      } as any);

      const response = await UploadAPI.uploadImage(formData);
      if (response.success && response.data?.image_url) {
        return response.data.image_url;
      }
      return null;
    } catch (error) {
      console.error('❌ [프로모션 이미지] 업로드 오류:', error);
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleRegister = async () => {
    // 필수 항목 체크
    if (!productImageUri && !productImageUrl) {
      alert('알림', '상품 대표 사진을 등록해주세요.');
      return;
    }
    if (!selectedIngredient) {
      alert('알림', '행사 중인 재료를 선택해주세요.');
      return;
    }
    if (!promotionTitle.trim()) {
      alert('알림', '프로모션 제목을 입력해주세요.');
      return;
    }
    if (!promotionDescription.trim()) {
      alert('알림', '프로모션 설명을 입력해주세요.');
      return;
    }
    if (!discountPrice.trim()) {
      alert('알림', '할인가를 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      alert('알림', '행사 기간을 선택해주세요.');
      return;
    }

    try {
      setRegistering(true);

      // 이미지 업로드
      let imageUrl = productImageUrl;
      if (productImageUri && !imageUrl) {
        imageUrl = await uploadPromotionImage(productImageUri);
        if (!imageUrl) {
          alert('오류', '이미지 업로드에 실패했습니다.');
          setRegistering(false);
          return;
        }
      }

      // 날짜 포맷 변환 (YYYY.MM.DD -> YYYY-MM-DD)
      const formatDateForAPI = (dateStr: string): string => {
        return dateStr.replace(/\./g, '-');
      };

      // 프로모션 등록
      const response = await StoreAPI.createPromotion({
        ingredient_id: selectedIngredient.ingredient_id,
        title: promotionTitle.trim(),
        description: promotionDescription.trim(),
        sale_price: Number(discountPrice.replace(/,/g, '')),
        original_price: originalPrice ? Number(originalPrice.replace(/,/g, '')) : undefined,
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        promotion_image_url: imageUrl!,
        quantity: quantity ? Number(quantity) : undefined,
        quantity_unit: quantityUnit || undefined,
      });

      if (response.success) {
        alert('등록 완료', '기획 상품이 등록되었습니다.').then(() => {
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        });
      } else {
        alert('오류', '기획 상품 등록에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [기획 상품 등록] 오류:', error);
      alert('오류', error.response?.data?.message || '기획 상품 등록 중 오류가 발생했습니다.');
    } finally {
      setRegistering(false);
    }
  };

  const units = ['개', 'g', 'kg', 'ml', 'L', '팩', '봉'];

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelButton}>
              <Text style={styles.cancelText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>새 기획 상품 등록</Text>
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
                  <View style={styles.imagePlaceholder}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.imagePlaceholderText}>
                      업로드 중...
                    </Text>
                  </View>
                ) : productImageUri ? (
                  <Image
                    source={{uri: productImageUri}}
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

            {/* 재료 선택 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                어떤 재료가 행사 중인가요? (필수)
              </Text>
              <TouchableOpacity
                style={styles.ingredientInputField}
                onPress={() => setIngredientModalVisible(true)}>
                <Text
                  style={[
                    styles.ingredientInputText,
                    !selectedIngredient &&
                      styles.ingredientInputTextPlaceholder,
                    selectedIngredient &&
                      styles.ingredientInputTextSelected,
                  ]}>
                  {selectedIngredient
                    ? selectedIngredient.name
                    : '재료 선택하기'}
                </Text>
              </TouchableOpacity>
              <Text style={styles.ingredientHint}>
                밥플의 데이터베이스와 연결하여 레시피 추천에 사용되는
                정보입니다.
              </Text>
            </View>

            {/* 프로모션 제목 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>프로모션 제목 (필수)</Text>
              <TextInput
                style={styles.textInput}
                placeholder="프로모션 제목을 입력하세요"
                value={promotionTitle}
                onChangeText={setPromotionTitle}
                maxLength={30}
                multiline={false}
              />
            </View>

            {/* 프로모션 설명 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>프로모션 설명 (필수)</Text>
              <TextArea
                style={styles.textArea}
                placeholder="프로모션을 홍보하는 짧은 문구입니다. (최대 32자)"
                value={promotionDescription}
                onChangeText={setPromotionDescription}
                maxLength={32}
                numberOfLines={3}
              />
              <Text style={styles.hintText}>
                프로모션을 홍보하는 짧은 문구입니다. (최대 32자)
              </Text>
            </View>

            {/* 수량 */}
            <View style={styles.section}>
              <View style={styles.quantityRow}>
                <Text style={styles.sectionLabel}>수량 (필수)</Text>
              </View>
              <View style={styles.quantityInputContainer}>
                <TextInput
                  style={styles.quantityInput}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                  placeholder="수량"
                />
                <TextInput
                  style={styles.unitInput}
                  value={quantityUnit}
                  onChangeText={setQuantityUnit}
                  placeholder="단위 (예: 개, kg, L)"
                  maxLength={10}
                />
              </View>
            </View>

            {/* 가격 정보 */}
            <View style={styles.section}>
              <Text style={styles.priceSectionTitle}>가격 정보</Text>
              <View style={styles.priceRow}>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>정상가 (선택)</Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      value={originalPrice}
                      onChangeText={setOriginalPrice}
                      keyboardType="numeric"
                    />
                    <Text style={styles.priceUnit}>원</Text>
                  </View>
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.priceLabel}>할인가 (필수)</Text>
                  <View style={styles.priceInputRow}>
                    <TextInput
                      style={styles.priceInput}
                      placeholder="0"
                      value={discountPrice}
                      onChangeText={setDiscountPrice}
                      keyboardType="numeric"
                    />
                    <Text style={styles.priceUnit}>원</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* 행사 기간 */}
            <View style={styles.section}>
              <Text style={styles.priceSectionTitle}>행사 기간 (필수)</Text>
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

        {/* 재료 선택 모달 */}
        <Modal
          visible={ingredientModalVisible}
          animationType="fade"
          transparent={true}
          onRequestClose={() => setIngredientModalVisible(false)}>
          <TouchableOpacity
            style={styles.modalOverlay}
            activeOpacity={1}
            onPress={() => {
              setIngredientModalVisible(false);
              setIngredientSearchQuery('');
            }}>
            <View
              style={styles.ingredientModalContainer}
              onStartShouldSetResponder={() => true}>
              {/* 모달 헤더 */}
              <View style={styles.ingredientModalHeader}>
                <Text style={styles.ingredientModalTitle}>재료 선택</Text>
                <TouchableOpacity
                  onPress={() => {
                    setIngredientModalVisible(false);
                    setIngredientSearchQuery('');
                  }}>
                  <Icon name="x" size={24} color={colors.textPrimary} />
                </TouchableOpacity>
              </View>

              {/* 검색 입력 */}
              <View style={styles.ingredientSearchContainer}>
                <TextInput
                  style={styles.ingredientSearchInput}
                  placeholder="양배추"
                  value={ingredientSearchQuery}
                  onChangeText={setIngredientSearchQuery}
                  autoFocus={true}
                />
                <Icon
                  name="search"
                  size={20}
                  color={colors.textSecondary}
                  style={styles.searchIcon}
                />
              </View>

              {/* 재료 목록 */}
              <ScrollView
                style={styles.ingredientList}
                showsVerticalScrollIndicator={false}>
                {loadingIngredients ? (
                  <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={styles.loadingText}>재료를 불러오는 중...</Text>
                  </View>
                ) : ingredients.length > 0 ? (
                  ingredients.map((ingredient, index) => (
                    <TouchableOpacity
                      key={ingredient.ingredient_id}
                      style={[
                        styles.ingredientItem,
                        index !== ingredients.length - 1 &&
                          styles.ingredientItemWithBorder,
                      ]}
                      onPress={() => handleSelectIngredient(ingredient)}>
                      <Text style={styles.ingredientItemText}>{ingredient.name}</Text>
                      {selectedIngredient?.ingredient_id !== ingredient.ingredient_id && (
                        <Icon
                          name="plus"
                          size={20}
                          color={colors.textPrimary}
                          style={styles.ingredientAddIcon}
                        />
                      )}
                    </TouchableOpacity>
                  ))
                ) : ingredientSearchQuery ? (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      검색 결과가 없습니다.
                    </Text>
                  </View>
                ) : (
                  <View style={styles.noResultsContainer}>
                    <Text style={styles.noResultsText}>
                      재료 이름을 검색해주세요.
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </TouchableOpacity>
        </Modal>

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
            setProductImageUri(imageUri);
            setShowCustomGallery(false);
          }}
          cropperToolbarTitle="상품 사진 편집"
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
    width: 150,
    height: 150,
    alignSelf: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
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
  ingredientInputField: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.white,
    justifyContent: 'center',
    minHeight: 56,
  },
  ingredientInputText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '400' as const,
    textAlign: 'center',
  },
  ingredientInputTextPlaceholder: {
    color: colors.textTertiary,
    textAlign: 'left',
  },
  ingredientInputTextSelected: {
    textAlign: 'center',
  },
  selectedIngredientsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.s,
    marginBottom: spacing.s,
  },
  selectedIngredientChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.secondary,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.m,
    borderRadius: borderRadius.l,
    gap: spacing.xs,
  },
  selectedIngredientText: {
    ...typography.captionMedium,
    color: colors.textPrimary,
  },
  removeIngredientButton: {
    padding: 2,
  },
  ingredientHint: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
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
  textArea: {
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.white,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  hintText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  quantityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  quantityInputContainer: {
    flexDirection: 'row',
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    backgroundColor: colors.white,
    overflow: 'hidden',
  },
  quantityInput: {
    flex: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  unitInput: {
    flex: 1,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderLeftWidth: 1,
    borderLeftColor: colors.lightGray,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    backgroundColor: colors.white,
  },
  priceSectionTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.m,
    textAlign: 'center',
  },
  priceRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  priceInputContainer: {
    flex: 1,
  },
  priceLabel: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    marginBottom: spacing.s,
  },
  priceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.lightGray,
    borderRadius: borderRadius.m,
    backgroundColor: colors.white,
    paddingHorizontal: spacing.m,
  },
  priceInput: {
    flex: 1,
    paddingVertical: spacing.m,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  priceUnit: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginLeft: spacing.s,
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
  loadingContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  loadingText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: spacing.m,
  },
  // 재료 선택 모달 스타일
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ingredientModalContainer: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    width: '90%',
    maxWidth: 400,
    maxHeight: '70%',
    paddingBottom: spacing.l,
  },
  ingredientModalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingTop: spacing.l,
    paddingBottom: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  ingredientModalTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700',
    flex: 1,
    textAlign: 'center',
  },
  ingredientSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: spacing.l,
    marginTop: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.white,
  },
  ingredientSearchInput: {
    flex: 1,
    paddingVertical: spacing.m,
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  searchIcon: {
    marginLeft: spacing.s,
  },
  ingredientList: {
    marginTop: spacing.m,
    paddingHorizontal: spacing.l,
  },
  ingredientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.m,
  },
  ingredientItemWithBorder: {
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  ingredientItemText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '400' as const,
  },
  ingredientAddIcon: {
    marginLeft: spacing.s,
  },
  noResultsContainer: {
    paddingVertical: spacing.xl,
    alignItems: 'center',
  },
  noResultsText: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
});

export default PromotionRegisterScreen;


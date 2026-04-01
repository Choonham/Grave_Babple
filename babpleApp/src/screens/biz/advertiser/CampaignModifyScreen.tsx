import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  Modal,
  Alert,
  ActivityIndicator,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import DatePicker from 'react-native-date-picker';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI} from '../../../api/ApiRequests';
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

interface CampaignModifyScreenProps {
  visible: boolean;
  onClose: () => void;
  campaign?: {
    campaign_id?: string;
    campaign_name?: string;
    total_budget?: number;
    cpi?: number;
    start_date?: Date | string;
    end_date?: Date | string;
    creatives?: Array<{
      creative_id: string;
      ad_title?: string;
      ad_type?: number;
      ad_image_url?: string;
    }>;
  };
  onSuccess?: () => void;
}

/**
 * 캠페인 수정 화면
 */
const CampaignModifyScreen: React.FC<CampaignModifyScreenProps> = ({
  visible,
  onClose,
  campaign: propCampaign,
  onSuccess,
}) => {
  const {alert, confirm} = useAlert();
  const [campaignName, setCampaignName] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [cpi, setCpi] = useState('');
  const [startDate, setStartDate] = useState(new Date());
  const [endDate, setEndDate] = useState(new Date());
  const [isStartDatePickerVisible, setIsStartDatePickerVisible] = useState(false);
  const [isEndDatePickerVisible, setIsEndDatePickerVisible] = useState(false);
  const [selectedResources, setSelectedResources] = useState<
    Array<{
      id: string;
      creative_id: string;
      title: string;
      type: 'feedAd' | 'recipeCardAd';
      thumbnail: string | null;
    }>
  >([]);
  const [availableResources, setAvailableResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [modifying, setModifying] = useState(false);

  /**
   * 캠페인 데이터 및 광고 소재 목록 로드
   */
  useEffect(() => {
    if (visible && propCampaign?.campaign_id) {
      loadCampaignData();
      loadAvailableCreatives();
    } else if (visible && propCampaign) {
      // propCampaign에서 직접 데이터 사용
      setCampaignName(propCampaign.campaign_name || '');
      setTotalBudget(propCampaign.total_budget?.toString() || '');
      setCpi(propCampaign.cpi?.toString() || '');
      
      if (propCampaign.start_date) {
        const start = typeof propCampaign.start_date === 'string' 
          ? new Date(propCampaign.start_date) 
          : propCampaign.start_date;
        setStartDate(start);
      }
      if (propCampaign.end_date) {
        const end = typeof propCampaign.end_date === 'string' 
          ? new Date(propCampaign.end_date) 
          : propCampaign.end_date;
        setEndDate(end);
      }

      // 광고 소재 미리 선택
      if (propCampaign.creatives) {
        const selected = propCampaign.creatives.map((c: any) => ({
          id: c.creative_id,
          creative_id: c.creative_id,
          title: c.ad_title || '제목 없음',
          type: c.ad_type === 1 ? 'feedAd' : c.ad_type === 2 ? 'recipeCardAd' : 'feedAd',
          thumbnail: buildImageUrl(c.ad_image_url),
        }));
        setSelectedResources(selected);
      }
    }
  }, [visible, propCampaign]);

  const loadCampaignData = async () => {
    if (!propCampaign?.campaign_id) return;

    try {
      setLoading(true);
      const response = await AdvertiserAPI.getCampaign(propCampaign.campaign_id);
      if (response.success && response.data) {
        const data = response.data;
        setCampaignName(data.campaign_name);
        setTotalBudget(data.total_budget.toString());
        setCpi(data.cpi.toString());
        setStartDate(new Date(data.start_date));
        setEndDate(new Date(data.end_date));

        // 광고 소재 미리 선택
        if (data.creatives) {
          const selected = data.creatives.map((c: any) => ({
            id: c.creative_id,
            creative_id: c.creative_id,
            title: c.ad_title || '제목 없음',
            type: c.ad_type === 1 ? 'feedAd' : c.ad_type === 2 ? 'recipeCardAd' : 'feedAd',
            thumbnail: buildImageUrl(c.ad_image_url),
          }));
          setSelectedResources(selected);
        }
      }
    } catch (error: any) {
      console.error('❌ [캠페인 수정] 데이터 로드 오류:', error);
      alert('오류', '캠페인 정보를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const loadAvailableCreatives = async () => {
    try {
      const response = await AdvertiserAPI.getMyCreatives();
      if (response.success && response.data) {
        // 현재 캠페인에 연결된 소재와 연결되지 않은 소재 모두 표시
        const all = response.data.map((creative: any) => ({
          id: creative.creative_id,
          creative_id: creative.creative_id,
          title: creative.ad_title || '제목 없음',
          type: creative.ad_type === 1 ? 'feedAd' : creative.ad_type === 2 ? 'recipeCardAd' : 'feedAd',
          thumbnail: buildImageUrl(creative.ad_image_url),
          campaign_id: creative.campaign_id, // 이미 다른 캠페인에 연결된 경우 표시
        }));
        setAvailableResources(all);
      }
    } catch (error: any) {
      console.error('❌ [캠페인 수정] 광고 소재 목록 로드 오류:', error);
      // 조용히 처리 (수정 화면을 막지 않음)
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'feedAd':
        return '피드 광고';
      case 'recipeCardAd':
        return '레시피 카드 광고';
      default:
        return '';
    }
  };

  const getTypeStyle = (type: string) => {
    switch (type) {
      case 'feedAd':
        return styles.typeTagFeedAd;
      case 'recipeCardAd':
        return styles.typeTagRecipeCardAd;
      default:
        return {};
    }
  };

  const handleCancel = async () => {
    // Modal 위에서는 native Alert 사용
    Alert.alert(
      '확인',
      '입력한 데이터가 사라집니다. 정말 취소하시겠습니까?',
      [
        {
          text: '아니오',
          style: 'cancel',
        },
        {
          text: '예',
          style: 'destructive',
          onPress: () => {
            onClose();
          },
        },
      ],
    );
  };

  const formatDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}.${month}.${day}`;
  };

  const handleToggleResource = (resource: {
    id: string;
    creative_id: string;
    title: string;
    type: 'feedAd' | 'recipeCardAd';
    thumbnail: string | null;
    campaign_id?: string | null;
  }) => {
    // 이미 다른 캠페인에 연결된 소재는 선택 불가
    if (resource.campaign_id && resource.campaign_id !== propCampaign?.campaign_id) {
      alert('알림', '이미 다른 캠페인에 연결된 광고 소재입니다.');
      return;
    }

    const isSelected = selectedResources.some(r => r.id === resource.id);
    if (isSelected) {
      setSelectedResources(prev =>
        prev.filter(r => r.id !== resource.id),
      );
    } else {
      setSelectedResources(prev => [...prev, resource]);
    }
  };

  const isResourceSelected = (id: string) => {
    return selectedResources.some(r => r.id === id);
  };

  const isFormValid = () => {
    if (!campaignName.trim()) return false;
    if (!totalBudget.trim()) return false;
    if (!cpi.trim()) return false;
    if (selectedResources.length === 0) return false;
    return true;
  };

  const handleModify = async () => {
    if (!isFormValid()) {
      alert('알림', '모든 필수 항목을 입력해주세요.');
      return;
    }

    if (!propCampaign?.campaign_id) {
      alert('오류', '수정할 캠페인 정보가 없습니다.');
      return;
    }

    // CPI가 총 예산보다 큰지 검증
    const cpiValue = Number(cpi);
    const totalBudgetValue = Number(totalBudget);
    
    if (cpiValue > totalBudgetValue) {
      alert('입력 오류', '노출당 단가(CPI)는 총 소진 예산보다 클 수 없습니다.');
      return;
    }

    try {
      setModifying(true);

      // 날짜 형식 변환 (YYYY-MM-DD)
      const formatDateForAPI = (date: Date): string => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      };

      const creativeIds = selectedResources.map(r => r.creative_id);

      console.log('📤 [캠페인 수정] 요청 데이터:', {
        campaign_name: campaignName,
        total_budget: Number(totalBudget),
        cpi: Number(cpi),
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        creative_ids: creativeIds,
      });

      const response = await AdvertiserAPI.updateCampaign(propCampaign.campaign_id, {
        campaign_name: campaignName,
        total_budget: Number(totalBudget),
        cpi: Number(cpi),
        start_date: formatDateForAPI(startDate),
        end_date: formatDateForAPI(endDate),
        creative_ids: creativeIds,
      });

      if (response.success && response.data) {
        console.log('✅ [캠페인 수정] 성공:', response.data.campaign_id);
        alert('성공', '캠페인이 수정되었습니다.').then(() => {
          onClose();
          if (onSuccess) {
            onSuccess();
          }
        });
      } else {
        alert('실패', response.message || '캠페인 수정에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('❌ [캠페인 수정] 오류:', error);
      console.error('❌ [캠페인 수정] 오류 응답:', error.response?.data);
      console.error('❌ [캠페인 수정] 오류 상태:', error.response?.status);

      let errorMessage = '캠페인 수정 중 오류가 발생했습니다.';

      if (error.response?.data) {
        errorMessage = error.response.data.message || errorMessage;
      } else if (error.message) {
        errorMessage = error.message;
      }

      alert('캠페인 수정 실패', errorMessage);
    } finally {
      setModifying(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
        <View style={styles.container}>
          {/* 헤더 */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleCancel} style={styles.cancelButton}>
              <Text style={styles.cancelButtonText}>취소</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle}>캠페인 수정</Text>
            <View style={styles.headerSpacer} />
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}>
            {/* 캠페인 이름 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                캠페인 이름<Text style={styles.required}> (필수)</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="캠페인 이름을 입력해주세요"
                placeholderTextColor={colors.textTertiary}
                value={campaignName}
                onChangeText={setCampaignName}
                maxLength={30}
                multiline={false}
              />
              <Text style={styles.helperText}>
                광고주가 관리하기 쉬운 이름을 입력해주세요. (예: 10월 신메뉴 홍보)
              </Text>
            </View>

            {/* 예산 및 단가 */}
            <View style={styles.section}>
              <View style={styles.budgetRow}>
                <View style={styles.budgetItem}>
                  <Text style={styles.sectionLabel}>총 예산 (₩)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={totalBudget}
                    onChangeText={setTotalBudget}
                    keyboardType="numeric"
                  />
                </View>
                <View style={styles.budgetItem}>
                  <Text style={styles.sectionLabel}>노출 당 단가 (CPI, ₩)</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                    value={cpi}
                    onChangeText={setCpi}
                    keyboardType="numeric"
                  />
                </View>
              </View>
              <Text style={styles.helperText}>
                1회 노출 당 금액이 높을수록 노출 확률이 높아집니다.
              </Text>
            </View>

            {/* 캠페인 기간 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>
                캠페인 기간<Text style={styles.required}> (필수)</Text>
              </Text>
              <View style={styles.dateRow}>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setIsStartDatePickerVisible(true)}>
                  <Icon name="calendar" size={16} color={colors.textPrimary} />
                  <Text style={styles.dateText}>{formatDate(startDate)}</Text>
                </TouchableOpacity>
                <Text style={styles.dateSeparator}>~</Text>
                <TouchableOpacity
                  style={styles.dateInput}
                  onPress={() => setIsEndDatePickerVisible(true)}>
                  <Icon name="calendar" size={16} color={colors.textPrimary} />
                  <Text style={styles.dateText}>{formatDate(endDate)}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* 광고 소재 */}
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>광고 소재</Text>
              {loading ? (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="small" color={colors.primary} />
                </View>
              ) : availableResources.length > 0 ? (
                availableResources.map(resource => {
                  const isSelected = isResourceSelected(resource.id);
                  const isDisabled = resource.campaign_id && resource.campaign_id !== propCampaign?.campaign_id;
                  return (
                    <TouchableOpacity
                      key={resource.id}
                      style={[
                        styles.resourceCard,
                        isSelected && styles.resourceCardSelected,
                        isDisabled && styles.resourceCardDisabled,
                      ]}
                      onPress={() => handleToggleResource(resource)}
                      disabled={isDisabled}>
                      {resource.thumbnail ? (
                        <Image
                          source={{uri: resource.thumbnail}}
                          style={styles.resourceThumbnail}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.resourceThumbnail, styles.thumbnailPlaceholder]}>
                          <Icon name="image" size={24} color={colors.lightGray} />
                        </View>
                      )}
                      <View style={styles.resourceInfo}>
                        <Text style={styles.resourceTitle}>{resource.title}</Text>
                        <View style={styles.tagsContainer}>
                          <View
                            style={[styles.typeTag, getTypeStyle(resource.type)]}>
                            <Text
                              style={[
                                styles.typeTagText,
                                resource.type === 'recipeCardAd' &&
                                  styles.typeTagTextRecipeCardAd,
                              ]}>
                              {getTypeLabel(resource.type)}
                            </Text>
                          </View>
                          {isDisabled && (
                            <View style={styles.disabledTag}>
                              <Text style={styles.disabledTagText}>
                                다른 캠페인 사용 중
                              </Text>
                            </View>
                          )}
                        </View>
                      </View>
                      <View style={styles.checkboxContainer}>
                        {isSelected && (
                          <Icon name="check" size={24} color={colors.primary} />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Text style={styles.emptyText}>
                    사용 가능한 광고 소재가 없습니다.
                  </Text>
                </View>
              )}
            </View>
          </ScrollView>

          {/* 수정하기 버튼 */}
          {loading ? (
            <View style={styles.loadingButtonContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <TouchableOpacity
              style={[
                styles.registerButton,
                isFormValid() && styles.registerButtonActive,
                modifying && styles.registerButtonDisabled,
              ]}
              onPress={handleModify}
              disabled={!isFormValid() || modifying}>
              {modifying ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text
                  style={[
                    styles.registerButtonText,
                    isFormValid() && styles.registerButtonTextActive,
                  ]}>
                  수정하기
                </Text>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* 날짜 선택 모달 */}
        <DatePicker
          modal
          open={isStartDatePickerVisible}
          date={startDate}
          mode="date"
          onConfirm={date => {
            setStartDate(date);
            setIsStartDatePickerVisible(false);
          }}
          onCancel={() => setIsStartDatePickerVisible(false)}
          minimumDate={new Date()}
        />
        <DatePicker
          modal
          open={isEndDatePickerVisible}
          date={endDate}
          mode="date"
          onConfirm={date => {
            setEndDate(date);
            setIsEndDatePickerVisible(false);
          }}
          onCancel={() => setIsEndDatePickerVisible(false)}
          minimumDate={startDate}
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
  },
  cancelButton: {
    padding: spacing.xs,
  },
  cancelButtonText: {
    ...typography.bodyMedium,
    color: colors.primary,
    fontWeight: '500' as const,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
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
    marginBottom: spacing.s,
  },
  required: {
    color: colors.primary,
  },
  input: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    padding: spacing.m,
    ...typography.bodyRegular,
    color: colors.textPrimary,
    borderWidth: 1,
    borderColor: colors.lightGray,
  },
  helperText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
  },
  budgetRow: {
    flexDirection: 'row',
    gap: spacing.m,
  },
  budgetItem: {
    flex: 1,
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
  },
  dateInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    padding: spacing.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
    gap: spacing.xs,
  },
  dateText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
  dateSeparator: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.lightGray,
    gap: spacing.m,
  },
  resourceCardSelected: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  resourceThumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.s,
  },
  resourceInfo: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resourceTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
    textAlign: 'center',
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: spacing.xs,
    justifyContent: 'center',
  },
  typeTag: {
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.l,
  },
  typeTagFeedAd: {
    backgroundColor: '#D6EAF8',
  },
  typeTagRecipeCardAd: {
    backgroundColor: '#D5F5E3',
  },
  typeTagText: {
    ...typography.captionMedium,
    color: '#2E86C1',
    fontWeight: '500' as const,
  },
  typeTagTextRecipeCardAd: {
    ...typography.captionMedium,
    color: '#28B463',
    fontWeight: '500' as const,
  },
  checkboxContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButton: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.lightGray,
    paddingVertical: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonActive: {
    backgroundColor: colors.primary,
  },
  registerButtonText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontWeight: '600' as const,
  },
  registerButtonTextActive: {
    color: colors.white,
  },
  registerButtonDisabled: {
    opacity: 0.6,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
  },
  loadingButtonContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.m,
  },
  emptyText: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    textAlign: 'center',
  },
  resourceCardDisabled: {
    opacity: 0.5,
  },
  disabledTag: {
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.l,
    backgroundColor: colors.lightGray,
    marginLeft: spacing.xs,
  },
  disabledTagText: {
    ...typography.captionMedium,
    color: colors.textTertiary,
    fontWeight: '500' as const,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default CampaignModifyScreen;


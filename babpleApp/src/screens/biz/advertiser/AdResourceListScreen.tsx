import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation, useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI} from '../../../api/ApiRequests';
import AdResourceRegisterScreen from './AdResourceRegisterScreen';
import AdResourceDetailScreen from './AdResourceDetailScreen';
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

type TabType = 'all' | 'feedAd' | 'recipeCardAd';

/**
 * 광고 소재 관리 화면
 */
const AdResourceListScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const [selectedTab, setSelectedTab] = useState<TabType>('all');
  const [isRegisterModalVisible, setIsRegisterModalVisible] = useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedResource, setSelectedResource] = useState<{
    id: string;
    type: string;
    title: string;
    thumbnail: any;
  } | undefined>();
  const [resources, setResources] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  /**
   * 광고 소재 목록 로드
   */
  const loadCreatives = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await AdvertiserAPI.getMyCreatives();
      if (response.success && response.data) {
        const formattedResources = response.data.map((creative: any) => ({
          id: creative.creative_id,
          creative_id: creative.creative_id,
          title: creative.ad_title || '제목 없음',
          type: creative.ad_type === 1 ? 'feedAd' : creative.ad_type === 2 ? 'recipeCardAd' : 'feedAd',
          status: 'available', // TODO: 실제 상태 필드가 있으면 사용
          thumbnail: buildImageUrl(creative.ad_image_url),
          ad_body: creative.ad_body,
          landing_page_url: creative.landing_page_url,
          creater_name: creative.creater_name,
          creater_image_url: creative.creater_image_url,
        }));
        setResources(formattedResources);
      }
    } catch (error: any) {
      console.error('❌ [광고 소재 목록] 로드 오류:', error);
      alert('오류', '광고 소재 목록을 불러오는 중 오류가 발생했습니다.');
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadCreatives(false);
    setRefreshing(false);
  }, [loadCreatives]);

  useEffect(() => {
    loadCreatives();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadCreatives();
    }, []),
  );

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

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'available':
        return '사용 가능';
      case 'underReview':
        return '심사 중';
      case 'rejected':
        return '반려됨';
      default:
        return '';
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'available':
        return styles.statusTagAvailable;
      case 'underReview':
        return styles.statusTagUnderReview;
      case 'rejected':
        return styles.statusTagRejected;
      default:
        return {};
    }
  };

  const filteredResources =
    selectedTab === 'all'
      ? resources
      : resources.filter(
          resource => resource.type === selectedTab,
        );

  const tabs: {key: TabType; label: string}[] = [
    {key: 'all', label: '전체'},
    {key: 'feedAd', label: '피드 광고'},
    {key: 'recipeCardAd', label: '레시피 카드 광고'},
  ];

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <View style={styles.container}>
        {/* 헤더 */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}>
            <Icon name="arrow-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>광고 소재 관리</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* 탭 바 */}
        <View style={styles.tabBar}>
          {tabs.map(tab => (
            <TouchableOpacity
              key={tab.key}
              style={[
                styles.tab,
                selectedTab === tab.key && styles.tabActive,
              ]}
              onPress={() => setSelectedTab(tab.key)}>
              <Text
                style={[
                  styles.tabText,
                  selectedTab === tab.key && styles.tabTextActive,
                ]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* 광고 소재 리스트 */}
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : filteredResources.length > 0 ? (
            filteredResources.map(resource => (
              <TouchableOpacity
                key={resource.id}
                style={styles.resourceCard}
                onPress={() => {
                  setSelectedResource({
                    id: resource.creative_id || resource.id,
                    type: resource.type,
                    title: resource.title,
                    thumbnail: resource.thumbnail,
                  });
                  setIsDetailModalVisible(true);
                }}>
                {resource.thumbnail ? (
                  <Image
                    source={{uri: resource.thumbnail}}
                    style={styles.thumbnail}
                    resizeMode="cover"
                  />
                ) : (
                  <View style={[styles.thumbnail, styles.thumbnailPlaceholder]}>
                    <Icon name="image" size={24} color={colors.lightGray} />
                  </View>
                )}
                <View style={styles.resourceInfo}>
                  <Text style={styles.resourceTitle}>{resource.title}</Text>
                  <View style={styles.tagsContainer}>
                    <View
                      style={[
                        styles.typeTag,
                        getTypeStyle(resource.type),
                      ]}>
                      <Text
                        style={[
                          styles.typeTagText,
                          resource.type === 'recipeCardAd' &&
                            styles.typeTagTextRecipeCardAd,
                        ]}>
                        {getTypeLabel(resource.type)}
                      </Text>
                    </View>
                  </View>
                </View>
                <View
                  style={[
                    styles.statusTag,
                    getStatusStyle(resource.status),
                  ]}>
                  <Text style={styles.statusTagText}>
                    {getStatusLabel(resource.status)}
                  </Text>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="image" size={64} color={colors.lightGray} />
              <Text style={styles.emptyTitle}>등록된 광고 소재가 없어요.</Text>
              <Text style={styles.emptySubtitle}>
                하단의 '+' 버튼을 눌러 첫 광고 소재를 만들어보세요.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsRegisterModalVisible(true)}>
          <Icon name="plus" size={24} color={colors.white} />
        </TouchableOpacity>

        {/* 등록 모달 */}
        <AdResourceRegisterScreen
          visible={isRegisterModalVisible}
          onClose={() => setIsRegisterModalVisible(false)}
          onSuccess={() => {
            loadCreatives();
            setIsRegisterModalVisible(false);
          }}
        />

        {/* 상세 모달 */}
        <AdResourceDetailScreen
          visible={isDetailModalVisible}
          onClose={() => {
            setIsDetailModalVisible(false);
            setSelectedResource(undefined);
          }}
          resource={selectedResource}
          onDeleteSuccess={() => {
            loadCreatives();
          }}
          onModifySuccess={() => {
            loadCreatives();
          }}
        />
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
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 40,
  },
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  tab: {
    flex: 1,
    paddingVertical: spacing.m,
    alignItems: 'center',
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: colors.primary,
  },
  tabText: {
    ...typography.bodyMedium,
    color: colors.textTertiary,
    fontWeight: '400' as const,
  },
  tabTextActive: {
    color: colors.primary,
    fontWeight: '600' as const,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.l,
    paddingBottom: 100,
  },
  resourceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    gap: spacing.m,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.s,
    flexShrink: 0,
  },
  resourceInfo: {
    flex: 1,
    gap: spacing.xs,
    justifyContent: 'center',
    alignItems: 'center',
    minWidth: 0,
    flexShrink: 1,
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
  statusTag: {
    width: 70,
    paddingHorizontal: spacing.s,
    paddingVertical: spacing.xs / 2,
    borderRadius: borderRadius.l,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusTagAvailable: {
    backgroundColor: colors.success,
  },
  statusTagUnderReview: {
    backgroundColor: colors.warning,
  },
  statusTagRejected: {
    backgroundColor: colors.textTertiary,
  },
  statusTagText: {
    ...typography.infoMedium,
    color: colors.white,
    fontWeight: '500' as const,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.l,
    marginBottom: spacing.xs,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  fab: {
    position: 'absolute',
    right: spacing.l,
    bottom: spacing.l,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
  },
  thumbnailPlaceholder: {
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default AdResourceListScreen;


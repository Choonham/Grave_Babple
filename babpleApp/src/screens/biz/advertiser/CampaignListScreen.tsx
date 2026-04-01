import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import {useNavigation, useRoute, useFocusEffect} from '@react-navigation/native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import {
  colors,
  spacing,
  typography,
  borderRadius,
} from '../../../styles/commonStyles';
import {AdvertiserAPI} from '../../../api/ApiRequests';
import CampaignRegisterScreen from './CampaignRegisterScreen';
import CampaignDetailScreen from './CampaignDetailScreen';
import {useAlert} from '../../../contexts/AlertContext';

type TabType = 'all' | 'inProgress' | 'completed' | 'underReview';

/**
 * 광고 캠페인 관리 화면
 */
const CampaignListScreen: React.FC = () => {
  const {alert} = useAlert();
  const navigation = useNavigation();
  const route = useRoute();
  const [selectedTab, setSelectedTab] = useState<TabType>('all');
  const [isCampaignRegisterVisible, setIsCampaignRegisterVisible] =
    useState(false);
  const [isDetailModalVisible, setIsDetailModalVisible] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string>();
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    // @ts-ignore
    if (route.params?.openRegister) {
      setIsCampaignRegisterVisible(true);
      // @ts-ignore
      navigation.setParams({openRegister: undefined});
    }
  }, [route.params]);

  /**
   * 캠페인 목록 로드
   */
  const loadCampaigns = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await AdvertiserAPI.getMyCampaigns();
      if (response.success && response.data) {
        setCampaigns(response.data);
      }
    } catch (error: any) {
      console.error('❌ [캠페인 목록] 로드 오류:', error);
      alert('오류', '캠페인 목록을 불러오는 중 오류가 발생했습니다.');
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
    await loadCampaigns(false);
    setRefreshing(false);
  }, [loadCampaigns]);

  useEffect(() => {
    loadCampaigns();
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      loadCampaigns();
    }, []),
  );

  /**
   * 상태를 UI 상태로 변환
   */
  const mapStatusToUI = (status: string): TabType => {
    switch (status) {
      case 'ACTIVE':
        return 'inProgress';
      case 'PAUSED':
        return 'inProgress'; // 일시정지도 진행 중 탭에 표시
      case 'COMPLETED':
        return 'completed';
      case 'PENDING':
        return 'underReview';
      default:
        return 'all';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'ACTIVE':
      case 'inProgress':
        return '진행 중';
      case 'PAUSED':
        return '일시정지';
      case 'COMPLETED':
      case 'completed':
        return '종료됨';
      case 'PENDING':
      case 'underReview':
        return '심사 중';
      default:
        return '';
    }
  };

  const getStatusStyle = (status: string) => {
    const uiStatus = status === 'ACTIVE' ? 'inProgress' : status === 'COMPLETED' ? 'completed' : 'underReview';
    switch (uiStatus) {
      case 'inProgress':
        return styles.statusTagInProgress;
      case 'completed':
        return styles.statusTagCompleted;
      case 'underReview':
        return styles.statusTagUnderReview;
      default:
        return {};
    }
  };

  const getStatusTextStyle = (status: string) => {
    const uiStatus = status === 'ACTIVE' ? 'inProgress' : status === 'COMPLETED' ? 'completed' : 'underReview';
    switch (uiStatus) {
      case 'inProgress':
        return styles.statusTagTextWhite;
      case 'completed':
        return styles.statusTagTextWhite;
      case 'underReview':
        return styles.statusTagTextBlack;
      default:
        return {};
    }
  };

  const filteredCampaigns =
    selectedTab === 'all'
      ? campaigns
      : campaigns.filter(campaign => mapStatusToUI(campaign.status) === selectedTab);

  const tabs: {key: TabType; label: string}[] = [
    {key: 'all', label: '전체'},
    {key: 'inProgress', label: '진행 중'},
    {key: 'completed', label: '종료됨'},
    {key: 'underReview', label: '심사 중'},
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
          <Text style={styles.headerTitle}>광고 캠페인 관리</Text>
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

        {/* 캠페인 리스트 */}
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
          ) : filteredCampaigns.length > 0 ? (
            filteredCampaigns.map(campaign => (
              <TouchableOpacity
                key={campaign.campaign_id}
                style={styles.campaignCard}
                onPress={() => {
                  setSelectedCampaignId(campaign.campaign_id);
                  setIsDetailModalVisible(true);
                }}>
                <View style={styles.campaignCardHeader}>
                  <Text style={styles.campaignTitle}>{campaign.campaign_name}</Text>
                  <View
                    style={[
                      styles.statusTag,
                      getStatusStyle(campaign.status),
                    ]}>
                    <Text
                      style={[
                        styles.statusTagText,
                        getStatusTextStyle(campaign.status),
                      ]}>
                      {getStatusLabel(campaign.status)}
                    </Text>
                  </View>
                </View>

                <View style={styles.metricsContainer}>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {campaign.view_count.toLocaleString()}회
                    </Text>
                    <Text style={styles.metricLabel}>총 노출 수</Text>
                  </View>
                  <View style={styles.metricItem}>
                    <Text style={styles.metricValue}>
                      {campaign.click_count.toLocaleString()}회
                    </Text>
                    <Text style={styles.metricLabel}>총 클릭 수</Text>
                  </View>
                </View>

                <View style={styles.progressBarContainer}>
                  <View style={styles.progressBarBackground}>
                    <View
                      style={[
                        styles.progressBarFill,
                        {width: `${campaign.progress}%`},
                      ]}
                    />
                  </View>
                </View>
              </TouchableOpacity>
            ))
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="target" size={64} color={colors.lightGray} />
              <Text style={styles.emptyText}>캠페인이 없습니다.</Text>
              <Text style={styles.emptySubtext}>
                하단의 '+' 버튼을 눌러 첫 캠페인을 만들어보세요.
              </Text>
            </View>
          )}
        </ScrollView>

        {/* FAB */}
        <TouchableOpacity
          style={styles.fab}
          onPress={() => setIsCampaignRegisterVisible(true)}>
          <Icon name="plus" size={24} color={colors.white} />
        </TouchableOpacity>
      </View>

      {/* 캠페인 등록 모달 */}
      <CampaignRegisterScreen
        onSuccess={() => {
          loadCampaigns();
        }}
        visible={isCampaignRegisterVisible}
        onClose={() => setIsCampaignRegisterVisible(false)}
      />

      {/* 캠페인 상세 모달 */}
      <CampaignDetailScreen
        visible={isDetailModalVisible}
        onClose={() => setIsDetailModalVisible(false)}
        campaignId={selectedCampaignId}
        onModifySuccess={() => {
          loadCampaigns();
        }}
        onDeleteSuccess={() => {
          loadCampaigns();
        }}
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
    paddingTop: spacing.m,
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
  campaignCard: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.l,
    marginBottom: spacing.m,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  campaignCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.m,
  },
  campaignTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  statusTag: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.xs,
    borderRadius: borderRadius.l,
  },
  statusTagInProgress: {
    backgroundColor: colors.success,
  },
  statusTagCompleted: {
    backgroundColor: colors.textTertiary,
  },
  statusTagUnderReview: {
    backgroundColor: colors.warning,
  },
  statusTagText: {
    ...typography.captionMedium,
    fontWeight: '500' as const,
  },
  statusTagTextWhite: {
    color: colors.white,
  },
  statusTagTextBlack: {
    color: colors.textPrimary,
  },
  metricsContainer: {
    flexDirection: 'row',
    gap: spacing.xl,
    marginBottom: spacing.m,
    justifyContent: 'space-evenly',
    alignItems: 'center',
  },
  metricItem: {
    alignItems: 'center',
  },
  metricValue: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.xs,
  },
  metricLabel: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  progressBarContainer: {
    marginTop: spacing.xs,
  },
  progressBarBackground: {
    height: 8,
    backgroundColor: colors.lightGray,
    borderRadius: borderRadius.s,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl * 3,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.l,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    marginTop: spacing.xs,
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
});

export default CampaignListScreen;


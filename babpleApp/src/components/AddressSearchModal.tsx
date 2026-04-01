import React, {useState, useEffect, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TextInput,
  TouchableOpacity,
  FlatList,
  Keyboard,
  Dimensions,
} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import {LottieSpinner} from './common';
import {colors, spacing, typography, borderRadius} from '../styles/commonStyles';
import {AddressSearchAPI} from '../api/ApiRequests';

interface AddressItem {
  address_name: string;
  address_type: string;
  y?: string; // 위도
  x?: string; // 경도
  road_address?: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    road_name: string;
    y?: string; // 위도
    x?: string; // 경도
  };
  address?: {
    address_name: string;
    region_1depth_name: string;
    region_2depth_name: string;
    region_3depth_name: string;
    y?: string; // 위도
    x?: string; // 경도
  };
}

interface AddressSearchModalProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (address: string, coordinates?: {latitude: number; longitude: number}) => void;
  returnFullAddress?: boolean; // 전체 주소 반환 여부 (기본값: false - 읍/면/동까지만)
}

/**
 * 주소 검색 모달 컴포넌트
 * 카카오 주소 검색 API를 사용하여 주소를 검색합니다.
 */
const AddressSearchModal: React.FC<AddressSearchModalProps> = ({
  visible,
  onClose,
  onSelect,
  returnFullAddress = false,
}) => {
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');
  const [addresses, setAddresses] = useState<AddressItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * 주소 검색
   */
  const searchAddresses = useCallback(async (query: string) => {
    if (!query || query.trim().length < 2) {
      setAddresses([]);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await AddressSearchAPI.searchAddress(query.trim());
      
      if (response.success && response.data?.documents) {
        setAddresses(response.data.documents);
      } else {
        setError(response.message || '주소 검색에 실패했습니다.');
        setAddresses([]);
      }
    } catch (err: any) {
      console.error('❌ [AddressSearchModal] 주소 검색 오류:', err);
      setError('주소 검색 중 오류가 발생했습니다.');
      setAddresses([]);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 검색어 변경 시 디바운스 처리
   */
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery) {
        searchAddresses(searchQuery);
      } else {
        setAddresses([]);
      }
    }, 300); // 300ms 디바운스

    return () => clearTimeout(timer);
  }, [searchQuery, searchAddresses]);

  /**
   * 주소 선택
   */
  const handleSelectAddress = (address: AddressItem) => {
    let selectedAddress = '';
    
    if (returnFullAddress) {
      // 전체 주소 반환 모드: 도로명 주소 전체 또는 지번 주소 전체 사용
      if (address.road_address) {
        // 도로명 주소 전체 사용
        selectedAddress = address.road_address.address_name;
      } else if (address.address) {
        // 지번 주소 전체 사용
        selectedAddress = address.address.address_name;
      } else {
        // 전체 주소명 사용
        selectedAddress = address.address_name;
      }
    } else {
      // 기본 모드: 읍/면/동까지만 추출 (일반 회원가입용)
      if (address.road_address) {
        // 도로명 주소에서 시도 + 시군구 + 읍면동 추출
        const {region_1depth_name, region_2depth_name, region_3depth_name} = address.road_address;
        const parts = [region_1depth_name, region_2depth_name, region_3depth_name].filter(part => part && part.trim());
        selectedAddress = parts.join(' ').trim();
      } else if (address.address) {
        // 지번 주소에서 시도 + 시군구 + 읍면동 추출
        const {region_1depth_name, region_2depth_name, region_3depth_name} = address.address;
        const parts = [region_1depth_name, region_2depth_name, region_3depth_name].filter(part => part && part.trim());
        selectedAddress = parts.join(' ').trim();
      } else {
        // 전체 주소명에서 시도 + 시군구 + 읍면동 추출 시도
        // address_name 형식: "인천광역시 연수구 연수동" 또는 "인천광역시 연수구"
        const addressParts = address.address_name.split(' ');
        if (addressParts.length >= 3) {
          // 시도 + 시군구 + 읍면동이 모두 있는 경우
          selectedAddress = `${addressParts[0]} ${addressParts[1]} ${addressParts[2]}`.trim();
        } else {
          // 전체 주소명 사용
          selectedAddress = address.address_name;
        }
      }
    }

    // 좌표 정보 추출 (우선순위: road_address > address > 최상위)
    let coordinates: {latitude: number; longitude: number} | undefined = undefined;
    if (address.road_address?.y && address.road_address?.x) {
      coordinates = {
        latitude: parseFloat(address.road_address.y),
        longitude: parseFloat(address.road_address.x),
      };
    } else if (address.address?.y && address.address?.x) {
      coordinates = {
        latitude: parseFloat(address.address.y),
        longitude: parseFloat(address.address.x),
      };
    } else if (address.y && address.x) {
      coordinates = {
        latitude: parseFloat(address.y),
        longitude: parseFloat(address.x),
      };
    }

    console.log('🔍 [AddressSearchModal] 선택된 주소:', selectedAddress);
    console.log('🔍 [AddressSearchModal] 좌표 정보:', coordinates);
    console.log('🔍 [AddressSearchModal] 전체 주소 모드:', returnFullAddress);
    console.log('🔍 [AddressSearchModal] 원본 주소 데이터:', address);

    onSelect(selectedAddress, coordinates);
    Keyboard.dismiss();
    onClose();
  };

  /**
   * 주소 항목 렌더링
   */
  const renderAddressItem = ({item}: {item: AddressItem}) => {
    const displayAddress = item.road_address?.address_name || item.address?.address_name || item.address_name;
    const detailAddress = item.road_address 
      ? `${item.road_address.region_1depth_name} ${item.road_address.region_2depth_name} ${item.road_address.region_3depth_name}`
      : item.address
      ? `${item.address.region_1depth_name} ${item.address.region_2depth_name} ${item.address.region_3depth_name}`
      : '';

    return (
      <TouchableOpacity
        style={styles.addressItem}
        onPress={() => handleSelectAddress(item)}>
        <View style={styles.addressItemContent}>
          <Text style={styles.addressItemTitle} numberOfLines={1}>
            {displayAddress}
          </Text>
          {detailAddress && (
            <Text style={styles.addressItemSubtitle} numberOfLines={1}>
              {detailAddress}
            </Text>
          )}
        </View>
        <Icon name="chevron-right" size={20} color={colors.textSecondary} />
      </TouchableOpacity>
    );
  };

  /**
   * 빈 상태 렌더링
   */
  const renderEmpty = () => {
    if (loading) {
      return (
        <View style={styles.emptyContainer}>
          <LottieSpinner size="large" />
          <Text style={styles.emptyText}>주소를 검색하는 중...</Text>
        </View>
      );
    }

    if (error) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="alert-circle" size={48} color={colors.error} />
          <Text style={styles.emptyText}>{error}</Text>
        </View>
      );
    }

    if (searchQuery.length > 0 && addresses.length === 0) {
      return (
        <View style={styles.emptyContainer}>
          <Icon name="search" size={48} color={colors.textTertiary} />
          <Text style={styles.emptyText}>검색 결과가 없습니다.</Text>
          <Text style={styles.emptySubtext}>다른 키워드로 검색해보세요.</Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyContainer}>
        <Icon name="map-pin" size={48} color={colors.textTertiary} />
        <Text style={styles.emptyText}>주소를 검색해주세요.</Text>
        <Text style={styles.emptySubtext}>예: 서울시 강남구 역삼동</Text>
      </View>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 헤더 */}
        <View style={[styles.header, {paddingTop: insets.top > 0 ? spacing.m : spacing.l}]}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="x" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>주소 검색</Text>
          <View style={styles.headerSpacer} />
        </View>

        {/* 검색 입력 */}
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Icon name="search" size={20} color={colors.textSecondary} style={styles.searchIcon} />
            <TextInput
              style={styles.searchInput}
              placeholder="주소를 입력하세요 (예: 서울시 강남구 역삼동)"
              placeholderTextColor={colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus={true}
              returnKeyType="search"
              onSubmitEditing={() => searchAddresses(searchQuery)}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity
                onPress={() => {
                  setSearchQuery('');
                  setAddresses([]);
                }}
                style={styles.clearButton}>
                <Icon name="x" size={18} color={colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* 주소 목록 */}
        <FlatList
          data={addresses}
          renderItem={renderAddressItem}
          keyExtractor={(item, index) => `${item.address_name}-${index}`}
          ListEmptyComponent={renderEmpty}
          style={styles.list}
          contentContainerStyle={addresses.length === 0 ? styles.listEmptyContent : undefined}
          keyboardShouldPersistTaps="handled"
        />
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  closeButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    ...typography.h3,
    fontWeight: '700',
    color: colors.textPrimary,
  },
  headerSpacer: {
    width: 40,
  },
  searchContainer: {
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.background,
    borderRadius: borderRadius.m,
    paddingHorizontal: spacing.m,
    height: 48,
  },
  searchIcon: {
    marginRight: spacing.s,
  },
  searchInput: {
    flex: 1,
    ...typography.bodyMedium,
    color: colors.textPrimary,
    padding: 0,
  },
  clearButton: {
    padding: spacing.xs,
  },
  list: {
    flex: 1,
  },
  listEmptyContent: {
    flex: 1,
  },
  addressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.l,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  addressItemContent: {
    flex: 1,
    marginRight: spacing.m,
  },
  addressItemTitle: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    marginBottom: spacing.xxs,
  },
  addressItemSubtitle: {
    ...typography.bodySmall,
    color: colors.textSecondary,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
    paddingHorizontal: spacing.l,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    marginTop: spacing.m,
    textAlign: 'center',
  },
  emptySubtext: {
    ...typography.bodySmall,
    color: colors.textTertiary,
    marginTop: spacing.xs,
    textAlign: 'center',
  },
});

export default AddressSearchModal;


import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Platform,
  Modal,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CameraRoll } from '@react-native-camera-roll/camera-roll';
import ImagePicker from 'react-native-image-crop-picker';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LottieSpinner } from './common';
import { colors, spacing, borderRadius } from '../styles/commonStyles';
import { requestPermission } from '../utils/permission';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const ITEM_MARGIN = 0.5;
const ITEM_SIZE = SCREEN_WIDTH / NUM_COLUMNS;
const ROW_HEIGHT = ITEM_SIZE + ITEM_MARGIN * 2; // 행 높이 = 아이템 높이 + 상하 마진
const PHOTOS_PER_PAGE = 50; // 페이지 크기 증가로 로딩 횟수 감소

export interface CustomGalleryProps {
  visible: boolean;
  onClose: () => void;
  onSelectImage: (imageUri: string) => void;
  cropperToolbarTitle?: string;
  allowCropping?: boolean;
  compressImageQuality?: number;
  maxWidth?: number;
  maxHeight?: number;
}

interface PhotoNode {
  node: {
    image: {
      uri: string;
      width: number;
      height: number;
    };
    timestamp: number;
    type: string;
  };
}

interface Album {
  title: string;
  count: number;
  thumbnail?: string;
}

// PhotoItem 컴포넌트를 외부로 분리하여 리렌더링 시 상태 유지
const PhotoItem: React.FC<{
  item: PhotoNode;
  isSelected: boolean;
  onSelect: (item: PhotoNode) => void;
}> = ({ item, isSelected, onSelect }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [shouldLoad, setShouldLoad] = useState(false); // 지연 로드 제어
  const imageUri = item.node.image.uri;
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loadDelayRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const MAX_RETRIES = 3; // 최대 재시도 횟수 증가 (1 -> 3)
  const LOAD_TIMEOUT = 15000; // 타임아웃 증가 (8초 -> 15초)
  const LOAD_DELAY = 100; // 이미지 로드 지연 (동시 로드 방지)

  // 이미지 URI가 변경되면 로드 상태 리셋
  useEffect(() => {
    setImageLoaded(false);
    setLoadError(false);
    setRetryCount(0);
    setShouldLoad(false);

    // 기존 타임아웃 정리
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    if (loadDelayRef.current) {
      clearTimeout(loadDelayRef.current);
      loadDelayRef.current = null;
    }
  }, [imageUri]);

  // 지연 로드: 컴포넌트가 마운트된 후 약간의 지연을 두고 로드 시작
  useEffect(() => {
    if (imageUri && !shouldLoad && !imageLoaded && !loadError) {
      loadDelayRef.current = setTimeout(() => {
        setShouldLoad(true);
        loadDelayRef.current = null;
      }, LOAD_DELAY);
    }

    return () => {
      if (loadDelayRef.current) {
        clearTimeout(loadDelayRef.current);
        loadDelayRef.current = null;
      }
    };
  }, [imageUri, shouldLoad, imageLoaded, loadError]);

  // 화면에 보일 때만 이미지 로드 시작 (이미지 컴포넌트가 렌더링되면 자동으로 로드됨)

  const handleError = useCallback((error: any) => {
    // 이미 로드된 경우 에러 무시
    if (imageLoaded) {
      return;
    }

    // 타임아웃 정리
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }

    // 재시도 로직
    if (retryCount < MAX_RETRIES) {
      const newRetryCount = retryCount + 1;
      setRetryCount(newRetryCount);

      // 재시도 간격을 점진적으로 증가 (1000ms -> 2000ms -> 3000ms)
      const retryDelay = Math.min(1000 * newRetryCount, 3000);

      retryTimeoutRef.current = setTimeout(() => {
        setImageLoaded(false);
        setLoadError(false);
        setShouldLoad(true); // 재시도 시 다시 로드 시작
        retryTimeoutRef.current = null;
      }, retryDelay);
    } else {
      // 최대 재시도 횟수 초과
      setLoadError(true);
      setImageLoaded(true); // 인디케이터 중지
    }
  }, [imageUri, imageLoaded, retryCount]);

  const handleLoad = useCallback(() => {
    // 이미 로드된 경우 중복 호출 방지
    if (imageLoaded) {
      return;
    }

    // 타임아웃 정리
    if (loadTimeoutRef.current) {
      clearTimeout(loadTimeoutRef.current);
      loadTimeoutRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    // 이미지 로드 시 즉시 표시
    setImageLoaded(true);
    setLoadError(false);
    setRetryCount(0); // 성공 시 재시도 카운트 리셋
  }, [imageUri, imageLoaded]);

  // 이미지 로드 타임아웃 설정
  useEffect(() => {
    if (!imageLoaded && !loadError && imageUri && shouldLoad) {
      // 타임아웃 설정: 일정 시간 내에 로드되지 않으면 재시도
      loadTimeoutRef.current = setTimeout(() => {
        if (!imageLoaded) {
          // 타임아웃 시 에러 핸들러 호출 (재시도 로직 실행)
          handleError(new Error('Timeout'));
        }
      }, LOAD_TIMEOUT);
    }

    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
        loadTimeoutRef.current = null;
      }
    };
  }, [imageUri, imageLoaded, loadError, shouldLoad, handleError]);



  // 컴포넌트 언마운트 시 정리
  useEffect(() => {
    return () => {
      if (loadTimeoutRef.current) {
        clearTimeout(loadTimeoutRef.current);
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
      }
      if (loadDelayRef.current) {
        clearTimeout(loadDelayRef.current);
      }
    };
  }, []);

  return (
    <TouchableOpacity
      style={styles.photoContainer}
      onPress={() => onSelect(item)}
      activeOpacity={0.8}>
      {/* 지연 로드: shouldLoad가 true일 때만 이미지 로드 */}
      {shouldLoad && (
        <Image
          source={{ uri: imageUri }}
          style={[styles.photo, { opacity: imageLoaded ? 1 : 0 }]}
          resizeMode="cover"
          onLoad={handleLoad}
          onError={(error) => {
            // 에러를 조용히 처리 (콘솔 에러 방지)
            try {
              handleError(error);
            } catch (e) {
              // 에러 핸들러에서도 에러가 발생하면 무시
            }
          }}
          {...(Platform.OS === 'android' && {
            cache: 'force-cache',
            resizeMethod: 'resize', // Android에서 리사이징 방법 지정 (성능 향상)
          })}
        />
      )}
      {!imageLoaded && !loadError && (
        <View style={styles.imagePlaceholder}>
          <LottieSpinner size="small" />
        </View>
      )}
      {loadError && (
        // 에러 발생 시 즉시 에러 아이콘 표시
        <View style={styles.errorContainer}>
          <Icon name="broken-image" size={32} color={colors.mediumGray} />
        </View>
      )}
      {isSelected && (
        <View style={styles.selectedOverlay}>
          <LottieSpinner size="small" />
        </View>
      )}
    </TouchableOpacity>
  );
};

const CustomGallery: React.FC<CustomGalleryProps> = ({
  visible,
  onClose,
  onSelectImage,
  cropperToolbarTitle = '사진 편집',
  allowCropping = true,
  compressImageQuality = 0.85, // 기본값 (iOS는 1.0으로 오버라이드됨)
  maxWidth, // 선택적 최대 너비
  maxHeight, // 선택적 최대 높이
}) => {
  // 뷰 모드: 'albums' = 앨범 목록, 'photos' = 사진 목록
  const [viewMode, setViewMode] = useState<'albums' | 'photos'>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [selectedAlbum, setSelectedAlbum] = useState<Album | null>(null);
  const [loadingAlbums, setLoadingAlbums] = useState(false);

  const [photos, setPhotos] = useState<PhotoNode[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasNextPage, setHasNextPage] = useState(true);
  const [endCursor, setEndCursor] = useState<string | null>(null);
  const [selectedPhoto, setSelectedPhoto] = useState<PhotoNode | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const endReachedCalledDuringMomentum = useRef(false);
  const flatListRef = useRef<FlatList>(null);
  const isScrollingRef = useRef(false);
  const scrollOffsetRef = useRef(0);
  const previousPhotosCountRef = useRef(0);

  // loading 상태를 ref로 관리하여 stale closure 문제 해결
  const loadingRef = useRef(false);
  const loadingMoreRef = useRef(false);

  // 앨범 목록 가져오기
  const fetchAlbums = useCallback(async () => {
    if (loadingAlbums) return;

    try {
      setLoadingAlbums(true);
      const albumsResult = await CameraRoll.getAlbums({
        assetType: 'Photos',
      });

      // "모든 사진" 앨범을 맨 위에 추가
      const allPhotosResult = await CameraRoll.getPhotos({
        first: 1,
        assetType: 'Photos',
      });

      // 전체 사진 개수 계산 (모든 앨범의 사진 개수 합)
      const totalPhotoCount = albumsResult.reduce((sum, album) => sum + album.count, 0);

      // 각 앨범의 썸네일 가져오기
      const albumsWithThumbnails = await Promise.all(
        albumsResult.map(async (album) => {
          try {
            const photos = await CameraRoll.getPhotos({
              first: 1,
              groupName: album.title,
              assetType: 'Photos',
            });
            return {
              title: album.title,
              count: album.count,
              thumbnail: photos.edges[0]?.node.image.uri,
            };
          } catch (error) {
            return {
              title: album.title,
              count: album.count,
              thumbnail: undefined,
            };
          }
        })
      );

      // "모든 사진" 앨범 추가 및 빈 앨범 필터링
      const allAlbums: Album[] = [
        {
          title: '모든 사진',
          count: totalPhotoCount,
          thumbnail: allPhotosResult.edges[0]?.node.image.uri,
        },
        ...albumsWithThumbnails.filter(album => album.count > 0),
      ];

      setAlbums(allAlbums);
    } catch (error: any) {
      console.error('앨범 로드 오류:', error);
    } finally {
      setLoadingAlbums(false);
    }
  }, [loadingAlbums]);

  // 사진 목록 가져오기
  const fetchPhotos = useCallback(
    async (after?: string | null) => {
      // ref로 현재 상태 확인
      if (loadingRef.current || loadingMoreRef.current) {
        return;
      }

      try {
        if (after) {
          loadingMoreRef.current = true;
          setLoadingMore(true);
        } else {
          loadingRef.current = true;
          setLoading(true);
        }

        const result = await CameraRoll.getPhotos({
          first: PHOTOS_PER_PAGE,
          after: after || undefined,
          assetType: 'Photos',
          include: ['imageSize', 'location'],
          // 선택된 앨범이 있고 "모든 사진"이 아니면 해당 앨범만 표시
          ...(selectedAlbum && selectedAlbum.title !== '모든 사진' && {
            groupName: selectedAlbum.title,
          }),
        });

        if (result.edges && result.edges.length > 0) {
          if (after) {
            // 추가 로드 - 기존 사진 유지하면서 추가
            setPhotos(prev => {
              // 중복 제거 (같은 URI가 있으면 제외)
              const existingUris = new Set(prev.map(p => p.node.image.uri));
              const newPhotos = result.edges.filter(
                p => !existingUris.has(p.node.image.uri)
              );

              // 스크롤 위치 저장
              previousPhotosCountRef.current = prev.length;

              return [...prev, ...newPhotos];
            });
          } else {
            // 첫 로드
            setPhotos(result.edges);
            previousPhotosCountRef.current = result.edges.length;
            scrollOffsetRef.current = 0;
          }
          setHasNextPage(result.page_info.has_next_page);
          setEndCursor(result.page_info.end_cursor || null);
        } else {
          setHasNextPage(false);
        }
      } catch (error: any) {
        if (error.message?.includes('permission')) {
          // 권한 오류는 상위 컴포넌트에서 처리
        }
      } finally {
        if (after) {
          loadingMoreRef.current = false;
          setLoadingMore(false);
        } else {
          loadingRef.current = false;
          setLoading(false);
        }
      }
    },
    [selectedAlbum], // selectedAlbum 의존성 추가
  );

  // 초기 로드 & 권한 체크
  useEffect(() => {
    const checkPermissionAndLoad = async () => {
      if (visible) {
        // 권한 체크 (JIT)
        const hasPermission = await requestPermission('photo', {
          title: '갤러리 접근 권한 필요',
          message: '사진을 선택하려면 갤러리 접근 권한이 필요합니다.',
        });

        if (!hasPermission) {
          onClose(); // 권한 없으면 닫기
          return;
        }

        if (viewMode === 'albums') {
          // 앨범 뷰: 앨범 목록 로드
          setAlbums([]);
          fetchAlbums();
        } else {
          // 사진 뷰: 선택된 앨범의 사진 로드
          setPhotos([]);
          setEndCursor(null);
          setHasNextPage(true);
          fetchPhotos();
        }
      } else {
        // 화면이 닫히면 상태 초기화
        setViewMode('albums');
        setAlbums([]);
        setSelectedAlbum(null);
        setPhotos([]);
        setEndCursor(null);
        setHasNextPage(true);
        setSelectedPhoto(null);
        setLoading(false);
        setLoadingMore(false);
        setLoadingAlbums(false);
      }
    };

    checkPermissionAndLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, viewMode]); // viewMode 의존성 추가

  // 더 많은 사진 로드 (무한 스크롤)
  const loadMorePhotos = useCallback(() => {
    if (loadingMore || loading || !hasNextPage || !endCursor) {
      return;
    }

    // 중복 호출 방지
    if (endReachedCalledDuringMomentum.current) {
      return;
    }

    endReachedCalledDuringMomentum.current = true;
    setLoadingMore(true);

    fetchPhotos(endCursor).finally(() => {
      setLoadingMore(false);
      // 약간의 지연 후 다시 호출 가능하도록 설정
      setTimeout(() => {
        endReachedCalledDuringMomentum.current = false;
      }, 500);
    });
  }, [loadingMore, loading, hasNextPage, endCursor, fetchPhotos]);

  // 사진 선택 처리
  const handleSelectPhoto = useCallback(
    async (photo: PhotoNode) => {
      try {
        setSelectedPhoto(photo);
        const imageUri = photo.node.image.uri;

        if (allowCropping) {
          // 크롭 기능 사용
          const cropperOptions: any = {
            path: imageUri,
            cropping: true, // 크롭 활성화
            cropperToolbarTitle: cropperToolbarTitle,
            cropperChooseText: '완료',
            cropperCancelText: '취소',
            compressImageQuality: Platform.OS === 'ios' ? 0.6 : 0.5,
            cropperRotateButtonsHidden: false,
            includeBase64: false,
            forceJpg: true,
            compressImageMaxWidth: 3000, // 현실적인 최대 크기 (3000x3000)
            compressImageMaxHeight: 3000,
            freeStyleCropEnabled: true, // 비율 수정 가능
          };

          // iOS에서만 원본 width/height의 60%로 명시 (200x200 이슈 회피 및 용량 최적화)
          if (Platform.OS === 'ios') {
            cropperOptions.width = Math.round(photo.node.image.width * 0.6);
            cropperOptions.height = Math.round(photo.node.image.height * 0.6);
          }

          // maxWidth, maxHeight props가 전달된 경우 해당 크기로 제한
          if (maxWidth && maxWidth > 0) {
            cropperOptions.width = maxWidth;
          }
          if (maxHeight && maxHeight > 0) {
            cropperOptions.height = maxHeight;
          }

          const croppedImage = await ImagePicker.openCropper(cropperOptions);

          onSelectImage(croppedImage.path);
        } else {
          // 크롭 없이 바로 선택
          onSelectImage(imageUri);
        }
        onClose();
      } catch (error: any) {
        if (error.code !== 'E_PICKER_CANCELLED') {
          // 에러 처리 (로그 없이 조용히 처리)
        }
        setSelectedPhoto(null);
      }
    },
    [allowCropping, cropperToolbarTitle, compressImageQuality, maxWidth, maxHeight, onSelectImage, onClose],
  );

  // 앨범 선택 처리
  const handleSelectAlbum = useCallback((album: Album) => {
    setSelectedAlbum(album);
    setViewMode('photos');
  }, []);

  // 뒤로가기 (사진 뷰 → 앨범 뷰)
  const handleBackToAlbums = useCallback(() => {
    setViewMode('albums');
    setSelectedAlbum(null);
    setPhotos([]);
    setEndCursor(null);
    setHasNextPage(true);
  }, []);

  // 앨범 렌더링
  const renderAlbum = useCallback(
    ({ item }: { item: Album }) => {
      return (
        <TouchableOpacity
          style={styles.albumContainer}
          onPress={() => handleSelectAlbum(item)}
          activeOpacity={0.7}>
          {item.thumbnail ? (
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.albumThumbnail}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.albumThumbnailPlaceholder}>
              <Icon name="photo-library" size={48} color={colors.lightGray} />
            </View>
          )}
          <View style={styles.albumInfo}>
            <Text style={styles.albumTitle} numberOfLines={1}>
              {item.title}
            </Text>
            <Text style={styles.albumCount}>{item.count}장</Text>
          </View>
        </TouchableOpacity>
      );
    },
    [handleSelectAlbum],
  );


  // 사진 렌더링
  const renderPhoto = useCallback(
    ({ item, index }: { item: PhotoNode; index: number }) => {
      const imageUri = item.node.image.uri;
      const isSelected = selectedPhoto?.node.image.uri === imageUri;

      return (
        <PhotoItem
          item={item}
          isSelected={isSelected}
          onSelect={handleSelectPhoto}
        />
      );
    },
    [selectedPhoto, handleSelectPhoto],
  );

  if (!visible) {
    return null;
  }

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        {/* 헤더 */}
        <View style={styles.header}>
          {viewMode === 'photos' && (
            <TouchableOpacity onPress={handleBackToAlbums} style={styles.backButton}>
              <Icon name="arrow-back" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>
            {viewMode === 'albums' ? '앨범 선택' : selectedAlbum?.title || '사진 선택'}
          </Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
        </View>

        {/* 앨범 목록 또는 사진 그리드 */}
        {viewMode === 'albums' ? (
          // 앨범 목록 뷰
          albums.length > 0 ? (
            <FlatList
              key="albums-list"
              data={albums}
              renderItem={renderAlbum}
              keyExtractor={(item, index) => `${item.title}-${index}`}
              numColumns={2}
              contentContainerStyle={styles.albumListContent}
              scrollEventThrottle={16}
            />
          ) : loadingAlbums ? (
            <View style={styles.emptyContainer}>
              <LottieSpinner size="large" />
              <Text style={styles.emptyText}>앨범을 불러오는 중...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="photo-library" size={64} color={colors.lightGray} />
              <Text style={styles.emptyText}>앨범이 없습니다</Text>
            </View>
          )
        ) : (
          // 사진 그리드 뷰 (기존 로직)
          photos.length > 0 ? (
            <FlatList
              key="photos-list"
              ref={flatListRef}
              data={photos}
              renderItem={renderPhoto}
              keyExtractor={(item, index) => `${item.node.image.uri}-${index}`}
              numColumns={NUM_COLUMNS}
              contentContainerStyle={styles.listContent}
              onEndReached={loadMorePhotos}
              onEndReachedThreshold={0.5}
              onMomentumScrollBegin={() => {
                endReachedCalledDuringMomentum.current = false;
                isScrollingRef.current = true;
              }}
              onMomentumScrollEnd={() => {
                isScrollingRef.current = false;
              }}
              onScrollBeginDrag={() => {
                isScrollingRef.current = true;
              }}
              onScrollEndDrag={() => {
                isScrollingRef.current = false;
              }}
              onScroll={(event) => {
                scrollOffsetRef.current = event.nativeEvent.contentOffset.y;
              }}
              // getItemLayout 제거 - numColumns 사용 시 FlatList가 자동으로 계산하는 것이 더 안정적
              // getItemLayout을 사용하면 레이아웃 계산 오류로 인해 스크롤 위치가 틀어질 수 있음
              ListFooterComponent={
                (loadingMore || loading) && hasNextPage ? (
                  <View style={styles.footerLoader}>
                    <LottieSpinner size="small" />
                  </View>
                ) : null
              }
              removeClippedSubviews={true} // 화면 밖 이미지 언마운트로 메모리 절약
              maxToRenderPerBatch={6} // 배치 크기 감소 (10 -> 6)
              windowSize={5} // 윈도우 크기 감소 (10 -> 5)
              initialNumToRender={15} // 초기 렌더링 수 감소 (18 -> 15)
              updateCellsBatchingPeriod={150} // 배치 업데이트 주기 증가 (100 -> 150)
              scrollEventThrottle={16}
              legacyImplementation={false}
              disableVirtualization={false}
            // 성능 최적화: 배치 크기 감소로 동시 로드 제한 및 메모리 사용량 감소
            />
          ) : loading ? (
            <View style={styles.emptyContainer}>
              <LottieSpinner size="large" />
              <Text style={styles.emptyText}>사진을 불러오는 중...</Text>
            </View>
          ) : (
            <View style={styles.emptyContainer}>
              <Icon name="photo-library" size={64} color={colors.lightGray} />
              <Text style={styles.emptyText}>사진이 없습니다</Text>
            </View>
          )
        )}
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundCard,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
    backgroundColor: colors.white,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  backButton: {
    padding: spacing.xs,
    position: 'absolute',
    left: spacing.m,
    zIndex: 1,
  },
  closeButton: {
    padding: spacing.xs,
    position: 'absolute',
    right: spacing.m,
    zIndex: 1,
  },
  // 앨범 리스트 스타일
  albumListContent: {
    padding: spacing.m,
  },
  albumContainer: {
    flex: 1,
    margin: spacing.s,
    borderRadius: borderRadius.m,
    backgroundColor: colors.white,
    overflow: 'hidden',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  albumThumbnail: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.offWhite,
  },
  albumThumbnailPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: colors.offWhite,
    justifyContent: 'center',
    alignItems: 'center',
  },
  albumInfo: {
    padding: spacing.m,
  },
  albumTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.textPrimary,
    marginBottom: spacing.xs,
  },
  albumCount: {
    fontSize: 14,
    color: colors.mediumGray,
  },
  // 사진 리스트 스타일 (기존 유지)
  listContent: {
    paddingBottom: spacing.l,
  },
  photoContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    margin: ITEM_MARGIN,
    backgroundColor: colors.offWhite,
    position: 'relative',
  },
  photo: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    backgroundColor: colors.offWhite,
  },
  imagePlaceholder: {
    position: 'absolute',
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
  },
  errorContainer: {
    width: ITEM_SIZE,
    height: ITEM_SIZE,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.offWhite,
  },
  selectedOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerLoader: {
    paddingVertical: spacing.l,
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    marginTop: spacing.m,
    fontSize: 16,
    color: colors.mediumGray,
  },
});

export default CustomGallery;


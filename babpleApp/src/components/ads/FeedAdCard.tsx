import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Linking} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import ImageWithLottie from '../common/ImageWithLottie';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AdAPI} from '../../api/ApiRequests';
import {getThumbnailUrl, buildMediaUrl} from '../../utils/imageUtils';

// 전역으로 기록된 creative_id 추적 (모듈 레벨)
const recordedCreativeIds = new Set<string>();

interface FeedAdCardProps {
  creative_id: string;
  ad_title?: string;
  ad_body?: string;
  ad_image_url: string;
  landing_page_url: string;
  creater_name?: string;
  creater_image_url?: string;
  impression_id?: string;
}

/**
 * 피드 광고 카드 컴포넌트
 */
const FeedAdCard: React.FC<FeedAdCardProps> = ({
  creative_id,
  ad_title,
  ad_body,
  ad_image_url,
  landing_page_url,
  creater_name,
  creater_image_url,
  impression_id,
}) => {
  // 카드에서는 썸네일 사용 (목록 표시용)
  const imageUrl = getThumbnailUrl(ad_image_url, true);
  const profileImageUrl = getThumbnailUrl(creater_image_url, true);

  // 광고가 표시될 때 노출 기록 (같은 creative_id는 전역적으로 한 번만)
  useEffect(() => {
    // creative_id가 없으면 스킵
    if (!creative_id) {
      return;
    }

    // 이미 전역적으로 기록했으면 스킵
    if (recordedCreativeIds.has(creative_id)) {
      return;
    }

    // 전역 Set에 추가 (요청 전에 추가하여 동시 요청 방지)
    recordedCreativeIds.add(creative_id);
    
    // 비동기로 노출 기록 (실패해도 조용히 처리)
    AdAPI.recordImpression(creative_id).catch(err => {
      // 429 에러는 조용히 처리
      if (err?.response?.status !== 429) {
        console.error('❌ [피드 광고] 노출 기록 실패:', err);
      }
      // 에러 발생 시에도 Set에서 제거하지 않음 (재시도 방지)
    });
    // 의존성 배열을 빈 배열로 하여 마운트 시 한 번만 실행
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePress = async () => {
    try {
      // 클릭 기록 (비동기, 실패해도 링크는 열림)
      AdAPI.recordClick(creative_id, impression_id).catch(err => {
        // 429 에러는 조용히 처리
        if (err?.response?.status !== 429) {
          console.error('❌ [피드 광고] 클릭 기록 실패:', err);
        }
      });

      // URL이 http:// 또는 https://로 시작하지 않으면 추가
      let urlToOpen = landing_page_url;
      if (!urlToOpen.startsWith('http://') && !urlToOpen.startsWith('https://')) {
        urlToOpen = `https://${urlToOpen}`;
      }

      // URL 열기 시도
      const canOpen = await Linking.canOpenURL(urlToOpen);
      if (canOpen) {
        await Linking.openURL(urlToOpen);
      } else {
        // canOpenURL이 false를 반환해도 직접 열기 시도
        try {
          await Linking.openURL(urlToOpen);
        } catch (openError) {
          console.error('❌ [피드 광고] URL 열기 실패:', openError);
          // 사용자에게 알림 (선택사항)
        }
      }
    } catch (error) {
      console.error('❌ [피드 광고] 링크 열기 실패:', error);
      // 에러가 발생해도 사용자에게는 조용히 처리
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
      {/* 헤더 */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {profileImageUrl ? (
            <Image source={{uri: profileImageUrl}} style={styles.profileImage} />
          ) : (
            <View style={styles.profileImagePlaceholder}>
              <Icon name="user" size={16} color={colors.textPrimary} />
            </View>
          )}
          <Text style={styles.advertiserName}>{creater_name || '광고주'}</Text>
        </View>
        <Text style={styles.sponsoredText}>Sponsored</Text>
      </View>

      {/* 이미지 */}
      {imageUrl && (
        <View style={styles.imageContainer}>
          <ImageWithLottie source={{uri: imageUrl}} style={styles.image} resizeMode="cover" />
        </View>
      )}

      {/* 제목 */}
      {ad_title && <Text style={styles.title}>{ad_title}</Text>}

      {/* 본문 */}
      {ad_body && <Text style={styles.body}>{ad_body}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.secondary,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    gap: spacing.m,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  profileImage: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  profileImagePlaceholder: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.lightGray,
    alignItems: 'center',
    justifyContent: 'center',
  },
  advertiserName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '500' as const,
  },
  sponsoredText: {
    ...typography.captionRegular,
    color: colors.textTertiary,
  },
  imageContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    width: '100%',
    aspectRatio: 1,
    borderRadius: borderRadius.s,
    backgroundColor: colors.background,
  },
  title: {
    ...typography.bodyMedium,
    fontSize: 18,
    color: colors.textPrimary,
    fontWeight: '800' as const,
    marginBottom: spacing.xs,
  },
  body: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    paddingVertical: spacing.s,
  },
});

export default FeedAdCard;


import React, {useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Linking} from 'react-native';
import ImageWithLottie from '../common/ImageWithLottie';
import {colors, spacing, typography, borderRadius} from '../../styles/commonStyles';
import {AdAPI} from '../../api/ApiRequests';
import {getThumbnailUrl} from '../../utils/imageUtils';

// 전역으로 기록된 creative_id + recipe_post_id 조합 추적 (모듈 레벨)
const recordedImpressionKeys = new Set<string>();

interface RecipeCardAdProps {
  creative_id: string;
  ad_title?: string;
  ad_image_url: string;
  landing_page_url: string;
  creater_name?: string;
  impression_id?: string;
  recipe_post_id?: string;
}

/**
 * 레시피 카드 광고 컴포넌트
 */
const RecipeCardAd: React.FC<RecipeCardAdProps> = ({
  creative_id,
  ad_title,
  ad_image_url,
  landing_page_url,
  creater_name,
  impression_id,
  recipe_post_id,
}) => {
  // 카드에서는 썸네일 사용 (목록 표시용)
  const imageUrl = getThumbnailUrl(ad_image_url, true);

  // 광고가 표시될 때 노출 기록 (레시피 카드 광고는 recipe_post_id 필요)
  // 같은 creative_id + recipe_post_id 조합은 전역적으로 한 번만
  useEffect(() => {
    // creative_id와 recipe_post_id가 모두 있어야 함
    if (!creative_id || !recipe_post_id) {
      return;
    }

    // 조합 키 생성
    const impressionKey = `${creative_id}-${recipe_post_id}`;
    
    // 이미 전역적으로 기록했으면 스킵
    if (recordedImpressionKeys.has(impressionKey)) {
      return;
    }

    // 전역 Set에 추가 (요청 전에 추가하여 동시 요청 방지)
    recordedImpressionKeys.add(impressionKey);
    
    // 비동기로 노출 기록 (실패해도 조용히 처리)
    AdAPI.recordImpression(creative_id, recipe_post_id).catch(err => {
      // 429 에러는 조용히 처리
      if (err?.response?.status !== 429) {
        console.error('❌ [레시피 카드 광고] 노출 기록 실패:', err);
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
          console.error('❌ [레시피 카드 광고] 클릭 기록 실패:', err);
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
          console.error('❌ [레시피 카드 광고] URL 열기 실패:', openError);
          // 사용자에게 알림 (선택사항)
        }
      }
    } catch (error) {
      console.error('❌ [레시피 카드 광고] 링크 열기 실패:', error);
      // 에러가 발생해도 사용자에게는 조용히 처리
    }
  };

  return (
    <TouchableOpacity style={styles.container} onPress={handlePress} activeOpacity={0.9}>
      <Text style={styles.brandName}>{creater_name || '광고주'}</Text>
      <View style={styles.contentContainer}>
        <View style={styles.productInfoBar}>
          <Text style={styles.productInfo}>{ad_title || '제목 없음'}</Text>
        </View>
        {imageUrl && (
          <View style={styles.imageContainer}>
            <ImageWithLottie source={{uri: imageUrl}} style={styles.image} resizeMode="cover" />
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginBottom: spacing.m,
    borderWidth: 1,
    borderColor: colors.primary,
    overflow: 'hidden',
  },
  brandName: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    marginBottom: spacing.m,
  },
  contentContainer: {
    backgroundColor: colors.background,
    borderRadius: borderRadius.s,
  },
  productInfoBar: {
    padding: spacing.s,
    alignSelf: 'flex-start',
  },
  productInfo: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
  imageContainer: {
    width: '100%',
    padding: spacing.s,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  image: {
    flex: 1,
    aspectRatio: 2.5,
    borderRadius: borderRadius.s,
  },
});

export default RecipeCardAd;


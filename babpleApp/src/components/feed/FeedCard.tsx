import React, {useState, useRef, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Image, Dimensions, ScrollView} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Avatar from '../common/Avatar';
import ImageWithLottie from '../common/ImageWithLottie';
import {colors, spacing, typography, borderRadius, shadows} from '../../styles/commonStyles';

const {width: SCREEN_WIDTH} = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH - spacing.l * 2;

interface FeedCardProps {
  nickname: string;
  isOwnPost: boolean;
  images: Array<string | number>;
  title: string;
  description: string;
  likeCount: number;
  commentCount: number;
  profilePhotoUrl?: string | number;
  userId?: string;
  onPress: () => void;
  onMenuPress: () => void;
  onUserProfilePress?: (userId: string, nickname: string) => void;
}

/**
 * 피드 카드 컴포넌트
 * 게시글의 사용자 정보, 이미지, 내용을 표시합니다.
 */
const FeedCard: React.FC<FeedCardProps> = ({
  nickname,
  isOwnPost,
  images,
  title,
  description,
  likeCount,
  commentCount,
  profilePhotoUrl,
  userId,
  onPress,
  onMenuPress,
  onUserProfilePress,
}) => {
  const renderImage = (source: string | number, index: number) => {
    const imageSource =
      typeof source === 'number' ? source : {uri: source};
    
    return (
      <TouchableOpacity
        key={`feed-image-${index}`}
        activeOpacity={0.9}
        onPress={onPress}
        style={styles.carouselItem}>
        <ImageWithLottie
          source={imageSource}
          style={styles.image}
          resizeMode="cover"
          onError={() => {
            console.warn('❌ [FeedCard] 이미지 로딩 실패:', source);
          }}
        />
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.wrapper}>
      <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.9}>
        {/* 사용자 정보 헤더 */}
        <View style={styles.header}>
        <TouchableOpacity
          style={styles.userInfo}
          onPress={() =>
            !isOwnPost &&
            onUserProfilePress &&
            onUserProfilePress(userId || '', nickname)
          }>
          <Avatar size={32} source={profilePhotoUrl ? (typeof profilePhotoUrl === 'number' ? profilePhotoUrl : {uri: profilePhotoUrl}) : undefined} />
          <Text style={styles.nickname}>
            {nickname}
            {isOwnPost && <Text style={styles.meLabel}> (me)</Text>}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={onMenuPress} style={styles.menuButton}>
          <Icon name="more-horizontal" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* 이미지 - 첫 번째 이미지만 표시 */}
      <View style={styles.imageContainer}>
        {images && images.length > 0 ? (
          renderImage(images[0], 0)
        ) : (
          renderImage(require('../../../assets/dev/images/feed01.png'), 0)
        )}
      </View>

      {/* 내용 */}
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.description}>{description}</Text>
      </View>

      {/* 인터랙션 아이콘 */}
      <View style={styles.footer}>
        <View style={styles.iconRow}>
          <Icon name="heart" size={18} color={colors.accent} />
          <Text style={styles.iconText}>{likeCount}</Text>
        </View>
        <View style={styles.iconRow}>
          <Icon name="message-circle" size={18} color={colors.textSecondary} />
          <Text style={styles.iconText}>{commentCount}</Text>
        </View>
      </View>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    width: SCREEN_WIDTH,
    alignItems: 'center',
    marginBottom: spacing.l,
    marginHorizontal: -spacing.l, // ScreenWrapper의 paddingHorizontal 상쇄
  },
  card: {
    backgroundColor: 'rgba(223,255,238,0.6)', // secondary 색상(#dfffee)에 투명도 80% 적용
    borderRadius: borderRadius.l,
    padding: 0,
    width: SCREEN_WIDTH - spacing.l * 2, // 화면 양쪽 여백 고려
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: colors.white,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
  },
  nickname: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
    fontSize: 15,
  },
  meLabel: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    fontWeight: '400',
    fontSize: 15,
  },
  menuButton: {
    padding: spacing.xs,
    borderRadius: borderRadius.s,
    backgroundColor: 'transparent',
  },
  imageContainer: {
    marginBottom: 0,
    borderRadius: 0,
    overflow: 'hidden',
  },
  imageScrollContent: {
    width: CARD_WIDTH,
  },
  carouselItem: {
    width: CARD_WIDTH,
  },
  singleImageContainer: {
    width: CARD_WIDTH,
  },
  image: {
    width: CARD_WIDTH,
    height: 340,
    backgroundColor: colors.offWhite,
  },
  content: {
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.s,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700',
    marginBottom: spacing.xs,
    fontSize: 18,
    lineHeight: 26,
  },
  description: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    lineHeight: 22,
    fontSize: 15,
  },
  footer: {
    flexDirection: 'row',
    gap: spacing.l,
    paddingHorizontal: spacing.m,
    paddingTop: spacing.s,
    paddingBottom: spacing.m,
    borderTopWidth: 1,
    borderTopColor: colors.offWhite,
  },
  iconRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  iconText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
});

export default FeedCard;


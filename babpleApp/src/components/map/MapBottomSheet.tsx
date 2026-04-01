import React from 'react';
import {View, Text, StyleSheet, Image, TouchableOpacity} from 'react-native';
import Icon from 'react-native-vector-icons/Feather';
import Avatar from '../common/Avatar';
import ImageWithLottie from '../common/ImageWithLottie';
import {colors, spacing, typography, borderRadius, shadows} from '../../styles/commonStyles';

interface MapBottomSheetProps {
  title: string;
  nickname: string;
  imageUrl?: string | null;
  likeCount: number;
  commentCount: number;
  isOpen: boolean;
  onClose: () => void;
  onPress?: () => void;
  recipeId?: string;
}

/**
 * 지도 하단 시트 컴포넌트
 * 마커를 터치했을 때 표시되는 상세 정보입니다.
 */
const MapBottomSheet: React.FC<MapBottomSheetProps> = ({
  title,
  nickname,
  imageUrl,
  likeCount,
  commentCount,
  isOpen,
  onClose,
  onPress,
  recipeId,
}) => {
  if (!isOpen) return null;

  const hasImage = imageUrl && imageUrl.length > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.8}>
      {/* 이미지 썸네일 */}
      <View style={styles.imageContainer}>
        {hasImage ? (
          <ImageWithLottie
            source={{uri: imageUrl}}
            style={styles.image}
            resizeMode="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Icon name="image" size={18} color={colors.textSecondary} />
          </View>
        )}
      </View>

      {/* 정보 */}
      <View style={styles.infoContainer}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <View style={styles.userRow}>
          <Avatar size={16} />
          <Text style={styles.nickname} numberOfLines={1}>
            {nickname}
          </Text>
        </View>
      </View>

      {/* 인터랙션 */}
      <View style={styles.metaContainer}>
        <View style={styles.metaItem}>
          <Icon name="heart" size={14} color={colors.accent} />
          <Text style={styles.metaText}>{likeCount}</Text>
        </View>
        <View style={styles.metaItem}>
          <Icon name="message-circle" size={14} color={colors.textSecondary} />
          <Text style={styles.metaText}>{commentCount}</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: 30, // 하단 네비게이션 바 위
    left: spacing.l,
    right: spacing.l,
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.m,
    ...shadows.card,
  },
  imageContainer: {
    width: 60,
    height: 60,
    borderRadius: borderRadius.s,
    overflow: 'hidden',
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
  infoContainer: {
    flex: 1,
    gap: spacing.xs,
  },
  title: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600',
  },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  nickname: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  viewsContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  viewsText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  metaContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.s,
  },
  metaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metaText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
});

export default MapBottomSheet;


import React, {useState, useEffect} from 'react';
import {Image, View, ViewStyle, ImageStyle, ImageErrorEventData, NativeSyntheticEvent, StyleProp} from 'react-native';
import {colors} from '../../styles/commonStyles';
import {getThumbnailUrl} from '../../utils/imageUtils';

interface AvatarProps {
  source?: {uri: string} | number;
  size?: number;
  style?: StyleProp<ViewStyle | ImageStyle>;
  defaultSource?: number;
}

/**
 * 사용자 프로필 이미지를 보여주는 원형 컴포넌트
 * 다양한 크기를 지원합니다 (32px, 40px, 48px, 80px 등).
 */
const Avatar: React.FC<AvatarProps> = ({source, size = 40, style, defaultSource}) => {
  const radius = size / 2;
  const [imageError, setImageError] = useState(false);

  // source가 변경되면 imageError 리셋
  useEffect(() => {
    setImageError(false);
  }, [source]);

  // 프로필 이미지에 썸네일 적용 (Avatar는 프로필 이미지이므로 항상 썸네일 사용)
  const processedSource = React.useMemo(() => {
    if (!source || typeof source === 'number') {
      return source;
    }
    const thumbnailUrl = getThumbnailUrl(source.uri, true);
    return thumbnailUrl ? {uri: thumbnailUrl} : source;
  }, [source]);

  // source가 없거나 이미지 로드 에러가 발생한 경우
  if (!source || imageError) {
    // 기본 아바타: 배경색만 표시 또는 기본 이미지
    if (defaultSource) {
      return (
        <Image
          source={defaultSource}
          style={[
            {
              width: size,
              height: size,
              borderRadius: radius,
              backgroundColor: colors.lightGray,
            } as ImageStyle,
            style as ImageStyle,
          ]}
        />
      );
    }
    return (
      <View
        style={[
          {
            width: size,
            height: size,
            borderRadius: radius,
            backgroundColor: colors.lightGray,
          },
          style as ViewStyle,
        ]}
      />
    );
  }

  const handleImageError = (error: NativeSyntheticEvent<ImageErrorEventData>) => {
    console.warn('Avatar 이미지 로드 실패:', error.nativeEvent.error);
    setImageError(true);
  };

  return (
    <Image
      source={processedSource}
      onError={handleImageError}
      style={[
        {
          width: size,
          height: size,
          borderRadius: radius,
          backgroundColor: colors.lightGray,
        } as ImageStyle,
        style as ImageStyle,
      ]}
    />
  );
};

export default Avatar;


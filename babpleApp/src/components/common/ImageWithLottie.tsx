import React, {useState} from 'react';
import {
  View,
  Image,
  StyleSheet,
  ImageProps,
  ImageStyle,
  ViewStyle,
  Platform,
} from 'react-native';
import LottieView from 'lottie-react-native';

interface ImageWithLottieProps extends Omit<ImageProps, 'source'> {
  source: {uri: string} | number;
  style?: ImageStyle;
  containerStyle?: ViewStyle;
  resizeMode?: 'contain' | 'cover' | 'stretch' | 'center';
  onLoadEnd?: () => void;
  onError?: () => void;
}

/**
 * 로딩/에러 상태를 Lottie 애니메이션으로 표시하는 이미지 컴포넌트
 * - 로딩 중: food-pic-loader.json
 * - 에러: server-error.json
 * - 성공: 이미지 표시
 */
const ImageWithLottie: React.FC<ImageWithLottieProps> = ({
  source,
  style,
  containerStyle,
  resizeMode = 'cover',
  onLoadEnd,
  onError,
  ...restProps
}) => {
  const [loadingState, setLoadingState] = useState<'loading' | 'success' | 'error'>('loading');

  // 로컬 이미지인 경우 바로 표시
  if (typeof source === 'number') {
    return (
      <Image
        source={source}
        style={style}
        resizeMode={resizeMode}
        {...restProps}
      />
    );
  }

  const handleLoadStart = () => {
    setLoadingState('loading');
  };

  const handleLoadEnd = () => {
    setLoadingState('success');
    onLoadEnd?.();
  };

  const handleError = (error: any) => {
    console.warn('❌ [ImageWithLottie] 이미지 로드 에러:', typeof source === 'object' ? source.uri : source, error?.nativeEvent);
    setLoadingState('error');
    onError?.();
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {/* 이미지 (항상 렌더링하되, 로딩 중/에러 시 Lottie 뒤에 숨김) */}
      <Image
        source={source}
        style={[style, loadingState !== 'success' && styles.hidden]}
        resizeMode={resizeMode}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError}
        // iOS 캐싱 문제 해결을 위한 설정
        {...(Platform.OS === 'ios' && {
          defaultSource: require('../../../assets/icon/app_icon/app_icon.jpg'),
        })}
        {...restProps}
      />

      {/* 로딩 중 - food-pic-loader */}
      {loadingState === 'loading' && (
        <View style={[StyleSheet.absoluteFill, styles.lottieContainer]}>
          <LottieView
            source={require('../../../assets/icon/loading/food-pic-loader.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>
      )}

      {/* 에러 - server-error */}
      {loadingState === 'error' && (
        <View style={[StyleSheet.absoluteFill, styles.lottieContainer]}>
          <LottieView
            source={require('../../../assets/icon/loading/server-error.json')}
            autoPlay
            loop
            style={styles.lottie}
          />
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  hidden: {
    opacity: 0,
  },
  lottieContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f5f5f5',
  },
  lottie: {
    width: 98,
    height: 98,
  },
});

export default ImageWithLottie;


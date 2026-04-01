import ImagePicker from 'react-native-image-crop-picker';
import { Alert, Platform } from 'react-native';
import { requestPermission } from './permission';

export interface ImagePickerOptions {
  width?: number;
  height?: number;
  cropping?: boolean;
  compressImageQuality?: number;
  cropperToolbarTitle?: string;
  cropperChooseText?: string;
  cropperCancelText?: string;
  includeBase64?: boolean;
  freeStyleCropEnabled?: boolean;
  cropperRotateButtonsHidden?: boolean;
}

export interface ImageResult {
  uri: string;
  width: number;
  height: number;
  mime: string;
  size: number;
  path: string;
}

/**
 * 카메라로 사진을 촬영하고 후처리 (크롭, 확대/축소) 가능
 */
export const pickImageFromCamera = async (
  options?: ImagePickerOptions,
): Promise<ImageResult | null> => {
  // 권한 요청
  const hasPermission = await requestPermission('camera', {
    title: '카메라 권한 필요',
    message: '사진 촬영을 위해 카메라 접근 권한이 필요합니다.',
  });

  if (!hasPermission) return null;

  try {
    const shouldCrop = options?.cropping !== false;

    // 1단계: 먼저 cropping 없이 원본 이미지 가져오기
    const tempImage = await ImagePicker.openCamera({
      cropping: false,
      includeBase64: false,
    });

    // cropping이 필요하면 2단계: 원본 크기로 cropper 열기
    if (shouldCrop) {
      const cropperOptions: any = {
        path: tempImage.path,
        cropping: true,
        cropperToolbarTitle: options?.cropperToolbarTitle || '사진 편집',
        cropperChooseText: options?.cropperChooseText || '완료',
        cropperCancelText: options?.cropperCancelText || '취소',
        cropperRotateButtonsHidden: options?.cropperRotateButtonsHidden !== true,
        compressImageQuality: Platform.OS === 'ios' ? 0.6 : 0.5,
        includeBase64: false,
        forceJpg: true,
        compressImageMaxWidth: 3000,
        compressImageMaxHeight: 3000,
        freeStyleCropEnabled: true,
      };

      // iOS에서만 원본 width/height의 60%로 명시 (200x200 이슈 회피 및 용량 최적화)
      if (Platform.OS === 'ios') {
        cropperOptions.width = Math.round(tempImage.width * 0.6);
        cropperOptions.height = Math.round(tempImage.height * 0.6);
      }

      const image = await ImagePicker.openCropper(cropperOptions);

      return {
        uri: image.path,
        width: image.width,
        height: image.height,
        mime: image.mime,
        size: image.size,
        path: image.path,
      };
    } else {
      // cropping이 불필요하면 원본 반환
      return {
        uri: tempImage.path,
        width: tempImage.width,
        height: tempImage.height,
        mime: tempImage.mime,
        size: tempImage.size,
        path: tempImage.path,
      };
    }
  } catch (error: any) {
    if (error.code === 'E_PERMISSION_MISSING') {
      Alert.alert('권한 필요', '카메라 권한이 필요합니다.');
      return null;
    }
    if (error.code === 'E_PICKER_CANCELLED') {
      // 사용자가 취소한 경우는 정상적인 동작이므로 에러로 처리하지 않음
      return null;
    }
    console.error('카메라 이미지 선택 오류:', error);
    Alert.alert('오류', '카메라를 열 수 없습니다.');
    return null;
  }
};

/**
 * 갤러리에서 사진을 선택하고 후처리 (크롭, 확대/축소) 가능
 */
export const pickImageFromGallery = async (
  options?: ImagePickerOptions,
): Promise<ImageResult | null> => {
  // 권한 요청
  const hasPermission = await requestPermission('photo', {
    title: '갤러리 접근 권한 필요',
    message: '사진 선택을 위해 갤러리 접근 권한이 필요합니다.',
  });

  if (!hasPermission) return null;

  try {
    const shouldCrop = options?.cropping !== false;

    // 1단계: 먼저 cropping 없이 원본 이미지 가져오기
    const tempImage = await ImagePicker.openPicker({
      cropping: false,
      includeBase64: false,
    });

    // cropping이 필요하면 2단계: 원본 크기로 cropper 열기
    if (shouldCrop) {
      const cropperOptions: any = {
        path: tempImage.path,
        cropping: true,
        cropperToolbarTitle: options?.cropperToolbarTitle || '사진 편집',
        cropperChooseText: options?.cropperChooseText || '완료',
        cropperCancelText: options?.cropperCancelText || '취소',
        cropperRotateButtonsHidden: options?.cropperRotateButtonsHidden !== true,
        compressImageQuality: Platform.OS === 'ios' ? 0.6 : 0.5,
        includeBase64: false,
        forceJpg: true,
        compressImageMaxWidth: 3000,
        compressImageMaxHeight: 3000,
        freeStyleCropEnabled: true,
      };

      // iOS에서만 원본 width/height의 60%로 명시 (200x200 이슈 회피 및 용량 최적화)
      if (Platform.OS === 'ios') {
        cropperOptions.width = Math.round(tempImage.width * 0.6);
        cropperOptions.height = Math.round(tempImage.height * 0.6);
      }

      const image = await ImagePicker.openCropper(cropperOptions);

      return {
        uri: image.path,
        width: image.width,
        height: image.height,
        mime: image.mime,
        size: image.size,
        path: image.path,
      };
    } else {
      // cropping이 불필요하면 원본 반환
      return {
        uri: tempImage.path,
        width: tempImage.width,
        height: tempImage.height,
        mime: tempImage.mime,
        size: tempImage.size,
        path: tempImage.path,
      };
    }
  } catch (error: any) {
    if (error.code === 'E_PERMISSION_MISSING') {
      Alert.alert('권한 필요', '갤러리 접근 권한이 필요합니다.');
      return null;
    }
    if (error.code === 'E_PICKER_CANCELLED') {
      // 사용자가 취소한 경우는 정상적인 동작이므로 에러로 처리하지 않음
      return null;
    }
    console.error('갤러리 이미지 선택 오류:', error);
    Alert.alert('오류', '이미지를 선택할 수 없습니다.');
    return null;
  }
};

/**
 * 이미지 선택 옵션을 표시하고 선택된 이미지 반환
 * @param allowCropping 크롭 기능 사용 여부 (기본값: true)
 * @param maxWidth 최대 너비 (기본값: 1920)
 * @param maxHeight 최대 높이 (기본값: 1920)
 * @param quality 이미지 품질 (0.0 ~ 1.0, 기본값: 0.8)
 * @returns 선택된 이미지 URI 또는 null
 */
export const showImagePicker = async (options?: {
  allowCropping?: boolean;
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  cropperToolbarTitle?: string;
}): Promise<string | null> => {
  return new Promise((resolve) => {
    Alert.alert(
      '사진 선택',
      '사진을 어디서 가져오시겠습니까?',
      [
        { text: '취소', style: 'cancel', onPress: () => resolve(null) },
        {
          text: '카메라',
          onPress: async () => {
            const pickerOptions: ImagePickerOptions = {
              cropping: options?.allowCropping !== false, // 기본값 true
              compressImageQuality: options?.quality || 0.5,
              cropperToolbarTitle: options?.cropperToolbarTitle || '사진 편집',
            };
            // maxWidth와 maxHeight가 명시적으로 전달된 경우에만 설정 (이미지 해상도 제한)
            if (options?.maxWidth) {
              pickerOptions.width = options.maxWidth;
            }
            if (options?.maxHeight) {
              pickerOptions.height = options.maxHeight;
            }
            const result = await pickImageFromCamera(pickerOptions);
            resolve(result?.uri || null);
          },
        },
        {
          text: '갤러리',
          onPress: async () => {
            const pickerOptions: ImagePickerOptions = {
              cropping: options?.allowCropping !== false, // 기본값 true
              compressImageQuality: options?.quality || 0.5,
              cropperToolbarTitle: options?.cropperToolbarTitle || '사진 편집',
            };
            // maxWidth와 maxHeight가 명시적으로 전달된 경우에만 설정 (이미지 해상도 제한)
            if (options?.maxWidth) {
              pickerOptions.width = options.maxWidth;
            }
            if (options?.maxHeight) {
              pickerOptions.height = options.maxHeight;
            }
            const result = await pickImageFromGallery(pickerOptions);
            resolve(result?.uri || null);
          },
        },
      ],
      { cancelable: true },
    );
  });
};


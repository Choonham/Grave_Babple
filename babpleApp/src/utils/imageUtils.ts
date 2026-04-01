import {API_BASE_URL} from '../config/api';
import {Platform} from 'react-native';

/**
 * 이미지 URL 빌드 (상대 경로를 전체 URL로 변환)
 * @param path 상대 경로 또는 전체 URL
 * @returns 전체 URL
 */
export const buildMediaUrl = (path?: string | null): string | null => {
  if (!path) {
    return null;
  }

  const trimmed = path.trim();

  if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
    // iOS 캐시 문제 해결: 외부 URL에도 타임스탬프 추가
    if (Platform.OS === 'ios') {
      const separator = trimmed.includes('?') ? '&' : '?';
      return `${trimmed}${separator}t=${Date.now()}`;
    }
    return trimmed;
  }

  let normalized = trimmed.replace(/\\/g, '/');

  if (normalized.startsWith('/uploads')) {
    // Already normalized
    const url = `${API_BASE_URL}${normalized}`;
    // iOS 캐시 문제 해결: URL에 타임스탬프 추가
    if (Platform.OS === 'ios') {
      return `${url}?t=${Date.now()}`;
    }
    return url;
  }

  if (normalized.startsWith('uploads')) {
    normalized = normalized.replace(/^uploads/, '/uploads');
  } else {
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized.startsWith('/uploads')) {
      normalized = `/uploads${normalized}`;
    }
  }

  const url = `${API_BASE_URL}${normalized}`;
  // iOS 캐시 문제 해결: URL에 타임스탬프 추가
  if (Platform.OS === 'ios') {
    return `${url}?t=${Date.now()}`;
  }
  return url;
};

/**
 * 원본 이미지 URL에서 썸네일 URL 생성
 * @param imageUrl 원본 이미지 URL (예: /uploads/profile/abc123.jpg 또는 전체 URL)
 * @param useThumbnail 썸네일 사용 여부 (기본값: true)
 * @returns 썸네일 URL 또는 원본 URL
 */
export const getThumbnailUrl = (imageUrl: string | null | undefined, useThumbnail: boolean = true): string | null => {
  if (!imageUrl || !useThumbnail) {
    return buildMediaUrl(imageUrl);
  }

  // 이미 썸네일인 경우 그대로 반환
  if (imageUrl.includes('/thumb-') || imageUrl.includes('thumb-')) {
    return buildMediaUrl(imageUrl);
  }

  // 외부 URL인 경우 썸네일 생성 불가
  if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
    // S3 URL이 아닌 경우 원본 반환
    if (!imageUrl.includes('.s3.') || !imageUrl.includes('.amazonaws.com/')) {
      return buildMediaUrl(imageUrl);
    }
  }

  // 경로에서 파일명 추출
  const pathParts = imageUrl.split('/');
  const filename = pathParts[pathParts.length - 1];

  // thumb- 접두사가 없으면 추가
  if (!filename.startsWith('thumb-')) {
    const thumbnailFilename = `thumb-${filename}`;
    const thumbnailPath = imageUrl.replace(filename, thumbnailFilename);
    return buildMediaUrl(thumbnailPath);
  }

  return buildMediaUrl(imageUrl);
};


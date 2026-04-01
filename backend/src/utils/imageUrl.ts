/**
 * 이미지 URL 변환 유틸리티
 * 로컬 경로를 S3 URL로 변환, S3 URL을 상대 경로로 변환
 */

/**
 * S3 URL을 상대 경로로 변환 (DB 저장용)
 * @param url S3 URL 또는 상대 경로
 * @returns 상대 경로 (예: uploads/profile/filename.jpg)
 */
export function normalizeToRelativePath(url: string | null | undefined): string | undefined {
  if (!url) {
    return undefined;
  }

  // 이미 상대 경로면 그대로 반환
  if (!url.startsWith('https://') && !url.startsWith('http://') && !url.startsWith('/')) {
    // uploads/... 형식
    return url;
  }

  // S3 URL에서 상대 경로 추출
  if (url.includes('.s3.') && url.includes('.amazonaws.com/')) {
    const urlParts = url.split('.amazonaws.com/');
    if (urlParts.length > 1 && urlParts[1]) {
      const path = urlParts[1];
      // babple/uploads/... -> uploads/...
      if (path.startsWith('babple/')) {
        return path.substring('babple/'.length);
      }
      return path;
    }
  }

  // /uploads/... 형식 -> uploads/...
  if (url.startsWith('/uploads/')) {
    return url.substring(1); // 첫 번째 / 제거
  }

  // /로 시작하는 경우
  if (url.startsWith('/')) {
    return url.substring(1);
  }

  return url;
}

/**
 * 이미지 URL을 nginx 프록시 URL로 변환 (응답용)
 * nginx 프록시를 통해 S3 파일에 접근하므로 상대 경로를 그대로 반환
 * 클라이언트가 /uploads/... 로 요청하면 nginx가 백엔드로 프록시하여 S3에서 가져옴
 * @param url 이미지 URL (로컬 경로 또는 S3 URL)
 * @returns nginx 프록시 URL 또는 상대 경로
 */
export function normalizeImageUrl(url: string | null | undefined): string | null {
  if (!url) {
    return null;
  }

  // 이미 전체 URL이면 그대로 반환 (다른 도메인 이미지 등)
  if (url.startsWith('https://') || url.startsWith('http://')) {
    // S3 URL인 경우 nginx 프록시 URL로 변환
    if (url.includes('.s3.') && url.includes('.amazonaws.com/')) {
      const urlParts = url.split('.amazonaws.com/');
      if (urlParts.length > 1 && urlParts[1]) {
        const path = urlParts[1];
        // babple/uploads/... -> /uploads/...
        if (path.startsWith('babple/')) {
          const relativePath = path.substring('babple/'.length);
          return `/${relativePath}`;
        }
        return `/${path}`;
      }
    }
    return url;
  }

  // 상대 경로 형식 처리 (uploads/recipe/filename.jpg)
  if (url.startsWith('uploads/')) {
    // uploads/recipe/filename.jpg -> /uploads/recipe/filename.jpg
    return `/${url}`;
  }

  // 로컬 경로 형식 처리 (/uploads/filename.jpg)
  if (url.startsWith('/uploads/')) {
    // 이미 /로 시작하므로 그대로 반환
    return url;
  }

  // 상대 경로 형식 처리 (recipe/filename.jpg - uploads/ 없이 시작)
  if (!url.startsWith('/') && !url.startsWith('http')) {
    // recipe/filename.jpg -> /uploads/recipe/filename.jpg
    return `/uploads/${url}`;
  }

  // 이미 /로 시작하는 경우
  if (url.startsWith('/')) {
    return url;
  }

  return url;
}

/**
 * 객체의 모든 image_url 필드를 변환
 * @param obj 변환할 객체
 * @returns 변환된 객체
 */
export function normalizeImageUrlsInObject(obj: any): any {
  if (!obj || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(item => normalizeImageUrlsInObject(item));
  }

  const normalized = {...obj};

  // image_url 필드 변환
  if (normalized.image_url !== undefined) {
    normalized.image_url = normalizeImageUrl(normalized.image_url);
  }

  // profile_image_url 필드 변환
  if (normalized.profile_image_url !== undefined) {
    normalized.profile_image_url = normalizeImageUrl(normalized.profile_image_url);
  }

  // ad_image_url 필드 변환
  if (normalized.ad_image_url !== undefined) {
    normalized.ad_image_url = normalizeImageUrl(normalized.ad_image_url);
  }

  // creater_image_url 필드 변환
  if (normalized.creater_image_url !== undefined) {
    normalized.creater_image_url = normalizeImageUrl(normalized.creater_image_url);
  }

  // video_url 필드 변환
  if (normalized.video_url !== undefined) {
    normalized.video_url = normalizeImageUrl(normalized.video_url);
  }

  // 중첩된 객체도 재귀적으로 변환
  for (const key in normalized) {
    if (normalized[key] && typeof normalized[key] === 'object') {
      normalized[key] = normalizeImageUrlsInObject(normalized[key]);
    }
  }

  return normalized;
}

/**
 * 원본 이미지 URL에서 썸네일 URL 생성
 * @param imageUrl 원본 이미지 URL (예: /uploads/recipe/abc123.jpg)
 * @returns 썸네일 URL (예: /uploads/recipe/thumb-abc123.jpg)
 */
export function getThumbnailUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) {
    return null;
  }

  // 이미 썸네일인 경우 그대로 반환
  if (imageUrl.includes('/thumb-')) {
    return normalizeImageUrl(imageUrl);
  }

  // 외부 URL인 경우 썸네일 생성 불가
  if (imageUrl.startsWith('https://') || imageUrl.startsWith('http://')) {
    // S3 URL이 아닌 경우 원본 반환
    if (!imageUrl.includes('.s3.') || !imageUrl.includes('.amazonaws.com/')) {
      return normalizeImageUrl(imageUrl);
    }
  }

  // 경로에서 파일명 추출
  const pathParts = imageUrl.split('/');
  const filename = pathParts[pathParts.length - 1];

  // 파일명이 없으면 원본 반환
  if (!filename || filename.trim() === '') {
    return normalizeImageUrl(imageUrl);
  }

  // thumb- 접두사가 없으면 추가
  if (!filename.startsWith('thumb-')) {
    const thumbnailFilename = `thumb-${filename}`;
    const thumbnailPath = imageUrl.replace(filename, thumbnailFilename);
    return normalizeImageUrl(thumbnailPath);
  }

  return normalizeImageUrl(imageUrl);
}


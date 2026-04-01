import sharp from 'sharp';

/**
 * 이미지 리사이징 및 썸네일 생성 결과
 */
export interface ImageProcessResult {
  resizedBuffer: Buffer;
  thumbnailBuffer: Buffer;
  originalWidth: number;
  originalHeight: number;
  resizedWidth: number;
  resizedHeight: number;
  thumbnailWidth: number;
  thumbnailHeight: number;
}

/**
 * 이미지 리사이징 및 썸네일 생성
 * @param imageBuffer 원본 이미지 버퍼
 * @param maxWidth 최대 너비 (기본값: 1280)
 * @param maxHeight 최대 높이 (기본값: 1280)
 * @param thumbnailWidth 썸네일 너비 (기본값: 800)
 * @param thumbnailHeight 썸네일 높이 (기본값: 800)
 * @param quality JPEG 품질 (기본값: 85)
 * @returns 리사이징된 이미지와 썸네일 버퍼
 */
export async function resizeAndCreateThumbnail(
  imageBuffer: Buffer,
  maxWidth: number = 1280,
  maxHeight: number = 1280,
  thumbnailWidth: number = 800,
  thumbnailHeight: number = 800,
  quality: number = 85
): Promise<ImageProcessResult> {
  try {
    // 원본 이미지 메타데이터 확인
    const metadata = await sharp(imageBuffer).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    if (originalWidth === 0 || originalHeight === 0) {
      throw new Error('이미지 크기를 확인할 수 없습니다.');
    }

    // 리사이징된 이미지 생성
    let resizedBuffer: Buffer;
    let resizedWidth: number;
    let resizedHeight: number;

    if (originalWidth > maxWidth || originalHeight > maxHeight) {
      // 비율 유지하면서 리사이징
      const ratio = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);
      resizedWidth = Math.round(originalWidth * ratio);
      resizedHeight = Math.round(originalHeight * ratio);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 [imageProcessor] 이미지 리사이징: ${originalWidth}x${originalHeight} -> ${resizedWidth}x${resizedHeight}`);
      }

      resizedBuffer = await sharp(imageBuffer)
        .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
        .resize(resizedWidth, resizedHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          fastShrinkOnLoad: true, // 빠른 축소 처리
        })
        .jpeg({
          quality,
          mozjpeg: true,
          progressive: true, // 점진적 JPEG 로딩 (웹 성능 향상)
          optimizeScans: true, // 스캔 최적화
        })
        .toBuffer();
    } else {
      // 이미 적절한 크기이면 높은 품질로 JPEG 변환만 (품질 손실 최소화)
      resizedWidth = originalWidth;
      resizedHeight = originalHeight;

      if (process.env.NODE_ENV === 'development') {
        console.log(`✅ [imageProcessor] 이미지 크기 적절함, 품질 유지하여 변환: ${originalWidth}x${originalHeight}`);
      }

      resizedBuffer = await sharp(imageBuffer)
        .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
        .jpeg({
          quality: 95, // 품질 유지 (85 → 95)
          mozjpeg: true,
          progressive: true, // 점진적 JPEG 로딩 (웹 성능 향상)
          optimizeScans: true, // 스캔 최적화
        })
        .toBuffer();
    }

    // 썸네일 생성
    let thumbnailBuffer: Buffer;
    let thumbWidth: number;
    let thumbHeight: number;

    if (originalWidth > thumbnailWidth || originalHeight > thumbnailHeight) {
      // 비율 유지하면서 썸네일 생성
      const thumbRatio = Math.min(thumbnailWidth / originalWidth, thumbnailHeight / originalHeight);
      thumbWidth = Math.round(originalWidth * thumbRatio);
      thumbHeight = Math.round(originalHeight * thumbRatio);

      if (process.env.NODE_ENV === 'development') {
        console.log(`🔄 [imageProcessor] 썸네일 생성: ${originalWidth}x${originalHeight} -> ${thumbWidth}x${thumbHeight}`);
      }

      thumbnailBuffer = await sharp(imageBuffer)
        .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
        .resize(thumbWidth, thumbHeight, {
          fit: 'inside',
          withoutEnlargement: true,
          fastShrinkOnLoad: true, // 빠른 축소 처리
        })
        .jpeg({
          quality: 85, // 썸네일 품질 개선 (80 → 85)
          mozjpeg: true,
          progressive: true, // 점진적 JPEG 로딩
          optimizeScans: true, // 스캔 최적화
        })
        .toBuffer();
    } else {
      // 이미 작으면 원본 크기로 썸네일 생성 (품질 유지)
      thumbWidth = originalWidth;
      thumbHeight = originalHeight;

      thumbnailBuffer = await sharp(imageBuffer)
        .rotate() // EXIF 방향 정보를 자동으로 적용하여 올바른 방향으로 회전
        .jpeg({
          quality: 90, // 작은 이미지는 품질 더 유지 (80 → 90)
          mozjpeg: true,
          progressive: true, // 점진적 JPEG 로딩
          optimizeScans: true, // 스캔 최적화
        })
        .toBuffer();
    }

    const originalSize = imageBuffer.length;
    const resizedSize = resizedBuffer.length;
    const thumbnailSize = thumbnailBuffer.length;

    if (process.env.NODE_ENV === 'development') {
      console.log(`✅ [imageProcessor] 이미지 처리 완료:`);
      console.log(`   원본: ${(originalSize / 1024).toFixed(2)}KB (${originalWidth}x${originalHeight})`);
      console.log(`   리사이징: ${(resizedSize / 1024).toFixed(2)}KB (${resizedWidth}x${resizedHeight})`);
      console.log(`   썸네일: ${(thumbnailSize / 1024).toFixed(2)}KB (${thumbWidth}x${thumbHeight})`);
    }

    return {
      resizedBuffer,
      thumbnailBuffer,
      originalWidth,
      originalHeight,
      resizedWidth,
      resizedHeight,
      thumbnailWidth: thumbWidth,
      thumbnailHeight: thumbHeight,
    };
  } catch (error) {
    console.error('❌ [imageProcessor] 이미지 처리 실패:', error);
    throw error;
  }
}


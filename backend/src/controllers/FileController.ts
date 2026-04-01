import {Request, Response} from 'express';
import {s3Service} from '../services/S3Service';

/**
 * 파일 컨트롤러
 * S3 파일을 프록시하여 제공
 */
export class FileController {
  /**
   * S3 파일 프록시
   * GET /api/files/uploads/*
   * EC2의 IAM 역할을 사용하여 S3에서 파일을 가져와서 클라이언트에 제공
   */
  static async proxyFile(req: Request, res: Response) {
    try {
      // URL에서 경로 추출
      // 예: /api/files/uploads/recipe/filename.jpg -> uploads/recipe/filename.jpg
      let filePath = req.path.replace('/api/files/', '');
      
      // 앞의 / 제거 (S3 키는 상대 경로여야 함)
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }
      
      if (!filePath) {
        return res.status(400).json({
          success: false,
          message: '파일 경로가 필요합니다.',
        });
      }

      console.log(`📁 [파일 프록시] 요청: ${filePath}`);

      // S3에서 파일 가져오기 (Buffer)
      const fileBuffer = await s3Service.getFileBuffer(filePath);

      if (!fileBuffer) {
        console.warn(`⚠️ [파일 프록시] 파일을 찾을 수 없음: ${filePath}`);
        return res.status(404).json({
          success: false,
          message: '파일을 찾을 수 없습니다.',
        });
      }

      // Content-Type 설정
      const contentType = getContentType(filePath);
      res.setHeader('Content-Type', contentType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      res.setHeader('Content-Length', fileBuffer.length.toString());

      console.log(`✅ [파일 프록시] 파일 전송 완료: ${filePath} (${fileBuffer.length} bytes)`);

      // 파일 전송
      return res.send(fileBuffer);
    } catch (error) {
      console.error('❌ [파일 프록시] 오류:', error);
      return res.status(500).json({
        success: false,
        message: '파일을 가져오는 중 오류가 발생했습니다.',
      });
    }
  }
}

/**
 * 파일 확장자에 따른 Content-Type 반환
 */
function getContentType(filePath: string): string {
  const ext = filePath.toLowerCase().split('.').pop();
  
  const contentTypes: {[key: string]: string} = {
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    webp: 'image/webp',
    svg: 'image/svg+xml',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    avi: 'video/x-msvideo',
    pdf: 'application/pdf',
    txt: 'text/plain',
    md: 'text/markdown',
  };

  return contentTypes[ext || ''] || 'application/octet-stream';
}


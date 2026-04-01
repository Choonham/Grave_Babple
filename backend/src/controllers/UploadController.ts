import {Request, Response} from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import {v4 as uuidv4} from 'uuid';
import {uploadDir} from '../config/upload';
import {s3Service} from '../services/S3Service';
import {resizeAndCreateThumbnail} from '../utils/imageProcessor';

/**
 * Multer 스토리지 설정 팩토리 함수
 * @param subDir 하위 디렉토리 (예: 'profile', 'chat', 'recipe')
 */
const createStorage = (subDir?: string) => {
  return multer.diskStorage({
    destination: (req, file, cb) => {
      const targetDir = subDir ? path.join(uploadDir, subDir) : uploadDir;
      // 디렉토리가 없으면 생성
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, {recursive: true});
      }
      cb(null, targetDir);
    },
    filename: (req, file, cb) => {
      // 원본 파일명에서 확장자 추출
      const ext = path.extname(file.originalname);
      // UUID로 고유한 파일명 생성
      const filename = `${uuidv4()}${ext}`;
      cb(null, filename);
    },
  });
};

/**
 * 파일 필터 설정 (이미지, 동영상, 파일 허용)
 */
const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic', // iOS HEIC 포맷 지원
    'image/heif', // HEIF 포맷 지원
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ];
  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('지원하지 않는 파일 형식입니다.'));
  }
};

/**
 * Multer 인스턴스 생성 (일반 업로드용 - 10MB)
 * uploads/ 루트에 저장 (하위 호환성 유지)
 */
const upload = multer({
  storage: createStorage(),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
});

/**
 * Multer 인스턴스 생성 (프로필 이미지 업로드용 - 10MB)
 * uploads/profile/ 폴더에 저장
 */
const profileUpload = multer({
  storage: createStorage('profile'),
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB 제한
  },
});

/**
 * Multer 인스턴스 생성 (채팅 미디어 업로드용 - 50MB)
 * uploads/chat/ 폴더에 저장
 * 채팅에서 이미지/비디오 전송 시 더 큰 파일이 필요할 수 있음
 */
const chatMediaUpload = multer({
  storage: createStorage('chat'),
  fileFilter,
  limits: {
    fileSize: 50 * 1024 * 1024, // 50MB 제한 (채팅용)
  },
});

/**
 * 업로드 컨트롤러
 */
export class UploadController {
  /**
   * 단일 이미지 업로드
   * POST /api/upload/image
   * 리사이징 및 썸네일 생성 포함 (상점, 광고 소재 등에서 사용)
   */
  static uploadImage = [
    upload.single('image'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: '이미지 파일이 필요합니다.',
          });
        }

        // 이미지인지 확인
        const isImage = req.file.mimetype.startsWith('image/');
        
        if (isImage) {
          // 이미지는 리사이징 및 썸네일 생성
          try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const {resizedBuffer, thumbnailBuffer} = await resizeAndCreateThumbnail(fileBuffer);
            
            // 리사이징된 원본 이미지 업로드
            const s3Key = `uploads/${req.file.filename}`;
            const contentType = req.file.mimetype;
            
            const relativePath = await s3Service.uploadBuffer(resizedBuffer, s3Key, contentType);
            console.log(`✅ [이미지 업로드] 리사이징된 이미지 S3 저장 완료: ${relativePath}`);
            
            // 썸네일 업로드
            const thumbnailFileName = `thumb-${req.file.filename}`;
            const thumbnailS3Key = `uploads/${thumbnailFileName}`;
            
            await s3Service.uploadBuffer(thumbnailBuffer, thumbnailS3Key, contentType);
            console.log(`✅ [이미지 업로드] 썸네일 S3 저장 완료: uploads/${thumbnailFileName}`);
            
            // 로컬 임시 파일 삭제
            try {
              fs.unlinkSync(req.file.path);
            } catch (error) {
              console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
            }

            console.log('✅ [이미지 업로드] S3 업로드 성공:', {
              originalName: req.file.originalname,
              filename: req.file.filename,
              size: req.file.size,
              relativePath: relativePath,
            });

            return res.json({
              success: true,
              message: '파일 업로드가 완료되었습니다.',
              data: {
                url: relativePath, // 상대 경로 (응답 미들웨어가 S3 URL로 변환)
                image_url: relativePath, // 하위 호환성
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: resizedBuffer.length,
              },
            });
          } catch (resizeError) {
            console.error('❌ [이미지 업로드] 이미지 리사이징 실패, 원본 업로드 시도:', resizeError);
            // 리사이징 실패 시 원본 업로드 (하위 호환)
            const s3Key = `uploads/${req.file.filename}`;
            const relativePath = await s3Service.uploadFile(
              req.file.path,
              s3Key,
              req.file.mimetype
            );

            // 로컬 임시 파일 삭제
            try {
              fs.unlinkSync(req.file.path);
            } catch (error) {
              console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
            }

            return res.json({
              success: true,
              message: '파일 업로드가 완료되었습니다.',
              data: {
                url: relativePath,
                image_url: relativePath,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
              },
            });
          }
        } else {
          // 이미지가 아닌 경우 원본 업로드 (하위 호환)
          const s3Key = `uploads/${req.file.filename}`;
          const relativePath = await s3Service.uploadFile(
            req.file.path,
            s3Key,
            req.file.mimetype
          );

          // 로컬 임시 파일 삭제
          try {
            fs.unlinkSync(req.file.path);
          } catch (error) {
            console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
          }

          return res.json({
            success: true,
            message: '파일 업로드가 완료되었습니다.',
            data: {
              url: relativePath,
              image_url: relativePath,
              filename: req.file.filename,
              originalName: req.file.originalname,
              size: req.file.size,
            },
          });
        }
      } catch (error: any) {
        console.error('❌ [이미지 업로드] 오류:', error);
        return res.status(500).json({
          success: false,
          message: error.message || '이미지 업로드 중 오류가 발생했습니다.',
        });
      }
    },
  ];

  /**
   * 다중 이미지 업로드
   * POST /api/upload/images
   */
  static uploadImages = [
    upload.array('images', 10), // 최대 10개
    async (req: Request, res: Response) => {
      try {
        if (!req.files || (Array.isArray(req.files) && req.files.length === 0)) {
          return res.status(400).json({
            success: false,
            message: '이미지 파일이 필요합니다.',
          });
        }

        const files = Array.isArray(req.files) ? req.files : [req.files];
        const uploadedImages = [];

        for (const file of files) {
          const multerFile = file as Express.Multer.File;
          const isImage = multerFile.mimetype.startsWith('image/');
          
          if (isImage) {
            // 이미지는 리사이징 및 썸네일 생성
            try {
              const fileBuffer = fs.readFileSync(multerFile.path);
              const {resizedBuffer, thumbnailBuffer} = await resizeAndCreateThumbnail(fileBuffer);
              
              // 리사이징된 원본 이미지 업로드
              const s3Key = `uploads/${multerFile.filename}`;
              const contentType = multerFile.mimetype;
              
              const relativePath = await s3Service.uploadBuffer(resizedBuffer, s3Key, contentType);
              
              // 썸네일 업로드
              const thumbnailFileName = `thumb-${multerFile.filename}`;
              const thumbnailS3Key = `uploads/${thumbnailFileName}`;
              
              await s3Service.uploadBuffer(thumbnailBuffer, thumbnailS3Key, contentType);
              
              // 로컬 임시 파일 삭제
              try {
                fs.unlinkSync(multerFile.path);
              } catch (error) {
                console.warn('⚠️ 로컬 임시 파일 삭제 실패:', multerFile.path);
              }

              uploadedImages.push({
                image_url: relativePath,
                url: relativePath,
                filename: multerFile.filename,
                originalName: multerFile.originalname,
                size: resizedBuffer.length,
              });
            } catch (resizeError) {
              console.error('❌ [다중 이미지 업로드] 이미지 리사이징 실패, 원본 업로드 시도:', resizeError);
              // 리사이징 실패 시 원본 업로드
              const s3Key = `uploads/${multerFile.filename}`;
              const relativePath = await s3Service.uploadFile(
                multerFile.path,
                s3Key,
                multerFile.mimetype
              );

              // 로컬 임시 파일 삭제
              try {
                fs.unlinkSync(multerFile.path);
              } catch (error) {
                console.warn('⚠️ 로컬 임시 파일 삭제 실패:', multerFile.path);
              }

              uploadedImages.push({
                image_url: relativePath,
                url: relativePath,
                filename: multerFile.filename,
                originalName: multerFile.originalname,
                size: multerFile.size,
              });
            }
          } else {
            // 이미지가 아닌 경우 원본 업로드
            const s3Key = `uploads/${multerFile.filename}`;
            const relativePath = await s3Service.uploadFile(
              multerFile.path,
              s3Key,
              multerFile.mimetype
            );

            // 로컬 임시 파일 삭제
            try {
              fs.unlinkSync(multerFile.path);
            } catch (error) {
              console.warn('⚠️ 로컬 임시 파일 삭제 실패:', multerFile.path);
            }

            uploadedImages.push({
              image_url: relativePath,
              url: relativePath,
              filename: multerFile.filename,
              originalName: multerFile.originalname,
              size: multerFile.size,
            });
          }
        }

        console.log('✅ [다중 이미지 업로드] S3 업로드 성공:', {
          count: uploadedImages.length,
        });

        return res.json({
          success: true,
          message: '이미지 업로드가 완료되었습니다.',
          data: {
            images: uploadedImages,
          },
        });
      } catch (error: any) {
        console.error('❌ [다중 이미지 업로드] 오류:', error);
        return res.status(500).json({
          success: false,
          message: error.message || '이미지 업로드 중 오류가 발생했습니다.',
        });
      }
    },
  ];

  /**
   * 채팅 미디어 업로드 (이미지/비디오)
   * POST /api/upload/chat-media
   * 파일 크기 제한: 50MB
   */
  static uploadChatMedia = [
    chatMediaUpload.single('media'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: '미디어 파일이 필요합니다.',
          });
        }

        // S3에 업로드 (상대 경로만 반환)
        const s3Key = `uploads/chat/${req.file.filename}`;
        const relativePath = await s3Service.uploadFile(
          req.file.path,
          s3Key,
          req.file.mimetype
        );

        // 로컬 임시 파일 삭제
        try {
          fs.unlinkSync(req.file.path);
        } catch (error) {
          console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
        }

        // 파일 타입 확인 (이미지/비디오)
        const isImage = req.file.mimetype.startsWith('image/');
        const isVideo = req.file.mimetype.startsWith('video/');

        console.log('✅ [채팅 미디어 업로드] S3 업로드 성공:', {
          originalName: req.file.originalname,
          filename: req.file.filename,
          size: req.file.size,
          mimetype: req.file.mimetype,
          type: isImage ? 'image' : isVideo ? 'video' : 'file',
          relativePath: relativePath,
        });

        return res.json({
          success: true,
          message: '미디어 업로드가 완료되었습니다.',
          data: {
            url: relativePath, // 상대 경로 (응답 미들웨어가 S3 URL로 변환)
            image_url: relativePath, // 하위 호환성
            filename: req.file.filename,
            originalName: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            type: isImage ? 'image' : isVideo ? 'video' : 'file',
          },
        });
      } catch (error: any) {
        console.error('❌ [채팅 미디어 업로드] 오류:', error);
        
        // 파일 크기 초과 오류 처리
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: '파일 크기가 너무 큽니다. 최대 50MB까지 업로드 가능합니다.',
          });
        }

        return res.status(500).json({
          success: false,
          message: error.message || '미디어 업로드 중 오류가 발생했습니다.',
        });
      }
    },
  ];

  /**
   * 프로필 이미지 업로드 (유저, 상점주, 광고주 모두 사용)
   * POST /api/upload/profile
   * uploads/profile/ 폴더에 저장
   * 리사이징 및 썸네일 생성 포함
   */
  static uploadProfile = [
    profileUpload.single('image'),
    async (req: Request, res: Response) => {
      try {
        if (!req.file) {
          return res.status(400).json({
            success: false,
            message: '이미지 파일이 필요합니다.',
          });
        }

        // 이미지인지 확인
        const isImage = req.file.mimetype.startsWith('image/');
        
        if (isImage) {
          // 이미지는 리사이징 및 썸네일 생성
          try {
            const fileBuffer = fs.readFileSync(req.file.path);
            const {resizedBuffer, thumbnailBuffer} = await resizeAndCreateThumbnail(fileBuffer);
            
            // 리사이징된 원본 이미지 업로드
            const s3Key = `uploads/profile/${req.file.filename}`;
            const contentType = req.file.mimetype;
            
            const relativePath = await s3Service.uploadBuffer(resizedBuffer, s3Key, contentType);
            console.log(`✅ [프로필 이미지 업로드] 리사이징된 이미지 S3 저장 완료: ${relativePath}`);
            
            // 썸네일 업로드
            const thumbnailFileName = `thumb-${req.file.filename}`;
            const thumbnailS3Key = `uploads/profile/${thumbnailFileName}`;
            
            await s3Service.uploadBuffer(thumbnailBuffer, thumbnailS3Key, contentType);
            console.log(`✅ [프로필 이미지 업로드] 썸네일 S3 저장 완료: uploads/profile/${thumbnailFileName}`);
            
            // 로컬 임시 파일 삭제
            try {
              fs.unlinkSync(req.file.path);
            } catch (error) {
              console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
            }

            console.log('✅ [프로필 이미지 업로드] S3 업로드 성공:', {
              originalName: req.file.originalname,
              filename: req.file.filename,
              size: req.file.size,
              relativePath: relativePath,
            });

            return res.json({
              success: true,
              message: '프로필 이미지 업로드가 완료되었습니다.',
              data: {
                url: relativePath, // 상대 경로 (응답 미들웨어가 S3 URL로 변환)
                image_url: relativePath, // 하위 호환성
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: resizedBuffer.length,
              },
            });
          } catch (resizeError) {
            console.error('❌ [프로필 이미지 업로드] 이미지 리사이징 실패, 원본 업로드 시도:', resizeError);
            // 리사이징 실패 시 원본 업로드 (하위 호환)
            const s3Key = `uploads/profile/${req.file.filename}`;
            const relativePath = await s3Service.uploadFile(
              req.file.path,
              s3Key,
              req.file.mimetype
            );

            // 로컬 임시 파일 삭제
            try {
              fs.unlinkSync(req.file.path);
            } catch (error) {
              console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
            }

            return res.json({
              success: true,
              message: '프로필 이미지 업로드가 완료되었습니다.',
              data: {
                url: relativePath,
                image_url: relativePath,
                filename: req.file.filename,
                originalName: req.file.originalname,
                size: req.file.size,
              },
            });
          }
        } else {
          // 이미지가 아닌 경우 원본 업로드 (하위 호환)
          const s3Key = `uploads/profile/${req.file.filename}`;
          const relativePath = await s3Service.uploadFile(
            req.file.path,
            s3Key,
            req.file.mimetype
          );

          // 로컬 임시 파일 삭제
          try {
            fs.unlinkSync(req.file.path);
          } catch (error) {
            console.warn('⚠️ 로컬 임시 파일 삭제 실패:', req.file.path);
          }

          return res.json({
            success: true,
            message: '파일 업로드가 완료되었습니다.',
            data: {
              url: relativePath,
              image_url: relativePath,
              filename: req.file.filename,
              originalName: req.file.originalname,
              size: req.file.size,
            },
          });
        }
      } catch (error: any) {
        console.error('❌ [프로필 이미지 업로드] 오류:', error);
        return res.status(500).json({
          success: false,
          message: error.message || '프로필 이미지 업로드 중 오류가 발생했습니다.',
        });
      }
    },
  ];

}


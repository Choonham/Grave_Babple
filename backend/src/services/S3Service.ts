import {S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand} from '@aws-sdk/client-s3';
import {getSignedUrl} from '@aws-sdk/s3-request-presigner';
import fs from 'fs';
import path from 'path';

/**
 * AWS S3 서비스
 * 파일 업로드, 다운로드, 삭제 기능 제공
 */
export class S3Service {
  private s3Client: S3Client;
  private bucketName: string;
  private baseUrl: string;
  private projectPrefix: string;

  constructor() {
    this.bucketName = process.env.AWS_S3_BUCKET_NAME || 'slowflowsoft-storage-bucket';
    this.projectPrefix = process.env.AWS_S3_PROJECT_PREFIX || 'babple';
    this.baseUrl = process.env.AWS_S3_BASE_URL || `https://${this.bucketName}.s3.ap-northeast-2.amazonaws.com/${this.projectPrefix}`;

    // IAM 역할 사용 시 credentials는 자동으로 인스턴스 메타데이터에서 가져옴
    // 액세스 키가 있으면 사용, 없으면 기본 자격 증명 체인 사용
    const credentials = process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY
      ? {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID,
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
        }
      : undefined;

    this.s3Client = new S3Client({
      region: process.env.AWS_REGION || 'ap-northeast-2',
      credentials,
    });
  }

  /**
   * 파일을 S3에 업로드
   * @param filePath 로컬 파일 경로
   * @param s3Key S3 객체 키 (경로, 프로젝트 접두사 제외)
   * @param contentType MIME 타입
   * @returns S3 URL
   */
  async uploadFile(
    filePath: string,
    s3Key: string,
    contentType?: string
  ): Promise<string> {
    try {
      const fileContent = fs.readFileSync(filePath);
      const fullS3Key = `${this.projectPrefix}/${s3Key}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
        Body: fileContent,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // DB에는 상대 경로만 저장 (예: uploads/profile/filename.jpg)
      // 응답 시에는 normalizeImageUrl로 전체 S3 URL로 변환
      console.log(`✅ [S3 업로드] 성공: ${fullS3Key} -> ${s3Key}`);
      return s3Key;
    } catch (error) {
      console.error(`❌ [S3 업로드] 실패: ${s3Key}`, error);
      throw error;
    }
  }

  /**
   * 버퍼를 S3에 업로드
   * @param buffer 파일 버퍼
   * @param s3Key S3 객체 키 (프로젝트 접두사 제외)
   * @param contentType MIME 타입
   * @returns S3 URL
   */
  async uploadBuffer(
    buffer: Buffer,
    s3Key: string,
    contentType?: string
  ): Promise<string> {
    try {
      const fullS3Key = `${this.projectPrefix}/${s3Key}`;

      const command = new PutObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
        Body: buffer,
        ContentType: contentType,
      });

      await this.s3Client.send(command);

      // DB에는 상대 경로만 저장 (예: uploads/profile/filename.jpg)
      // 응답 시에는 normalizeImageUrl로 전체 S3 URL로 변환
      console.log(`✅ [S3 업로드] 성공: ${fullS3Key} -> ${s3Key}`);
      return s3Key;
    } catch (error) {
      console.error(`❌ [S3 업로드] 실패: ${s3Key}`, error);
      throw error;
    }
  }

  /**
   * S3에서 파일 읽기 (문자열 반환 - 텍스트 파일용)
   * @param s3Key S3 객체 키 (프로젝트 접두사 포함 또는 제외)
   * @returns 파일 내용 (문자열)
   */
  async getFile(s3Key: string): Promise<string> {
    try {
      const fullS3Key = s3Key.startsWith(`${this.projectPrefix}/`) ? s3Key : `${this.projectPrefix}/${s3Key}`;

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
      });

      const response = await this.s3Client.send(command);
      const content = await response.Body?.transformToString() || '';
      
      console.log(`✅ [S3 파일 읽기] 성공: ${fullS3Key}`);
      return content;
    } catch (error) {
      console.error(`❌ [S3 파일 읽기] 실패: ${s3Key}`, error);
      throw error;
    }
  }

  /**
   * S3에서 파일 읽기 (Buffer 반환 - 바이너리 파일용)
   * @param s3Key S3 객체 키 (프로젝트 접두사 포함 또는 제외)
   * @returns 파일 내용 (Buffer)
   */
  async getFileBuffer(s3Key: string): Promise<Buffer | null> {
    try {
      // 앞의 / 제거 (S3 키는 상대 경로여야 함)
      let normalizedKey = s3Key.startsWith('/') ? s3Key.substring(1) : s3Key;
      
      // 이미 projectPrefix로 시작하는지 확인
      const fullS3Key = normalizedKey.startsWith(`${this.projectPrefix}/`) 
        ? normalizedKey 
        : `${this.projectPrefix}/${normalizedKey}`;

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        return null;
      }

      const arrayBuffer = await response.Body.transformToByteArray();
      const buffer = Buffer.from(arrayBuffer);
      
      console.log(`✅ [S3 파일 읽기] 성공: ${fullS3Key} (${buffer.length} bytes)`);
      return buffer;
    } catch (error) {
      console.error(`❌ [S3 파일 읽기] 실패: ${s3Key}`, error);
      return null;
    }
  }

  /**
   * S3에서 파일 삭제
   * @param s3Key S3 객체 키 (프로젝트 접두사 포함 또는 제외)
   */
  async deleteFile(s3Key: string): Promise<void> {
    try {
      const fullS3Key = s3Key.startsWith(`${this.projectPrefix}/`) ? s3Key : `${this.projectPrefix}/${s3Key}`;

      const command = new DeleteObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
      });

      await this.s3Client.send(command);
      console.log(`✅ [S3 삭제] 성공: ${fullS3Key}`);
    } catch (error) {
      console.error(`❌ [S3 삭제] 실패: ${s3Key}`, error);
      throw error;
    }
  }

  /**
   * S3 URL에서 S3 키 추출
   * @param url S3 URL
   * @returns S3 키 (프로젝트 접두사 포함)
   */
  extractKeyFromUrl(url: string): string {
    if (url.startsWith(this.baseUrl)) {
      return `${this.projectPrefix}/${url.replace(this.baseUrl + '/', '')}`;
    }
    // 기존 /uploads/ 경로 처리
    if (url.startsWith('/uploads/')) {
      return `${this.projectPrefix}/uploads/${url.replace('/uploads/', '')}`;
    }
    // 전체 S3 URL인 경우
    if (url.includes('.s3.') && url.includes('.amazonaws.com/')) {
      const urlParts = url.split('.amazonaws.com/');
      if (urlParts.length > 1 && urlParts[1]) {
        return urlParts[1];
      }
    }
    return url;
  }

  /**
   * 로컬 경로를 S3 키로 변환
   * @param localPath 로컬 파일 경로
   * @param prefix S3 키 접두사 (예: 'uploads', 'docs/terms')
   * @returns S3 키
   */
  localPathToS3Key(localPath: string, prefix: string = 'uploads'): string {
    const filename = path.basename(localPath);
    return `${prefix}/${filename}`;
  }

  /**
   * Pre-signed URL 생성 (임시 접근 URL)
   * @param s3Key S3 객체 키 (프로젝트 접두사 포함 또는 제외)
   * @param expiresIn 만료 시간 (초 단위, 기본 1시간)
   * @returns Pre-signed URL
   */
  async getPresignedUrl(s3Key: string, expiresIn: number = 3600): Promise<string> {
    try {
      const fullS3Key = s3Key.startsWith(`${this.projectPrefix}/`) ? s3Key : `${this.projectPrefix}/${s3Key}`;

      const command = new GetObjectCommand({
        Bucket: this.bucketName,
        Key: fullS3Key,
      });

      const url = await getSignedUrl(this.s3Client, command, {expiresIn});
      console.log(`✅ [Pre-signed URL 생성] ${fullS3Key} (만료: ${expiresIn}초)`);
      return url;
    } catch (error) {
      console.error(`❌ [Pre-signed URL 생성] 실패: ${s3Key}`, error);
      throw error;
    }
  }
}

// 싱글톤 인스턴스
export const s3Service = new S3Service();


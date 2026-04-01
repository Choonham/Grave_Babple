import sharp from 'sharp';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const publicDir = join(__dirname, '..', 'public');
const iconPath = join(publicDir, 'babpleIcon.png');

// 출력할 favicon 크기들
const sizes = [
  { size: 16, name: 'favicon-16x16.png' },
  { size: 32, name: 'favicon-32x32.png' },
  { size: 180, name: 'apple-touch-icon.png' },
  { size: 192, name: 'android-chrome-192x192.png' },
  { size: 512, name: 'android-chrome-512x512.png' },
];

async function generateFavicons() {
  try {
    // 원본 아이콘 파일 확인
    if (!existsSync(iconPath)) {
      console.error(`❌ 아이콘 파일을 찾을 수 없습니다: ${iconPath}`);
      process.exit(1);
    }

    console.log(`✅ 원본 아이콘 찾음: ${iconPath}`);
    
    // 각 크기의 favicon 생성
    for (const { size, name } of sizes) {
      const outputPath = join(publicDir, name);
      
      await sharp(iconPath)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 0, g: 0, b: 0, alpha: 0 }
        })
        .png()
        .toFile(outputPath);
      
      console.log(`✅ 생성 완료: ${name} (${size}x${size})`);
    }

    // favicon.ico 생성 (16x16과 32x32를 포함)
    const favicon16 = await sharp(iconPath)
      .resize(16, 16, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    const favicon32 = await sharp(iconPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toBuffer();

    // 간단한 .ico 파일 생성 (실제로는 PNG를 사용하는 것이 더 현대적)
    // 대부분의 브라우저는 PNG favicon을 지원하므로 favicon-32x32.png를 favicon.ico로 복사
    await sharp(iconPath)
      .resize(32, 32, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 }
      })
      .png()
      .toFile(join(publicDir, 'favicon.ico'));

    console.log(`✅ 생성 완료: favicon.ico`);
    console.log(`\n✨ 모든 favicon 생성이 완료되었습니다!`);
    
  } catch (error) {
    console.error('❌ 오류 발생:', error);
    process.exit(1);
  }
}

generateFavicons();


import nodemailer, {Transporter} from 'nodemailer';

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_SECURE = process.env.SMTP_SECURE === 'true' || SMTP_PORT === 465;
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const EMAIL_FROM = process.env.EMAIL_FROM || SMTP_USER || 'no-reply@babple.com';

let transporter: Transporter | null = null;

const ensureTransporter = (): Transporter => {
  if (transporter) {
    return transporter;
  }

  if (!SMTP_HOST) {
    throw new Error(
      'SMTP_HOST 환경 변수가 설정되지 않았습니다. 이메일 전송을 위해 SMTP 설정을 구성해주세요.',
    );
  }

  if (!SMTP_USER || !SMTP_PASS) {
    throw new Error(
      'SMTP_USER 또는 SMTP_PASS 환경 변수가 설정되지 않았습니다. 인증 가능한 SMTP 계정을 설정해주세요.',
    );
  }

  console.log('📧 [이메일 서비스] SMTP 설정:');
  console.log(`   - Host: ${SMTP_HOST}`);
  console.log(`   - Port: ${SMTP_PORT}`);
  console.log(`   - Secure: ${SMTP_SECURE}`);
  console.log(`   - User: ${SMTP_USER}`);
  console.log(`   - From: ${EMAIL_FROM}`);

  transporter = nodemailer.createTransport({
    host: SMTP_HOST,
    port: SMTP_PORT,
    secure: SMTP_SECURE,
    auth: {
      user: SMTP_USER,
      pass: SMTP_PASS,
    },
    // 연결 타임아웃 설정
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 10000,
  });

  return transporter;
};

export class EmailService {
  /**
   * 인증 코드 이메일 전송
   */
  static async sendVerificationCode(recipient: string, code: string) {
    const mailer = ensureTransporter();

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 이메일 인증</h2>
        <p>아래 인증 코드를 앱에 입력하여 이메일 인증을 완료해주세요.</p>
        <p style="font-size: 32px; font-weight: bold; letter-spacing: 4px; color: #FF7A5A; text-align: center; margin: 24px 0;">
          ${code}
        </p>
        <p style="color: #555555;">해당 코드는 5분 동안만 유효하며, 타인과 공유하지 마세요.</p>
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">잘못 수신한 메일이라면 이 메시지를 무시해주세요.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: recipient,
      subject: '[Babple] 이메일 인증 코드 안내',
      html,
    });
  }

  /**
   * 신고 처리 결과 이메일 전송
   */
  static async sendReportResultEmail(
    recipient: string,
    recipientName: string,
    reportedUserName: string,
    reportReason: string,
    penaltyAction: string,
    adminComment?: string,
  ) {
    const mailer = ensureTransporter();

    // 제제 조치에 따른 메시지 생성
    let actionMessage = '';
    let penaltyDetail = '';

    switch (penaltyAction) {
      case 'WARNING':
        actionMessage = '경고 조치';
        penaltyDetail = '경고 조치가 적용되었습니다.';
        break;
      case 'SUSPEND_7DAYS':
        actionMessage = '7일 계정 정지';
        penaltyDetail = '7일간 계정이 정지되었습니다.';
        break;
      case 'SUSPEND_30DAYS':
        actionMessage = '30일 계정 정지';
        penaltyDetail = '30일간 계정이 정지되었습니다.';
        break;
      case 'BAN':
        actionMessage = '영구 정지';
        penaltyDetail = '계정이 영구적으로 정지되었습니다.';
        break;
      case 'NONE':
        actionMessage = '조치 없음';
        penaltyDetail = '검토 결과 조치가 필요하지 않은 것으로 판단되었습니다.';
        break;
      default:
        actionMessage = '처리 완료';
        penaltyDetail = '신고가 처리되었습니다.';
    }

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 신고 처리 결과 안내</h2>
        <p>안녕하세요, ${recipientName}님.</p>
        <p>제출해주신 신고가 검토되어 처리되었습니다.</p>
        
        <div style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #333;">신고 정보</h3>
          <p><strong>신고 대상:</strong> ${reportedUserName}</p>
          <p><strong>신고 사유:</strong> ${reportReason}</p>
          <p><strong>처리 결과:</strong> ${actionMessage}</p>
          ${adminComment ? `<p><strong>관리자 코멘트:</strong><br>${adminComment}</p>` : ''}
        </div>
        
        <p>${penaltyDetail}</p>
        
        <p style="color: #555555;">추가 문의사항이 있으시면 고객센터로 연락해주세요.</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 신고 처리 완료 알림을 위해 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: recipient,
      subject: '[Babple] 신고 처리 결과 안내',
      html,
    });
  }

  /**
   * 테스트 신청 이메일 전송
   */
  static async sendTestApplicationEmail(
    applicantName: string,
    applicantEmail: string,
    platform: 'android' | 'ios',
  ) {
    const mailer = ensureTransporter();
    const recipientEmail = 'support@slowflowsoft.com';

    const platformName = platform === 'android' ? 'Android' : 'iOS';
    const currentDate = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 알파 테스트 신청</h2>
        <p>새로운 알파 테스트 신청이 접수되었습니다.</p>
        
        <div style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #333;">신청자 정보</h3>
          <p><strong>이름:</strong> ${applicantName}</p>
          <p><strong>이메일:</strong> ${applicantEmail}</p>
          <p><strong>플랫폼:</strong> ${platformName}</p>
          <p><strong>신청 일시:</strong> ${currentDate}</p>
        </div>
        
        <p style="color: #555555;">신청자에게 테스트 안내를 진행해주세요.</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 Babple 웹사이트의 테스트 신청 폼을 통해 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `[Babple] 알파 테스트 신청 - ${applicantName} (${platformName})`,
      html,
      replyTo: applicantEmail, // 답장 시 신청자 이메일로 답장 가능하도록
    });
  }

  /**
   * 테스트 신청 관리자용 이메일 전송 (링크 포함)
   */
  static async sendTestApplicationEmailToAdmin(
    applicantName: string,
    applicantEmail: string,
    platform: 'android' | 'ios',
    applicationId: string,
    adminLink: string,
  ) {
    const mailer = ensureTransporter();
    const recipientEmail = 'support@slowflowsoft.com';

    const platformName = platform === 'android' ? 'Android' : 'iOS';
    const currentDate = new Date().toLocaleString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 알파 테스트 신청</h2>
        <p>새로운 알파 테스트 신청이 접수되었습니다.</p>
        
        <div style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <h3 style="margin-top: 0; color: #333;">신청자 정보</h3>
          <p><strong>이름:</strong> ${applicantName}</p>
          <p><strong>이메일:</strong> ${applicantEmail}</p>
          <p><strong>플랫폼:</strong> ${platformName}</p>
          <p><strong>신청 일시:</strong> ${currentDate}</p>
        </div>
        
        <div style="background-color: #E8F4F8; padding: 16px; border-radius: 8px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 16px 0; font-weight: 600; color: #333;">테스트 링크를 입력하고 신청자에게 전송하려면 아래 버튼을 클릭하세요:</p>
          <a href="${adminLink}" 
             style="display: inline-block; background-color: #FF7A5A; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: 600;">
            테스트 링크 입력하기
          </a>
        </div>
        
        <p style="color: #555555;">링크를 클릭하면 테스트 링크를 입력할 수 있는 페이지로 이동합니다.</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 Babple 웹사이트의 테스트 신청 폼을 통해 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: recipientEmail,
      subject: `[Babple] 알파 테스트 신청 - ${applicantName} (${platformName})`,
      html,
      replyTo: applicantEmail,
    });
  }

  /**
   * 테스트 신청 확인 이메일 전송 (신청자에게)
   */
  static async sendTestApplicationConfirmationEmail(
    applicantName: string,
    applicantEmail: string,
    platform: 'android' | 'ios',
  ) {
    const mailer = ensureTransporter();
    const platformName = platform === 'android' ? 'Android' : 'iOS';

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 알파 테스트 신청 확인</h2>
        <p>안녕하세요, ${applicantName}님.</p>
        <p>${platformName} 버전 알파 테스트 신청이 정상적으로 접수되었습니다.</p>
        
        <div style="background-color: #F5F5F5; padding: 16px; border-radius: 8px; margin: 24px 0;">
          <p style="margin: 0;"><strong>신청 플랫폼:</strong> ${platformName}</p>
          <p style="margin: 8px 0 0 0;"><strong>신청 일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
        </div>
        
        <p>테스트 링크는 검토 후 곧 발송해드리겠습니다. 잠시만 기다려주세요.</p>
        <p style="color: #555555;">추가 문의사항이 있으시면 언제든지 연락주세요.</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 테스트 신청 확인을 위해 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: applicantEmail,
      subject: `[Babple] 알파 테스트 신청 확인 - ${platformName}`,
      html,
    });
  }

  /**
   * 테스트 링크 전송 이메일 (신청자에게)
   */
  static async sendTestLinkEmail(
    applicantName: string,
    applicantEmail: string,
    platform: 'android' | 'ios',
    testLink: string,
  ) {
    const mailer = ensureTransporter();
    const platformName = platform === 'android' ? 'Android' : 'iOS';

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 알파 테스트 링크</h2>
        <p>안녕하세요, ${applicantName}님.</p>
        <p>${platformName} 버전 알파 테스트에 참여해주셔서 감사합니다!</p>
        
        <div style="background-color: #E8F4F8; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 16px 0; font-weight: 600; color: #333;">아래 링크를 클릭하여 테스트 앱을 다운로드하세요:</p>
          <a href="${testLink}" 
             style="display: inline-block; background-color: #FF7A5A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            ${platformName} 테스트 앱 다운로드
          </a>
        </div>
        
        <p style="color: #555555;">테스트 중 궁금한 점이나 문제가 발생하면 언제든지 연락주세요.</p>
        <p style="color: #555555;">소중한 피드백 부탁드립니다!</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 Babple 알파 테스트 링크 발송을 위해 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: applicantEmail,
      subject: `[Babple] ${platformName} 알파 테스트 링크`,
      html,
    });
  }

  /**
   * 회원 탈퇴 링크 이메일 전송
   */
  static async sendAccountDeletionLinkEmail(
    userName: string,
    userEmail: string,
    deletionLink: string,
  ) {
    const mailer = ensureTransporter();

    const html = `
      <div style="font-family: 'Pretendard', 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif; line-height: 1.6; color: #1A1A1A;">
        <h2 style="color: #FF7A5A;">Babple 회원 탈퇴 안내</h2>
        <p>안녕하세요, ${userName}님.</p>
        <p>회원 탈퇴 요청이 접수되었습니다.</p>
        
        <div style="background-color: #FFF3E0; padding: 20px; border-radius: 8px; margin: 24px 0; border-left: 4px solid #FF9800;">
          <p style="margin: 0 0 12px 0; font-weight: 600; color: #E65100;">⚠️ 탈퇴 전 확인사항</p>
          <ul style="margin: 0; padding-left: 20px; color: #555;">
            <li>탈퇴 후 90일간 계정 복구가 가능합니다.</li>
            <li>90일 후에는 모든 데이터가 영구적으로 삭제됩니다.</li>
            <li>작성한 레시피, 댓글, 좋아요 등 모든 활동 내역이 삭제됩니다.</li>
          </ul>
        </div>
        
        <div style="background-color: #E8F4F8; padding: 24px; border-radius: 8px; margin: 24px 0; text-align: center;">
          <p style="margin: 0 0 16px 0; font-weight: 600; color: #333;">아래 링크를 클릭하여 회원 탈퇴를 완료하세요:</p>
          <a href="${deletionLink}" 
             style="display: inline-block; background-color: #FF7A5A; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 16px;">
            회원 탈퇴 완료하기
          </a>
        </div>
        
        <p style="color: #666; font-size: 14px;">이 링크는 24시간 동안만 유효하며, 한 번 사용하면 무효화됩니다.</p>
        <p style="color: #666; font-size: 14px;">요청하지 않은 경우 이 메일을 무시해주세요.</p>
        
        <hr style="border: none; border-top: 1px solid #EEE; margin: 32px 0;" />
        <p style="font-size: 12px; color: #999;">이 메일은 회원 탈퇴 요청에 따라 자동으로 발송되었습니다.</p>
      </div>
    `;

    await mailer.sendMail({
      from: EMAIL_FROM,
      to: userEmail,
      subject: '[Babple] 회원 탈퇴 안내',
      html,
    });
  }
}



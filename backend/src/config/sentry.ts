import * as Sentry from '@sentry/node';
// @sentry/profiling-node는 자동으로 통합됩니다

/**
 * Sentry 초기화 함수
 * 에러 추적 및 성능 모니터링을 위한 Sentry 설정
 */
export const initializeSentry = () => {
    if (!process.env.SENTRY_DSN) {
        console.log('⚠️ [Sentry] SENTRY_DSN이 설정되지 않았습니다. Sentry를 비활성화합니다.');
        return;
    }

    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',

        // 성능 모니터링 샘플링 비율
        // Production: 10% (비용 절감), Development: 100% (전체 추적)
        tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // 프로파일링 샘플링 비율
        profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,

        // 릴리스 버전 추적 (package.json의 version 사용)
        release: `babple-backend@${process.env.npm_package_version || 'unknown'}`,

        // 민감한 데이터 필터링
        beforeSend(event, hint) {
            // 요청 데이터에서 민감한 정보 제거
            if (event.request?.data) {
                const data = event.request.data as any;

                // 비밀번호 관련
                if (data.password) delete data.password;
                if (data.newPassword) delete data.newPassword;
                if (data.currentPassword) delete data.currentPassword;

                // 토큰 관련
                if (data.token) delete data.token;
                if (data.accessToken) delete data.accessToken;
                if (data.refreshToken) delete data.refreshToken;
                if (data.fcmToken) delete data.fcmToken;

                // 기타 민감한 정보
                if (data.socialToken) delete data.socialToken;
                if (data.idToken) delete data.idToken;
            }

            // 요청 헤더에서 민감한 정보 제거
            if (event.request?.headers) {
                const headers = event.request.headers as any;
                if (headers.authorization) delete headers.authorization;
                if (headers.Authorization) delete headers.Authorization;
            }

            return event;
        },
    });

    console.log(`✅ [Sentry] Sentry 초기화 완료 (환경: ${process.env.NODE_ENV})`);
    console.log(`📊 [Sentry] 성능 샘플링 비율: ${process.env.NODE_ENV === 'production' ? '10%' : '100%'}`);
};

import {StyleSheet} from 'react-native';

/**
 * Babple 앱 전역 색상 정의
 * 디자인 컨셉: "따뜻하고 부드러운, 맛있는 디자인"
 */
export const colors = {
  // Primary Colors
  primary: '#2ECC71', // 부드러운 당근/홍시 색 (핵심 액션)
  secondary: '#dfffee', // 따뜻한 미색/베이지 (카드 배경 등)
  accent: '#FF5252', // 생기 있는 토마토 레드 (좋아요 활성, 알림 배지)

  // Grayscale Colors
  white: '#FFFFFF',
  offWhite: '#F7F7F7', // 화면 배경, 섹션 배경
  lightGray: '#DCDCDC', // 테두리, 구분선
  mediumGray: '#999999', // 비활성 요소, 보조 정보 텍스트
  darkGray: '#555555', // 본문 보조 텍스트
  almostBlack: '#1A1A1A', // 가장 중요한 본문 텍스트

  // Background Colors (Semantic)
  background: '#F7F7F7', // 기본 화면 배경 (Off White)
  backgroundInput: '#F7F7F7', // TextArea 배경 (Off White)
  backgroundCard: '#FFFFFF', // 기본 카드 배경 (White for contrast)
  backgroundPress: '#F0F0F0', // 터치 피드백용 연한 회색

  // Text Colors (Semantic)
  textPrimary: '#1A1A1A', // Almost Black
  textSecondary: '#555555', // Dark Gray
  textTertiary: '#999999', // Medium Gray
  textWhite: '#FFFFFF',
  textPrimaryOnPrimary: '#FFFFFF', // Primary 배경 위의 흰색 텍스트
  textError: '#E74C3C', // 오류 텍스트

  // System Colors
  success: '#2ECC71', // 성공 상태
  error: '#E74C3C', // 오류 상태
  warning: '#F1C40F', // 경고 상태

  // Social Colors (Optional)
  kakao: '#FEE500',
  naver: '#03C75A',
};

/**
 * 다크 모드 색상 정의
 */
export const darkColors = {
  // Primary Colors (다크 모드에서도 동일하게 유지)
  primary: '#2ECC71',
  secondary: '#2A3A2E',
  accent: '#FF5252',

  // Grayscale Colors
  white: '#1A1A1A',
  offWhite: '#252525',
  lightGray: '#404040',
  mediumGray: '#707070',
  darkGray: '#B0B0B0',
  almostBlack: '#FFFFFF',

  // Background Colors (Semantic)
  background: '#121212',
  backgroundInput: '#1E1E1E',
  backgroundCard: '#1A1A1A',
  backgroundPress: '#2A2A2A',

  // Text Colors (Semantic)
  textPrimary: '#FFFFFF',
  textSecondary: '#B0B0B0',
  textTertiary: '#707070',
  textWhite: '#FFFFFF',
  textPrimaryOnPrimary: '#FFFFFF',
  textError: '#FF5252',

  // System Colors
  success: '#2ECC71',
  error: '#FF5252',
  warning: '#F1C40F',

  // Social Colors
  kakao: '#FEE500',
  naver: '#03C75A',
};

/**
 * Babple 앱 타이포그래피 정의
 * 기본 서체: Pretendard (폰트 파일은 /assets/fonts에 포함 필요)
 */
export const typography = {
  h1: {
    fontSize: 24,
    fontWeight: '700' as const,
    lineHeight: 34,
    fontFamily: 'Pretendard-Regular',
  }, // 화면 제목
  h2: {
    fontSize: 20,
    fontWeight: '700' as const,
    lineHeight: 28,
    fontFamily: 'Pretendard-Regular',
  }, // 섹션 제목
  bodyRegular: {
    fontSize: 16,
    fontWeight: '400' as const,
    lineHeight: 24,
    fontFamily: 'Pretendard-Regular',
  }, // 본문 기본
  bodyMedium: {
    fontSize: 16,
    fontWeight: '500' as const,
    lineHeight: 24,
    fontFamily: 'Pretendard-Regular',
  }, // 본문 강조, 버튼 텍스트
  captionRegular: {
    fontSize: 14,
    fontWeight: '400' as const,
    lineHeight: 20,
    fontFamily: 'Pretendard-Regular',
  }, // 부가 정보
  captionMedium: {
    fontSize: 14,
    fontWeight: '500' as const,
    lineHeight: 20,
    fontFamily: 'Pretendard-Regular',
  }, // 부가 정보 강조
  infoRegular: {
    fontSize: 12,
    fontWeight: '300' as const,
    lineHeight: 18,
    fontFamily: 'Pretendard-Regular',
  }, // 가장 작은 정보 (Light)
  infoMedium: {
    fontSize: 12,
    fontWeight: '500' as const,
    lineHeight: 18,
    fontFamily: 'Pretendard-Regular',
  }, // 작은 정보 강조 (뱃지 등)
};

/**
 * Babple 앱 간격 정의
 * 8pt 그리드 시스템 기반
 */
export const spacing = {
  xs: 4, // 아이콘-텍스트 등 미세 간격
  s: 8, // 작은 버튼 내부, 칩 간격, 태그 내부
  m: 16, // 기본 간격 (카드 내부 여백, 리스트 아이템 간격 등)
  l: 24, // 화면 좌우 여백, 카드 간격
  xl: 32, // 섹션 간격
  xxl: 48, // 큰 콘텐츠 블록 간격
};

/**
 * Babple 앱 모서리 둥글기 정의
 */
export const borderRadius = {
  s: 8, // 버튼, 입력창, 태그
  m: 16, // 카드, 주요 컨테이너
  l: 24, // 모달, 바텀시트 상단
  full: 999, // 원형 (Avatar, 원형 버튼)
};

/**
 * Babple 앱 그림자 정의
 * React Native에서는 shadowColor, shadowOffset, shadowOpacity, shadowRadius (iOS)
 * elevation (Android)을 조합하여 구현
 */
export const shadows = {
  card: {
    // 일반 카드 그림자
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 4},
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 5,
  },
  modal: {
    // 모달처럼 더 강조된 그림자
    shadowColor: colors.almostBlack,
    shadowOffset: {width: 0, height: 8},
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 10,
  },
};

/**
 * Babple 앱 테마 객체
 */
export const theme = {
  colors,
  typography,
  spacing,
  borderRadius,
  shadows,
};

/**
 * TypeScript 타입 정의
 */
export type ThemeType = typeof theme;

/**
 * 공통 스타일 정의
 * 앱 전반에 걸쳐 일관된 UI를 위한 스타일을 정의합니다.
 */
const commonStyles = StyleSheet.create({
  // Container
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
  paddingContainer: {
    flex: 1,
    padding: spacing.m,
    backgroundColor: colors.background,
  },
  contentContainer: {
    flexGrow: 1,
    paddingVertical: spacing.s,
  },

  // Typography
  h1: {
    ...typography.h1,
    color: colors.textPrimary,
    marginBottom: spacing.s,
  },
  h2: {
    ...typography.h2,
    color: colors.textPrimary,
    marginBottom: spacing.s,
  },
  bodyText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
  bodyMediumText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  captionText: {
    ...typography.captionRegular,
    color: colors.textSecondary,
  },
  captionMediumText: {
    ...typography.captionMedium,
    color: colors.textSecondary,
  },
  infoText: {
    ...typography.infoRegular,
    color: colors.textTertiary,
  },
  infoMediumText: {
    ...typography.infoMedium,
    color: colors.textTertiary,
  },

  // Buttons
  primaryButton: {
    backgroundColor: colors.primary,
    borderRadius: borderRadius.s,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimaryOnPrimary,
  },
  secondaryButton: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  dangerButton: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.s,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerButtonText: {
    ...typography.bodyMedium,
    color: colors.textWhite,
  },

  // Inputs
  input: {
    backgroundColor: colors.backgroundInput,
    borderRadius: borderRadius.s,
    borderWidth: 1,
    borderColor: colors.lightGray,
    padding: spacing.m,
    ...typography.bodyRegular,
    color: colors.textPrimary,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.error,
  },

  // Cards
  card: {
    backgroundColor: colors.backgroundCard,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    ...shadows.card,
  },
  cardPressed: {
    backgroundColor: colors.backgroundPress,
  },

  // Modal
  modal: {
    backgroundColor: colors.white,
    borderRadius: borderRadius.l,
    padding: spacing.m,
    ...shadows.modal,
  },

  // Loading
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.l,
  },
  loadingText: {
    marginLeft: spacing.s,
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },

  // Error
  errorContainer: {
    backgroundColor: colors.error,
    borderRadius: borderRadius.s,
    padding: spacing.m,
    marginVertical: spacing.s,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    ...typography.captionRegular,
    color: colors.textWhite,
  },

  // Spacing Utilities
  marginTopXS: {marginTop: spacing.xs},
  marginTopS: {marginTop: spacing.s},
  marginTopM: {marginTop: spacing.m},
  marginTopL: {marginTop: spacing.l},
  marginTopXL: {marginTop: spacing.xl},
  marginTopXXL: {marginTop: spacing.xxl},

  marginBottomXS: {marginBottom: spacing.xs},
  marginBottomS: {marginBottom: spacing.s},
  marginBottomM: {marginBottom: spacing.m},
  marginBottomL: {marginBottom: spacing.l},
  marginBottomXL: {marginBottom: spacing.xl},
  marginBottomXXL: {marginBottom: spacing.xxl},

  marginLeftXS: {marginLeft: spacing.xs},
  marginLeftS: {marginLeft: spacing.s},
  marginLeftM: {marginLeft: spacing.m},
  marginLeftL: {marginLeft: spacing.l},
  marginLeftXL: {marginLeft: spacing.xl},
  marginLeftXXL: {marginLeft: spacing.xxl},

  marginRightXS: {marginRight: spacing.xs},
  marginRightS: {marginRight: spacing.s},
  marginRightM: {marginRight: spacing.m},
  marginRightL: {marginRight: spacing.l},
  marginRightXL: {marginRight: spacing.xl},
  marginRightXXL: {marginRight: spacing.xxl},

  paddingXS: {padding: spacing.xs},
  paddingS: {padding: spacing.s},
  paddingM: {padding: spacing.m},
  paddingL: {padding: spacing.l},
  paddingXL: {padding: spacing.xl},
  paddingXXL: {padding: spacing.xxl},

  // Flexbox Utilities
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowSpaceBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowSpaceAround: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  rowWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  column: {
    flexDirection: 'column',
  },
  alignCenter: {
    alignItems: 'center',
  },
  justifyCenter: {
    justifyContent: 'center',
  },
});

export default commonStyles;

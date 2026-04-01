/**
 * 날짜 관련 유틸리티 함수
 * 한국 표준시(KST, UTC+9) 기준 날짜 처리
 */

/**
 * 현재 시간을 한국 표준시(KST) 기준으로 가져옵니다.
 * 시간은 00:00:00.000으로 설정됩니다.
 * 
 * @returns KST 기준 현재 날짜 (시간: 00:00:00.000)
 */
export function getKSTDate(): Date {
  const now = new Date();
  // 한국 시간대로 변환 (UTC+9)
  const kstNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kstNow.setHours(0, 0, 0, 0);
  return kstNow;
}

/**
 * 주어진 Date 객체를 KST 기준 날짜로 변환합니다.
 * 시간은 00:00:00.000으로 설정됩니다.
 * 
 * @param date 변환할 Date 객체
 * @returns KST 기준 날짜 (시간: 00:00:00.000)
 */
export function toKSTDate(date: Date): Date {
  const kstDate = new Date(date.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
  kstDate.setHours(0, 0, 0, 0);
  return kstDate;
}

/**
 * 두 날짜가 KST 기준으로 같은 날인지 비교합니다.
 * 
 * @param date1 첫 번째 날짜
 * @param date2 두 번째 날짜
 * @returns 같은 날이면 true, 아니면 false
 */
export function isSameDayKST(date1: Date, date2: Date): boolean {
  const kst1 = toKSTDate(date1);
  const kst2 = toKSTDate(date2);
  return kst1.getTime() === kst2.getTime();
}

/**
 * 날짜가 특정 기간 내에 있는지 KST 기준으로 확인합니다.
 * 
 * @param targetDate 확인할 날짜
 * @param startDate 시작 날짜
 * @param endDate 종료 날짜
 * @returns 기간 내에 있으면 true, 아니면 false
 */
export function isDateInRangeKST(targetDate: Date, startDate: Date, endDate: Date): boolean {
  const target = toKSTDate(targetDate);
  const start = toKSTDate(startDate);
  const end = toKSTDate(endDate);
  
  return target >= start && target <= end;
}




/**
 * 소수점을 분수로 변환하는 유틸리티 함수
 * 단위가 g, ml, l이 아닐 때만 분수로 표시
 */

const COMMON_FRACTIONS: Array<{value: number; numerator: number; denominator: number}> = [
  {value: 0.125, numerator: 1, denominator: 8},
  {value: 0.25, numerator: 1, denominator: 4},
  {value: 0.333, numerator: 1, denominator: 3},
  {value: 0.375, numerator: 3, denominator: 8},
  {value: 0.5, numerator: 1, denominator: 2},
  {value: 0.625, numerator: 5, denominator: 8},
  {value: 0.666, numerator: 2, denominator: 3},
  {value: 0.75, numerator: 3, denominator: 4},
  {value: 0.875, numerator: 7, denominator: 8},
];

const DECIMAL_FRACTIONS: Array<{value: number; numerator: number; denominator: number}> = [
  {value: 0.1, numerator: 1, denominator: 10},
  {value: 0.2, numerator: 1, denominator: 5},
  {value: 0.3, numerator: 3, denominator: 10},
  {value: 0.4, numerator: 2, denominator: 5},
  {value: 0.6, numerator: 3, denominator: 5},
  {value: 0.7, numerator: 7, denominator: 10},
  {value: 0.8, numerator: 4, denominator: 5},
  {value: 0.9, numerator: 9, denominator: 10},
];

/**
 * 최대공약수 계산 (GCD)
 */
const gcd = (a: number, b: number): number => {
  return b === 0 ? a : gcd(b, a % b);
};

/**
 * 소수를 분수로 변환
 */
const decimalToFraction = (decimal: number): {numerator: number; denominator: number} | null => {
  // 정수인 경우
  if (Number.isInteger(decimal)) {
    return null;
  }

  // 일반적인 분수 확인 (정확한 값)
  for (const frac of COMMON_FRACTIONS) {
    if (Math.abs(decimal - frac.value) < 0.01) {
      return {numerator: frac.numerator, denominator: frac.denominator};
    }
  }

  // 십진수 분수 확인 (0.1, 0.2 등)
  for (const frac of DECIMAL_FRACTIONS) {
    if (Math.abs(decimal - frac.value) < 0.01) {
      return {numerator: frac.numerator, denominator: frac.denominator};
    }
  }

  // 근사치로 분수 계산
  const precision = 10000; // 소수점 4자리까지 정확도
  let numerator = Math.round(decimal * precision);
  let denominator = precision;

  // 최대공약수로 약분
  const divisor = gcd(numerator, denominator);
  numerator = numerator / divisor;
  denominator = denominator / divisor;

  // 분모가 너무 크면 분수로 표시하지 않음 (예: 0.1234)
  if (denominator > 20) {
    return null;
  }

  return {numerator, denominator};
};

/**
 * 재료 수량 포맷팅
 * 단위가 g, ml, l이 아닐 때만 소수점을 분수로 변환
 * @param value 수량 문자열
 * @param unit 단위
 * @returns 포맷된 수량 문자열
 */
export const formatIngredientAmount = (value: string, unit: string): string => {
  // 단위가 g, ml, l이면 소수점 유지
  const weightOrVolumeUnits = ['g', 'ml', 'l', 'kg', 'mg', 'g/ml'];
  const normalizedUnit = unit.toLowerCase().trim();

  if (weightOrVolumeUnits.some(u => normalizedUnit === u.toLowerCase())) {
    return `${value} ${unit}`;
  }

  // 숫자 파싱
  const numValue = parseFloat(value);
  if (isNaN(numValue)) {
    return `${value} ${unit}`;
  }

  // 정수인 경우 그대로 반환
  if (Number.isInteger(numValue)) {
    return `${value} ${unit}`;
  }

  // 분수로 변환
  const fraction = decimalToFraction(numValue);
  if (!fraction) {
    return `${value} ${unit}`;
  }

  // 정수 부분과 소수 부분 분리
  const integerPart = Math.floor(numValue);
  const hasIntegerPart = integerPart > 0;

  // 분수 문자열 생성
  let fractionStr = `${fraction.numerator}/${fraction.denominator}`;

  // 정수 부분이 있으면 함께 표시
  if (hasIntegerPart) {
    return `${integerPart} ${fractionStr} ${unit}`;
  }

  return `${fractionStr} ${unit}`;
};


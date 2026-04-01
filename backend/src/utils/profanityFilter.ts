import {profanity, ProfanityOptions} from '@2toad/profanity';
import {koreanProfanityList, englishProfanityList} from './korean-profanity-list';

/**
 * Profanity 필터 초기화
 * - 한국어 욕설 리스트 추가
 * - 영어 욕설 리스트 추가 (기본 제공 + 커스텀)
 */
class ProfanityFilter {
  private initialized = false;

  /**
   * 필터 초기화 (lazy initialization)
   */
  private initialize() {
    if (this.initialized) {
      return;
    }

    // 한국어 욕설 추가
    profanity.addWords(koreanProfanityList);

    // 추가 영어 욕설 (기본 제공 외 추가)
    profanity.addWords(englishProfanityList);

    this.initialized = true;

    console.log('✅ [ProfanityFilter] 필터 초기화 완료');
    console.log(`   - 한국어 욕설: ${koreanProfanityList.length}개`);
    console.log(`   - 영어 욕설: ${englishProfanityList.length}개`);
  }

  /**
   * 텍스트에 욕설이 포함되어 있는지 확인
   * @param text 확인할 텍스트
   * @returns 욕설 포함 여부
   */
  isProfane(text: string): boolean {
    this.initialize();

    if (!text || typeof text !== 'string') {
      return false;
    }

    const normalized = text.trim().toLowerCase();

    if (normalized.length === 0) {
      return false;
    }

    // 1. Profanity 라이브러리로 영어 욕설 체크
    const hasEnglishProfanity = profanity.exists(normalized);

    // 2. 한국어 욕설 직접 체크 (라이브러리가 한국어를 제대로 인식 못할 수 있음)
    let hasKoreanProfanity = false;
    for (const word of koreanProfanityList) {
      const lowerWord = word.toLowerCase();
      // 단어 경계를 고려한 매칭
      if (normalized === lowerWord || normalized.includes(lowerWord)) {
        hasKoreanProfanity = true;
        break;
      }
    }

    const hasProfanity = hasEnglishProfanity || hasKoreanProfanity;

    if (hasProfanity) {
      console.log(`🚫 [ProfanityFilter] 부적절한 표현 감지: "${text}"`);
    }

    return hasProfanity;
  }

  /**
   * 텍스트의 욕설을 별표(*)로 대체
   * @param text 원본 텍스트
   * @returns 욕설이 대체된 텍스트
   */
  censor(text: string): string {
    this.initialize();

    if (!text || typeof text !== 'string') {
      return text;
    }

    return profanity.censor(text);
  }

  /**
   * 텍스트에서 발견된 욕설 목록 반환
   * @param text 확인할 텍스트
   * @returns 발견된 욕설 배열
   */
  findProfanities(text: string): string[] {
    this.initialize();

    if (!text || typeof text !== 'string') {
      return [];
    }

    // 모든 욕설 찾기 (간단한 구현)
    const found: string[] = [];
    const normalized = text.trim().toLowerCase();

    // 한국어 욕설 확인
    for (const word of koreanProfanityList) {
      if (normalized.includes(word.toLowerCase())) {
        found.push(word);
      }
    }

    // 영어 욕설 확인
    for (const word of englishProfanityList) {
      if (normalized.includes(word.toLowerCase())) {
        found.push(word);
      }
    }

    return [...new Set(found)]; // 중복 제거
  }

  /**
   * 커스텀 단어 추가
   * @param words 추가할 단어 배열
   */
  addWords(words: string[]) {
    this.initialize();
    profanity.addWords(words);
    console.log(`✅ [ProfanityFilter] ${words.length}개의 단어 추가됨`);
  }

  /**
   * 화이트리스트 단어 추가 (필터링 제외)
   * @param words 제외할 단어 배열
   */
  removeWords(words: string[]) {
    this.initialize();
    profanity.removeWords(words);
    console.log(`✅ [ProfanityFilter] ${words.length}개의 단어 제외됨`);
  }
}

// 싱글톤 인스턴스 생성
const profanityFilter = new ProfanityFilter();

// 편의 함수 export
export const isProfane = (text: string): boolean => profanityFilter.isProfane(text);
export const censorProfanity = (text: string): string => profanityFilter.censor(text);
export const findProfanities = (text: string): string[] => profanityFilter.findProfanities(text);
export const addCustomWords = (words: string[]) => profanityFilter.addWords(words);
export const removeWords = (words: string[]) => profanityFilter.removeWords(words);

export default profanityFilter;


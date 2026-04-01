/**
 * Alert.alert와 호환되는 헬퍼 함수
 * 기존 코드를 최소한의 변경으로 커스텀 Alert로 마이그레이션하기 위한 유틸리티
 */

import {AlertButton} from '../components/common/CustomAlert';
import {useAlert} from '../contexts/AlertContext';

/**
 * Alert.alert 호환 함수
 * @deprecated useAlert hook을 직접 사용하는 것을 권장합니다
 */
export const showAlert = async (
  title: string,
  message: string,
  buttons?: Array<{text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}>,
) => {
  // 이 함수는 useAlert hook을 사용할 수 없으므로 (컴포넌트 외부)
  // 직접 Alert를 사용하도록 안내
  console.warn('showAlert는 컴포넌트 내부에서 useAlert hook을 사용해주세요.');
  
  // 임시로 기본 Alert 사용 (나중에 전역 AlertProvider로 대체 가능)
  const {Alert} = require('react-native');
  return new Promise<void>(resolve => {
    const alertButtons = buttons?.map(btn => ({
      text: btn.text,
      style: btn.style || 'default',
      onPress: () => {
        if (btn.onPress) {
          btn.onPress();
        }
        resolve();
      },
    })) || [{text: '확인', onPress: () => resolve()}];

    Alert.alert(title, message, alertButtons);
  });
};

/**
 * Alert.alert와 유사한 confirm 함수
 * @deprecated useAlert hook을 직접 사용하는 것을 권장합니다
 */
export const showConfirm = async (
  title: string,
  message: string,
  buttons?: Array<{text: string; onPress?: () => void; style?: 'default' | 'cancel' | 'destructive'}>,
): Promise<boolean> => {
  console.warn('showConfirm는 컴포넌트 내부에서 useAlert hook을 사용해주세요.');
  
  const {Alert} = require('react-native');
  return new Promise<boolean>(resolve => {
    const alertButtons = buttons?.map(btn => ({
      text: btn.text,
      style: btn.style || 'default',
      onPress: () => {
        if (btn.onPress) {
          btn.onPress();
        }
        resolve(btn.text !== '취소' && btn.style !== 'cancel');
      },
    })) || [
      {
        text: '취소',
        style: 'cancel' as const,
        onPress: () => resolve(false),
      },
      {
        text: '확인',
        style: 'default' as const,
        onPress: () => resolve(true),
      },
    ];

    Alert.alert(title, message, alertButtons);
  });
};


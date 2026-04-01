import React, {createContext, useContext, useCallback, useRef, ReactNode} from 'react';
import {Alert, Platform} from 'react-native';
import RootSiblings from 'react-native-root-siblings';
import CustomAlert, {AlertButton} from '../components/common/CustomAlert';

interface AlertContextType {
  alert: (title: string, message?: string, buttons?: AlertButton[]) => Promise<void>;
  confirm: (title: string, message?: string, buttons?: AlertButton[]) => Promise<boolean>;
}

const AlertContext = createContext<AlertContextType | null>(null);

export const useAlert = () => {
  const context = useContext(AlertContext);
  if (!context) {
    throw new Error('useAlert must be used within AlertProvider');
  }
  return context;
};

interface AlertProviderProps {
  children: ReactNode;
}

export const AlertProvider: React.FC<AlertProviderProps> = ({children}) => {
  const siblingRef = useRef<RootSiblings | null>(null);

  const destroySibling = useCallback(() => {
    if (siblingRef.current) {
      siblingRef.current.destroy();
      siblingRef.current = null;
    }
  }, []);

  const showAlert = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]): Promise<void> => {
      // iOS: 네이티브 Alert 사용 (Modal 위에서도 자동으로 표시됨)
      if (Platform.OS === 'ios') {
        return new Promise(resolve => {
          const defaultButtons = buttons || [{text: '확인'}];
          const nativeButtons = defaultButtons.map(button => ({
            text: button.text,
            style: button.style === 'destructive' ? 'destructive' as const : 
                   button.style === 'cancel' ? 'cancel' as const : 'default' as const,
            onPress: () => {
              if (button.onPress) {
                button.onPress();
              }
              resolve();
            },
          }));
          Alert.alert(title, message || '', nativeButtons);
        });
      }

      // Android: CustomAlert를 overFullScreen Modal로 렌더링 (다른 Modal 위에 표시됨)
      return new Promise(resolve => {
        destroySibling();

        const defaultButtons: AlertButton[] = buttons || [{text: '확인'}];

        const handleButtonPress = (button: AlertButton) => {
          if (button.onPress) {
            button.onPress();
          }
          destroySibling();
          resolve();
        };

        const handleDismiss = () => {
          destroySibling();
          resolve();
        };

        siblingRef.current = new RootSiblings(
          (
            <CustomAlert
              visible={true}
              title={title}
              message={message || ''}
              buttons={defaultButtons.map(button => ({
                ...button,
                onPress: () => handleButtonPress(button),
              }))}
              cancelable={true}
              onDismiss={handleDismiss}
              usePortal={true}
            />
          ),
        );
      });
    },
    [destroySibling],
  );

  const showConfirm = useCallback(
    (title: string, message?: string, buttons?: AlertButton[]): Promise<boolean> => {
      // iOS: 네이티브 Alert 사용 (Modal 위에서도 자동으로 표시됨)
      if (Platform.OS === 'ios') {
        return new Promise(resolve => {
          const defaultButtons = buttons || [
            {text: '취소', style: 'cancel' as const},
            {text: '확인', style: 'default' as const},
          ];
          const nativeButtons = defaultButtons.map((button, index) => ({
            text: button.text,
            style: button.style === 'destructive' ? 'destructive' as const : 
                   button.style === 'cancel' ? 'cancel' as const : 'default' as const,
            onPress: () => {
              if (button.onPress) {
                button.onPress();
              }
              // 마지막 버튼(확인)이면 true, 아니면 false
              resolve(index === defaultButtons.length - 1);
            },
          }));
          Alert.alert(title, message || '', nativeButtons);
        });
      }

      // Android: CustomAlert를 overFullScreen Modal로 렌더링 (다른 Modal 위에 표시됨)
      return new Promise(resolve => {
        destroySibling();

        const defaultButtons: AlertButton[] = buttons || [
          {
            text: '취소',
            style: 'cancel',
          },
          {
            text: '확인',
            style: 'default',
          },
        ];

        const handleButtonPress = (button: AlertButton, isConfirm: boolean) => {
          if (button.onPress) {
            button.onPress();
          }
          destroySibling();
          resolve(isConfirm);
        };

        const handleDismiss = () => {
          destroySibling();
          resolve(false);
        };

        siblingRef.current = new RootSiblings(
          (
            <CustomAlert
              visible={true}
              title={title}
              message={message || ''}
              buttons={defaultButtons.map((button, index) => ({
                ...button,
                onPress: () => handleButtonPress(button, index === defaultButtons.length - 1),
              }))}
              cancelable={true}
              onDismiss={handleDismiss}
              usePortal={true}
            />
          ),
        );
      });
    },
    [destroySibling],
  );

  return (
    <AlertContext.Provider
      value={{
        alert: showAlert,
        confirm: showConfirm,
      }}>
      {children}
    </AlertContext.Provider>
  );
};

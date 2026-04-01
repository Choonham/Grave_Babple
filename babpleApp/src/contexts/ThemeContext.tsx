import React, {createContext, useContext, useState, useEffect, ReactNode} from 'react';
import {useSelector} from 'react-redux';
import {RootState} from '../redux';
import {colors, darkColors} from '../styles/commonStyles';

export type ThemeMode = 'light' | 'dark';

interface ThemeContextType {
  theme: typeof colors;
  themeMode: ThemeMode;
  isDarkMode: boolean;
  setThemeMode: (mode: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({children}) => {
  const userInfo = useSelector((state: RootState) => state.userState.userInfo);
  const [themeMode, setThemeModeState] = useState<ThemeMode>('light');

  // 사용자 정보에서 view_mode 읽기 (1 = 다크 모드, 0 또는 null = 라이트 모드)
  useEffect(() => {
    if (userInfo) {
      if (userInfo.view_mode !== undefined && userInfo.view_mode !== null) {
        const mode: ThemeMode = userInfo.view_mode === 1 ? 'dark' : 'light';
        setThemeModeState(mode);
      } else {
        // view_mode가 없으면 기본값은 라이트 모드
        setThemeModeState('light');
      }
    } else {
      // userInfo가 없으면 (로그아웃 상태) 라이트 모드
      setThemeModeState('light');
    }
  }, [userInfo?.view_mode, userInfo]);

  const setThemeMode = (mode: ThemeMode) => {
    setThemeModeState(mode);
  };

  const theme = themeMode === 'dark' ? darkColors : colors;
  const isDarkMode = themeMode === 'dark';

  return (
    <ThemeContext.Provider value={{theme, themeMode, isDarkMode, setThemeMode}}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};


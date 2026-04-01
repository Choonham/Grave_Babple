import React, {useEffect} from 'react';
import {Provider} from 'react-redux';
import {createStore, applyMiddleware} from 'redux';
import createSagaMiddleware from 'redux-saga';
import {StatusBar} from 'react-native';
import {RootSiblingParent} from 'react-native-root-siblings';

import {rootReducer, rootSaga} from './src/redux';
import AppNavigator from './src/navigation/AppNavigator';
import {OverlayProvider} from './src/components/OverlayProvider';
import {ThemeProvider, useTheme} from './src/contexts/ThemeContext';
import {AlertProvider} from './src/contexts/AlertContext';
import firebaseService from './src/services/FirebaseService';

/**
 * Redux Saga 미들웨어 생성
 */
const sagaMiddleware = createSagaMiddleware();

/**
 * Redux 스토어 생성
 * 루트 리듀서와 사가 미들웨어를 결합합니다.
 */
const store = createStore(rootReducer, applyMiddleware(sagaMiddleware));

/**
 * 루트 사가 실행
 */
sagaMiddleware.run(rootSaga);

/**
 * StatusBar를 테마에 따라 설정하는 컴포넌트
 */
const StatusBarWrapper: React.FC = () => {
  const {theme, isDarkMode} = useTheme();
  
  return (
    <StatusBar
      barStyle={isDarkMode ? 'light-content' : 'dark-content'}
      backgroundColor={theme.background}
      translucent={false}
    />
  );
};

/**
 * Babple 앱의 최상위 컴포넌트
 * Redux Provider로 전체 앱을 감싸고 네비게이션을 설정합니다.
 */
const App: React.FC = () => {
  useEffect(() => {
    // Firebase 초기화
    firebaseService.initialize().catch(error => {
      console.error('❌ [App] Firebase 초기화 실패:', error);
    });
  }, []);

  return (
    <Provider store={store}>
      <ThemeProvider>
        <RootSiblingParent>
          <OverlayProvider>
            <AlertProvider>
              <StatusBarWrapper />
              <AppNavigator />
            </AlertProvider>
          </OverlayProvider>
        </RootSiblingParent>
      </ThemeProvider>
    </Provider>
  );
};

export default App;

/**
 * @format
 */

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';
import messaging from '@react-native-firebase/messaging';

// 백그라운드 알림 핸들러 등록
messaging().setBackgroundMessageHandler(async (remoteMessage) => {
  console.log('📱 [Firebase] 백그라운드 알림 수신:', remoteMessage);
  // 백그라운드에서는 자동으로 알림이 표시됩니다.
});

AppRegistry.registerComponent(appName, () => App);

import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {colors, spacing, typography} from '../../styles/commonStyles';

interface UploadScreenProps {
  navigation: any;
}

/**
 * 업로드 정보 입력 화면 (업로드 두 번째 단계)
 */
const UploadScreen: React.FC<UploadScreenProps> = ({navigation}) => {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.content}>
        <Text style={styles.title}>업로드 정보 입력</Text>
        <Text style={styles.text}>재료와 레시피 정보를 입력하는 화면입니다.</Text>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.white,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.l,
  },
  title: {
    ...typography.h2,
    fontWeight: '700',
    color: colors.textPrimary,
    marginBottom: spacing.m,
  },
  text: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
  },
});

export default UploadScreen;


import React, {useState, useEffect} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, Modal, ActivityIndicator} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Avatar from '../../../components/common/Avatar';
import {colors, spacing, typography, borderRadius, shadows} from '../../../styles/commonStyles';
import {UserAPI, ChatAPI} from '../../../api/ApiRequests';
import ChatRoomScreen from './ChatRoomScreen';

interface AddChatRoomScreenProps {
  visible: boolean;
  onClose: () => void;
  onRoomCreated?: (roomId: string, peerName: string, peerId: string) => void;
}

interface FollowingUser {
  user_id: string;
  nickname: string;
  profile_image_url?: string | null;
  introduction?: string | null;
}

import {API_BASE_URL} from '../../../config/api';

const buildMediaUrl = (path?: string | null) => {
  if (!path) {
    return null;
  }
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  let normalized = path.replace(/\\/g, '/');
  if (normalized.startsWith('/uploads')) {
    return `${API_BASE_URL}${normalized}`;
  }
  if (normalized.startsWith('uploads')) {
    normalized = normalized.replace(/^uploads/, '/uploads');
  } else {
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
    if (!normalized.startsWith('/uploads')) {
      normalized = `/uploads${normalized}`;
    }
  }
  return `${API_BASE_URL}${normalized}`;
};

const AddChatRoomScreen: React.FC<AddChatRoomScreenProps> = ({visible, onClose, onRoomCreated}) => {
  const [following, setFollowing] = useState<FollowingUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (visible) {
      loadFollowing();
    }
  }, [visible]);

  const loadFollowing = async () => {
    try {
      setLoading(true);
      const response = await UserAPI.getMyFollowing();
      if (response?.success && Array.isArray(response.data)) {
        setFollowing(response.data);
      } else {
        setFollowing([]);
      }
    } catch (error) {
      console.error('팔로잉 리스트 로드 오류:', error);
      setFollowing([]);
    } finally {
      setLoading(false);
    }
  };

  const handleUserPress = async (user: FollowingUser) => {
    try {
      // 채팅방 생성 또는 조회
      const response = await ChatAPI.createOrGetRoom(user.user_id);
      if (response?.success && response.data) {
        const roomId = response.data.room_id;
        const peerName = user.nickname;
        const peerId = user.user_id;
        
        // ChatListScreen에서 ChatRoomScreen을 열도록 콜백 호출
        if (onRoomCreated) {
          onRoomCreated(roomId, peerName, peerId);
        }
        // AddChatRoomScreen 닫기
        onClose();
      }
    } catch (error) {
      console.error('채팅방 생성 오류:', error);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>새로운 대화 상대 찾기</Text>
          <View style={styles.headerSpacer} />
        </View>

        {loading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : following.length > 0 ? (
          <ScrollView style={styles.list}>
            {following.map(user => (
              <TouchableOpacity
                key={user.user_id}
                style={styles.row}
                onPress={() => handleUserPress(user)}>
                <Avatar
                  size={40}
                  source={
                    user.profile_image_url
                      ? (() => {
                          const url = buildMediaUrl(user.profile_image_url);
                          return url ? {uri: url} : undefined;
                        })()
                      : undefined
                  }
                />
                <View style={styles.rowTextArea}>
                  <Text style={styles.rowName}>{user.nickname}</Text>
                  {user.introduction && (
                    <Text style={styles.rowPreview} numberOfLines={1}>
                      {user.introduction}
                    </Text>
                  )}
                </View>
                <Icon name="message-circle" size={20} color={colors.primary} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyContainer}>
            <Icon name="user-x" size={40} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>팔로잉이 없어요</Text>
            <Text style={styles.emptySubtitle}>먼저 이웃을 팔로우해보세요!</Text>
          </View>
        )}

      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingTop: spacing.m,
    paddingBottom: spacing.m,
    backgroundColor: colors.white,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {width: 24},
  list: {flex: 1},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    borderBottomWidth: 1,
    borderBottomColor: colors.lightGray,
  },
  rowTextArea: {
    flex: 1,
    marginLeft: spacing.m,
  },
  rowName: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  rowPreview: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    marginTop: 2,
    fontWeight: '400' as const,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.m,
  },
  emptyTitle: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  emptySubtitle: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    fontWeight: '400' as const,
  },
});

export default AddChatRoomScreen;



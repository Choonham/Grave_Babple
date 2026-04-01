import React, {useState, useEffect, useCallback, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, ScrollView, RefreshControl, Modal} from 'react-native';
import {SafeAreaView, useSafeAreaInsets} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Avatar from '../../../components/common/Avatar';
import {LottieSpinner} from '../../../components/common';
import {colors, spacing, typography, borderRadius, shadows} from '../../../styles/commonStyles';
import {ChatAPI} from '../../../api/ApiRequests';
import AddChatRoomScreen from './AddChatRoomScreen';
import ChatRoomScreen from './ChatRoomScreen';
import socketService from '../../../services/SocketService';
import {Socket} from 'socket.io-client';
import {useSelector} from 'react-redux';
import {RootState} from '../../../redux';

interface ChatListScreenProps {
  visible: boolean;
  onClose: () => void;
  initialRoomId?: string; // 푸시 알림에서 특정 채팅방으로 이동할 때 사용
  onInitialRoomProcessed?: () => void; // initialRoomId 처리가 완료되었을 때 호출
}

interface ChatRoom {
  room_id: string;
  other_user: {
    user_id: string;
    nickname: string;
    profile_image_url?: string | null;
  } | null;
  last_message: {
    message_id: string;
    content: string;
    content_type: number;
    created_at: string;
    sender_id: string;
  } | null;
  unread_count: number;
  last_message_at: string | null;
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

const formatTime = (dateString: string | null) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;

  const month = date.getMonth() + 1;
  const day = date.getDate();
  const hour = date.getHours();
  const minute = date.getMinutes();
  const ampm = hour >= 12 ? '오후' : '오전';
  const displayHour = hour % 12 || 12;

  return `${month}/${day} ${ampm} ${displayHour}:${minute.toString().padStart(2, '0')}`;
};

const formatMessagePreview = (content: string | null, contentType: number | null) => {
  if (!content) return '메시지가 없습니다.';
  
  // content_type에 따라 다른 텍스트 표시
  if (contentType === 1) {
    return '사진';
  } else if (contentType === 2) {
    return '동영상';
  } else if (contentType === 3) {
    // 파일의 경우 파일명 추출
    const fileName = content.split('/').pop() || '파일';
    return `파일: ${fileName}`;
  }
  
  // 텍스트 메시지 (content_type === 0 또는 null)
  return content;
};

const ChatListScreen: React.FC<ChatListScreenProps> = ({visible, onClose, initialRoomId, onInitialRoomProcessed}) => {
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const insets = useSafeAreaInsets();
  const [rooms, setRooms] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddChatVisible, setIsAddChatVisible] = useState(false);
  const [isRoomVisible, setIsRoomVisible] = useState(false);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedPeerName, setSelectedPeerName] = useState('');
  const [selectedPeerId, setSelectedPeerId] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const processedInitialRoomIdRef = useRef<string | null>(null); // 이미 처리한 initialRoomId 추적

  useEffect(() => {
    if (visible) {
      loadRooms();
      setupSocket();
      // 화면이 열릴 때마다 processedInitialRoomIdRef 초기화
      processedInitialRoomIdRef.current = null;
    } else {
      cleanupSocket();
      // 화면이 닫힐 때 초기화
      processedInitialRoomIdRef.current = null;
    }

    return () => {
      cleanupSocket();
    };
  }, [visible]);

  // initialRoomId가 있으면 해당 채팅방 열기 (한 번만 실행)
  useEffect(() => {
    if (
      initialRoomId &&
      rooms.length > 0 &&
      processedInitialRoomIdRef.current !== initialRoomId // 아직 처리하지 않은 경우만
    ) {
      const room = rooms.find(r => r.room_id === initialRoomId);
      if (room) {
        console.log(`📱 [ChatListScreen] initialRoomId로 채팅방 열기: ${initialRoomId}`);
        setSelectedRoomId(room.room_id);
        setSelectedPeerName(room.other_user?.nickname || '알 수 없음');
        setSelectedPeerId(room.other_user?.user_id || '');
        setIsRoomVisible(true);
        // 처리 완료 표시
        processedInitialRoomIdRef.current = initialRoomId;
        // HomeScreen에 처리 완료 알림
        onInitialRoomProcessed?.();
      }
    }
  }, [initialRoomId, rooms, onInitialRoomProcessed]);

  // Socket 연결 및 이벤트 리스너 설정
  const setupSocket = async () => {
    try {
      const socket = await socketService.connect();
      socketRef.current = socket;

      // 새 메시지 수신 시 채팅방 리스트 업데이트
      socket.on('new_message', async (messageData: {
        message_id: string;
        room_id: string;
        content: string;
        content_type: number;
        sender_id: string;
        sender: {
          user_id: string;
          nickname: string;
          profile_image_url?: string | null;
        } | null;
        created_at: string;
      }) => {
        // 새 메시지 수신 시 채팅방 리스트 업데이트 (내 메시지든 상대방 메시지든 모두)
        updateRoomList(messageData);
      });

      console.log('✅ [ChatListScreen] Socket 이벤트 리스너 설정 완료');
    } catch (error) {
      console.error('❌ [ChatListScreen] Socket 연결 오류:', error);
    }
  };

  // Socket 정리
  const cleanupSocket = () => {
    if (socketRef.current) {
      socketRef.current.off('new_message');
      socketRef.current = null;
    }
  };

  // 채팅방 리스트 업데이트 (새 메시지 수신 시)
  const updateRoomList = async (messageData: {
    message_id: string;
    room_id: string;
    content: string;
    content_type: number;
    sender_id: string;
    sender: {
      user_id: string;
      nickname: string;
      profile_image_url?: string | null;
    } | null;
    created_at: string;
  }) => {
    setRooms(prevRooms => {
      const existingRoomIndex = prevRooms.findIndex(room => room.room_id === messageData.room_id);

      if (existingRoomIndex >= 0) {
        // 기존 채팅방 업데이트
        const updatedRooms = [...prevRooms];
        const room = updatedRooms[existingRoomIndex];

        // 마지막 메시지 업데이트
        const updatedRoom: ChatRoom = {
          ...room,
          last_message: {
            message_id: messageData.message_id,
            content: messageData.content,
            content_type: messageData.content_type,
            created_at: messageData.created_at,
            sender_id: messageData.sender_id,
          },
          last_message_at: messageData.created_at,
          // 읽지 않은 메시지 개수 증가 (상대방이 보낸 메시지인 경우)
          unread_count: messageData.sender_id !== currentUser?.user_id
            ? room.unread_count + 1
            : room.unread_count,
        };

        updatedRooms[existingRoomIndex] = updatedRoom;

        // 최신 메시지가 있는 방을 맨 위로 이동
        updatedRooms.sort((a: ChatRoom, b: ChatRoom) => {
          const aTime = a.last_message_at || a.last_message?.created_at || '';
          const bTime = b.last_message_at || b.last_message?.created_at || '';
          return new Date(bTime).getTime() - new Date(aTime).getTime();
        });

        return updatedRooms;
      } else {
        // 새 채팅방인 경우, 채팅방 정보를 가져와서 추가
        // 백그라운드에서 채팅방 정보를 가져오고, 완료되면 리스트에 추가
        loadRoomInfo(messageData.room_id, messageData);
        return prevRooms;
      }
    });
  };

  // 새 채팅방 정보 로드 (메시지를 받았는데 채팅방이 리스트에 없는 경우)
  const loadRoomInfo = async (roomId: string, messageData: {
    message_id: string;
    room_id: string;
    content: string;
    content_type: number;
    sender_id: string;
    sender: {
      user_id: string;
      nickname: string;
      profile_image_url?: string | null;
    } | null;
    created_at: string;
  }) => {
    try {
      // 전체 채팅방 리스트를 다시 가져와서 새 채팅방 찾기
      const response = await ChatAPI.getRooms();
      if (response?.success && Array.isArray(response.data)) {
        const newRoom = response.data.find((room: ChatRoom) => room.room_id === roomId);
        if (newRoom) {
          setRooms(prevRooms => {
            // 이미 리스트에 있는지 확인 (중복 방지)
            if (prevRooms.some(room => room.room_id === roomId)) {
              return prevRooms;
            }
            // 새 채팅방을 맨 위에 추가하고 마지막 메시지 정보 업데이트
            const updatedNewRoom: ChatRoom = {
              ...newRoom,
              last_message: {
                message_id: messageData.message_id,
                content: messageData.content,
                content_type: messageData.content_type,
                created_at: messageData.created_at,
                sender_id: messageData.sender_id,
              },
              last_message_at: messageData.created_at,
              // 읽지 않은 메시지 개수 (상대방이 보낸 메시지인 경우 1)
              unread_count: messageData.sender_id !== currentUser?.user_id ? 1 : 0,
            };
            return [updatedNewRoom, ...prevRooms];
          });
        }
      }
    } catch (error) {
      console.error('채팅방 정보 로드 오류:', error);
    }
  };

  const loadRooms = useCallback(async (showLoading = true) => {
    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await ChatAPI.getRooms();
      if (response?.success && Array.isArray(response.data)) {
        setRooms(response.data);
      } else {
        setRooms([]);
      }
    } catch (error) {
      console.error('채팅방 목록 로드 오류:', error);
      setRooms([]);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  }, []);

  /**
   * Pull-to-refresh 핸들러
   */
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRooms(false);
    setRefreshing(false);
  }, [loadRooms]);

  const handleRoomPress = (room: ChatRoom) => {
    if (room.other_user) {
      setSelectedRoomId(room.room_id);
      setSelectedPeerName(room.other_user.nickname);
      setSelectedPeerId(room.other_user.user_id);
      setIsRoomVisible(true);
    }
  };

  return (
    <Modal 
      visible={visible} 
      animationType="slide" 
      transparent={false} 
      onRequestClose={onClose}
      statusBarTranslucent={false}>
      <SafeAreaView style={styles.container} edges={['bottom']}>
        {/* Header - insets.top을 직접 적용 */}
        <View style={[styles.header, {paddingTop: insets.top + spacing.m}]}>
          <TouchableOpacity onPress={onClose} style={styles.backButton}>
            <Icon name="chevron-left" size={24} color={colors.textPrimary} />
          </TouchableOpacity>
          <Text style={styles.title}>채팅</Text>
          <View style={styles.headerSpacer} />
        </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <LottieSpinner size="large" />
        </View>
      ) : rooms.length > 0 ? (
        <ScrollView
          style={styles.list}
          contentContainerStyle={{paddingBottom: spacing.xl}}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[colors.primary]}
              tintColor={colors.primary}
            />
          }>
          {rooms.map(room => (
            <TouchableOpacity
              key={room.room_id}
              style={styles.card}
              onPress={() => handleRoomPress(room)}>
              <Avatar
                size={40}
                source={
                  room.other_user?.profile_image_url
                    ? (() => {
                        const url = buildMediaUrl(room.other_user.profile_image_url);
                        return url ? {uri: url} : undefined;
                      })()
                    : undefined
                }
              />
              <View style={styles.cardTextArea}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>
                    {room.other_user?.nickname || '알 수 없음'}
                  </Text>
                  <Text style={styles.time}>
                    {formatTime(room.last_message_at || room.last_message?.created_at || null)}
                  </Text>
                </View>
                <View style={styles.previewRow}>
                  <Text style={styles.preview} numberOfLines={1}>
                    {formatMessagePreview(room.last_message?.content || null, room.last_message?.content_type || null)}
                  </Text>
                  {room.unread_count > 0 && (
                    <View style={styles.unreadBadge}>
                      <Text style={styles.unreadText}>{room.unread_count}</Text>
                    </View>
                  )}
                </View>
              </View>
            </TouchableOpacity>
          ))}
        </ScrollView>
      ) : (
        <View style={styles.emptyContainer}>
          <Icon name="message-square" size={40} color={colors.textSecondary} />
          <Text style={styles.emptyTitle}>아직 대화 상대가 없어요...</Text>
          <Text style={styles.emptySubtitle}>이웃과 대화를 시작해보세요!</Text>
          <TouchableOpacity style={styles.pickButton} onPress={() => setIsAddChatVisible(true)}>
            <Icon name="send" size={18} color={colors.textPrimary} />
            <Text style={styles.pickButtonText}>단골 리스트에서 선택하기</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Add Chat Room - Full Screen Modal */}
      <AddChatRoomScreen
        visible={isAddChatVisible}
        onClose={() => setIsAddChatVisible(false)}
        onRoomCreated={(roomId, peerName, peerId) => {
          setIsAddChatVisible(false);
          // 선택한 사용자와의 채팅방 열기
          setSelectedRoomId(roomId);
          setSelectedPeerName(peerName);
          setSelectedPeerId(peerId);
          setIsRoomVisible(true);
          // 채팅방 목록 새로고침
          loadRooms();
        }}
      />

      <ChatRoomScreen
        visible={isRoomVisible}
        onClose={() => {
          setIsRoomVisible(false);
          loadRooms(); // 채팅방 나간 후 목록 새로고침
          // 채팅방이 닫히면 initialRoomId 처리 상태 초기화
          if (processedInitialRoomIdRef.current) {
            processedInitialRoomIdRef.current = null;
          }
        }}
        roomId={selectedRoomId}
        peerName={selectedPeerName}
        peerId={selectedPeerId}
      />
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
    paddingVertical: spacing.m,
  },
  backButton: {
    padding: spacing.xs,
  },
  title: {
    ...typography.h2,
    color: colors.textPrimary,
    fontWeight: '700' as const,
    flex: 1,
    textAlign: 'center',
  },
  headerSpacer: {
    width: 24,
  },
  list: {
    flex: 1,
    paddingHorizontal: spacing.s,
    paddingTop: spacing.s,
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
  pickButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.s,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.lightGray,
    paddingVertical: spacing.s,
    paddingHorizontal: spacing.l,
    borderRadius: borderRadius.m,
    ...shadows.card,
  },
  pickButtonText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    fontWeight: '400' as const,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    borderRadius: borderRadius.m,
    padding: spacing.m,
    marginHorizontal: spacing.s,
    marginBottom: spacing.s,
    ...shadows.card,
  },
  cardTextArea: {
    flex: 1,
    marginLeft: spacing.m,
    gap: spacing.xs,
  },
  nameRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  name: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
    fontWeight: '600' as const,
  },
  time: {
    ...typography.captionRegular,
    color: colors.textSecondary,
    fontWeight: '400' as const,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  preview: {
    ...typography.bodyRegular,
    color: colors.textSecondary,
    flex: 1,
    marginRight: spacing.s,
    fontWeight: '400' as const,
  },
  unreadBadge: {
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.error,
    justifyContent: 'center',
    alignItems: 'center',
  },
  unreadText: {
    fontSize: 11,
    color: colors.white,
    fontWeight: '700' as const,
    paddingHorizontal: 4,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default ChatListScreen;



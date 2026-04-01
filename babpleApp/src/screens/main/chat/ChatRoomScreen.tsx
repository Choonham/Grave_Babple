import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  ActivityIndicator,
  Image,
  Platform,
  Animated,
  KeyboardAvoidingView,
  Dimensions,
  Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Feather';
import Video from 'react-native-video';
import {
  launchCamera,
  launchImageLibrary,
  ImagePickerResponse,
  MediaType,
  Asset,
} from 'react-native-image-picker';
import CustomGallery from '../../../components/CustomGallery';
// import DocumentPicker from 'react-native-document-picker'; // React Native 0.82와 호환성 문제로 일시적으로 비활성화
import { colors, spacing, typography, borderRadius } from '../../../styles/commonStyles';
import { ChatAPI, UploadAPI, ReportAPI } from '../../../api/ApiRequests';
import { API_BASE_URL } from '../../../config/api';
import { BottomSheetMenu } from '../../../components/common';
import { useSelector } from 'react-redux';
import { RootState } from '../../../redux';
import socketService from '../../../services/SocketService';
import { Socket } from 'socket.io-client';
import { useAlert } from '../../../contexts/AlertContext';

interface ChatRoomScreenProps {
  visible: boolean;
  onClose: () => void;
  roomId?: string;
  peerName: string;
  peerId?: string;
}

interface Message {
  message_id: string;
  content: string;
  content_type: number;
  sender_id: string;
  sender: {
    user_id: string;
    nickname: string;
    profile_image_url?: string | null;
  } | null;
  read: boolean;
  created_at: string;
}

const formatMessageTime = (dateString: string) => {
  const date = new Date(dateString);
  const hour = date.getHours();
  const minute = date.getMinutes();
  const ampm = hour >= 12 ? '오후' : '오전';
  const displayHour = hour % 12 || 12;
  return `${ampm} ${displayHour}:${minute.toString().padStart(2, '0')}`;
};

const ChatRoomScreen: React.FC<ChatRoomScreenProps> = ({
  visible,
  onClose,
  roomId,
  peerName,
  peerId,
}) => {
  const { alert, confirm } = useAlert();
  const insets = useSafeAreaInsets();
  const currentUser = useSelector((state: RootState) => state.userState.userInfo);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [mediaMenuVisible, setMediaMenuVisible] = useState(false);
  const [imageViewerVisible, setImageViewerVisible] = useState(false);
  const [viewingImageUrl, setViewingImageUrl] = useState<string | null>(null);
  const [videoViewerVisible, setVideoViewerVisible] = useState(false);
  const [viewingVideoUrl, setViewingVideoUrl] = useState<string | null>(null);
  const [menuVisible, setMenuVisible] = useState(false);
  const [reportReasonMenuVisible, setReportReasonMenuVisible] = useState(false);
  const [socket, setSocket] = useState<Socket | null>(null);
  const [showCustomGallery, setShowCustomGallery] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const imageScrollRef = useRef<ScrollView>(null);
  const mediaPanelAnim = useRef(new Animated.Value(0)).current;
  const { height: SCREEN_HEIGHT, width: SCREEN_WIDTH } = Dimensions.get('window');

  // Socket 연결 및 채팅방 입장/퇴장
  useEffect(() => {
    let currentSocket: Socket | null = null;

    const setupSocket = async () => {
      if (visible && roomId) {
        try {
          // Socket 연결
          currentSocket = await socketService.connect();
          setSocket(currentSocket);

          // 채팅방 입장
          currentSocket.emit('join_room', { roomId });

          // 새 메시지 수신
          currentSocket.on('new_message', (messageData: Message) => {
            setMessages(prev => {
              // 중복 메시지 방지
              const exists = prev.some(msg => msg.message_id === messageData.message_id);
              if (exists) {
                return prev;
              }
              return [...prev, messageData];
            });

            // 스크롤을 맨 아래로
            setTimeout(() => {
              scrollRef.current?.scrollToEnd({ animated: true });
            }, 100);

            // 읽음 처리 (상대방이 보낸 메시지인 경우)
            if (messageData.sender_id !== currentUser?.user_id) {
              currentSocket?.emit('mark_read', { roomId });
            }
          });

          // Socket 오류 처리
          currentSocket.on('error', (error: { message: string }) => {
            console.error('Socket 오류:', error.message);
            alert('오류', error.message);
          });

          // 입장 확인
          currentSocket.on('joined_room', ({ roomId: joinedRoomId }: { roomId: string }) => {
            console.log('✅ [Socket] 채팅방 입장 완료:', joinedRoomId);
            // 초기 메시지 로드
            loadMessages();
          });
        } catch (error) {
          console.error('Socket 연결 오류:', error);
          alert('연결 오류', '실시간 채팅 연결에 실패했습니다. 다시 시도해주세요.');
        }
      } else {
        // 채팅방이 닫히면 Socket에서 나가기
        if (currentSocket && roomId) {
          currentSocket.emit('leave_room', { roomId });
        }
        setSocket(null);
      }
    };

    setupSocket();

    return () => {
      // 클린업: 채팅방 나가기 및 Socket 이벤트 리스너 제거
      if (currentSocket && roomId) {
        currentSocket.emit('leave_room', { roomId });
        currentSocket.off('new_message');
        currentSocket.off('error');
        currentSocket.off('joined_room');
      }
    };
  }, [visible, roomId, currentUser?.user_id]);

  // 채팅방이 열릴 때 이미지/비디오 뷰어 상태 초기화
  useEffect(() => {
    if (visible) {
      setImageViewerVisible(false);
      setViewingImageUrl(null);
      setVideoViewerVisible(false);
      setViewingVideoUrl(null);
    }
  }, [visible]);

  const loadMessages = async (showLoading = true) => {
    if (!roomId) return;

    try {
      if (showLoading) {
        setLoading(true);
      }
      const response = await ChatAPI.getMessages(roomId, 50);
      if (response?.success && Array.isArray(response.data)) {
        setMessages(response.data);
        // 메시지 로드 후 스크롤을 맨 아래로
        setTimeout(() => {
          scrollRef.current?.scrollToEnd({ animated: false });
        }, 100);
      }
    } catch (error) {
      console.error('메시지 로드 오류:', error);
    } finally {
      if (showLoading) {
        setLoading(false);
      }
    }
  };

  // 텍스트 메시지 전송 (Socket 사용)
  const handleSendText = async () => {
    if (!input.trim() || !roomId || sending || uploading || !socket) return;

    const content = input.trim();
    setInput('');
    setSending(true);

    try {
      // Socket으로 메시지 전송
      socket.emit('send_message', {
        roomId,
        content,
        contentType: 0,
      });

      // Socket의 new_message 이벤트에서 자동으로 메시지가 추가되므로
      // 여기서는 입력만 초기화
      setSending(false);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      // 전송 실패 시 입력 내용 복원
      setInput(content);
      setSending(false);
      await alert('전송 실패', '메시지 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 미디어 메시지 전송 (내부용, Socket 사용)
  const handleSendMedia = async (contentType: number, mediaUrl: string) => {
    if (!roomId || sending || uploading || !socket) return;

    setSending(true);

    try {
      // Socket으로 메시지 전송
      socket.emit('send_message', {
        roomId,
        content: mediaUrl,
        contentType,
      });

      // Socket의 new_message 이벤트에서 자동으로 메시지가 추가됨
      setSending(false);
    } catch (error) {
      console.error('메시지 전송 오류:', error);
      setSending(false);
      await alert('전송 실패', '메시지 전송에 실패했습니다. 다시 시도해주세요.');
    }
  };

  // 미디어 선택 패널 표시/숨김
  const toggleMediaPanel = () => {
    const toValue = mediaMenuVisible ? 0 : 1;
    setMediaMenuVisible(!mediaMenuVisible);

    Animated.spring(mediaPanelAnim, {
      toValue,
      useNativeDriver: true,
      tension: 65,
      friction: 11,
    }).start();
  };

  const hideMediaPanel = () => {
    if (mediaMenuVisible) {
      setMediaMenuVisible(false);
      Animated.spring(mediaPanelAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    }
  };

  // 사진 버튼 클릭 시 네이티브 모달로 카메라/갤러리 선택
  const handleTakePhoto = () => {
    Alert.alert(
      '사진 선택',
      '사진을 어떻게 추가하시겠습니까?',
      [
        {
          text: '취소',
          style: 'cancel',
        },
        {
          text: '카메라로 촬영',
          onPress: handleTakePhotoWithCamera,
        },
        {
          text: '갤러리에서 선택',
          onPress: handlePickPhotoFromGallery,
        },
      ],
      { cancelable: true }
    );
  };

  // 카메라로 사진 찍기
  const handleTakePhotoWithCamera = () => {
    const options = {
      mediaType: 'photo' as MediaType,
      quality: 0.8 as const,
      saveToPhotos: false,
      cameraType: 'back' as const,
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        await uploadAndSendMedia(response.assets[0], 1); // content_type: 1 (image)
      }
    });
  };

  // 갤러리에서 사진 선택 (커스텀 갤러리)
  const handlePickPhotoFromGallery = () => {
    setShowCustomGallery(true);
  };

  // 카메라로 동영상 찍기
  const handleTakeVideo = () => {
    const options = {
      mediaType: 'video' as MediaType,
      quality: 0.8 as const, // 품질을 0.8로 낮춤 (용량 절감)
      videoQuality: 'medium' as const, // 동영상 품질을 medium으로 낮춤 (high -> medium)
      saveToPhotos: false,
      cameraType: 'back' as const,
    };

    launchCamera(options, async (response: ImagePickerResponse) => {
      if (response.didCancel || response.errorMessage) {
        return;
      }

      if (response.assets && response.assets[0]) {
        await uploadAndSendMedia(response.assets[0], 2); // content_type: 2 (video)
      }
    });
  };

  // 파일 선택 (일시적으로 비활성화 - React Native 0.82 호환성 문제)
  const handlePickFile = async () => {
    await alert('알림', '파일 선택 기능은 현재 준비 중입니다.');
    // TODO: React Native 0.82와 호환되는 파일 선택 라이브러리로 교체 필요
    /*
    try {
      const results = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: true,
      });

      for (const file of results) {
        await uploadAndSendFile(file);
      }
    } catch (err) {
      if (DocumentPicker.isCancel(err)) {
        return;
      }
      console.error('파일 선택 오류:', err);
      alert('오류', '파일을 선택하는 중 오류가 발생했습니다.');
    }
    */
  };

  // 미디어 업로드 및 전송
  const uploadAndSendMedia = async (asset: Asset, contentType: number) => {
    if (!asset.uri || !roomId) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('media', {
        uri: asset.uri,
        type: asset.type || 'image/jpeg',
        name: asset.fileName || `media_${Date.now()}.${asset.type?.includes('video') ? 'mp4' : 'jpg'}`,
      } as any);

      // 채팅 미디어 업로드 API 사용 (50MB 제한)
      const uploadResponse = await UploadAPI.uploadChatMedia(formData);
      if (uploadResponse?.success && uploadResponse.data?.url) {
        // 업로드된 URL로 메시지 전송
        const mediaUrl = uploadResponse.data.url || uploadResponse.data.image_url;
        await handleSendMedia(contentType, mediaUrl);
      } else {
        await alert('오류', uploadResponse?.message || '미디어 업로드에 실패했습니다.');
      }
    } catch (error) {
      console.error('미디어 업로드 오류:', error);
      await alert('오류', '미디어 업로드 중 오류가 발생했습니다.');
    } finally {
      setUploading(false);
    }
  };

  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);

  /**
   * 사용자 신고 처리
   */
  const handleReportUser = async (reason: string, messageId?: string, isChatRoomReport: boolean = false) => {
    if (!peerId) {
      await alert('오류', '사용자 정보를 찾을 수 없습니다.');
      return;
    }
    try {
      const response = await ReportAPI.reportUser(
        peerId,
        reason,
        undefined,
        messageId || isChatRoomReport ? 'CHAT' : 'USER',
        undefined,
        messageId,
        isChatRoomReport && roomId ? roomId : undefined,
      );
      if (response?.success) {
        await alert('완료', '신고가 접수되었습니다. 검토 후 처리하겠습니다.');
        setSelectedMessage(null);
        setMenuVisible(false);
        setReportReasonMenuVisible(false);
      } else {
        await alert('오류', response?.message || '신고 처리에 실패했습니다.');
      }
    } catch (error: any) {
      console.error('사용자 신고 오류:', error);
      await alert('오류', error?.response?.data?.message || '신고 처리 중 오류가 발생했습니다.');
    }
  };

  /**
   * 메시지 길게 누르기 처리 (신고 옵션)
   */
  const handleMessageLongPress = (message: Message) => {
    // 자신의 메시지는 신고할 수 없음
    if (message.sender_id === currentUser?.user_id) {
      return;
    }

    setSelectedMessage(message);
    setMenuVisible(true);
  };

  return (
    <>
      <Modal
        visible={visible}
        animationType="slide"
        transparent={false}
        onRequestClose={onClose}
        statusBarTranslucent={false}>
        <SafeAreaView style={styles.container} edges={['bottom']}>
          {/* Header - insets.top을 직접 적용 */}
          <View style={[styles.header, { paddingTop: insets.top + spacing.m }]}>
            <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
              <Icon name="chevron-left" size={24} color={colors.textPrimary} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>{peerName}</Text>
            <TouchableOpacity style={styles.headerBtn} onPress={() => setMenuVisible(true)}>
              <Icon name="more-horizontal" size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Messages */}
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <ScrollView
              ref={scrollRef}
              style={styles.messages}
              contentContainerStyle={{ paddingVertical: spacing.m, paddingHorizontal: spacing.m }}
              onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}>
              {messages.length > 0 ? (
                messages.map(msg => {
                  const isMe = msg.sender_id === currentUser?.user_id;
                  const isImage = msg.content_type === 1;
                  const isVideo = msg.content_type === 2;
                  const isFile = msg.content_type === 3;

                  const buildMediaUrl = (url: string) => {
                    if (!url) return null;
                    if (url.startsWith('http://') || url.startsWith('https://')) {
                      return url;
                    }
                    return `${API_BASE_URL}${url.startsWith('/') ? url : `/${url}`}`;
                  };

                  return (
                    <TouchableOpacity
                      key={msg.message_id}
                      style={[styles.messageRow, isMe ? styles.messageRowMe : undefined]}
                      onLongPress={() => !isMe && handleMessageLongPress(msg)}
                      activeOpacity={0.9}>
                      {!isMe && <View style={styles.spacer} />}
                      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleOther]}>
                        {isImage && (
                          <TouchableOpacity
                            onPress={() => {
                              const imageUrl = buildMediaUrl(msg.content);
                              if (imageUrl) {
                                setViewingImageUrl(imageUrl);
                                setImageViewerVisible(true);
                              }
                            }}>
                            <Image
                              source={{ uri: buildMediaUrl(msg.content) || undefined }}
                              style={styles.mediaImage}
                              resizeMode="cover"
                            />
                          </TouchableOpacity>
                        )}
                        {isVideo && (
                          <TouchableOpacity
                            onPress={() => {
                              const videoUrl = buildMediaUrl(msg.content);
                              if (videoUrl) {
                                setViewingVideoUrl(videoUrl);
                                setVideoViewerVisible(true);
                              }
                            }}>
                            <View style={styles.videoContainer}>
                              <Icon name="play-circle" size={40} color={colors.white} />
                              <Text style={styles.videoText}>동영상</Text>
                            </View>
                          </TouchableOpacity>
                        )}
                        {isFile && (
                          <View style={styles.fileContainer}>
                            <Icon name="file" size={24} color={colors.primary} />
                            <Text style={styles.fileText} numberOfLines={1}>
                              {msg.content.split('/').pop() || '파일'}
                            </Text>
                          </View>
                        )}
                        {msg.content_type === 0 && (
                          <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>
                            {msg.content}
                          </Text>
                        )}
                      </View>
                      <View style={styles.metaRow}>
                        <Text style={styles.timeText}>{formatMessageTime(msg.created_at)}</Text>
                        {isMe && (
                          <Icon
                            name="check"
                            size={16}
                            color={msg.read ? colors.primary : colors.textSecondary}
                          />
                        )}
                      </View>
                    </TouchableOpacity>
                  );
                })
              ) : (
                <View style={styles.emptyContainer}>
                  <Icon name="message-square" size={40} color={colors.textSecondary} />
                  <Text style={styles.emptyText}>아직 메시지가 없어요</Text>
                  <Text style={styles.emptySubtext}>첫 메시지를 보내보세요!</Text>
                </View>
              )}
            </ScrollView>
          )}

          {/* Input bar */}
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 20}>
            <View style={styles.inputBar}>
              <TouchableOpacity
                style={styles.attachBtn}
                onPress={toggleMediaPanel}
                disabled={uploading || sending}>
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon name="plus" size={20} color={colors.primary} />
                )}
              </TouchableOpacity>
              <TextInput
                style={styles.input}
                placeholder="메시지를 입력하세요"
                placeholderTextColor={colors.textTertiary}
                value={input}
                onChangeText={setInput}
                onSubmitEditing={handleSendText}
                onFocus={hideMediaPanel}
                editable={!sending && !uploading}
              />
              <TouchableOpacity
                style={styles.sendBtn}
                disabled={!input.trim() || sending || uploading}
                onPress={handleSendText}>
                {sending ? (
                  <ActivityIndicator size="small" color={colors.primary} />
                ) : (
                  <Icon
                    name="send"
                    size={20}
                    color={input.trim() ? colors.primary : colors.textSecondary}
                  />
                )}
              </TouchableOpacity>
            </View>

            {/* 미디어 선택 패널 */}
            {mediaMenuVisible && (
              <Animated.View
                style={[
                  styles.mediaPanel,
                  {
                    transform: [
                      {
                        translateY: mediaPanelAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: [200, 0],
                        }),
                      },
                    ],
                    opacity: mediaPanelAnim,
                  },
                ]}>
                <View style={styles.mediaPanelContent}>
                  <TouchableOpacity
                    style={styles.mediaOption}
                    onPress={() => {
                      hideMediaPanel();
                      handleTakePhoto();
                    }}
                    disabled={uploading || sending}>
                    <View style={styles.mediaIconCircle}>
                      <Icon name="camera" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.mediaOptionText}>사진</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={styles.mediaOption}
                    onPress={() => {
                      hideMediaPanel();
                      handleTakeVideo();
                    }}
                    disabled={uploading || sending}>
                    <View style={styles.mediaIconCircle}>
                      <Icon name="video" size={28} color={colors.primary} />
                    </View>
                    <Text style={styles.mediaOptionText}>동영상</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            )}
          </KeyboardAvoidingView>

          {/* 이미지 뷰어 모달 - ChatRoomScreen 모달 내부로 이동 */}
          {imageViewerVisible && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setImageViewerVisible(false)}>
              <View style={styles.imageViewerContainer}>
                <TouchableOpacity
                  style={styles.imageViewerBackdrop}
                  activeOpacity={1}
                  onPress={() => setImageViewerVisible(false)}
                />
                <View style={styles.imageViewerContent}>
                  <View style={styles.imageViewerHeader}>
                    <TouchableOpacity
                      style={styles.imageViewerCloseButton}
                      onPress={() => setImageViewerVisible(false)}>
                      <Icon name="x" size={24} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    ref={imageScrollRef}
                    style={styles.imageViewerScrollContent}
                    contentContainerStyle={styles.imageViewerScrollContainer}
                    maximumZoomScale={5}
                    minimumZoomScale={1}
                    showsHorizontalScrollIndicator={false}
                    showsVerticalScrollIndicator={false}
                    bouncesZoom={true}
                    scrollEnabled={true}>
                    {viewingImageUrl && (
                      <Image
                        source={{ uri: viewingImageUrl }}
                        style={{
                          width: SCREEN_WIDTH,
                          height: SCREEN_HEIGHT,
                          minWidth: SCREEN_WIDTH,
                          minHeight: SCREEN_HEIGHT,
                        }}
                        resizeMode="contain"
                      />
                    )}
                  </ScrollView>
                </View>
              </View>
            </Modal>
          )}

          {/* 비디오 뷰어 모달 - ChatRoomScreen 모달 내부로 이동 */}
          {videoViewerVisible && (
            <Modal
              visible={true}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setVideoViewerVisible(false)}>
              <View style={styles.videoViewerContainer}>
                <TouchableOpacity
                  style={styles.videoViewerBackdrop}
                  activeOpacity={1}
                  onPress={() => setVideoViewerVisible(false)}
                />
                <View style={styles.videoViewerContent}>
                  <View style={styles.videoViewerHeader}>
                    <TouchableOpacity
                      style={styles.videoViewerCloseButton}
                      onPress={() => setVideoViewerVisible(false)}>
                      <Icon name="x" size={24} color={colors.white} />
                    </TouchableOpacity>
                  </View>
                  {viewingVideoUrl && (
                    <Video
                      source={{ uri: viewingVideoUrl }}
                      style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                      controls={true}
                      resizeMode="contain"
                      paused={false}
                      onError={(error) => {
                        console.error('비디오 재생 오류:', error);
                        alert('오류', '동영상을 재생할 수 없습니다.');
                        setVideoViewerVisible(false);
                      }}
                    />
                  )}
                </View>
              </View>
            </Modal>
          )}
          {/* 커스텀 갤러리 - 모달 내부로 이동 */}
          <CustomGallery
            visible={showCustomGallery}
            onClose={() => setShowCustomGallery(false)}
            onSelectImage={async (imageUri) => {
              // 이미지 URI를 Asset 형태로 변환하여 업로드
              const asset: Asset = {
                uri: imageUri,
                type: 'image/jpeg',
              };
              await uploadAndSendMedia(asset, 1); // content_type: 1 (image)
              setShowCustomGallery(false);
            }}
            cropperToolbarTitle="사진 편집"
            allowCropping={true}
            compressImageQuality={0.6}
          />
        </SafeAreaView>
      </Modal>

      {/* 더보기 메뉴 */}
      <BottomSheetMenu
        visible={menuVisible}
        options={
          selectedMessage
            ? [
              {
                id: 'report',
                icon: 'alert-triangle',
                label: '이 메시지 신고하기',
                color: colors.error,
              },
              { id: 'cancel', icon: 'x', label: '취소' },
            ]
            : [
              { id: 'leave', icon: 'log-out', label: '채팅방 나가기', color: colors.error },
              { id: 'report', icon: 'alert-triangle', label: '사용자 신고하기', color: colors.error },
            ]
        }
        onClose={() => {
          setMenuVisible(false);
          setSelectedMessage(null);
        }}
        onOptionPress={async item => {
          if (item === 'leave') {
            if (!roomId) {
              await alert('오류', '채팅방 정보를 찾을 수 없습니다.');
              return;
            }
            // useAlert를 사용하여 플랫폼별 최적 Alert 표시
            const confirmed = await confirm(
              '채팅방 나가기',
              '정말 채팅방에서 나가시겠습니까?',
              [
                {
                  text: '취소',
                  style: 'cancel',
                },
                {
                  text: '나가기',
                  style: 'destructive',
                },
              ],
            );

            if (confirmed) {
              try {
                const response = await ChatAPI.leaveRoom(roomId);
                if (response?.success) {
                  await alert('완료', '채팅방에서 나갔습니다.');
                  onClose();
                } else {
                  await alert('오류', response?.message || '채팅방 나가기에 실패했습니다.');
                }
              } catch (error: any) {
                console.error('채팅방 나가기 오류:', error);
                await alert('오류', error?.response?.data?.message || '채팅방 나가기 중 오류가 발생했습니다.');
              }
            }
            return;
          }

          if (item === 'report') {
            if (!peerId) {
              await alert('오류', '사용자 정보를 찾을 수 없습니다.');
              return;
            }
            // 신고 사유 선택 메뉴 표시
            setReportReasonMenuVisible(true);
            return;
          }
        }}
      />

      {/* 신고 사유 선택 메뉴 */}
      <BottomSheetMenu
        visible={reportReasonMenuVisible}
        options={[
          { id: 'cancel', icon: 'x', label: '취소' },
          { id: 'spam', icon: 'alert-triangle', label: '스팸/홍보', color: colors.error },
          { id: 'inappropriate', icon: 'alert-triangle', label: '부적절한 콘텐츠', color: colors.error },
          { id: 'harassment', icon: 'alert-triangle', label: '욕설/혐오 표현', color: colors.error },
          { id: 'sexual', icon: 'alert-triangle', label: '성적 괴롭힘', color: colors.error },
          { id: 'other', icon: 'alert-triangle', label: '기타', color: colors.error },
        ]}
        onClose={() => setReportReasonMenuVisible(false)}
        onOptionPress={async item => {
          if (item === 'cancel') {
            return;
          }

          if (!peerId) {
            await alert('오류', '사용자 정보를 찾을 수 없습니다.');
            return;
          }

          const reasonMap: { [key: string]: string } = {
            spam: '스팸/홍보',
            inappropriate: '부적절한 콘텐츠',
            harassment: '욕설/혐오 표현',
            sexual_content: '성적인 표현',
            child_safety: '아동 보호 정책 위반',
            other: '기타',
          };

          const reason = reasonMap[item] || '기타';
          await handleReportUser(reason, undefined, true);
        }}
      />


    </>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.m,
    backgroundColor: colors.white,
  },
  headerBtn: { padding: spacing.xs },
  headerTitle: {
    ...typography.h2,
    fontWeight: '700' as const,
    color: colors.textPrimary,
    flex: 1,
    textAlign: 'center',
  },
  messages: { flex: 1 },
  messageRow: { marginBottom: spacing.l },
  messageRowMe: { alignItems: 'flex-end' },
  spacer: { width: 1, height: 1 },
  bubble: {
    maxWidth: '80%',
    borderRadius: borderRadius.l,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.m,
    backgroundColor: colors.white,
  },
  bubbleOther: { backgroundColor: colors.white },
  bubbleMe: { backgroundColor: colors.secondary },
  bubbleText: { ...typography.bodyRegular, color: colors.textPrimary, fontWeight: '400' as const },
  bubbleTextMe: { ...typography.bodyRegular, color: colors.textPrimary, fontWeight: '400' as const },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  timeText: { ...typography.captionRegular, color: colors.textSecondary, fontWeight: '400' as const },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
  },
  attachBtn: { padding: spacing.xs },
  input: {
    flex: 1,
    ...typography.bodyRegular,
    color: colors.textPrimary,
    backgroundColor: colors.background,
    borderRadius: borderRadius.l,
    paddingHorizontal: spacing.m,
    paddingVertical: spacing.s,
    marginHorizontal: spacing.s,
    fontWeight: '400' as const,
    ...(Platform.OS === 'ios' && {
      lineHeight: undefined,
    }),
  },
  sendBtn: { padding: spacing.xs },
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
    paddingTop: spacing.xl * 2,
  },
  emptyText: {
    ...typography.bodyMedium,
    color: colors.textSecondary,
    fontWeight: '600' as const,
  },
  emptySubtext: {
    ...typography.bodyRegular,
    color: colors.textTertiary,
    fontWeight: '400' as const,
  },
  mediaImage: {
    width: 200,
    height: 200,
    borderRadius: borderRadius.m,
    marginBottom: spacing.xs,
  },
  videoContainer: {
    width: 200,
    height: 150,
    backgroundColor: colors.darkGray,
    borderRadius: borderRadius.m,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  videoText: {
    ...typography.captionRegular,
    color: colors.white,
    marginTop: spacing.xs,
    fontWeight: '400' as const,
  },
  fileContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: spacing.s,
    backgroundColor: colors.background,
    borderRadius: borderRadius.m,
    gap: spacing.s,
  },
  fileText: {
    ...typography.bodyRegular,
    color: colors.textPrimary,
    flex: 1,
    fontWeight: '400' as const,
  },
  mediaPanel: {
    backgroundColor: colors.white,
    borderTopWidth: 1,
    borderTopColor: colors.lightGray,
    paddingTop: spacing.m,
    paddingBottom: spacing.l,
    paddingHorizontal: spacing.m,
    minHeight: 120,
  },
  mediaPanelContent: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    paddingHorizontal: spacing.l,
  },
  mediaOption: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  mediaIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: colors.secondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  mediaOptionText: {
    ...typography.captionRegular,
    color: colors.textPrimary,
    fontWeight: '500' as const,
    marginTop: spacing.xs,
  },
  imageViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  imageViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  imageViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.m,
  },
  imageViewerCloseButton: {
    alignSelf: 'flex-end',
    padding: spacing.s,
  },
  imageViewerScrollContent: {
    flex: 1,
    width: '100%',
  },
  imageViewerScrollContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageViewerImage: {
    width: '100%',
    height: '100%',
  },
  videoViewerContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  videoViewerBackdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  videoViewerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoViewerHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: spacing.xl,
    paddingHorizontal: spacing.m,
    paddingBottom: spacing.m,
  },
  videoViewerCloseButton: {
    alignSelf: 'flex-end',
    padding: spacing.s,
  },
  videoViewerVideo: {
    width: '100%',
    height: '100%',
  },
});

export default ChatRoomScreen;





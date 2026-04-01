import React, {createContext, useContext, useState, useCallback} from 'react';
import {View, StyleSheet, TouchableOpacity, Animated, Modal} from 'react-native';
import {colors} from '../styles/commonStyles';

interface OverlayContextType {
  showOverlay: (content: React.ReactNode) => void;
  hideOverlay: () => void;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export const useOverlay = () => {
  const context = useContext(OverlayContext);
  if (!context) {
    throw new Error('useOverlay must be used within OverlayProvider');
  }
  return context;
};

interface OverlayProviderProps {
  children: React.ReactNode;
}

export const OverlayProvider: React.FC<OverlayProviderProps> = ({children}) => {
  const [overlayContent, setOverlayContent] = useState<React.ReactNode | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const fadeAnim = React.useRef(new Animated.Value(0)).current;

  const showOverlay = useCallback((content: React.ReactNode) => {
    setOverlayContent(content);
    setIsVisible(true);
    Animated.spring(fadeAnim, {
      toValue: 1,
      useNativeDriver: true,
      friction: 8,
      tension: 40,
    }).start();
  }, [fadeAnim]);

  const hideOverlay = useCallback(() => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setIsVisible(false);
      setOverlayContent(null);
    });
  }, [fadeAnim]);

  return (
    <OverlayContext.Provider value={{showOverlay, hideOverlay}}>
      {children}
      <Modal
        visible={isVisible}
        transparent
        animationType="none"
        onRequestClose={hideOverlay}>
        <Animated.View style={[styles.overlay, {opacity: fadeAnim}]}>
          <TouchableOpacity
            style={styles.backdrop}
            activeOpacity={1}
            onPress={hideOverlay}
          />
        </Animated.View>
        {overlayContent && (
          <Animated.View
            style={[
              styles.content,
              {
                opacity: fadeAnim,
                transform: [
                  {
                    scale: fadeAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.9, 1],
                    }),
                  },
                ],
              },
            ]}>
            {overlayContent}
          </Animated.View>
        )}
      </Modal>
    </OverlayContext.Provider>
  );
};

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  content: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
});


import React, {useState, useEffect, useRef} from 'react';
import {View, Text, StyleSheet, TouchableOpacity, Platform} from 'react-native';
import MapView, {Marker, Region} from 'react-native-maps';
import Icon from 'react-native-vector-icons/Feather';
import {LottieSpinner} from './common';
import Geolocation from '@react-native-community/geolocation';
import {colors, spacing, typography, borderRadius} from '../styles/commonStyles';

interface LocationMapPickerProps {
  initialRegion?: Region;
  onLocationSelect: (latitude: number, longitude: number) => void;
}

/**
 * 지도에서 위치를 선택하는 컴포넌트
 */
const LocationMapPicker: React.FC<LocationMapPickerProps> = ({
  initialRegion,
  onLocationSelect,
}) => {
  const mapRef = useRef<MapView>(null);
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [region, setRegion] = useState<Region>(
    initialRegion || {
      latitude: 37.5665,
      longitude: 126.978,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    },
  );
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 현재 위치 가져오기 (저정밀 모드로 빠르게 획득)
    if (!initialRegion) {
      setLoading(true);
      Geolocation.getCurrentPosition(
        position => {
          const {latitude, longitude} = position.coords;
          const newRegion: Region = {
            latitude,
            longitude,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          };
          setRegion(newRegion);
          setSelectedLocation({latitude, longitude});
          mapRef.current?.animateToRegion(newRegion, 1000);
          setLoading(false);
        },
        error => {
          console.log('⚠️ [위치 선택] 현재 위치 가져오기 실패:', error);
          setLoading(false);
        },
        {
          enableHighAccuracy: false, // 저정밀 모드로 변경 (빠른 응답)
          timeout: 5000,
          maximumAge: 300000, // 5분 캐시 허용
        },
      );
    } else {
      setSelectedLocation({
        latitude: initialRegion.latitude,
        longitude: initialRegion.longitude,
      });
    }
  }, [initialRegion]);

  const handleMapPress = (event: any) => {
    const {latitude, longitude} = event.nativeEvent.coordinate;
    setSelectedLocation({latitude, longitude});
  };

  const handleConfirm = () => {
    if (selectedLocation) {
      onLocationSelect(selectedLocation.latitude, selectedLocation.longitude);
    }
  };

  const handleCurrentLocation = () => {
    setLoading(true);
    Geolocation.getCurrentPosition(
      position => {
        const {latitude, longitude} = position.coords;
        const newRegion: Region = {
          latitude,
          longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        setRegion(newRegion);
        setSelectedLocation({latitude, longitude});
        mapRef.current?.animateToRegion(newRegion, 1000);
        setLoading(false);
      },
      error => {
        console.log('⚠️ [위치 선택] 현재 위치 가져오기 실패:', error);
        setLoading(false);
      },
      {
        enableHighAccuracy: false, // 저정밀 모드로 변경 (빠른 응답)
        timeout: 5000,
        maximumAge: 300000, // 5분 캐시 허용
      },
    );
  };

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={Platform.OS === 'ios' ? undefined : 'google'}
        initialRegion={region}
        onPress={handleMapPress}
        showsUserLocation={true}
        showsMyLocationButton={false}>
        {selectedLocation && (
          <Marker
            coordinate={{
              latitude: selectedLocation.latitude,
              longitude: selectedLocation.longitude,
            }}
            draggable
            onDragEnd={event => {
              const {latitude, longitude} = event.nativeEvent.coordinate;
              setSelectedLocation({latitude, longitude});
            }}
          />
        )}
      </MapView>

      {loading && (
        <View style={styles.loadingOverlay}>
          <LottieSpinner size="large" />
        </View>
      )}

      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={styles.currentLocationButton}
          onPress={handleCurrentLocation}>
          <Icon name="crosshair" size={20} color={colors.primary} />
          <Text style={styles.currentLocationText}>현재 위치</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.confirmButton,
            !selectedLocation && styles.confirmButtonDisabled,
          ]}
          onPress={handleConfirm}
          disabled={!selectedLocation}>
          <Text style={styles.confirmButtonText}>위치 선택</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
  },
  buttonContainer: {
    position: 'absolute',
    bottom: spacing.l,
    left: spacing.l,
    right: spacing.l,
    flexDirection: 'row',
    gap: spacing.m,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.white,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: borderRadius.m,
    gap: spacing.s,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  currentLocationText: {
    ...typography.bodyMedium,
    color: colors.textPrimary,
  },
  confirmButton: {
    flex: 1,
    backgroundColor: colors.primary,
    paddingVertical: spacing.m,
    paddingHorizontal: spacing.l,
    borderRadius: borderRadius.m,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  confirmButtonDisabled: {
    opacity: 0.5,
  },
  confirmButtonText: {
    ...typography.bodyMedium,
    color: colors.white,
    fontWeight: '600',
  },
});

export default LocationMapPicker;


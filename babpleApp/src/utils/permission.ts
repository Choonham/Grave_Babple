import { Platform, Alert, Linking } from 'react-native';
import { check, request, PERMISSIONS, RESULTS, Permission, openSettings } from 'react-native-permissions';

export type PermissionType = 'camera' | 'photo' | 'location' | 'notification';

const ANDROID_PERMISSIONS = {
    camera: PERMISSIONS.ANDROID.CAMERA,
    photo: Number(Platform.Version) >= 33
        ? PERMISSIONS.ANDROID.READ_MEDIA_IMAGES
        : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
    location: PERMISSIONS.ANDROID.ACCESS_FINE_LOCATION,
    notification: Number(Platform.Version) >= 33
        ? 'android.permission.POST_NOTIFICATIONS'
        : null,
};

const IOS_PERMISSIONS = {
    camera: PERMISSIONS.IOS.CAMERA,
    photo: PERMISSIONS.IOS.PHOTO_LIBRARY,
    location: PERMISSIONS.IOS.LOCATION_WHEN_IN_USE,
    notification: (PERMISSIONS as any).IOS?.NOTIFICATIONS || null, // iOS notifications are often handled via PushNotificationIOS, but RNPermissions might support it
};

const getPermission = (type: PermissionType): Permission | null => {
    const permissions = Platform.OS === 'android' ? ANDROID_PERMISSIONS : IOS_PERMISSIONS;
    return permissions[type] as Permission | null;
};

/**
 * Checks the status of a specific permission.
 */
export const checkPermission = async (type: PermissionType): Promise<string> => {
    const permission = getPermission(type);
    if (!permission) return RESULTS.UNAVAILABLE; // or GRANTED if not applicable?

    try {
        const result = await check(permission);
        return result;
    } catch (error) {
        console.error(`Error checking permission ${type}:`, error);
        return RESULTS.DENIED;
    }
};

/**
 * Requests a specific permission.
 * If permission is blocked/denied, it can optionally show an alert to open settings.
 */
export const requestPermission = async (
    type: PermissionType,
    rationale?: { title: string; message: string; }
): Promise<boolean> => {
    const permission = getPermission(type);
    console.log(`[Permission] Requesting ${type}`, { permission, platform: Platform.OS, version: Platform.Version });

    if (!permission) {
        console.log(`[Permission] No permission defined for ${type}`);
        return true; // Permission not required for this OS/Version
    }

    try {
        const status = await check(permission);
        console.log(`[Permission] Check status for ${type}:`, status);

        if (status === RESULTS.GRANTED) return true;

        if (status === RESULTS.BLOCKED) {
            console.log(`[Permission] Status is BLOCKED for ${type}. Rationale provided?`, !!rationale);
            if (rationale) {
                await showSettingsAlert(rationale.title, rationale.message);
            }
            return false;
        }

        const result = await request(permission);
        console.log(`[Permission] Request result for ${type}:`, result);

        if (result === RESULTS.GRANTED) return true;

        if ((result === RESULTS.BLOCKED || result === RESULTS.DENIED) && rationale) {
            console.log(`[Permission] Showing rationale alert for ${type}. Result: ${result}`);
            await showSettingsAlert(rationale.title, rationale.message);
        }
        return false;
    } catch (error) {
        console.error(`Error requesting permission ${type}:`, error);
        return false;
    }
};

/**
 * Shows an alert guiding the user to settings.
 * Returns a promise that resolves when the alert is closed.
 */
const showSettingsAlert = (title: string, message: string): Promise<void> => {
    return new Promise((resolve) => {
        Alert.alert(
            title,
            message,
            [
                { text: '취소', style: 'cancel', onPress: () => resolve() },
                {
                    text: '설정으로 이동', onPress: async () => {
                        await openAppSettings();
                        resolve();
                    }
                },
            ]
        );
    });
};

/**
 * Opens app settings.
 */
export const openAppSettings = async () => {
    try {
        await openSettings();
    } catch (error) {
        console.error('Error opening settings:', error);
        if (Platform.OS === 'ios') {
            Linking.openURL('app-settings:');
        } else {
            Linking.openSettings();
        }
    }
};

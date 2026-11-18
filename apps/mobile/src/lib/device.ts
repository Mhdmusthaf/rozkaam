// Camera and GPS helpers. Both fail soft: they return null instead of throwing,
// so a screen can show a clear message and let the person retry.
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Linking, Platform } from 'react-native';

/**
 * Development builds on the web only: automated browser tests cannot drive the
 * camera or file picker, so a test can set `window.__rozTestPhoto` to an image
 * URL and every photo step uses it. Never active in a release build.
 */
const testPhoto = (): string | null => {
  if (!__DEV__ || Platform.OS !== 'web') return null;
  const v = (globalThis as { __rozTestPhoto?: unknown }).__rozTestPhoto;
  return typeof v === 'string' ? v : null;
};

/** Opens the camera (front or back) and returns the photo URI, or null. */
export async function takePhoto(opts: { front?: boolean } = {}): Promise<string | null> {
  const fake = testPhoto();
  if (fake) return fake;
  try {
    if (Platform.OS !== 'web') {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) return null;
    }
    const res = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      quality: 0.6,
      cameraType: opts.front ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
    });
    return res.canceled ? null : (res.assets[0]?.uri ?? null);
  } catch {
    // Browsers without camera capture fall back to choosing a file.
    return pickPhoto();
  }
}

/** Lets the person choose an existing image. */
export async function pickPhoto(): Promise<string | null> {
  try {
    const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.6 });
    return res.canceled ? null : (res.assets[0]?.uri ?? null);
  } catch {
    return null;
  }
}

export interface Fix {
  lat: number;
  lng: number;
  accuracy: number | null;
}

/** Current GPS position, or null when permission is denied or unavailable. */
export async function getFix(): Promise<Fix | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (!perm.granted) return null;
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      new Promise<null>((r) => setTimeout(() => r(null), 12000)),
    ]);
    if (!pos) return null;
    return { lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy };
  } catch {
    return null;
  }
}

/** Opens the venue in the phone's maps app. */
export function openMaps(lat: number, lng: number, label: string) {
  const q = encodeURIComponent(label);
  const url = Platform.select({
    ios: `http://maps.apple.com/?ll=${lat},${lng}&q=${q}`,
    android: `geo:${lat},${lng}?q=${lat},${lng}(${q})`,
    default: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
  })!;
  Linking.openURL(url).catch(() => {});
}

export const callPhone = (phone: string) => Linking.openURL(`tel:${phone.replace(/\s/g, '')}`).catch(() => {});

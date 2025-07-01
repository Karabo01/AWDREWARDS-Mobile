import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? ''
    : 'http://192.168.0.50:8081';

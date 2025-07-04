import { Platform } from 'react-native';

export const API_BASE_URL =
  Platform.OS === 'web'
    ? ''
    : 'http://13.247.119.74:8081';

import { useEffect } from 'react';
import { Stack, useSegments, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useFrameworkReady } from '@/hooks/useFrameworkReady';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';

function RootLayoutNav() {
  const { isAuthenticated, isLoading, user } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading) {
      const inAuthGroup = segments[0] === 'auth';
      const needsPasswordChange = user?.passwordChanged === false;

      if (!isAuthenticated && !inAuthGroup) {
        router.replace('/auth');
      } else if (isAuthenticated && inAuthGroup) {
        if (needsPasswordChange && segments[1] !== 'change-password') {
          router.replace('/auth/change-password');
        } 
        // Only redirect away from change-password if passwordChanged is true
        else if (!needsPasswordChange && segments[1] === 'change-password') {
          router.replace('/select-tenant');
        } 
        // Prevent double redirect: only redirect to select-tenant if not on change-password and passwordChanged is true
        else if (!needsPasswordChange && segments[1] !== 'change-password') {
          router.replace('/select-tenant');
        }
      }
    }
  }, [isAuthenticated, isLoading, segments, user?.passwordChanged]);

  return (
    <>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen
          name="(auth)"
          options={{ headerShown: false }}
        />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="+not-found" />
      </Stack>
      <StatusBar style="auto" />
    </>
  );
}

export default function RootLayout() {
  useFrameworkReady();

  return (
    <AuthProvider>
      <RootLayoutNav />
    </AuthProvider>
  );
}
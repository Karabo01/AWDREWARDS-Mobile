import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { API_BASE_URL } from '@/utils/api';
import { Picker } from '@react-native-picker/picker';

// Add the signature constant (should match your server)
const APP_SIGNATURE = '2d1e7f8b-4c9a-4e2b-9f3d-8b7e6c5a1d2f$!@';

export default function SelectTenantScreen() {
  const { user, setSelectedTenantId } = useAuth();
  const [tenants, setTenants] = useState<{ _id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchTenants();
  }, [user]);

  const fetchTenants = async () => {
    setLoading(true);
    try {
      // Get tenantIds from user (can be string or array)
      let userTenantIds: string[] = [];
      if (!user) {
        setTenants([]);
        setLoading(false);
        return;
      }
      if (Array.isArray(user.tenantId)) {
        userTenantIds = user.tenantId;
      } else if (typeof user.tenantId === 'string') {
        userTenantIds = [user.tenantId];
      }

      // Fetch all tenants WITH the required signature header
      const response = await fetch(`${API_BASE_URL}/api/tenants`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-awd-app-signature': APP_SIGNATURE
        }
      });

      // Add better error handling
      if (!response.ok) {
        const errorText = await response.text();
        console.error('Tenants fetch error:', response.status, errorText);
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Tenants response:', data); // Debug log
      
      const filtered = (data.tenants || []).filter((t: any) =>
        userTenantIds.includes(t._id)
      );
      
      setTenants(filtered);
      if (filtered.length === 1) {
        setSelected(filtered[0]._id);
        // Auto-select if only one tenant
        setSelectedTenantId(filtered[0]._id);
        router.replace('/(tabs)');
      }
    } catch (e) {
      console.error('Fetch tenants error:', e);
      setTenants([]);
    }
    setLoading(false);
  };

  const handleSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color="#2563EB" />
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={{ textAlign: 'center', marginTop: 40 }}>No user found.</Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Your Location</Text>
        <Text style={styles.subtitle}>Choose the business location to view your points and rewards</Text>
      </View>
      {tenants.length > 1 ? (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selected}
            onValueChange={(itemValue) => setSelected(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select a location..." value={null} />
            {tenants.map((tenant) => (
              <Picker.Item key={tenant._id} label={tenant.name} value={tenant._id} />
            ))}
          </Picker>
          <TouchableOpacity
            style={[styles.tenantButton, !selected && { opacity: 0.5 }]}
            onPress={() => selected && handleSelect(selected)}
            disabled={!selected}
          >
            <Text style={styles.tenantButtonText}>Continue</Text>
          </TouchableOpacity>
        </View>
      ) : tenants.length === 1 ? null : (
        <Text style={{ textAlign: 'center', marginTop: 40 }}>No locations available for your account.</Text>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  header: { alignItems: 'center', marginTop: 48, marginBottom: 24, paddingHorizontal: 24 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#111827', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#6B7280', textAlign: 'center' },
  pickerContainer: { paddingHorizontal: 24, marginTop: 24 },
  picker: { backgroundColor: '#F3F4F6', borderRadius: 12, marginBottom: 24 },
  tenantButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  tenantButtonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
});
import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'expo-router';
import { Picker } from '@react-native-picker/picker';

export default function SelectTenantScreen() {
  const { user, setSelectedTenantId, tenants, fetchTenants } = useAuth();
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (user) {
      setLoading(true);
      fetchTenants().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [user]);

  // Filter tenants to only those the user is a member of
  let userTenantIds: string[] = [];
  if (user) {
    if (Array.isArray(user.tenantId)) {
      userTenantIds = user.tenantId;
    } else if (typeof user.tenantId === 'string') {
      userTenantIds = [user.tenantId];
    }
  }
  const filteredTenants = tenants.filter(t => userTenantIds.includes(t._id));

  useEffect(() => {
    if (filteredTenants.length === 1) {
      setSelected(filteredTenants[0]._id);
      setSelectedTenantId(filteredTenants[0]._id);
      router.replace('/(tabs)');
    }
  }, [filteredTenants.length]);

  const handleSelect = (tenantId: string) => {
    setSelectedTenantId(tenantId);
    router.replace('/(tabs)');
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color="#2563EB" />
          <Text style={styles.loadingText}>Loading locations...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!user) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>No user found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centerContainer}>
          <Text style={styles.errorText}>Error: {error}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={fetchTenants}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Select Your Location</Text>
        <Text style={styles.subtitle}>Choose the business location to view your points and rewards</Text>
      </View>
      {filteredTenants.length > 1 ? (
        <View style={styles.pickerContainer}>
          <Picker
            selectedValue={selected}
            onValueChange={(itemValue) => setSelected(itemValue)}
            style={styles.picker}
          >
            <Picker.Item label="Select a location..." value={null} />
            {filteredTenants.map((tenant) => (
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
      ) : filteredTenants.length === 1 ? null : (
        <View style={styles.centerContainer}>
          <Text style={styles.noTenantsText}>No locations available for your account.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  centerContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
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
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#6B7280',
  },
  errorText: {
    fontSize: 16,
    color: '#EF4444',
    textAlign: 'center',
    marginBottom: 16,
  },
  noTenantsText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  retryButton: {
    backgroundColor: '#2563EB',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
});
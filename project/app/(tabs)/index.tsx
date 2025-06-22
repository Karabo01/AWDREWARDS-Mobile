import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  Alert, 
  Platform,
  Dimensions
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/types/user';
import { Award, ChevronRight, Gift, LogOut } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { storage } from '@/utils/storage';
import { API_BASE_URL } from '@/utils/api';

export default function HomeScreen() {
  const { user, refreshUser, logout, selectedTenantId } = useAuth();
  const router = useRouter();
  const [recentTransactions, setRecentTransactions] = useState<Transaction[]>([]);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Add state for tenants
  const [tenantsMap, setTenantsMap] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (user) {
      fetchRecentTransactions();
      fetchAllTransactions();
      fetchTenants();
    }
  }, [user]);

  const fetchRecentTransactions = async () => {
    try {
      const token = await storage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/transactions/recent`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setRecentTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchAllTransactions = async () => {
    try {
      const token = await storage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setAllTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch all transactions:', error);
    }
  };

  // Fetch tenants for the slider
  const fetchTenants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants`);
      if (response.ok) {
        const data = await response.json();
        const map: { [key: string]: string } = {};
        (data.tenants || []).forEach((tenant: any) => {
          map[tenant._id] = tenant.name;
        });
        setTenantsMap(map);
      }
    } catch (error) {
      console.error('Failed to fetch tenants:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    await fetchRecentTransactions();
    await fetchAllTransactions();
    setIsRefreshing(false);
  };

  // Calculate total earned points (sum of all POINTS_EARNED transactions)
  const totalEarned = allTransactions
    .filter(t => t.type === 'POINTS_EARNED')
    .reduce((sum, t) => sum + Math.abs(t.points), 0);

  // Find the earliest transaction date for "Member Since"
  const memberSince = allTransactions.length > 0
    ? new Date(
        allTransactions
          .map(t => new Date(t.createdAt))
          .sort((a, b) => a.getTime() - b.getTime())[0]
      )
    : null;

  const handleLogout = async () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Sign Out', 
          style: 'destructive',
          onPress: async () => {
            setIsRefreshing(true);
            try {
              await logout();
              router.replace('/auth');
            } catch (error) {
              console.error('Logout failed:', error);
            } finally {
              setIsRefreshing(false);
            }
          }
        }
      ]
    );
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  };

  const getTransactionTypeFromString = (type: string) => {
    switch (type) {
      case 'REWARD_REDEEMED':
        return 'redeemed';
      case 'POINTS_EARNED':
        return 'earned';
      default:
        return 'earned';
    }
  };

  // Only include transactions for selected tenant
  const tenantTransactions = allTransactions.filter(tx => tx.tenantId === selectedTenantId);

  // Calculate current points for selected tenant
  const points = tenantTransactions.length > 0
    ? tenantTransactions
        .slice()
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0].balance
    : 0;

  if (!user || !selectedTenantId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  // Only include tenants the user has transactions with
  const userTenantIds = Object.keys(
    allTransactions.reduce((acc, tx) => {
      acc[tx.tenantId] = true;
      return acc;
    }, {} as { [tenantId: string]: boolean })
  );

  // Optionally, sort userTenantIds by tenant name or other criteria
  userTenantIds.sort((a, b) => (tenantsMap[a] || '').localeCompare(tenantsMap[b] || ''));

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.greeting}>
            Hello, {user?.name || user?.email || 'Guest'}!
          </Text>
          <Text style={styles.subtitle}>Welcome back to AWDRewards</Text>
        </View>

        {/* Show points for selected tenant */}
        <View style={styles.statsContainer}>
          <View style={styles.currentPointsCard}>
            <Text style={styles.currentPointsLabel}>
              {tenantsMap[selectedTenantId] || 'Unknown Business'}
            </Text>
            <Text style={styles.currentPointsValue}>
              {typeof points === 'number' ? points.toLocaleString() : '0'}
            </Text>
            <Text style={styles.currentPointsSubtext}>Points</Text>
          </View>
        </View>

        {/* Remove the total points section here, so each card only shows its tenant's points */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Recent Activity</Text>
            <TouchableOpacity onPress={() => router.push('/(tabs)/points')}>
              <Text style={styles.sectionLink}>View All</Text>
            </TouchableOpacity>
          </View>

          {recentTransactions.filter(tx => tx.tenantId === selectedTenantId).length > 0 ? (
            <View style={styles.transactionsList}>
              {recentTransactions
                .filter(tx => tx.tenantId === selectedTenantId)
                .slice(0, 5)
                .map((transaction) => (
                  <View key={transaction._id} style={styles.transactionItem}>
                    <View style={styles.transactionContent}>
                      <View style={styles.transactionInfo}>
                        <Text style={styles.transactionDescription}>
                          {transaction.description}
                        </Text>
                        <Text style={styles.transactionDate}>
                          {transaction.createdAt
                            ? formatDate(transaction.createdAt)
                            : '--'}
                        </Text>
                      </View>
                      <View style={styles.transactionPoints}>
                        <Text style={[
                          styles.transactionPointsText,
                          getTransactionTypeFromString(transaction.type) === 'earned'
                            ? styles.pointsEarned
                            : styles.pointsRedeemed
                        ]}>
                          {getTransactionTypeFromString(transaction.type) === 'earned'
                            ? '+'
                            : ''}
                          {Math.abs(transaction.points)}
                        </Text>
                      </View>
                    </View>
                  </View>
                ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No recent activity. Start earning points at participating locations!
              </Text>
            </View>
          )}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.quickActions}>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/rewards')}
            >
              <Gift size={24} color="#2563EB" />
              <Text style={styles.actionButtonText}>Browse Rewards</Text>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={styles.actionButton}
              onPress={() => router.push('/(tabs)/points')}
            >
              <Award size={24} color="#10B981" />
              <Text style={styles.actionButtonText}>Points History</Text>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.actionButton, styles.logoutButton]} 
              onPress={handleLogout}
            >
              <LogOut size={24} color="#EF4444" />
              <Text style={[styles.actionButtonText, styles.logoutButtonText]}>Sign Out</Text>
              <ChevronRight size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  scrollView: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    paddingHorizontal: 24,
    paddingVertical: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },
  statsContainer: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  currentPointsCard: {
    backgroundColor: '#2563EB',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    // width is set dynamically in renderTenantCard
    boxShadow: '0px 8px 16px rgba(37, 99, 235, 0.3)',
    elevation: 8,
    // Center content vertically and horizontally
    justifyContent: 'center',
  },
  currentPointsCardActive: {
    borderWidth: 2,
    borderColor: '#2563EB',
  },
  currentPointsLabel: {
    fontSize: 16,
    color: '#E0E7FF',
    marginBottom: 8,
  },
  currentPointsValue: {
    fontSize: 48,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 4,
  },
  currentPointsSubtext: {
    fontSize: 14,
    color: '#E0E7FF',
  },
  section: {
    paddingHorizontal: 24,
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  sectionLink: {
    fontSize: 14,
    color: '#2563EB',
    fontWeight: '600',
  },
  transactionsList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
  },
  transactionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  transactionContent: {
    flexDirection: 'row',
    padding: 16,
    alignItems: 'center',
  },
  transactionInfo: {
    flex: 1,
  },
  transactionDescription: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  transactionBusiness: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  transactionDate: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  transactionPoints: {
    alignItems: 'flex-end',
  },
  transactionPointsText: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  pointsEarned: {
    color: '#10B981',
  },
  pointsRedeemed: {
    color: '#EF4444',
  },
  emptyState: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 24,
  },
  quickActions: {
    gap: 12,
  },
  actionButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
    elevation: 2,
  },
  logoutButton: {
    borderWidth: 1,
    borderColor: '#FEE2E2',
    backgroundColor: '#FEF2F2',
  },
  actionButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginLeft: 16,
  },
  logoutButtonText: {
    color: '#EF4444',
  },
});
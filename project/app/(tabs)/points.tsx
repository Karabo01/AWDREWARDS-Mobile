import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  Platform,
  DeviceEventEmitter 
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Transaction } from '@/types/user';
import { TrendingUp, TrendingDown, Filter } from 'lucide-react-native';
import { storage } from '@/utils/storage';
import { API_BASE_URL } from '@/utils/api';
import { ScrollView as RNScrollView } from 'react-native';

export default function PointsScreen() {
  const { user, refreshUser, logout, selectedTenantId, tenants } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'earned' | 'redeemed'>('all');
  const [tenantsMap, setTenantsMap] = useState<{ [key: string]: string }>({});


  useEffect(() => {
    if (user) {
      fetchTransactions();
      fetchTenants();
    }
    // Listen for refreshPointsTab event
    const sub1 = DeviceEventEmitter.addListener('refreshPointsTab', async () => {
      await refreshUser();
      await fetchTransactions();
    });
    // Listen for global refresh event
    const sub2 = DeviceEventEmitter.addListener('refreshAllTabs', async () => {
      await handleRefresh();
    });
    return () => {
      sub1.remove();
      sub2.remove();
    };
  }, [user]);

  const fetchTransactions = async () => {
    try {
      const token = await storage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/transactions`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      if (response.ok) {
        const data = await response.json();
        setTransactions(data.transactions);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const fetchTenants = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/tenants`);
      if (response.ok) {
        const data = await response.json();
        // Build a map of tenantId to tenant name
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
    await fetchTransactions();
    await fetchTenants(); // also refresh tenants for up-to-date names
    setIsRefreshing(false);
  };

  // Only show transactions for selected tenant
  const selectedTenantTransactions = transactions.filter(tx => tx.tenantId === selectedTenantId);
  const selectedTenant = tenants.find(t => t._id === selectedTenantId);
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

  const filteredTransactions = selectedTenantTransactions.filter(transaction => {
    if (filter === 'all') return true;
    return getTransactionTypeFromString(transaction.type) === filter;
  });

  const totalEarnedThisMonth = selectedTenantTransactions
    .filter(t => {
      const transactionDate = new Date(t.createdAt);
      const currentDate = new Date();
      return t.type === 'POINTS_EARNED' && 
             transactionDate.getMonth() === currentDate.getMonth() &&
             transactionDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((sum, t) => sum + Math.abs(t.points), 0);

  const totalRedeemedThisMonth = selectedTenantTransactions
    .filter(t => {
      const transactionDate = new Date(t.createdAt);
      const currentDate = new Date();
      return t.type === 'REWARD_REDEEMED' && 
             transactionDate.getMonth() === currentDate.getMonth() &&
             transactionDate.getFullYear() === currentDate.getFullYear();
    })
    .reduce((sum, t) => sum + Math.abs(t.points), 0);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric',
      weekday: 'short'
    });
  };

  if (!user || !selectedTenantId) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text>Loading...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Points Overview</Text>
          <Text style={styles.subtitle}>
             {selectedTenant ? ` ${selectedTenant.name}` : 'Welcome back to AWDRewards'}
          </Text>
        </View>

        <View style={styles.statsContainer}>
          <View style={styles.currentPointsCard}>
            <Text style={styles.currentPointsLabel}>
               {selectedTenant ? ` ${selectedTenant.name}` : 'Welcome back to AWDRewards'}
            </Text>
            <Text style={styles.currentPointsValue}>
              {typeof (selectedTenantTransactions[0]?.balance) === 'number'
                ? selectedTenantTransactions[0].balance.toLocaleString()
                : '0'}
            </Text>
            <Text style={styles.currentPointsSubtext}>Points</Text>
          </View>

          <View style={styles.monthlyStats}>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <TrendingUp size={20} color="#10B981" />
              </View>
              <Text style={styles.statValue}>{totalEarnedThisMonth}</Text>
              <Text style={styles.statLabel}>Earned This Month</Text>
            </View>
            <View style={styles.statCard}>
              <View style={styles.statIcon}>
                <TrendingDown size={20} color="#EF4444" />
              </View>
              <Text style={styles.statValue}>{totalRedeemedThisMonth}</Text>
              <Text style={styles.statLabel}>Redeemed This Month</Text>
            </View>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Transaction History</Text>
            <TouchableOpacity style={styles.filterButton}>
              <Filter size={16} color="#6B7280" />
            </TouchableOpacity>
          </View>

          <View style={styles.filterTabs}>
            <TouchableOpacity 
              style={[styles.filterTab, filter === 'all' && styles.filterTabActive]}
              onPress={() => setFilter('all')}
            >
              <Text style={[styles.filterTabText, filter === 'all' && styles.filterTabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterTab, filter === 'earned' && styles.filterTabActive]}
              onPress={() => setFilter('earned')}
            >
              <Text style={[styles.filterTabText, filter === 'earned' && styles.filterTabTextActive]}>
                Earned
              </Text>
            </TouchableOpacity>
            <TouchableOpacity 
              style={[styles.filterTab, filter === 'redeemed' && styles.filterTabActive]}
              onPress={() => setFilter('redeemed')}
            >
              <Text style={[styles.filterTabText, filter === 'redeemed' && styles.filterTabTextActive]}>
                Redeemed
              </Text>
            </TouchableOpacity>
          </View>

          {filteredTransactions.length > 0 ? (
            <View style={styles.transactionsList}>
              {filteredTransactions.map((transaction) => (
                <View key={transaction._id} style={styles.transactionItem}>
                  <View style={styles.transactionContent}>
                    <View style={[
                      styles.transactionIcon,
                      transaction.type === 'POINTS_EARNED' ? styles.earnedIcon : styles.redeemedIcon
                    ]}>
                      {transaction.type === 'POINTS_EARNED' ? (
                        <TrendingUp size={16} color="#ffffff" />
                      ) : (
                        <TrendingDown size={16} color="#ffffff" />
                      )}
                    </View>
                    <View style={styles.transactionInfo}>
                      <Text style={styles.transactionDescription}>
                        {transaction.description}
                      </Text>
                      <Text style={styles.transactionBusiness}>
                        {tenantsMap[transaction.tenantId] || 'Unknown Business'}
                      </Text>
                      <Text style={styles.transactionBalance}>
                        Balance: {transaction.balance.toLocaleString()} points
                      </Text>
                      <Text style={styles.transactionDate}>
                        {formatDate(transaction.createdAt)}
                      </Text>
                    </View>
                    <View style={styles.transactionPoints}>
                      <Text style={[
                        styles.transactionPointsText,
                        transaction.type === 'POINTS_EARNED' ? styles.pointsEarned : styles.pointsRedeemed
                      ]}>
                        {transaction.type === 'POINTS_EARNED' ? '+' : ''}{Math.abs(transaction.points)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <Text style={styles.emptyStateText}>
                No transactions found for the selected filter.
              </Text>
            </View>
          )}
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
  title: {
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
    width: 350, // Optional: set a fixed width for consistent centering
    alignSelf: 'center', // Center the card horizontally
    boxShadow: '0px 8px 16px rgba(37, 99, 235, 0.3)',
    elevation: 8,
    justifyContent: 'center', // Center content vertically
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
  monthlyStats: {
    flexDirection: 'row',
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    alignItems: 'center',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
    elevation: 2,
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6B7280',
    textAlign: 'center',
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
  filterButton: {
    padding: 8,
  },
  filterTabs: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
    elevation: 2,
  },
  filterTab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  filterTabActive: {
    backgroundColor: '#2563EB',
  },
  filterTabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  filterTabTextActive: {
    color: '#ffffff',
  },
  transactionsList: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
    elevation: 2,
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
  transactionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  earnedIcon: {
    backgroundColor: '#10B981',
  },
  redeemedIcon: {
    backgroundColor: '#EF4444',
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
  transactionBalance: {
    fontSize: 13,
    color: '#4B5563',
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
    fontSize: 18,
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
});
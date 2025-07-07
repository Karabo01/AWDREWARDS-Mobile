import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  Alert,
  Platform,
  DeviceEventEmitter,
  TouchableOpacity,
  Modal
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Reward } from '@/types/user';
import { Star, Gift } from 'lucide-react-native';
import { API_BASE_URL } from '@/utils/api';
import QRCode from 'react-native-qrcode-svg';
import { storage } from '@/utils/storage';
import { Transaction } from '@/types/user';

export default function RewardsScreen() {
  const { user, refreshUser, selectedTenantId } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [qrReward, setQRReward] = useState<Reward | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);

  useEffect(() => {
    fetchRewards();
    fetchTransactions();
    // Listen for global refresh event
    // const sub = DeviceEventEmitter.addListener('refreshAllTabs', async () => {
    //   await handleRefresh();
    // });
    // return () => sub.remove();
  }, []);

  const fetchRewards = async () => {
    try {
      console.log('Fetching rewards from:', `${API_BASE_URL}/api/rewards`);
      const token = await storage.getItem('authToken');
      const response = await fetch(`${API_BASE_URL}/api/rewards`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'x-awd-app-signature': '2d1e7f8b-4c9a-4e2b-9f3d-8b7e6c5a1d2f$!@', // Replace with your actual signature
        },
      });
      console.log('Rewards response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('Rewards API response:', data);
        console.log('Rewards array:', data.rewards);
        setRewards(data.rewards || []);
        console.log('Fetched rewards:', data.rewards?.length || 0);
      } else {
        console.error('Rewards API error:', response.status, response.statusText);
        const errorText = await response.text();
        console.error('Error response:', errorText);
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    }
  };

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
        console.log('Fetched transactions:', data.transactions.length);
      }
    } catch (error) {
      console.error('Failed to fetch transactions:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([
        refreshUser(),
        fetchRewards(),
        fetchTransactions()
      ]);
    } catch (error) {
      console.error('Refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!user) return;

    const currentPoints = getUserPointsForTenant();
    
    if (currentPoints < reward.pointsRequired) {
      Alert.alert(
        'Insufficient Points',
        `You need ${reward.pointsRequired - currentPoints} more points to redeem this reward.`,
        [{ text: 'OK' }]
      );
      return;
    }

    Alert.alert(
      'Confirm Redemption',
      `Are you sure you want to redeem "${reward.name}" for ${reward.pointsRequired} points?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Redeem', onPress: () => processRedemption(reward) }
      ]
    );
  };

  const processRedemption = async (reward: Reward) => {
    try {
      const response = await fetch(`${API_BASE_URL}/api/rewards/redeem`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ rewardId: reward._id }),
      });

      if (response.ok) {
        Alert.alert(
          'Reward Redeemed!',
          'Your reward has been successfully redeemed. Show this confirmation to the business to claim your reward.',
          [{ text: 'OK' }]
        );
        await refreshUser();
        await fetchRewards();
        // Notify points tab to refresh transactions
        DeviceEventEmitter.emit('refreshPointsTab');
      } else {
        const error = await response.json();
        Alert.alert('Redemption Failed', error.message || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem reward. Please try again.');
    }
  };

  // Get user's current points for selected tenant
  const getUserPointsForTenant = () => {
    if (!user || !selectedTenantId) return 0;
    
    // Calculate from transactions for the selected tenant
    const tenantTransactions = transactions
      .filter(tx => tx.tenantId === selectedTenantId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    return tenantTransactions.length > 0 ? tenantTransactions[0].balance : 0;
  };

  const currentPoints = getUserPointsForTenant();

  // Only show rewards for selected tenant
  const tenantRewards = rewards.filter(r => r.tenantId === selectedTenantId);

  // Show rewards that user qualifies for (in selected tenant)
  const qualifiedRewards = tenantRewards.filter(
    reward => currentPoints >= reward.pointsRequired
  );

  // // Debug logging
  // console.log('Debug Info:', {
  //   selectedTenantId,
  //   currentPoints,
  //   totalRewards: rewards.length,
  //   tenantRewards: tenantRewards.length,
  //   qualifiedRewards: qualifiedRewards.length,
  //   userPoints: user?.points,
  //   transactionsCount: transactions.length,
  //   tenantTransactionsCount: transactions.filter(tx => tx.tenantId === selectedTenantId).length
  // });

  // QR code data for redemption
  const qrData = user && qrReward ? JSON.stringify({
    name: user.name,
    rewardId: qrReward._id,
    tenantId: qrReward.tenantId,
    action: 'REDEEM_REWARD'
  }) : '';

  // QR modal
  const renderQRModal = () => (
    <Modal
      animationType="fade"
      transparent={true}
      visible={showQR}
      onRequestClose={() => setShowQR(false)}
    >
      <TouchableOpacity
        style={styles.modalOverlay}
        activeOpacity={1}
        onPress={() => setShowQR(false)}
      >
        <View style={styles.modalContent}>
          <View style={styles.qrContainer}>
            <Text style={styles.qrTitle}>Redeem Reward</Text>
            <Text style={styles.qrSubtitle}>
              Show this QR code to the business to redeem your reward
            </Text>
            <View style={styles.qrCode}>
              <QRCode
                value={qrData}
                size={200}
                color="#111827"
              />
            </View>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={() => setShowQR(false)}
            >
              <Text style={styles.closeButtonText}>Close</Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>
    </Modal>
  );

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
      {renderQRModal()}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <View style={styles.header}>
          <Text style={styles.title}>Available Rewards</Text>
          <Text style={styles.subtitle}>Redeem your points for great rewards</Text>
          <View style={styles.pointsInfo}>
            <Star size={16} color="#F59E0B" />
            <Text style={styles.pointsText}>
              {typeof currentPoints === 'number' ? currentPoints.toLocaleString() : '0'} points available
            </Text>
          </View>
          {/* Debug info - remove in production
          {__DEV__ && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugText}>
                Debug: {tenantRewards.length} tenant rewards, {qualifiedRewards.length} qualified
              </Text>
            </View>
          )} */}
        </View>

        <View style={styles.rewardsContainer}>
          {qualifiedRewards.length > 0 ? (
            qualifiedRewards.map((reward) => (
              <View key={reward._id} style={styles.rewardCard}>
                <View style={styles.rewardContent}>
                  <View style={styles.rewardHeader}>
                    <View style={styles.rewardTitleContainer}>
                      <Text style={styles.rewardTitle}>{reward.name}</Text>
                      <Text style={styles.tenantName}>{reward.tenantName}</Text>
                    </View>
                    <View style={styles.pointsBadge}>
                      <Text style={styles.pointsBadgeText}>{reward.pointsRequired}</Text>
                    </View>
                  </View>
                  
                  <Text style={styles.rewardDescription}>{reward.description}</Text>
                  <TouchableOpacity
                    style={styles.redeemButton}
                    onPress={() => {
                      setQRReward(reward);
                      setShowQR(true);
                    }}
                  >
                    <Text style={styles.redeemButtonText}>Redeem</Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Gift size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Rewards Available</Text>
              <Text style={styles.emptyStateText}>
                {tenantRewards.length === 0 
                  ? "No rewards available for this business."
                  : "You do not currently qualify for any rewards. Keep earning points!"
                }
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
    marginBottom: 12,
  },
  pointsInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FEF3C7',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    alignSelf: 'flex-start',
  },
  pointsText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#92400E',
    marginLeft: 6,
  },
  debugInfo: {
    backgroundColor: '#EEF2FF',
    padding: 8,
    borderRadius: 8,
    marginTop: 12,
  },
  debugText: {
    fontSize: 12,
    color: '#4F46E5',
  },
  rewardsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  rewardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    boxShadow: '0px 2px 8px rgba(0,0,0,0.1)',
    elevation: 2,
    overflow: 'hidden',
  },
  rewardImage: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
  },
  rewardContent: {
    padding: 20,
  },
  rewardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  rewardTitleContainer: {
    flex: 1,
    marginRight: 12,
  },
  rewardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginRight: 12,
  },
  tenantName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 2,
  },
  pointsBadge: {
    backgroundColor: '#2563EB',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  pointsBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  rewardDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  redeemButton: {
    backgroundColor: '#2563EB',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: 'center',
    marginTop: 8,
  },
  redeemButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  qrContainer: {
    alignItems: 'center',
  },
  qrTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  qrSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  qrCode: {
    padding: 16,
    backgroundColor: '#ffffff',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 24,
  },
  closeButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    backgroundColor: '#2563EB',
    borderRadius: 12,
  },
  closeButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
});
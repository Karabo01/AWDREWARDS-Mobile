import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  ScrollView, 
  StyleSheet, 
  RefreshControl,
  TouchableOpacity,
  Image,
  Alert
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@/contexts/AuthContext';
import { Reward } from '@/types/user';
import { Gift, Star, Clock, MapPin } from 'lucide-react-native';

export default function RewardsScreen() {
  const { user, refreshUser } = useAuth();
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    fetchRewards();
  }, []);

  const fetchRewards = async () => {
    try {
      const response = await fetch('/api/rewards');
      if (response.ok) {
        const data = await response.json();
        setRewards(data.rewards);
      }
    } catch (error) {
      console.error('Failed to fetch rewards:', error);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshUser();
    await fetchRewards();
    setIsRefreshing(false);
  };

  const handleRedeemReward = async (reward: Reward) => {
    if (!user) return;

    if (user.points < reward.pointsRequired) {
      Alert.alert(
        'Insufficient Points',
        `You need ${reward.pointsRequired - user.points} more points to redeem this reward.`,
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
      const response = await fetch('/api/rewards/redeem', {
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
      } else {
        const error = await response.json();
        Alert.alert('Redemption Failed', error.message || 'Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to redeem reward. Please try again.');
    }
  };

  const canAfford = (pointsRequired: number) => {
    return user ? user.points >= pointsRequired : false;
  };

  if (!user) {
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
          <Text style={styles.title}>Available Rewards</Text>
          <Text style={styles.subtitle}>Redeem your points for great rewards</Text>
          <View style={styles.pointsInfo}>
            <Star size={16} color="#F59E0B" />
            <Text style={styles.pointsText}>{user.points.toLocaleString()} points available</Text>
          </View>
        </View>

        <View style={styles.rewardsContainer}>
          {rewards.length > 0 ? (
            rewards.map((reward) => (
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
                    style={[
                      styles.redeemButton,
                      !canAfford(reward.pointsRequired) && styles.redeemButtonDisabled
                    ]}
                    onPress={() => handleRedeemReward(reward)}
                    disabled={!canAfford(reward.pointsRequired)}
                  >
                    <Gift size={16} color="#ffffff" />
                    <Text style={styles.redeemButtonText}>
                      {canAfford(reward.pointsRequired) ? 'Redeem Now' : 'Insufficient Points'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <Gift size={48} color="#D1D5DB" />
              <Text style={styles.emptyStateTitle}>No Rewards Available</Text>
              <Text style={styles.emptyStateText}>
                Check back later for new rewards.
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
  rewardsContainer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
  },
  rewardCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
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
});
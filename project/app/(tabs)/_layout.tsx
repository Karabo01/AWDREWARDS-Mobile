import { Tabs } from 'expo-router';
import { Home, Award, Gift, MapPin } from 'lucide-react-native';
import { TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';

export default function TabLayout() {
  const router = useRouter();

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        tabBarActiveTintColor: '#2563EB',
        tabBarInactiveTintColor: '#6B7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#E5E7EB',
          paddingBottom: 8,
          paddingTop: 8,
          height: 88,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        tabBarIconStyle: { marginBottom: -4 },
        tabBarButton: (props) => {
          // Remove props with null values to satisfy TouchableOpacityProps
          const filteredProps = Object.fromEntries(
            Object.entries(props).filter(([_, v]) => v !== null)
          );
          return <TouchableOpacity {...filteredProps} />;
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ size, color }) => (
            <Home size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="points"
        options={{
          title: 'Points',
          tabBarIcon: ({ size, color }) => (
            <Award size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="select-tenant"
        options={{
          title: 'Switch',
          tabBarIcon: ({ size, color }) => (
            <MapPin size={size} color={color} />
          ),
          tabBarLabel: 'Switch',
        }}
      />
      <Tabs.Screen
        name="rewards"
        options={{
          title: 'Rewards',
          tabBarIcon: ({ size, color }) => (
            <Gift size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
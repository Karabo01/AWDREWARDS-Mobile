export interface User {
  id: string;
  email: string;
  tenantId: string;
  phone: string;
  points: number;
  status: string;
  passwordChanged?: boolean;
  name?: string; // <-- Add this line
}

export interface Transaction {
  _id: string;
  tenantId: string;
  customerId: string;
  type: 'REWARD_REDEEMED' | 'POINTS_EARNED';
  points: number;
  rewardId?: string;
  description: string;
  balance: number;
  createdAt: string;
  updatedAt: string;
}

export interface Reward {
  _id: string;
  tenantId: string;
  tenantName: string; // Add this field
  name: string;
  description: string;
  pointsRequired: number;
  status: 'active' | 'inactive';
  redemptionCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}
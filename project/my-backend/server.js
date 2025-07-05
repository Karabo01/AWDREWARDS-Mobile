const express = require('express');
const { MongoClient, ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');
const mongoose = require('mongoose');

const app = express();
const PORT = 8081;

const MONGODB_URI = 'mongodb+srv://awdrewards:ADu7kcStcJSq8QGF@awdrewards.g4p1fdg.mongodb.net/AWDRewards?retryWrites=true&w=majority';

app.use(express.json());

// Log every incoming HTTP request
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// --- Secret signature middleware ---
const APP_SIGNATURE =  '2d1e7f8b-4c9a-4e2b-9f3d-8b7e6c5a1d2f$!@';


app.use((req, res, next) => {
  const signature = req.headers['x-awd-app-signature'];
  if (!signature || signature !== APP_SIGNATURE) {
    return res.status(403).json({ success: false, message: 'Forbidden: Invalid app signature' });
  }
  next();
});

// Place this as the first middleware, before any other app.use or routes
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-awd-app-signature');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// --- Mongoose Transaction Schema ---
const transactionSchema = new mongoose.Schema(
  {
    tenantId: { type: String, required: true },
    customerId: { type: String, required: true },
    type: { type: String, required: true },
    points: { type: Number, required: true },
    rewardId: { type: String, required: false },
    description: { type: String, required: true },
    balance: { type: Number, required: true }
  },
  { timestamps: true }
);

const Transaction = mongoose.models.Transaction || mongoose.model('Transaction', transactionSchema);

// --- Connect to MongoDB with mongoose ---
mongoose.connect(MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log('Mongoose connected to MongoDB'))
  .catch(err => console.error('Mongoose connection error:', err));

// --- AUTH LOGIN (already implemented) ---
app.post('/auth/login', async (req, res) => {
  try {
    const { phoneNumber, password } = req.body;

    if (!phoneNumber || !password) {
      return res.status(400).json({ success: false, message: 'Phone number and password are required' });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoClient connected for /auth/login');

    const db = client.db('AWDRewards');
    const users = db.collection('customers');

    // Find user by phone number
    const user = await users.findOne({ phone: phoneNumber });

    if (!user) {
      await client.close();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await client.close();
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

    // Remove sensitive data from user object
    const { password: _, ...userWithoutPassword } = user;

    // Add name property from firstName and lastName
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const userWithName = { ...userWithoutPassword, name };

    await client.close();

    return res.status(200).json({
      success: true,
      token,
      user: userWithName
    });

  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- GET ALL ACTIVE REWARDS ---
app.get('/api/rewards', async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoClient connected for /api/rewards');

    const db = client.db('AWDRewards');
    const rewards = db.collection('rewards');
    const tenants = db.collection('tenants');

    const activeRewards = await rewards
      .find({ status: 'active' })
      .sort({ pointsRequired: 1 })
      .toArray();

    const tenantIds = activeRewards.map(reward => new ObjectId(reward.tenantId));
    const tenantsList = await tenants.find({ _id: { $in: tenantIds } }).toArray();
    const tenantsMap = new Map(tenantsList.map(tenant => [tenant._id.toString(), tenant.name]));

    const transformedRewards = activeRewards.map(reward => ({
      ...reward,
      _id: reward._id.toString(),
      tenantName: tenantsMap.get(reward.tenantId) || 'Unknown Business',
      pointsRequired: typeof reward.pointsRequired === 'object' ? 
        reward.pointsRequired.$numberInt || 0 : 
        reward.pointsRequired || 0,
      redemptionCount: typeof reward.redemptionCount === 'object' ? 
        reward.redemptionCount.$numberInt || 0 : 
        reward.redemptionCount || 0
    }));

    await client.close();

    return res.status(200).json({ success: true, rewards: transformedRewards });
  } catch (error) {
    console.error('Rewards fetch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- AUTH MIDDLEWARE ---
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'No authorization token provided' });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');
    if (!userId) throw new Error('Invalid token');
    req.userId = userId;
    next();
  } catch {
    return res.status(401).json({ success: false, message: 'Invalid token' });
  }
}

// --- REDEEM REWARD ---
app.post('/api/rewards/redeem', requireAuth, async (req, res) => {
  try {
    const { rewardId } = req.body;
    if (!rewardId) {
      return res.status(400).json({ success: false, message: 'Reward ID is required' });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoClient connected for /api/rewards/redeem');

    const db = client.db('AWDRewards');
    const users = db.collection('customers');
    const rewards = db.collection('rewards');

    const user = await users.findOne({ _id: new ObjectId(req.userId) });
    const reward = await rewards.findOne({ _id: new ObjectId(rewardId) });

    if (!user || !reward) {
      await client.close();
      return res.status(404).json({ success: false, message: 'User or reward not found' });
    }

    if (user.points < reward.pointsRequired) {
      await client.close();
      return res.status(400).json({ success: false, message: 'Insufficient points' });
    }

    const newBalance = user.points - reward.pointsRequired;

    // Use mongoose Transaction model to insert
    await Transaction.create({
      tenantId: reward.tenantId,
      customerId: req.userId,
      type: 'REWARD_REDEEMED',
      points: -reward.pointsRequired,
      rewardId: rewardId,
      description: `Redeemed reward: ${reward.name}`,
      balance: newBalance
    });

    await users.updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { points: newBalance } }
    );

    await client.close();

    return res.status(200).json({ success: true, message: 'Reward redeemed successfully' });
  } catch (error) {
    console.error('Reward redemption error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- CHANGE PASSWORD ---
app.post('/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ success: false, message: 'New password must be at least 8 characters long' });
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoClient connected for /auth/change-password');

    const db = client.db('AWDRewards');
    const users = db.collection('customers');

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await users.updateOne(
      { _id: new ObjectId(req.userId) },
      { $set: { password: hashedPassword, passwordChanged: true } }
    );

    await client.close();

    return res.status(200).json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    console.error('Password change error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- Helper to robustly extract ISO date string from MongoDB extended JSON ---
function extractIsoDate(val) {
  if (!val) return '';
  // If already a string, try to parse
  if (typeof val === 'string') {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  // If object with $date
  if (typeof val === 'object' && '$date' in val) {
    const dVal = val.$date;
    if (typeof dVal === 'string' || typeof dVal === 'number') {
      const d = new Date(dVal);
      return isNaN(d.getTime()) ? '' : d.toISOString();
    }
    if (typeof dVal === 'object' && '$numberLong' in dVal) {
      const d = new Date(Number(dVal.$numberLong));
      return isNaN(d.getTime()) ? '' : d.toISOString();
    }
  }
  // If object with $numberLong directly
  if (typeof val === 'object' && '$numberLong' in val) {
    const d = new Date(Number(val.$numberLong));
    return isNaN(d.getTime()) ? '' : d.toISOString();
  }
  // Fallback: try to construct date
  try {
    const d = new Date(val);
    return isNaN(d.getTime()) ? '' : d.toISOString();
  } catch {
    return '';
  }
}

// --- GET ALL TRANSACTIONS ---
app.get('/api/transactions', requireAuth, async (req, res) => {
  try {
    // Use mongoose Transaction model
    const userTransactions = await Transaction.find({ customerId: req.userId })
      .sort({ createdAt: -1 })
      .lean();

    const transformedTransactions = userTransactions.map(tx => ({
      ...tx,
      _id: tx._id.toString(),
      createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
      updatedAt: tx.updatedAt ? new Date(tx.updatedAt).toISOString() : '',
    }));

    return res.status(200).json({ success: true, transactions: transformedTransactions });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- GET RECENT TRANSACTIONS ---
app.get('/api/transactions/recent', requireAuth, async (req, res) => {
  try {
    // Use mongoose Transaction model
    const recentTransactions = await Transaction.find({ customerId: req.userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    const transformedTransactions = recentTransactions.map(tx => ({
      ...tx,
      _id: tx._id.toString(),
      createdAt: tx.createdAt ? new Date(tx.createdAt).toISOString() : '',
      updatedAt: tx.updatedAt ? new Date(tx.updatedAt).toISOString() : '',
    }));

    return res.status(200).json({ success: true, transactions: transformedTransactions });
  } catch (error) {
    console.error('Transactions fetch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// --- GET ALL TENANTS (for client-side mapping) ---
app.get('/api/tenants', async (req, res) => {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    console.log('MongoClient connected for /api/tenants');

    const db = client.db('AWDRewards');
    const tenants = db.collection('tenants');
    const tenantsList = await tenants.find({}).toArray();

    await client.close();

    return res.status(200).json({ success: true, tenants: tenantsList.map(t => ({
      _id: t._id.toString(),
      name: t.name
    })) });
  } catch (error) {
    console.error('Tenants fetch error:', error);
    return res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
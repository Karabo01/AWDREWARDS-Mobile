import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://awdrewards:ADu7kcStcJSq8QGF@awdrewards.g4p1fdg.mongodb.net/AWDRewards?retryWrites=true&w=majority';

export async function POST(request: Request) {
  // --- Require secret signature header ---
  const APP_SIGNATURE = process.env.AWD_APP_SIGNATURE || 'REPLACE_WITH_STRONG_SECRET';
  const signature = request.headers.get('x-awd-app-signature');
  if (!signature || signature !== APP_SIGNATURE) {
    return new Response(
      JSON.stringify({ success: false, message: 'Forbidden: Invalid app signature' }),
      {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }

  try {
    const authHeader = request.headers.get('Authorization');
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ success: false, message: 'No authorization token provided' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId] = decoded.split(':');

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid token' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const { rewardId } = await request.json();

    if (!rewardId) {
      return new Response(
        JSON.stringify({ success: false, message: 'Reward ID is required' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('AWDRewards');
    const users = db.collection('customers');
    const rewards = db.collection('rewards');
    const transactions = db.collection('transactions');

    // Get user and reward info
    const user = await users.findOne({ _id: new ObjectId(userId) });
    const reward = await rewards.findOne({ _id: new ObjectId(rewardId) });

    if (!user || !reward) {
      await client.close();
      return new Response(
        JSON.stringify({ success: false, message: 'User or reward not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Check if user has enough points
    if (user.points < reward.pointsRequired) {
      await client.close();
      return new Response(
        JSON.stringify({ success: false, message: 'Insufficient points' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newBalance = user.points - reward.pointsRequired;

    // Create transaction record
    await transactions.insertOne({
      tenantId: reward.tenantId,
      customerId: userId,
      type: 'REWARD_REDEEMED',
      points: -reward.pointsRequired,
      rewardId: rewardId,
      description: `Redeemed reward: ${reward.name}`,
      balance: newBalance,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Update user's points
    await users.updateOne(
      { _id: new ObjectId(userId) },
      { $set: { points: newBalance } }
    );

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Reward redeemed successfully'
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Reward redemption error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
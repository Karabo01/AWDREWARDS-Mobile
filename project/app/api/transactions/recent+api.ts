import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://awdrewards:ADu7kcStcJSq8QGF@awdrewards.g4p1fdg.mongodb.net/AWDRewards?retryWrites=true&w=majority';

export async function GET(request: Request) {
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

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('AWDRewards');
    const transactions = db.collection('transactions');

    // Get the most recent 10 transactions for the user
    const recentTransactions = await transactions
      .find({ customerId: userId })
      .sort({ createdAt: -1 })
      .limit(10)
      .toArray();

    // Transform MongoDB number/date format to plain JS values
    const transformedTransactions = recentTransactions.map(tx => ({
      ...tx,
      _id: tx._id.toString(),
      points: typeof tx.points === 'object' ? Number(tx.points.$numberInt) : tx.points,
      balance: typeof tx.balance === 'object' ? Number(tx.balance.$numberInt) : tx.balance,
      createdAt: tx.createdAt && tx.createdAt.$date
        ? new Date(
            typeof tx.createdAt.$date === 'object' && tx.createdAt.$date.$numberLong
              ? Number(tx.createdAt.$date.$numberLong)
              : Number(tx.createdAt.$date)
          ).toISOString()
        : (typeof tx.createdAt === 'string' ? tx.createdAt : ''),
      updatedAt: tx.updatedAt && tx.updatedAt.$date
        ? new Date(
            typeof tx.updatedAt.$date === 'object' && tx.updatedAt.$date.$numberLong
              ? Number(tx.updatedAt.$date.$numberLong)
              : Number(tx.updatedAt.$date)
          ).toISOString()
        : (typeof tx.updatedAt === 'string' ? tx.updatedAt : ''),
      rewardId: tx.rewardId ? (typeof tx.rewardId === 'object' && tx.rewardId.$oid ? tx.rewardId.$oid : tx.rewardId) : undefined,
    }));

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactions: transformedTransactions
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Transactions fetch error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
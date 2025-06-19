import { MongoClient, ObjectId } from 'mongodb';

const MONGODB_URI = 'mongodb+srv://awdrewards:ADu7kcStcJSq8QGF@awdrewards.g4p1fdg.mongodb.net/AWDRewards?retryWrites=true&w=majority';

export async function GET(request: Request) {
  try {
    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    
    const db = client.db('AWDRewards');
    const rewards = db.collection('rewards');
    const tenants = db.collection('tenants');

    // Get all active rewards
    const activeRewards = await rewards
      .find({ status: 'active' })
      .sort({ pointsRequired: 1 })
      .toArray();

    // Fetch tenant details in a single query
    const tenantIds = activeRewards.map(reward => new ObjectId(reward.tenantId));
    const tenantsList = await tenants.find({ _id: { $in: tenantIds } }).toArray();
    
    // Create a lookup map for tenants
    const tenantsMap = new Map(tenantsList.map(tenant => [tenant._id.toString(), tenant.name]));

    // Transform the data and include tenant names
    const transformedRewards = activeRewards.map(reward => ({
      ...reward,
      tenantName: tenantsMap.get(reward.tenantId) || 'Unknown Business',
      pointsRequired: typeof reward.pointsRequired === 'object' ? 
        reward.pointsRequired.$numberInt || 0 : 
        reward.pointsRequired || 0,
      redemptionCount: typeof reward.redemptionCount === 'object' ? 
        reward.redemptionCount.$numberInt || 0 : 
        reward.redemptionCount || 0
    }));

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        rewards: transformedRewards
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Rewards fetch error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
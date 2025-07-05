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

  // --- Only allow requests from allowed origins ---
  const ALLOWED_ORIGINS = [
    'https://awdrewards.app',
    'capacitor://localhost',
    'http://localhost:5173'
  ];
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.includes(origin)) {
    return new Response(
      JSON.stringify({ success: false, message: 'Forbidden: Invalid origin' }),
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
    
    // Decode the simple token (in production, use JWT verification)
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
    const users = db.collection('customers');

    const user = await users.findOne({ _id: new ObjectId(userId) });

    if (!user) {
      await client.close();
      return new Response(
        JSON.stringify({ success: false, message: 'User not found' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Remove password from user object
    const { password: _, ...userWithoutPassword } = user;

    // Add name property from firstName and lastName
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const userWithName = { ...userWithoutPassword, name };

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        user: userWithName
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Profile fetch error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
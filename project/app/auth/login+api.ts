import { MongoClient } from 'mongodb';
import bcrypt from 'bcryptjs';

const MONGODB_URI = 'mongodb+srv://awdrewards:ADu7kcStcJSq8QGF@awdrewards.g4p1fdg.mongodb.net/AWDRewards?retryWrites=true&w=majority';

export async function POST(request: Request) {
  try {
    const { phoneNumber, password } = await request.json();

    if (!phoneNumber || !password) {
      return new Response(
        JSON.stringify({ success: false, message: 'Phone number and password are required' }),
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

    // Find user by phone number
    const user = await users.findOne({ phone: phoneNumber });

    if (!user) {
      await client.close();
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid credentials' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verify password with bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);

    if (!isValidPassword) {
      await client.close();
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid credentials' }),
        { 
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Generate a simple token (in production, use JWT)
    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

    // Remove sensitive data from user object
    const { password: _, ...userWithoutPassword } = user;

    // Add name property from firstName and lastName
    const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
    const userWithName = { 
      ...userWithoutPassword, 
      name,
      passwordChanged: typeof user.passwordChanged === 'boolean' ? user.passwordChanged : false
    };

    await client.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        token,
        user: userWithName
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Login error:', error);
    return new Response(
      JSON.stringify({ success: false, message: 'Internal server error' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}
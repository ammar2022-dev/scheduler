import dbConnect from '../../lib/mongodb';
import ScheduledPost from '../../models/ScheduledPost';
import Account from '../../models/Account';
import { decrypt } from '../../lib/encrypt';
import crypto from 'crypto';

// Token = SHA256(posting_key_encrypted) — stored in DB, never changes
// Frontend ko login ke waqt yeh token milta hai aur sessionStorage mein store hota hai
// Har request mein yeh token bheja jata hai — koi aur nahi bana sakta kyunki
// unhe posting key nahi pata

function generateToken(encryptedKey) {
  return crypto.createHash('sha256').update(encryptedKey).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, token } = req.query;

  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  if (!token) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    await dbConnect();

    // DB se account fetch karo
    const account = await Account.findOne({
      account_name: username.toLowerCase().trim(),
    });

    if (!account) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Token verify karo
    const expectedToken = generateToken(account.posting_key_encrypted);
    if (token !== expectedToken) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Verified — posts fetch karo
    const posts = await ScheduledPost.find({
      account_name: username.toLowerCase().trim(),
    })
      .select('-posting_key_encrypted')
      .sort({ scheduled_time: -1 })
      .limit(100)
      .lean();

    return res.status(200).json({ success: true, posts });
  } catch (err) {
    console.error('Get posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch posts: ' + err.message });
  }
}
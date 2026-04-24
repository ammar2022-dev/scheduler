import dbConnect from '../../lib/mongodb';
import { encrypt } from '../../lib/encrypt';
import { getAccount } from '../../lib/blurt';
import Account from '../../models/Account';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, postingKey } = req.body;

  if (!username || !postingKey) {
    return res.status(400).json({ error: 'Username and posting key required' });
  }

  const cleanUsername = username.toLowerCase().trim();
  const cleanKey = postingKey.trim();

  // Validate posting key format first (WIF format starts with 5)
  if (!cleanKey.startsWith('5') || cleanKey.length < 50) {
    return res.status(400).json({ error: 'Invalid posting key. Must start with "5" and be ~51 chars' });
  }

  try {
    // Try to verify on blockchain (optional — if nodes down, skip)
    const account = await getAccount(cleanUsername);

    if (account === null) {
      // Could be node issue OR account not found
      // We'll warn but still allow login if key format is valid
      console.warn(`Could not verify account ${cleanUsername} on blockchain — proceeding anyway`);
    }

    // Connect DB and save encrypted key
    await dbConnect();
    const encryptedKey = encrypt(cleanKey);

    await Account.findOneAndUpdate(
      { account_name: cleanUsername },
      { account_name: cleanUsername, posting_key_encrypted: encryptedKey },
      { upsert: true, new: true }
    );

    return res.status(200).json({
      success: true,
      message: `Logged in as @${cleanUsername}`,
      username: cleanUsername,
      verified: account !== null,
    });

  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}
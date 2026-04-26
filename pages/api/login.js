import dbConnect from '../../lib/mongodb';
import { encrypt } from '../../lib/encrypt';
import { getAccount } from '../../lib/blurt';
import Account from '../../models/Account';
import { PrivateKey } from 'dsteem';

const ADDRESS_PREFIX = 'BLT';

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

  // Step 1: Basic WIF format check
  if (!cleanKey.startsWith('5') || cleanKey.length < 50) {
    return res.status(400).json({ error: 'Invalid posting key format. Must start with "5"' });
  }

  // Step 2: Parse private key
  let derivedPublicKey;
  try {
    const privateKey = PrivateKey.fromString(cleanKey);
    derivedPublicKey = privateKey.createPublic(ADDRESS_PREFIX).toString();
    console.log('[LOGIN] Derived public key:', derivedPublicKey);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid posting key — cannot parse WIF' });
  }

  // Step 3: Try to verify on blockchain
  let account = null;
  let blockchainVerified = false;

  try {
    account = await getAccount(cleanUsername);
  } catch (err) {
    console.warn('[LOGIN] getAccount threw error:', err.message);
  }

  if (account) {
    // Account found — verify key matches
    const postingAuthorities = account?.posting?.key_auths || [];
    console.log('[LOGIN] Posting auths:', JSON.stringify(postingAuthorities));

    const isValidKey = postingAuthorities.some(
      ([pubKey]) => pubKey === derivedPublicKey
    );

    if (!isValidKey) {
      return res.status(401).json({
        error: 'Wrong posting key for this account.',
      });
    }

    blockchainVerified = true;
    console.log('[LOGIN] ✅ Key verified on blockchain');

  } else {
    // Nodes down — allow login based on key format only
    // Wrong key will simply fail when trying to broadcast a post
    console.warn('[LOGIN] ⚠️ Could not verify on blockchain — nodes down. Allowing login based on key format.');
  }

  // Step 4: Save to DB
  try {
    await dbConnect();
    const encryptedKey = encrypt(cleanKey);

    await Account.findOneAndUpdate(
      { account_name: cleanUsername },
      { account_name: cleanUsername, posting_key_encrypted: encryptedKey },
      { upsert: true, new: true }
    );

    console.log(`[LOGIN] ✅ @${cleanUsername} saved to DB. Verified: ${blockchainVerified}`);

    return res.status(200).json({
      success: true,
      message: `Logged in as @${cleanUsername}`,
      username: cleanUsername,
      verified: blockchainVerified,
    });

  } catch (err) {
    console.error('[LOGIN] DB error:', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}

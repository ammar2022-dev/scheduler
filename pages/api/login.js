import dbConnect from '../../lib/mongodb';
import { encrypt } from '../../lib/encrypt';
import { getAccount } from '../../lib/blurt';
import Account from '../../models/Account';
import { PrivateKey } from 'dsteem';

const ADDRESS_PREFIX = 'BLT';

// Try every RPC node individually — return account if any node responds
async function getAccountStrict(username) {
  const nodes = [
    'https://rpc.blurt.blog',
    'https://rpc.beblurt.com',
    'https://rpc.blurt.world',
    'https://blurt-rpc.saboin.com',
  ];

  const { Client } = await import('@beblurt/dblurt');

  for (const node of nodes) {
    try {
      const client = new Client([node], { timeout: 10000 });
      const accounts = await client.database.getAccounts([username]);
      if (accounts && accounts.length > 0 && accounts[0].name === username) {
        console.log(`[LOGIN] Account fetched from ${node}`);
        return accounts[0];
      }
    } catch (err) {
      console.warn(`[LOGIN] Node failed (${node}):`, err.message);
    }
  }

  // All nodes failed
  return null;
}

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
    return res.status(400).json({ error: 'Invalid posting key format.' });
  }

  // Step 2: Derive public key from posting key
  let derivedPublicKey;
  try {
    const privateKey = PrivateKey.fromString(cleanKey);
    derivedPublicKey = privateKey.createPublic(ADDRESS_PREFIX).toString();
    console.log('[LOGIN] Derived public key:', derivedPublicKey);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid posting key — cannot parse WIF.' });
  }

  // Step 3: Fetch account — try ALL nodes strictly
  const account = await getAccountStrict(cleanUsername);

  // Step 4: If ALL nodes failed — refuse login (do not allow unverified access)
  if (!account) {
    return res.status(503).json({
      error: 'Unable to verify account — all Blurt nodes are currently unreachable. Please try again in a moment.',
    });
  }

  // Step 5: Verify posting key matches this account on blockchain
  const postingAuthorities = account?.posting?.key_auths || [];
  console.log('[LOGIN] Posting auths:', JSON.stringify(postingAuthorities));

  const isValidKey = postingAuthorities.some(
    ([pubKey]) => pubKey === derivedPublicKey
  );

  if (!isValidKey) {
    return res.status(401).json({
      error: 'Incorrect posting key for this account.',
    });
  }

  // Step 6: Save to DB
  try {
    await dbConnect();
    const encryptedKey = encrypt(cleanKey);

    await Account.findOneAndUpdate(
      { account_name: cleanUsername },
      { account_name: cleanUsername, posting_key_encrypted: encryptedKey },
      { upsert: true, new: true }
    );

    console.log(`[LOGIN] ✅ @${cleanUsername} verified and saved.`);

    return res.status(200).json({
      success: true,
      username: cleanUsername,
    });

  } catch (err) {
    console.error('[LOGIN] DB error:', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}
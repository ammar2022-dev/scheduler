import dbConnect from '../../lib/mongodb';
import { encrypt } from '../../lib/encrypt';
import Account from '../../models/Account';
import { PrivateKey } from 'dsteem';

const ADDRESS_PREFIX = 'BLT';

const RPC_NODES = [
  'https://rpc.blurt.blog',       // Primary — Blurt core team
  'https://rpc.drakernoise.com',  // Fallback 1
  'https://blurt-rpc.saboin.com', // Fallback 2
  'https://rpc.beblurt.com',      // Fallback 3
];

async function getAccountFromAnyNode(username) {
  for (const node of RPC_NODES) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'condenser_api.get_accounts',
          params: [[username]],
          id: 1,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      const accounts = data?.result;

      if (accounts && accounts.length > 0 && accounts[0].name === username) {
        console.log(`[LOGIN] Account found on node: ${node}`);
        return accounts[0];
      }
    } catch (err) {
      console.warn(`[LOGIN] Node failed: ${node} — ${err.message}`);
    }
  }
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
    return res.status(400).json({ error: 'Invalid posting key format' });
  }

  // Step 2: Parse private key and derive public key
  let derivedPublicKey;
  try {
    const privateKey = PrivateKey.fromString(cleanKey);
    derivedPublicKey = privateKey.createPublic(ADDRESS_PREFIX).toString();
    console.log(`[LOGIN] Derived public key: ${derivedPublicKey}`);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid posting key — cannot parse WIF' });
  }

  // Step 3: Fetch account from blockchain — try all nodes
  const account = await getAccountFromAnyNode(cleanUsername);

  // Step 4: All nodes failed — block login, never allow unverified access
  if (!account) {
    return res.status(503).json({
      error: 'Unable to verify account. Blurt nodes are unreachable. Please try again in a few minutes.',
    });
  }

  // Step 5: Verify posting key matches blockchain record
  const postingAuthorities = account?.posting?.key_auths || [];
  const isValidKey = postingAuthorities.some(([pubKey]) => pubKey === derivedPublicKey);

  if (!isValidKey) {
    return res.status(401).json({ error: 'Incorrect posting key for this account' });
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

    console.log(`[LOGIN] ✅ @${cleanUsername} verified and saved`);

    return res.status(200).json({
      success: true,
      username: cleanUsername,
    });
  } catch (err) {
    console.error('[LOGIN] DB error:', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}
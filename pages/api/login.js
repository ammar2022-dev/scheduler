import dbConnect from '../../lib/mongodb';
import { encrypt } from '../../lib/encrypt';
import { getAccount } from '../../lib/blurt';
import Account from '../../models/Account';
import { PrivateKey } from 'dsteem';

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

  // Step 1: Basic format check
  if (!cleanKey.startsWith('5') || cleanKey.length < 50) {
    return res.status(400).json({ error: 'Invalid posting key format. Must start with "5"' });
  }

  // Step 2: Check private key is parseable
  let derivedPublicKey;
  try {
    const privateKey = PrivateKey.fromString(cleanKey);
    derivedPublicKey = privateKey.createPublic(ADDRESS_PREFIX).toString();
    console.log('[LOGIN] Derived public key:', derivedPublicKey);
  } catch (err) {
    return res.status(400).json({ error: 'Invalid posting key — cannot parse WIF key' });
  }

  // Step 3: Fetch account from Blurt blockchain
  let account;
  try {
    account = await getAccount(cleanUsername);
  } catch (err) {
    console.error('[LOGIN] getAccount error:', err.message);
  }

  if (!account) {
    return res.status(404).json({ 
      error: 'Account not found on Blurt blockchain. Check username or try again.' 
    });
  }

  // Step 4: Compare derived public key with account's posting keys
  const postingAuthorities = account?.posting?.key_auths || [];
  console.log('[LOGIN] Account posting keys:', JSON.stringify(postingAuthorities));
  console.log('[LOGIN] Derived public key:', derivedPublicKey);

  const isValidKey = postingAuthorities.some(
    ([pubKey]) => pubKey === derivedPublicKey
  );

  if (!isValidKey) {
    return res.status(401).json({ 
      error: 'Wrong posting key for this account. Please check and try again.' 
    });
  }

  // Step 5: Key is valid — encrypt and save
  try {
    await dbConnect();
    const encryptedKey = encrypt(cleanKey);

    await Account.findOneAndUpdate(
      { account_name: cleanUsername },
      { account_name: cleanUsername, posting_key_encrypted: encryptedKey },
      { upsert: true, new: true }
    );

    console.log(`[LOGIN] ✅ @${cleanUsername} logged in successfully`);

    return res.status(200).json({
      success: true,
      message: `Logged in as @${cleanUsername}`,
      username: cleanUsername,
    });

  } catch (err) {
    console.error('[LOGIN] DB error:', err.message);
    return res.status(500).json({ error: 'Login failed: ' + err.message });
  }
}

const ADDRESS_PREFIX = 'BLT';
// test-login.js
// Run: node test-login.js

const RPC_NODES = [
  'https://rpc.blurt.blog',        // Primary — Blurt core team
  'https://rpc.drakernoise.com',   // Fallback 1
  'https://blurt-rpc.saboin.com',  // Fallback 2
  'https://rpc.beblurt.com',       // Fallback 3
];

const ADDRESS_PREFIX = 'BLT';

// ─── CONFIG ───────────────────────────────────────────────
const TEST_USERNAME   = 'ammarfahim2026';
const TEST_POSTING_KEY = ''; // <-- Apni posting key yahan daalo
// ──────────────────────────────────────────────────────────

async function getAccountFromAnyNode(username) {
  for (const node of RPC_NODES) {
    try {
      console.log(`  Trying node: ${node}`);

      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method:  'condenser_api.get_accounts',
          params:  [[username]],
          id:      1,
        }),
        signal: AbortSignal.timeout(8000),
      });

      const data = await res.json();
      const accounts = data?.result;

      if (accounts && accounts.length > 0 && accounts[0].name === username) {
        console.log(`  ✅ Account found on: ${node}\n`);
        return accounts[0];
      }

      console.log(`  ⚠️  No account returned from: ${node}`);
    } catch (err) {
      console.log(`  ❌ Node failed: ${node} — ${err.message}`);
    }
  }
  return null;
}

function derivePublicKey(postingKey) {
  try {
    // dsteem / dblurt compatible WIF parsing
    const bs58    = require('bs58');
    const crypto  = require('crypto');

    // Decode base58
    const decoded = bs58.decode(postingKey);
    // Remove version byte (1) and checksum (4)
    const privateKeyBytes = decoded.slice(1, 33);

    // Derive public key using secp256k1
    const { createPublicKey } = require('crypto');

    // Use tiny-secp256k1 if available, else fallback message
    try {
      const secp256k1 = require('tiny-secp256k1');
      const pubKeyBytes = secp256k1.pointFromScalar(privateKeyBytes, true);
      if (!pubKeyBytes) throw new Error('Invalid private key scalar');

      // Encode as BLT-prefixed compressed public key
      const checksum = crypto
        .createHash('sha256')
        .update(crypto.createHash('sha256').update(pubKeyBytes).digest())
        .digest()
        .slice(0, 4);

      const withChecksum = Buffer.concat([pubKeyBytes, checksum]);
      const pubKeyB58    = bs58.encode(withChecksum);
      return `${ADDRESS_PREFIX}${pubKeyB58}`;
    } catch {
      // tiny-secp256k1 not available — use dsteem directly
      const { PrivateKey } = require('dsteem');
      const priv = PrivateKey.fromString(postingKey);
      return priv.createPublic(ADDRESS_PREFIX).toString();
    }
  } catch (err) {
    throw new Error('Cannot parse posting key: ' + err.message);
  }
}

async function runTest() {
  console.log('═══════════════════════════════════════');
  console.log('         BLURT LOGIN TEST');
  console.log('═══════════════════════════════════════\n');

  // ── Validation ──────────────────────────────────────────
  if (!TEST_USERNAME) {
    console.log('❌ Username is empty'); process.exit(1);
  }
  if (!TEST_POSTING_KEY) {
    console.log('❌ Posting key is empty — please fill TEST_POSTING_KEY'); process.exit(1);
  }
  if (!TEST_POSTING_KEY.startsWith('5') || TEST_POSTING_KEY.length < 50) {
    console.log('❌ Invalid posting key format (must start with 5, min 50 chars)'); process.exit(1);
  }

  console.log(`Username : @${TEST_USERNAME}`);
  console.log(`Key      : ${TEST_POSTING_KEY.substring(0, 8)}...`);
  console.log();

  // ── Step 1: Derive public key ────────────────────────────
  console.log('[Step 1] Deriving public key from posting key...');
  let derivedPublicKey;
  try {
    derivedPublicKey = derivePublicKey(TEST_POSTING_KEY);
    console.log(`  Derived: ${derivedPublicKey}\n`);
  } catch (err) {
    console.log(`  ❌ ${err.message}`); process.exit(1);
  }

  // ── Step 2: Fetch account from blockchain ────────────────
  console.log('[Step 2] Fetching account from Blurt blockchain...');
  const account = await getAccountFromAnyNode(TEST_USERNAME);

  if (!account) {
    console.log('❌ FAIL — Could not reach any Blurt RPC node');
    console.log('   All nodes are down or unreachable. Try again later.');
    process.exit(1);
  }

  // ── Step 3: Verify posting key ───────────────────────────
  console.log('[Step 3] Verifying posting key against blockchain...');
  const postingAuths = account?.posting?.key_auths || [];

  console.log(`  Blockchain posting keys for @${TEST_USERNAME}:`);
  postingAuths.forEach(([key]) => console.log(`    - ${key}`));
  console.log(`  Your derived key:`);
  console.log(`    - ${derivedPublicKey}`);
  console.log();

  const isValid = postingAuths.some(([key]) => key === derivedPublicKey);

  // ── Result ───────────────────────────────────────────────
  console.log('═══════════════════════════════════════');
  if (isValid) {
    console.log('✅ SUCCESS — Posting key is correct for @' + TEST_USERNAME);
    console.log('   Login will work.');
  } else {
    console.log('❌ FAIL — Posting key does NOT match @' + TEST_USERNAME);
    console.log('   Login will be rejected (security working correctly).');
  }
  console.log('═══════════════════════════════════════');
}

runTest().catch(err => {
  console.error('Unexpected error:', err.message);
  process.exit(1);
});
import { PrivateKey, Types } from '@blurtfoundation/blurtjs';

const NODES = [
  'https://api.blurt.blog',
  'https://rpc.blurt.world',
];

async function rpcCall(method, params) {
  for (const node of NODES) {
    try {
      const res = await fetch(node, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      if (data.error) throw new Error(data.error.message);
      console.log('Connected to:', node);
      return data.result;
    } catch (err) {
      console.log('Node failed:', node, err.message);
    }
  }
  throw new Error('All nodes failed');
}

export async function getAccount(username) {
  try {
    const result = await rpcCall('condenser_api.get_accounts', [[username]]);
    return result && result.length > 0 ? result[0] : null;
  } catch (err) {
    console.error('getAccount error:', err.message);
    return null;
  }
}

export async function publishPost({ author, title, body, tags, postingKey }) {
  const permlink =
    title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 200) +
    '-' + Date.now();

  const tagList = tags
    ? tags.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
    : ['blurt'];
  if (!tagList.length) tagList.push('blurt');

  const json_metadata = JSON.stringify({ tags: tagList, app: 'blurt-scheduler/1.0', format: 'markdown' });

  // Get blockchain properties
  const props = await rpcCall('condenser_api.get_dynamic_global_properties', []);
  const refBlockNum = props.head_block_number & 0xFFFF;
  const refBlockPrefix = Buffer.from(props.head_block_id, 'hex').readUInt32LE(4);
  const expiration = new Date(Date.now() + 60000).toISOString().slice(0, 19);

  // Build transaction manually
  const op = {
    parent_author: '',
    parent_permlink: tagList[0],
    author,
    permlink,
    title,
    body,
    json_metadata,
  };

  // Sign using blurtjs PrivateKey
  const key = PrivateKey.fromString(postingKey);
  const chainId = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';

  const tx = {
    ref_block_num: refBlockNum,
    ref_block_prefix: refBlockPrefix,
    expiration,
    operations: [['comment', op]],
    extensions: [],
  };

  // Serialize and sign
  const { serialize, Transaction } = await import('@blurtfoundation/blurtjs').then(m => m.default || m);
  
  const digest = serialize ? serialize(tx, chainId) : null;

  let signedTx;
  if (digest) {
    const sig = key.sign(Buffer.from(digest, 'hex'));
    signedTx = { ...tx, signatures: [sig.toString()] };
  } else {
    // Fallback: use blurtjs broadcast directly
    const blurt = (await import('@blurtfoundation/blurtjs')).default;
    blurt.api.setOptions({ url: 'https://api.blurt.blog' });
    blurt.config.set('address_prefix', 'BLT');
    blurt.config.set('chain_id', chainId);

    return new Promise((resolve, reject) => {
      blurt.broadcast.comment(
        postingKey, '', tagList[0], author, permlink, title, body, json_metadata,
        (err, result) => {
          if (err) reject(new Error(err.message || JSON.stringify(err)));
          else resolve({ permlink, result });
        }
      );
    });
  }

  const result = await rpcCall('condenser_api.broadcast_transaction', [signedTx]);
  return { permlink, result };
}
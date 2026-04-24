import { PrivateKey } from 'dsteem';

const NODE = 'https://api.blurt.blog';
const CHAIN_ID = 'cd8d90f29ae273abab3f3ac905be9d8ea89849c0863a3f00f67c1d7d0d8fb20c';

async function rpcCall(method, params) {
  const res = await fetch(NODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', method, params, id: 1 }),
  });
  const text = await res.text();
  console.log('rpcCall', method, 'status:', res.status, 'body:', text.slice(0, 300));
  const data = JSON.parse(text);
  if (data.error) throw new Error(data.error.message || JSON.stringify(data.error));
  return data.result;
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
    title.toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 200) +
    '-' + Date.now();

  const tagList = tags
    ? tags.split(',').map(t => t.trim().toLowerCase().replace(/[^a-z0-9-]/g, '')).filter(Boolean)
    : ['blurt'];
  if (!tagList.length) tagList.push('blurt');

  const json_metadata = JSON.stringify({
    tags: tagList,
    app: 'blurt-scheduler/1.0',
    format: 'markdown',
  });

  // Step 1: Get blockchain head
  const props = await rpcCall('condenser_api.get_dynamic_global_properties', []);
  console.log('Got props, head_block_number:', props.head_block_number);

  const refBlockNum = props.head_block_number & 0xFFFF;
  const refBlockPrefix = Buffer.from(props.head_block_id, 'hex').readUInt32LE(4);
  const expiration = new Date(Date.now() + 60000).toISOString().slice(0, 19);

  // Step 2: Build transaction
  const operation = [
    'comment',
    {
      parent_author: '',
      parent_permlink: tagList[0],
      author,
      permlink,
      title,
      body,
      json_metadata,
    },
  ];

  const tx = {
    ref_block_num: refBlockNum,
    ref_block_prefix: refBlockPrefix,
    expiration,
    operations: [operation],
    extensions: [],
  };

  console.log('Built tx:', JSON.stringify(tx).slice(0, 200));

  // Step 3: Serialize using dsteem
  const { Types } = await import('dsteem');
  const serializer = Types.Transaction;
  const buffer = new (await import('dsteem')).ByteBuffer(
    ByteBuffer.DEFAULT_CAPACITY,
    ByteBuffer.LITTLE_ENDIAN
  );
  
  // Manual serialization fallback
  const dsteem = await import('dsteem');
  
  let serializedHex;
  try {
    const buf = dsteem.serialize('transaction', tx);
    serializedHex = Buffer.from(buf).toString('hex');
    console.log('Serialized tx hex (first 40):', serializedHex.slice(0, 40));
  } catch (serErr) {
    console.log('dsteem serialize error:', serErr.message);
    throw new Error('Serialization failed: ' + serErr.message);
  }

  // Step 4: Sign
  const chainBuffer = Buffer.from(CHAIN_ID, 'hex');
  const txBuffer = Buffer.from(serializedHex, 'hex');
  const msgBuffer = Buffer.concat([chainBuffer, txBuffer]);

  const key = PrivateKey.fromString(postingKey);
  const signature = key.sign(msgBuffer);
  const sigHex = signature.toString();

  console.log('Signature:', sigHex.slice(0, 20), '...');

  const signedTx = { ...tx, signatures: [sigHex] };

  // Step 5: Broadcast
  const result = await rpcCall('condenser_api.broadcast_transaction', [signedTx]);
  console.log('Broadcast result:', JSON.stringify(result));

  return { permlink, result };
}
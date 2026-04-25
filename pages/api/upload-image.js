import dbConnect from '../../lib/mongodb';
import Account from '../../models/Account';
import { decrypt } from '../../lib/encrypt';
import { PrivateKey } from 'dsteem';
import crypto from 'crypto'

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, imageBase64, filename } = req.body;

  if (!username || !imageBase64) {
    return res.status(400).json({ error: 'username and imageBase64 required' });
  }

  try {
    await dbConnect();
    const account = await Account.findOne({
      account_name: username.toLowerCase().trim(),
    });

    if (!account) {
      return res.status(401).json({ error: 'Account not found. Please login first.' });
    }

    const postingKey = decrypt(account.posting_key_encrypted);
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // 1. Generate SHA256 hash of the image (must match browser's method)
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    // 2. Sign the hash with posting key
    const privateKey = PrivateKey.fromString(postingKey);
    const hashBuffer = Buffer.from(imageHash, 'hex');
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[UPLOAD] Username: ${username}`);
    console.log(`[UPLOAD] Image hash: ${imageHash}`);
    console.log(`[UPLOAD] Signature: ${signature.substring(0, 60)}...`);

    // 3. CORRECT ENDPOINT (from your successful request)
    const uploadUrl = `https://img-upload.blurt.blog/${username}/${signature}`;

    // 4. Upload as binary with proper headers (matching browser behavior)
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length.toString(),
        'Origin': 'https://blurt.blog',  // Important!
      },
      body: imageBuffer,
    });

    const responseText = await uploadRes.text();
    console.log(`[UPLOAD] Response status: ${uploadRes.status}`);
    console.log(`[UPLOAD] Response body: ${responseText}`);

    if (!uploadRes.ok) {
      throw new Error(`Upload failed with status ${uploadRes.status}: ${responseText}`);
    }

    // Parse response (should be JSON like your example)
    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid response format: ${responseText}`);
    }

    if (!uploadData.ok) {
      throw new Error(`Upload failed: ${uploadData.message || 'Unknown error'}`);
    }

    const imageUrl = uploadData.url;
    
    console.log(`[UPLOAD] ✅ Success! URL: ${imageUrl}`);

    return res.status(200).json({
      success: true,
      url: imageUrl,
      markdown: `![${filename || 'image.png'}](${imageUrl})`,
    });

  } catch (err) {
    console.error('[UPLOAD] Error:', err);
    return res.status(500).json({ error: 'Image upload failed: ' + err.message });
  }
}
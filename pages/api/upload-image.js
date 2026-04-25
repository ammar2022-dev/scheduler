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
    // 1. Get posting key from DB
    await dbConnect();
    const account = await Account.findOne({
      account_name: username.toLowerCase().trim(),
    });

    if (!account) {
      return res.status(401).json({ error: 'Account not found. Please login first.' });
    }

    const postingKey = decrypt(account.posting_key_encrypted);

    // 2. Convert base64 to buffer
    const imageBuffer = Buffer.from(imageBase64, 'base64');

    // 3. Generate SHA256 hash of image
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    // 4. Sign the hash with private key
    const privateKey = PrivateKey.fromString(postingKey);
    const hashBuffer = Buffer.from(imageHash, 'hex');
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[IMAGE] Uploading for @${username}`);
    console.log(`[IMAGE] Image hash: ${imageHash}`);
    console.log(`[IMAGE] Signature: ${signature.slice(0, 40)}...`);

    // 5. Upload to CORRECT Blurt image server
    const uploadUrl = 'https://img.blurt.blog/api/v1/upload'; // New endpoint
    
    // Prepare multipart form data
    const formData = new FormData();
    formData.append('username', username);
    formData.append('signature', signature);
    formData.append('imageHash', imageHash);
    formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), filename || 'image.png');

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
    });

    const uploadData = await uploadRes.json();
    console.log(`[IMAGE] Upload response:`, uploadData);

    if (!uploadRes.ok || !uploadData.ok) {
      throw new Error(`Upload failed: ${uploadData.message || uploadRes.statusText}`);
    }

    // Extract URL from response
    const imageUrl = uploadData.url;
    
    console.log(`[IMAGE] ✅ Uploaded: ${imageUrl}`);

    return res.status(200).json({
      success: true,
      url: imageUrl,
      markdown: `![${filename || 'image.png'}](${imageUrl})`,
    });

  } catch (err) {
    console.error('[IMAGE] Error:', err.message);
    return res.status(500).json({ error: 'Image upload failed: ' + err.message });
  }
}
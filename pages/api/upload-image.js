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
    
    // Generate SHA256 hash of image for filename
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    // Sign the hash with private key
    const privateKey = PrivateKey.fromString(postingKey);
    const hashBuffer = Buffer.from(imageHash, 'hex');
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[IMAGE] Uploading for @${username}`);
    console.log(`[IMAGE] Image hash: ${imageHash}`);

    // CORRECT ENDPOINT: Direct POST to blurtimage endpoint
    const uploadUrl = `https://img.blurt.blog/blurtimage/${username}/`;
    
    // Send as multipart/form-data
    const formData = new FormData();
    formData.append('image', new Blob([imageBuffer], { type: 'image/png' }), `${imageHash}.png`);
    formData.append('signature', signature);
    formData.append('hash', imageHash);

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      body: formData,
      // Don't set Content-Type header - fetch will set it automatically with boundary
    });

    const responseText = await uploadRes.text();
    console.log(`[IMAGE] Response status: ${uploadRes.status}`);
    console.log(`[IMAGE] Response text: ${responseText.substring(0, 200)}`);

    if (!uploadRes.ok) {
      throw new Error(`Upload failed with status ${uploadRes.status}: ${responseText}`);
    }

    let imageUrl;
    try {
      // Try to parse as JSON
      const uploadData = JSON.parse(responseText);
      imageUrl = uploadData.url || uploadData.image_url || uploadData;
    } catch {
      // If not JSON, maybe server returns plain text URL
      imageUrl = responseText.trim();
    }

    // Construct URL if needed
    if (!imageUrl || !imageUrl.startsWith('http')) {
      imageUrl = `https://img.blurt.blog/blurtimage/${username}/${imageHash}.png`;
    }

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
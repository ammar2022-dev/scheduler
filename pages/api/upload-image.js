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

    // 3. Sign with "ImageSigningChallenge" prefix
    const prefix = Buffer.from('ImageSigningChallenge');
    const buf = Buffer.concat([prefix, imageBuffer]);
const bufSha = crypto.createHash('sha256').update(buf).digest();
const privateKey = PrivateKey.fromString(postingKey);
const signature = privateKey.sign(bufSha).toHex();

    console.log(`[IMAGE] Uploading for @${username}, sig: ${signature.slice(0, 20)}...`);

    // 4. Upload to Blurt image server
    const uploadUrl = `https://img-upload.blurt.world/${username}/${signature}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length.toString(),
      },
      body: imageBuffer,
    });

    const uploadText = await uploadRes.text();
    console.log(`[IMAGE] Upload response ${uploadRes.status}: ${uploadText.slice(0, 200)}`);

    if (!uploadRes.ok) {
      throw new Error(`Upload failed: ${uploadRes.status} — ${uploadText}`);
    }

    let imageUrl;
    try {
      const uploadData = JSON.parse(uploadText);
      imageUrl = uploadData.url || uploadData.image_url || uploadData;
    } catch {
      // Some servers return plain URL
      imageUrl = uploadText.trim();
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
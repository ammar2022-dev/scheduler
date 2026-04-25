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
    
    // Convert base64 to buffer - handle data URL if present
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(',')) {
      cleanBase64 = imageBase64.split(',')[1];
    }
    const imageBuffer = Buffer.from(cleanBase64, 'base64');

    console.log(`[UPLOAD] Username: ${username}`);
    console.log(`[UPLOAD] Image size: ${imageBuffer.length} bytes`);

    // Generate SHA256 hash
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    // Sign the hash
    const privateKey = PrivateKey.fromString(postingKey);
    const hashBuffer = Buffer.from(imageHash, 'hex');
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[UPLOAD] Image hash: ${imageHash}`);
    console.log(`[UPLOAD] Signature: ${signature.substring(0, 60)}...`);

    // CORRECT: Upload to img-upload.blurt.blog
    const uploadUrl = `https://img-upload.blurt.blog/${username}/${signature}`;

    // CRITICAL: Send as binary with proper headers
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': imageBuffer.length.toString(),
      },
      body: imageBuffer, // Direct buffer, not converted
    });

    const responseText = await uploadRes.text();
    console.log(`[UPLOAD] Response status: ${uploadRes.status}`);
    console.log(`[UPLOAD] Response body: ${responseText}`);

    if (!uploadRes.ok) {
      // Try to parse error response
      let errorMessage = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || responseText;
      } catch {
        // Keep as is
      }
      throw new Error(`Upload failed: ${errorMessage}`);
    }

    // Parse success response
    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid response: ${responseText}`);
    }

    if (!uploadData.ok) {
      throw new Error(uploadData.message || 'Upload failed');
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
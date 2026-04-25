import dbConnect from '../../lib/mongodb';
import Account from '../../models/Account';
import { decrypt } from '../../lib/encrypt';
import { PrivateKey } from 'dsteem';
import crypto from 'crypto';
import FormData from 'form-data'; // Install: npm install form-data

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
    
    // Clean base64 string
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(',')) {
      cleanBase64 = imageBase64.split(',')[1];
    }
    
    // Convert to buffer
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const fileExtension = filename ? filename.split('.').pop() : 'png';
    const finalFilename = filename || `image.${fileExtension}`;

    console.log(`[UPLOAD] Username: ${username}`);
    console.log(`[UPLOAD] File: ${finalFilename}, Size: ${imageBuffer.length} bytes`);

    // Generate image hash for signing
    const imageHash = crypto.createHash('sha256').update(imageBuffer).digest('hex');
    
    // Sign the hash with posting key
    const privateKey = PrivateKey.fromString(postingKey);
    const hashBuffer = Buffer.from(imageHash, 'hex');
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[UPLOAD] Image hash: ${imageHash.substring(0, 32)}...`);
    console.log(`[UPLOAD] Signature: ${signature.substring(0, 60)}...`);

    // Create multipart form data
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: finalFilename,
      contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
    });

    // OPTIONAL: If server expects specific field name, try these variations
    // formData.append('image', imageBuffer, finalFilename);
    // formData.append('upload', imageBuffer, finalFilename);

    // Upload URL with signature in path
    const uploadUrl = `https://img-upload.blurt.blog/${username}/${signature}`;

    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(), // This adds correct Content-Type with boundary
      },
      body: formData,
    });

    const responseText = await uploadRes.text();
    console.log(`[UPLOAD] Response status: ${uploadRes.status}`);
    console.log(`[UPLOAD] Response body: ${responseText.substring(0, 300)}`);

    if (!uploadRes.ok) {
      let errorMessage = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || responseText;
      } catch {
        // Keep as is
      }
      throw new Error(`Upload failed (${uploadRes.status}): ${errorMessage}`);
    }

    // Parse success response
    let uploadData;
    try {
      uploadData = JSON.parse(responseText);
    } catch {
      throw new Error(`Invalid JSON response: ${responseText.substring(0, 100)}`);
    }

    if (!uploadData.ok) {
      throw new Error(uploadData.message || 'Upload failed');
    }

    const imageUrl = uploadData.url;
    
    console.log(`[UPLOAD] ✅ Success! URL: ${imageUrl}`);

    return res.status(200).json({
      success: true,
      url: imageUrl,
      markdown: `![${finalFilename}](${imageUrl})`,
    });

  } catch (err) {
    console.error('[UPLOAD] Error:', err.message);
    return res.status(500).json({ error: 'Image upload failed: ' + err.message });
  }
}
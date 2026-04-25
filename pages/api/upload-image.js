// pages/api/upload-image.js
import dbConnect from '../../lib/mongodb';
import Account from '../../models/Account';
import { decrypt } from '../../lib/encrypt';
import { PrivateKey } from 'dsteem';
import crypto from 'crypto';
import FormData from 'form-data';

export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { username, imageBase64, filename } = req.body;

  // Validate required fields
  if (!username || !imageBase64) {
    return res.status(400).json({ error: 'username and imageBase64 are required' });
  }

  try {
    // 1. Connect to database and get user account
    await dbConnect();
    const account = await Account.findOne({
      account_name: username.toLowerCase().trim(),
    });

    if (!account) {
      return res.status(401).json({ error: 'Account not found. Please login first.' });
    }

    // 2. Decrypt the posting key
    const postingKey = decrypt(account.posting_key_encrypted);
    
    // 3. Clean and prepare image buffer
    let cleanBase64 = imageBase64;
    if (imageBase64.includes(',')) {
      cleanBase64 = imageBase64.split(',')[1];
    }
    
    const imageBuffer = Buffer.from(cleanBase64, 'base64');
    const fileExtension = filename ? filename.split('.').pop() : 'png';
    const finalFilename = filename || `image.${fileExtension}`;

    console.log(`[UPLOAD] Username: ${username}`);
    console.log(`[UPLOAD] File: ${finalFilename}, Size: ${imageBuffer.length} bytes`);

    // 4. 🔑 CRITICAL FIX: Sign the raw hash, not hex string
    // Option A: Without prefix (try this first)
    const hashBuffer = crypto.createHash('sha256').update(imageBuffer).digest();
    
    // Option B: With "ImageSigningChallenge" prefix (if Option A fails)
    // const prefix = Buffer.from('ImageSigningChallenge');
    // const combinedBuffer = Buffer.concat([prefix, imageBuffer]);
    // const hashBuffer = crypto.createHash('sha256').update(combinedBuffer).digest();
    
    // Sign the hash buffer directly
    const privateKey = PrivateKey.fromString(postingKey);
    const signatureBuffer = privateKey.sign(hashBuffer);
    const signature = signatureBuffer.toString('hex');

    console.log(`[UPLOAD] Image hash (hex): ${hashBuffer.toString('hex').substring(0, 32)}...`);
    console.log(`[UPLOAD] Signature: ${signature.substring(0, 60)}...`);

    // 5. Create multipart form data
    const formData = new FormData();
    formData.append('file', imageBuffer, {
      filename: finalFilename,
      contentType: `image/${fileExtension === 'jpg' ? 'jpeg' : fileExtension}`,
    });

    // Try different field names if 'file' doesn't work:
    // formData.append('image', imageBuffer, finalFilename);
    // formData.append('upload', imageBuffer, finalFilename);

    // 6. Upload to Blurt server
    const uploadUrl = `https://img-upload.blurt.blog/${username}/${signature}`;
    
    console.log(`[UPLOAD] Upload URL: ${uploadUrl.substring(0, 100)}...`);
    
    const uploadRes = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        ...formData.getHeaders(),
      },
      body: formData,
    });

    const responseText = await uploadRes.text();
    console.log(`[UPLOAD] Response status: ${uploadRes.status}`);
    console.log(`[UPLOAD] Response body: ${responseText.substring(0, 300)}`);

    // 7. Handle response
    if (!uploadRes.ok) {
      let errorMessage = responseText;
      try {
        const errorJson = JSON.parse(responseText);
        errorMessage = errorJson.error || errorJson.message || responseText;
      } catch {
        // Keep as is
      }
      
      // If still failing, try with prefix
      if (errorMessage.includes('Invalid signing key')) {
        console.log('[UPLOAD] Retrying with "ImageSigningChallenge" prefix...');
        
        // Retry with prefix
        const prefix = Buffer.from('ImageSigningChallenge');
        const combinedBuffer = Buffer.concat([prefix, imageBuffer]);
        const newHashBuffer = crypto.createHash('sha256').update(combinedBuffer).digest();
        const newSignatureBuffer = privateKey.sign(newHashBuffer);
        const newSignature = newSignatureBuffer.toString('hex');
        
        const retryUrl = `https://img-upload.blurt.blog/${username}/${newSignature}`;
        const retryFormData = new FormData();
        retryFormData.append('file', imageBuffer, finalFilename);
        
        const retryRes = await fetch(retryUrl, {
          method: 'POST',
          headers: retryFormData.getHeaders(),
          body: retryFormData,
        });
        
        const retryText = await retryRes.text();
        console.log(`[UPLOAD] Retry response status: ${retryRes.status}`);
        console.log(`[UPLOAD] Retry response body: ${retryText.substring(0, 300)}`);
        
        if (!retryRes.ok) {
          throw new Error(`Upload failed after retry: ${retryText}`);
        }
        
        // Parse retry response
        let retryData;
        try {
          retryData = JSON.parse(retryText);
        } catch {
          throw new Error(`Invalid JSON response: ${retryText.substring(0, 100)}`);
        }
        
        const imageUrl = retryData.url;
        console.log(`[UPLOAD] ✅ Success with prefix! URL: ${imageUrl}`);
        
        return res.status(200).json({
          success: true,
          url: imageUrl,
          markdown: `![${finalFilename}](${imageUrl})`,
        });
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
// Vercel Serverless Function: Get Dailymotion access token + upload URL
// This keeps API secrets safe on the server side

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    DAILYMOTION_API_KEY,
    DAILYMOTION_API_SECRET,
    DAILYMOTION_USERNAME,
    DAILYMOTION_PASSWORD
  } = process.env;

  if (!DAILYMOTION_API_KEY || !DAILYMOTION_API_SECRET) {
    return res.status(500).json({ error: 'Dailymotion credentials not configured on server.' });
  }

  try {
    // Step 1: Get access token using Resource Owner Password Grant
    const tokenResponse = await fetch('https://api.dailymotion.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: DAILYMOTION_API_KEY,
        client_secret: DAILYMOTION_API_SECRET,
        username: DAILYMOTION_USERNAME,
        password: DAILYMOTION_PASSWORD,
        scope: 'manage_videos'
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Dailymotion token error:', tokenData);
      return res.status(400).json({ 
        error: 'Failed to get Dailymotion access token', 
        details: tokenData.error_description || tokenData.error || 'Unknown error'
      });
    }

    // Step 2: Get upload URL
    const uploadResponse = await fetch(
      `https://api.dailymotion.com/file/upload?access_token=${tokenData.access_token}`
    );
    const uploadData = await uploadResponse.json();

    if (!uploadData.upload_url) {
      return res.status(400).json({ error: 'Failed to get upload URL from Dailymotion' });
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      upload_url: uploadData.upload_url,
      progress_url: uploadData.progress_url
    });
  } catch (error) {
    console.error('Dailymotion token error:', error);
    return res.status(500).json({ error: error.message });
  }
}

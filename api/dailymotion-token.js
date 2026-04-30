// Vercel Serverless Function: Get Dailymotion access token using refresh_token
// No username/password needed - uses OAuth refresh token

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const {
    DAILYMOTION_API_KEY,
    DAILYMOTION_API_SECRET,
    DAILYMOTION_REFRESH_TOKEN
  } = process.env;

  if (!DAILYMOTION_API_KEY || !DAILYMOTION_API_SECRET || !DAILYMOTION_REFRESH_TOKEN) {
    return res.status(500).json({ 
      error: 'Dailymotion chưa được cấu hình. Truy cập /api/dailymotion-auth để thiết lập.' 
    });
  }

  try {
    // Get access token using refresh_token (no password needed!)
    const tokenResponse = await fetch('https://api.dailymotion.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: DAILYMOTION_API_KEY,
        client_secret: DAILYMOTION_API_SECRET,
        refresh_token: DAILYMOTION_REFRESH_TOKEN
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (!tokenData.access_token) {
      console.error('Dailymotion token error:', tokenData);
      return res.status(400).json({ 
        error: 'Không thể lấy access token. Có thể cần xác thực lại tại /api/dailymotion-auth',
        details: tokenData.error_description || tokenData.error
      });
    }

    // Get upload URL
    const uploadResponse = await fetch(
      `https://api.dailymotion.com/file/upload?access_token=${tokenData.access_token}`
    );
    const uploadData = await uploadResponse.json();

    if (!uploadData.upload_url) {
      return res.status(400).json({ error: 'Không thể lấy upload URL từ Dailymotion' });
    }

    return res.status(200).json({
      access_token: tokenData.access_token,
      upload_url: uploadData.upload_url
    });
  } catch (error) {
    console.error('Dailymotion token error:', error);
    return res.status(500).json({ error: error.message });
  }
}

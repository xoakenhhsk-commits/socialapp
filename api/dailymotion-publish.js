// Vercel Serverless Function: Publish uploaded video on Dailymotion

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

  const { access_token, uploaded_url, title } = req.body;

  if (!access_token || !uploaded_url) {
    return res.status(400).json({ error: 'Missing access_token or uploaded_url' });
  }

  try {
    const response = await fetch('https://api.dailymotion.com/me/videos', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: new URLSearchParams({
        url: uploaded_url,
        title: title || 'Social App Video',
        channel: 'people',
        published: 'true',
        is_created_for_kids: 'false'
      }).toString()
    });

    const data = await response.json();

    if (data.id) {
      return res.status(200).json({
        id: data.id,
        embed_url: `https://www.dailymotion.com/embed/video/${data.id}`,
        url: `https://www.dailymotion.com/video/${data.id}`,
        title: data.title
      });
    } else {
      console.error('Dailymotion publish error:', data);
      return res.status(400).json({ 
        error: 'Failed to publish video', 
        details: data.error?.message || data.error || 'Unknown error' 
      });
    }
  } catch (error) {
    console.error('Dailymotion publish error:', error);
    return res.status(500).json({ error: error.message });
  }
}

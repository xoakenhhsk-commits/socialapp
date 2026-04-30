// Vercel Serverless Function: Redirect user to Dailymotion OAuth page
// This is a ONE-TIME setup step for the app owner

export default async function handler(req, res) {
  const { DAILYMOTION_API_KEY } = process.env;

  if (!DAILYMOTION_API_KEY) {
    return res.status(500).send('DAILYMOTION_API_KEY not configured in Vercel env vars.');
  }

  // The callback URL must match what's registered in Dailymotion app settings
  const redirectUri = `https://${req.headers.host}/api/dailymotion-callback`;

  const authUrl = `https://www.dailymotion.com/oauth/authorize?` +
    `response_type=code` +
    `&client_id=${DAILYMOTION_API_KEY}` +
    `&redirect_uri=${encodeURIComponent(redirectUri)}` +
    `&scope=manage_videos`;

  res.redirect(302, authUrl);
}

// Vercel Serverless Function: Handle Dailymotion OAuth callback
// Exchanges authorization code for access_token + refresh_token

export default async function handler(req, res) {
  const { code, error } = req.query;

  if (error) {
    return res.status(400).send(`
      <html><body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;">
        <div style="text-align:center;">
          <h1>❌ Lỗi xác thực</h1>
          <p>${error}</p>
        </div>
      </body></html>
    `);
  }

  if (!code) {
    return res.status(400).send('Missing authorization code.');
  }

  const {
    DAILYMOTION_API_KEY,
    DAILYMOTION_API_SECRET
  } = process.env;

  const redirectUri = `https://${req.headers.host}/api/dailymotion-callback`;

  try {
    const tokenResponse = await fetch('https://api.dailymotion.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: DAILYMOTION_API_KEY,
        client_secret: DAILYMOTION_API_SECRET,
        redirect_uri: redirectUri,
        code: code
      }).toString()
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.refresh_token) {
      // Show the refresh token to the user so they can save it
      return res.status(200).send(`
        <html>
        <head><title>Dailymotion - Thành công!</title></head>
        <body style="background:#0f172a;color:white;font-family:'Inter',sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0;">
          <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:40px;max-width:600px;width:90%;text-align:center;">
            <h1 style="color:#34d399;">✅ Kết nối Dailymotion thành công!</h1>
            <p>Copy đoạn mã bên dưới và thêm vào <strong>Vercel Environment Variables</strong> với tên:</p>
            <code style="background:rgba(99,102,241,0.2);padding:4px 12px;border-radius:6px;color:#818cf8;font-size:1.1rem;">DAILYMOTION_REFRESH_TOKEN</code>
            <div style="margin-top:20px;background:rgba(0,0,0,0.3);border-radius:12px;padding:16px;word-break:break-all;">
              <input type="text" value="${tokenData.refresh_token}" readonly 
                style="width:100%;background:transparent;border:1px solid rgba(255,255,255,0.2);color:white;padding:12px;border-radius:8px;font-size:0.9rem;"
                onclick="this.select();document.execCommand('copy');" />
            </div>
            <p style="color:rgba(255,255,255,0.5);margin-top:16px;font-size:0.85rem;">Nhấn vào ô trên để tự động copy. Sau đó vào Vercel → Settings → Environment Variables → thêm biến mới.</p>
            <p style="color:rgba(255,255,255,0.5);font-size:0.85rem;">Sau khi thêm xong, hãy <strong>Redeploy</strong> lại project trên Vercel.</p>
          </div>
        </body>
        </html>
      `);
    } else {
      return res.status(400).send(`
        <html><body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;">
          <div style="text-align:center;max-width:500px;">
            <h1>❌ Không lấy được refresh token</h1>
            <p>Chi tiết: ${JSON.stringify(tokenData)}</p>
          </div>
        </body></html>
      `);
    }
  } catch (err) {
    return res.status(500).send(`
      <html><body style="background:#0f172a;color:white;font-family:sans-serif;display:flex;justify-content:center;align-items:center;min-height:100vh;">
        <div style="text-align:center;">
          <h1>❌ Lỗi hệ thống</h1>
          <p>${err.message}</p>
        </div>
      </body></html>
    `);
  }
}

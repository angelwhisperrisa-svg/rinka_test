const VALID_TYPES = ["mint", "rose", "lavender", "ivory", "skyblue"];

async function verifyIdToken(idToken, channelId) {
  const body = new URLSearchParams();
  body.set("id_token", idToken);
  body.set("client_id", channelId);
  const r = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  });
  if (!r.ok) return null;
  const data = await r.json();
  return data.sub || null;
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const accessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const channelId = process.env.LINE_CHANNEL_ID;
  if (!accessToken || !channelId) {
    res.status(500).json({ error: "Server missing LINE_CHANNEL_ACCESS_TOKEN or LINE_CHANNEL_ID" });
    return;
  }

  let payload = req.body;
  if (typeof payload === "string") {
    try {
      payload = JSON.parse(payload || "{}");
    } catch {
      res.status(400).json({ error: "Invalid JSON body" });
      return;
    }
  }

  const { idToken, resultType } = payload || {};
  if (!idToken || typeof idToken !== "string" || !VALID_TYPES.includes(resultType)) {
    res.status(400).json({ error: "Invalid idToken or resultType" });
    return;
  }

  const lineUserId = await verifyIdToken(idToken, channelId);
  if (!lineUserId) {
    res.status(401).json({ error: "Invalid or expired id token" });
    return;
  }

  const text = `color=${resultType}`;
  const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text }]
    })
  });

  if (!pushRes.ok) {
    const detail = await pushRes.text();
    res.status(502).json({
      error: "LINE Messaging API push failed",
      status: pushRes.status,
      detail: detail.slice(0, 500)
    });
    return;
  }

  res.status(200).json({ ok: true, resultType, text });
};

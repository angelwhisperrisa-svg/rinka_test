const VALID_TYPES = ["mint", "rose", "lavender", "ivory", "skyblue"];

const TYPE_LABEL = {
  mint: "🌿ミント",
  rose: "🌹ローズ",
  lavender: "🪻ラベンダー",
  ivory: "☀️アイボリー",
  skyblue: "🩵スカイブルー"
};

/** サーバー側の鑑定コピー（クライアントと揃えること） */
const PUSH_BODY = {
  mint: `【ミントグリーン】
あなたは、人を支えることが自然にできる人です。周りを優先しすぎていないか、一度立ち止まってみてください。
・自分の時間を少しだけ優先する
・無理に合わせるのをやめる
本来のあなたは、もっと自然体でいられる人です。`,
  rose: `【ローズピンク】
あなたは、感情豊かに愛せる人です。気持ちが強くなりすぎていないか、自分の内側も見てあげてください。
・相手ではなく、自分の気持ちを見てみる
・少しだけ距離を取る
本来のあなたは、愛を受け取りながら与えられる人です。`,
  lavender: `【ラベンダー】
あなたは、とても感性が豊かな人です。内側に寄りすぎていないか、少し外に出してみてください。
・感じたことを少し言葉にする
・小さく外に出してみる
本来のあなたは、感性を現実に活かせる人です。`,
  ivory: `【アイボリー】
あなたは、安定した判断ができる人です。感情を抑えすぎていないか、優しく向き合ってみてください。
・自分の気持ちを少し言葉にする
・楽しいと感じることを選ぶ
本来のあなたは、安定と感情の両方を持てる人です。`,
  skyblue: `【スカイブルー】
あなたは、自由に動ける人です。流れに任せすぎていないか、一つ決めてみてください。
・1つだけ続けることを決める
・少しだけ深く向き合う
本来のあなたは、自由と継続を両方持てる人です。`
};

const MAX_TEXT = 4800;
const RICH_MENU_ID_BY_TYPE = {
  mint: process.env.LINE_RICHMENU_MINT || "",
  rose: process.env.LINE_RICHMENU_ROSE || "",
  lavender: process.env.LINE_RICHMENU_LAVENDER || "",
  ivory: process.env.LINE_RICHMENU_IVORY || "",
  skyblue: process.env.LINE_RICHMENU_SKYBLUE || ""
};

function splitLineMessages(text) {
  const t = text.trim();
  if (t.length <= MAX_TEXT) return [{ type: "text", text: t }];
  const parts = [];
  let rest = t;
  while (rest.length > 0) {
    parts.push(rest.slice(0, MAX_TEXT));
    rest = rest.slice(MAX_TEXT);
  }
  return parts.map((body) => ({ type: "text", text: body }));
}

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

async function linkUserRichMenu({ accessToken, lineUserId, resultType }) {
  const richMenuId = RICH_MENU_ID_BY_TYPE[resultType];
  if (!richMenuId) return { ok: false, skipped: true, reason: "missing_richmenu_id", richMenuId: "" };

  const endpoint = `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const r = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    if (r.ok) return { ok: true, attempt, richMenuId };
    const detail = await r.text();
    if (attempt === 3) {
      return { ok: false, status: r.status, detail: detail.slice(0, 500), attempt, richMenuId };
    }
  }
  return { ok: false, reason: "unknown", richMenuId };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
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

  const { idToken, resultType, diagnosisText } = payload || {};
  if (!idToken || typeof idToken !== "string" || !VALID_TYPES.includes(resultType)) {
    res.status(400).json({ error: "Invalid idToken or resultType" });
    return;
  }

  const lineUserId = await verifyIdToken(idToken, channelId);
  if (!lineUserId) {
    res.status(401).json({ error: "Invalid or expired id token" });
    return;
  }

  const siteBase = (process.env.PUBLIC_SITE_URL || "https://shima-brand.vercel.app").replace(/\/$/, "");
  const fullUrl = `${siteBase}/result?type=${encodeURIComponent(resultType)}&mode=full`;
  const label = TYPE_LABEL[resultType] || resultType;

  const serverBody = PUSH_BODY[resultType] || "";
  const clientExtra =
    typeof diagnosisText === "string" && diagnosisText.trim().length > 0
      ? `\n\n── 鑑定メモ ──\n${diagnosisText.trim().slice(0, 3500)}`
      : "";

  const block1 = `【推し色診断・結果】\nあなたの推し色は「${label}」タイプです。\n\n${serverBody}${clientExtra}\n\nこのメッセージで診断は完了です。続きはLINEのリッチメニューからご利用ください。\n\n▼フル鑑定ページ\n${fullUrl}`;

  const messages = splitLineMessages(block1);

  const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`
    },
    body: JSON.stringify({ to: lineUserId, messages })
  });

  if (!pushRes.ok) {
    const detail = await pushRes.text();
    console.error("LINE push failed", pushRes.status, detail);
    res.status(502).json({
      error: "LINE Messaging API push failed",
      status: pushRes.status,
      detail: detail.slice(0, 500)
    });
    return;
  }

  const richMenuLinkResult = await linkUserRichMenu({ accessToken, lineUserId, resultType });
  console.info("LINE rich menu link trace", {
    resultType,
    richMenuId: richMenuLinkResult.richMenuId || "",
    ok: !!richMenuLinkResult.ok,
    attempt: richMenuLinkResult.attempt || null,
    reason: richMenuLinkResult.reason || null
  });
  if (!richMenuLinkResult.ok) {
    console.warn("LINE rich menu link skipped/failed", {
      resultType,
      richMenuId: richMenuLinkResult.richMenuId || "",
      status: richMenuLinkResult.status,
      detail: richMenuLinkResult.detail,
      reason: richMenuLinkResult.reason
    });
  }

  res.status(200).json({
    ok: true,
    resultType,
    richMenuId: richMenuLinkResult.richMenuId || "",
    richMenuLinkResult
  });
}

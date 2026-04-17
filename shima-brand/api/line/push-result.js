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
  console.log("[push-result] idToken 検証開始", {
    channelIdPresent: Boolean(channelId),
    channelId: channelId || "(none)",
    idToken: idToken || "(none)"
  });
  try {
    const body = new URLSearchParams();
    body.set("id_token", idToken);
    body.set("client_id", channelId);
    const r = await fetch("https://api.line.me/oauth2/v2.1/verify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString()
    });
    const rawText = await r.text();
    console.log("[push-result] LINE id_token verify HTTP", r.status, r.statusText, rawText.slice(0, 800));
    if (!r.ok) {
      console.log("[push-result] idToken 検証結果: sub は取得できず（HTTP エラー）");
      return null;
    }
    let data;
    try {
      data = JSON.parse(rawText);
    } catch (e) {
      console.log("[push-result] idToken verify JSON parse error (catch)", String(e));
      return null;
    }
    const sub = data.sub || null;
    console.log("[push-result] idToken 検証結果: sub", sub || "(null)");
    return sub;
  } catch (e) {
    console.log("[push-result] LINE id_token verify fetch error (catch)", String(e));
    return null;
  }
}

async function getUserIdFromAccessToken(accessToken) {
  try {
    const r = await fetch("https://api.line.me/v2/profile", {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    });
    const rawText = await r.text();
    console.log("[push-result] LINE v2/profile (accessToken)", r.status, r.statusText, rawText.slice(0, 400));
    if (!r.ok) return null;
    const data = JSON.parse(rawText);
    return data.userId || null;
  } catch (e) {
    console.log("[push-result] getUserIdFromAccessToken (catch)", String(e));
    return null;
  }
}

async function linkUserRichMenu({ accessToken, lineUserId, resultType }) {
  const richMenuId = RICH_MENU_ID_BY_TYPE[resultType];
  if (!richMenuId) return { ok: false, skipped: true, reason: "missing_richmenu_id", richMenuId: "" };

  const endpoint = `https://api.line.me/v2/bot/user/${encodeURIComponent(lineUserId)}/richmenu/${encodeURIComponent(richMenuId)}`;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const r = await fetch(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`
        }
      });
      const detail = await r.text();
      console.log("[push-result] richmenu link HTTP", attempt, r.status, detail.slice(0, 400));
      if (r.ok) return { ok: true, attempt, richMenuId };
      if (attempt === 3) {
        return { ok: false, status: r.status, detail: detail.slice(0, 500), attempt, richMenuId };
      }
    } catch (e) {
      console.log("[push-result] richmenu link fetch (catch)", attempt, String(e));
      if (attempt === 3) {
        return { ok: false, reason: "fetch_error", detail: String(e), attempt, richMenuId };
      }
    }
  }
  return { ok: false, reason: "unknown", richMenuId };
}

module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method === "OPTIONS") {
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ success: false, failure: true, error: "Method not allowed" });
    return;
  }

  try {
    const channelAccessToken = process.env.LINE_CHANNEL_ACCESS_TOKEN;
    const channelId = process.env.LINE_CHANNEL_ID;
    if (!channelAccessToken) {
      console.log("[push-result] failure: LINE_CHANNEL_ACCESS_TOKEN 未設定");
      res.status(500).json({
        success: false,
        failure: true,
        error: "Server missing LINE_CHANNEL_ACCESS_TOKEN"
      });
      return;
    }

    let payload = req.body;
    if (typeof payload === "string") {
      try {
        payload = JSON.parse(payload || "{}");
      } catch (e) {
        console.log("[push-result] Invalid JSON body (catch)", String(e));
        res.status(400).json({ success: false, failure: true, error: "Invalid JSON body" });
        return;
      }
    }

    const { lineUserId, idToken, accessToken, resultType, diagnosisText } = payload || {};
    const hasLineUserId = typeof lineUserId === "string" && lineUserId.length > 0;
    const hasIdToken = typeof idToken === "string" && idToken.length > 0;
    const hasAccessToken = typeof accessToken === "string" && accessToken.length > 0;

    console.log("[push-result] リクエスト受信", {
      idToken: hasIdToken ? idToken : "(none)",
      lineUserId: hasLineUserId ? lineUserId : "(none)",
      hasAccessToken,
      resultType: resultType || "(none)"
    });

    if ((!hasLineUserId && !hasIdToken && !hasAccessToken) || !VALID_TYPES.includes(resultType)) {
      console.log("[push-result] failure: Invalid identity or resultType");
      res.status(400).json({
        success: false,
        failure: true,
        error: "Invalid identity payload or resultType"
      });
      return;
    }

    let resolvedLineUserId = hasLineUserId ? lineUserId : null;
    if (!resolvedLineUserId && hasIdToken && channelId) {
      resolvedLineUserId = await verifyIdToken(idToken, channelId);
    }
    if (!resolvedLineUserId && hasAccessToken) {
      resolvedLineUserId = await getUserIdFromAccessToken(accessToken);
    }

    console.log("[push-result] 解決後 lineUserId（push の to）", resolvedLineUserId || "(null)");

    if (!resolvedLineUserId) {
      console.log("[push-result] failure: Unable to resolve LINE user id");
      res.status(401).json({
        success: false,
        failure: true,
        error: "Unable to resolve LINE user id"
      });
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

    let pushRes;
    let pushResponseText;
    try {
      pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`
        },
        body: JSON.stringify({ to: resolvedLineUserId, messages })
      });
      pushResponseText = await pushRes.text();
    } catch (e) {
      console.log("[push-result] pushMessage fetch error (catch)", String(e));
      res.status(502).json({
        success: false,
        failure: true,
        error: "LINE push fetch failed",
        detail: String(e && e.message ? e.message : e)
      });
      return;
    }

    console.log("[push-result] LINE pushMessage のレスポンス", pushRes.status, pushRes.statusText, pushResponseText.slice(0, 800));

    if (!pushRes.ok) {
      console.log("[push-result] LINE API エラー（push not ok）", pushResponseText);
      res.status(502).json({
        success: false,
        failure: true,
        error: "LINE Messaging API push failed",
        status: pushRes.status,
        detail: pushResponseText.slice(0, 500)
      });
      return;
    }

    let richMenuLinkResult;
    try {
      richMenuLinkResult = await linkUserRichMenu({ accessToken: channelAccessToken, lineUserId: resolvedLineUserId, resultType });
    } catch (e) {
      console.log("[push-result] linkUserRichMenu (catch)", String(e));
      richMenuLinkResult = { ok: false, reason: "exception", detail: String(e && e.message ? e.message : e) };
    }

    console.log("[push-result] LINE rich menu link trace", {
      resultType,
      richMenuId: richMenuLinkResult.richMenuId || "",
      ok: !!richMenuLinkResult.ok,
      attempt: richMenuLinkResult.attempt || null,
      reason: richMenuLinkResult.reason || null
    });
    if (!richMenuLinkResult.ok) {
      console.log("[push-result] LINE rich menu link skipped/failed", {
        resultType,
        richMenuId: richMenuLinkResult.richMenuId || "",
        status: richMenuLinkResult.status,
        detail: richMenuLinkResult.detail,
        reason: richMenuLinkResult.reason
      });
    }

    const body = {
      success: true,
      failure: false,
      ok: true,
      resultType,
      richMenuId: richMenuLinkResult.richMenuId || "",
      richMenuLinkResult
    };
    console.log("[push-result] success レスポンス", { resultType, richMenuOk: richMenuLinkResult.ok });
    res.status(200).json(body);
  } catch (err) {
    console.log("[push-result] handler 全体 catch", String(err));
    res.status(500).json({
      success: false,
      failure: true,
      error: "push-result internal error",
      detail: String(err && err.message ? err.message : err)
    });
  }
};

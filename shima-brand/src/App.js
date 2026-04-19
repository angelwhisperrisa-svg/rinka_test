import React, { useState, useRef, useEffect, useLayoutEffect } from "react";

const publicUrl = process.env.PUBLIC_URL || "";
const VIDEO = {
  welcome: `${publicUrl}/videos/A_Oshiiro_welcome_1080p.mp4`,
  final: `${publicUrl}/videos/C_Oshiiro_Thank_you_and_invite_1080p.mp4`
};
/** 中間表示（start と同じレインボーサークル）の秒数。その後 start へ自動遷移 */
const INTRO_DIAGNOSIS_MS = 15000;
/** 無音のまま welcome 動画が終わったあと、中間表示へ進むまでの待ち時間 */
const WELCOME_MUTED_END_DELAY_MS = 7000;
const LINE_OFFICIAL_URL = "https://line.me/R/ti/p/@877xrsvw";
const BASE_FULL_URL = process.env.REACT_APP_BASE_FULL_URL || "https://thebase.in/";
/** /api 呼び出し先（別 Vercel ドメインで開いても shima-brand 側の Functions を叩く） */
const PUBLIC_APP_ORIGIN = (
  process.env.REACT_APP_PUBLIC_APP_ORIGIN || "https://shima-brand.vercel.app"
).replace(/\/$/, "");

const RESULT_TYPE_KEYS = ["mint", "rose", "lavender", "ivory", "skyblue"];
const REACT_APP_LIFF_ID = process.env.REACT_APP_LIFF_ID || "";
/** LIFF ログイン遷移後に push-result を再開するためのフラグ（値は resultKey） */
const PENDING_LINE_SEND_KEY = "pendingLineSend";
/** 同一セッションでの liff.login 多重起動防止（push 成功時に削除） */
const LIFF_LOGIN_STARTED_KEY = "liff_login_started";

/**
 * LINE アプリ内: init は withLoginOnExternalBrowser を付けない（UA で判定）。
 * liff.login は呼ばない。init 後 isLoggedIn が false なら getAccessToken() のみ試し、トークンがあれば push-result へ。
 * true のときは getProfile を優先し、失敗時のみ idToken / accessToken を試す。
 * @returns {Promise<{ ok: true } | { ok: false, kind: "error", message: string }>}
 */
async function handleComplete(resultKey) {
  alert("handleComplete内");
  console.log('handleComplete start');
  console.log("CURRENT URL:", window.location.href);
  console.log("finalResultKey:", resultKey);
  console.log("[handleComplete] start", { resultKey, hasLiffId: Boolean(REACT_APP_LIFF_ID) });

  if (!REACT_APP_LIFF_ID || !RESULT_TYPE_KEYS.includes(resultKey)) {
    console.log("[handleComplete] return: invalid LIFF or resultKey");
    return { ok: false, kind: "error", message: "診断結果の送信設定が無効です。" };
  }
  let liff;
  try {
    liff = (await import("@line/liff")).default;
    const ua = typeof navigator !== "undefined" ? navigator.userAgent || "" : "";
    const likelyLineInApp = /Line\//i.test(ua);
    const initOpts = { liffId: REACT_APP_LIFF_ID };
    if (!likelyLineInApp) initOpts.withLoginOnExternalBrowser = true;
    console.log("liff.init start", { likelyLineInApp, initOptsKeys: Object.keys(initOpts) });
    await liff.init(initOpts);
    console.log("liff.isLoggedIn:", liff.isLoggedIn());
    console.log("liff.isInClient:", liff.isInClient());
  } catch (e) {
    console.warn("[handleComplete] liff.init failed", e);
    console.log("[handleComplete] return: liff.init failed");
    return { ok: false, kind: "error", message: "LINE連携の初期化に失敗しました。しばらくしてから再度お試しください。" };
  }

  alert("liff.isLoggedIn(): " + String(liff.isLoggedIn()));

  const loggedIn = typeof liff.isLoggedIn === "function" && liff.isLoggedIn();
  let lineUserId = null;
  let idToken = null;
  let accessToken = null;

  if (loggedIn) {
    try {
      const profile = await liff.getProfile();
      lineUserId = profile?.userId || null;
      console.log("after getProfile", profile);
    } catch (e) {
      console.warn("[handleComplete] getProfile failed (continue with token if any)", e);
    }
    if (!lineUserId) {
      try {
        if (typeof liff.getIDToken === "function") idToken = liff.getIDToken();
      } catch (e) {
        console.warn("[handleComplete] getIDToken failed", e);
      }
      try {
        if (typeof liff.getAccessToken === "function") accessToken = liff.getAccessToken();
      } catch (e) {
        console.warn("[handleComplete] getAccessToken failed", e);
      }
    }
  } else {
    console.log("[handleComplete] isLoggedIn false: skip liff.login, getAccessToken() only → push-result if present");
    try {
      if (typeof liff.getAccessToken === "function") accessToken = liff.getAccessToken();
    } catch (e) {
      console.warn("[handleComplete] getAccessToken failed", e);
    }
  }

  if (!lineUserId && !idToken && !accessToken) {
    console.log("[handleComplete] return: no identity (profile / idToken / accessToken)");
    return {
      ok: false,
      kind: "error",
      message: "LINEのユーザー情報を取得できませんでした。LINEアプリから開き直してお試しください。"
    };
  }

  console.log("sending result:", resultKey, { hasLineUserId: Boolean(lineUserId), hasIdToken: Boolean(idToken), hasAccessToken: Boolean(accessToken) });

  const origin = PUBLIC_APP_ORIGIN;
  const pushBody = { resultType: resultKey };
  if (lineUserId) pushBody.lineUserId = lineUserId;
  if (idToken) pushBody.idToken = idToken;
  if (accessToken) pushBody.accessToken = accessToken;

  const parsePushJson = async (response) => {
    const raw = await response.text();
    try {
      return { raw, data: JSON.parse(raw) };
    } catch {
      return { raw, data: {} };
    }
  };

  try {
    console.log("calling push-result API");
    const res = await fetch(`${origin}/api/line/push-result`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(pushBody)
    });
    console.log("push-result response:", res.status);
    const { data } = await parsePushJson(res);
    if (!res.ok || data.failure === true || data.success === false) {
      console.warn("[handleComplete] push-result failure", res.status, data);
      const hint = typeof data.detail === "string" ? data.detail.slice(0, 120) : "";
      console.log("[handleComplete] return: push-result failure", res.status);
      return {
        ok: false,
        kind: "error",
        message: hint ? `結果の送信に失敗しました。（${hint}）` : "結果の送信に失敗しました。もう一度お試しください。"
      };
    }
  } catch (e) {
    console.warn("[handleComplete] fetch failed", e);
    console.log("[handleComplete] return: fetch exception");
    return { ok: false, kind: "error", message: "通信エラーが発生しました。通信状況をご確認のうえ、再度お試しください。" };
  }

  try {
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(PENDING_LINE_SEND_KEY);
      window.sessionStorage.removeItem(LIFF_LOGIN_STARTED_KEY);
    }
  } catch (_) {
    /* ignore */
  }
  console.log("[handleComplete] return: ok true");
  return { ok: true };
}

/**
 * 公式LINE（友だち追加）へ。LIFF 内は external:false で LINE 内ブラウザを切り替えやすい。
 * openWindow が無い／失敗時は同一 WebView で location.assign。
 * （自動再開有効時のみ参照 — DEBUG 単一路径中は未使用）
 */
// eslint-disable-next-line no-unused-vars
async function openLineOfficialAccountLink() {
  if (typeof window === "undefined") return;
  if (REACT_APP_LIFF_ID) {
    try {
      const liff = (await import("@line/liff")).default;
      await liff.init({ liffId: REACT_APP_LIFF_ID });
      const inClient = typeof liff.isInClient === "function" && liff.isInClient();
      if (inClient && typeof liff.openWindow === "function") {
        liff.openWindow({ url: LINE_OFFICIAL_URL, external: false });
        return;
      }
      if (inClient) {
        window.location.assign(LINE_OFFICIAL_URL);
        return;
      }
    } catch (e) {
      console.warn("[openLineOfficialAccountLink]", e);
    }
  }
  window.location.assign(LINE_OFFICIAL_URL);
}

/** 診断タイプ保持（リッチメニュー等の /result?auto=true から分岐するため） */
const OSHI_RESULT_STORAGE_KEY = "shima_oshi_result_v1";

function readStoredOshiType() {
  try {
    if (typeof window === "undefined") return null;
    const raw = window.localStorage.getItem(OSHI_RESULT_STORAGE_KEY);
    if (raw && RESULT_TYPE_KEYS.includes(raw)) return raw;
  } catch (_) {
    /* ignore */
  }
  return null;
}

function normalizeTypeKey(v) {
  if (!v || typeof v !== "string") return null;
  const t = v.trim().toLowerCase();
  return RESULT_TYPE_KEYS.includes(t) ? t : null;
}

/** state が空でも URL ?type= や pending から診断結果キーを復元する（LIFF ログイン復帰用） */
// eslint-disable-next-line no-unused-vars
function resolveFinalResultKey(resultKeyFromState, typeFromUrlRaw, pendingRaw) {
  const fromState = normalizeTypeKey((resultKeyFromState || "").trim() || "");
  const fromUrl = normalizeTypeKey((typeFromUrlRaw || "").trim() || "");
  const fromPending = normalizeTypeKey((pendingRaw || "").trim() || "");
  return fromState || fromUrl || fromPending;
}

function writeStoredOshiType(typeKey) {
  try {
    if (typeof window === "undefined") return;
    if (!typeKey || !RESULT_TYPE_KEYS.includes(typeKey)) return;
    window.localStorage.setItem(OSHI_RESULT_STORAGE_KEY, typeKey);
  } catch (_) {
    /* ignore */
  }
}

function clearStoredOshiType() {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(OSHI_RESULT_STORAGE_KEY);
  } catch (_) {
    /* ignore */
  }
}

/** 回答スコアのみで判定。同点時は固定の優先順（URLには依存しない） */
function computeResultFromScores(sc) {
  const max = Math.max(...RESULT_TYPE_KEYS.map((k) => sc[k] || 0));
  const tops = RESULT_TYPE_KEYS.filter((k) => sc[k] === max);
  if (tops.length === 1) return tops[0];
  const tieOrder = ["mint", "rose", "lavender", "ivory", "skyblue"];
  return tieOrder.find((k) => tops.includes(k)) || tops[0];
}

/**
 * 各色の BASE（有料・フル鑑定）URL。ボタンは常にこの関数だけを参照する（色ごとの if 分岐をここに集約）。
 */
function getBaseShopUrlForType(typeKey) {
  const fallback = process.env.REACT_APP_BASE_FULL_URL || BASE_FULL_URL;
  if (!typeKey || !RESULT_TYPE_KEYS.includes(typeKey)) return fallback;
  if (typeKey === "mint") return process.env.REACT_APP_BASE_MINT || fallback;
  if (typeKey === "rose") return process.env.REACT_APP_BASE_ROSE || fallback;
  if (typeKey === "lavender") return process.env.REACT_APP_BASE_LAVENDER || fallback;
  if (typeKey === "ivory") return process.env.REACT_APP_BASE_IVORY || fallback;
  if (typeKey === "skyblue") return process.env.REACT_APP_BASE_SKYBLUE || fallback;
  return fallback;
}

function parseInitialResultRoute() {
  const empty = { showResult: false, resultType: null, modeFull: false };
  if (typeof window === "undefined") return empty;

  const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
  const isResultPath = path === "/result" || path.endsWith("/result");
  const params = new URLSearchParams(window.location.search);
  const typeFromQuery = normalizeTypeKey(params.get("type"));

  /** LIFF 等: エンドポイントが / でも ?type=mint で結果画面へ（例: https://liff.line.me/xxx?type=mint） */
  if (typeFromQuery && !isResultPath && path !== "/start") {
    const modeParam = (params.get("mode") || "free").toLowerCase();
    return {
      showResult: true,
      resultType: typeFromQuery,
      modeFull: modeParam === "full",
      replaceUrlWithCanonical: true
    };
  }

  if (!isResultPath) return empty;
  const autoRaw = params.get("auto");
  const isAuto = autoRaw === "true" || autoRaw === "1";

  if (isAuto) {
    const explicitType = normalizeTypeKey(params.get("type"));
    const storedType = normalizeTypeKey(readStoredOshiType());
    const modeParam = (params.get("mode") || "full").toLowerCase();
    const modeFull = modeParam !== "free";
    const resolvedType = explicitType || storedType;
    if (resolvedType) {
      return {
        showResult: true,
        resultType: resolvedType,
        modeFull,
        replaceUrlWithCanonical: true
      };
    }
    // type も保存結果も無い場合のみ空振り
    return { ...empty, autoMissingStorage: true };
  }

  const type = normalizeTypeKey(params.get("type"));
  const mode = params.get("mode");
  if (!type) return empty;
  return {
    showResult: true,
    resultType: type,
    modeFull: mode === "full"
  };
}

/**
 * LINE リッチメニュー / LIFF からの診断入口（女神画面を出さない）。
 * 例: …/start または /?start=1 または /?entry=diagnosis
 * このときは LINE誘導画面ではなく「診断開始前」カードへ（7問は別ボタン）。
 * Instagram 等のトップは / のまま（女神＝ゴール、診断へは進めない）
 */
function shouldSkipWelcomeToDiagnosis() {
  if (typeof window === "undefined") return false;
  const path = (window.location.pathname || "/").replace(/\/$/, "") || "/";
  if (path === "/result" || path.endsWith("/result")) return false;
  const q = new URLSearchParams(window.location.search);
  /** ?type= があるときは結果復元を優先（LIFF で ?type=mint&entry=diagnosis 等の衝突を避ける） */
  if (normalizeTypeKey(q.get("type"))) return false;
  return path === "/start" || q.get("start") === "1" || q.get("entry") === "diagnosis";
}

const questions = [
  { text: "夜、ひとりでいるとき、自然と何をしていることが多い？", choices: [
    { icon: "🎵", text: "音楽を聴きながら、ぼーっとしている", scores: { lavender: 2, skyblue: 1 } },
    { icon: "📖", text: "本や漫画を読んでいる", scores: { ivory: 2, mint: 1 } },
    { icon: "✨", text: "推しのことを考えて妄想している", scores: { rose: 2, lavender: 1 } },
    { icon: "📱", text: "SNSで好きなものを集めている", scores: { skyblue: 2, mint: 1 } }
  ]},
  { text: "推しを見ているとき、胸の中に来るのはどんな感覚？", choices: [
    { icon: "🌸", text: "あたたかくて、泣きそうになる", scores: { rose: 2, ivory: 1 } },
    { icon: "⚡", text: "興奮して、全力で応援したくなる", scores: { mint: 2, skyblue: 1 } },
    { icon: "🌙", text: "静かに、でも確かに満たされる", scores: { lavender: 2, ivory: 1 } },
    { icon: "💫", text: "自分も輝けるような気がしてくる", scores: { skyblue: 2, rose: 1 } }
  ]},
  { text: "選ぶとしたら、どんな空間が好き？", choices: [
    { icon: "🕯️", text: "間接照明のやわらかい、静かな部屋", scores: { lavender: 2, ivory: 1 } },
    { icon: "🌿", text: "植物があって、光が差し込む場所", scores: { mint: 2, ivory: 1 } },
    { icon: "🌆", text: "夜景が見える、少し非日常な場所", scores: { skyblue: 2, lavender: 1 } },
    { icon: "🌸", text: "花や好きなものに囲まれた、自分だけの空間", scores: { rose: 2, mint: 1 } }
  ]},
  { text: "推しへの気持ちを一言で表すなら？", choices: [
    { icon: "💜", text: "「いてくれるだけでいい」", scores: { lavender: 3 } },
    { icon: "💙", text: "「どこまでも追いかけたい」", scores: { skyblue: 3 } },
    { icon: "💚", text: "「一緒に成長していきたい」", scores: { mint: 3 } },
    { icon: "🌸", text: "「ずっとそばにいたい」", scores: { rose: 3 } },
    { icon: "🤍", text: "「その存在が私の宝物」", scores: { ivory: 3 } }
  ]},
  { text: "落ち込んだとき、あなたを救ってくれるのは？", choices: [
    { icon: "🎤", text: "推しの歌声や言葉", scores: { rose: 2, lavender: 1 } },
    { icon: "🎬", text: "推しの映像を繰り返し見ること", scores: { skyblue: 2, mint: 1 } },
    { icon: "✍️", text: "気持ちを書き出したり、絵を描くこと", scores: { ivory: 2, lavender: 1 } },
    { icon: "👥", text: "同じ推しを持つ友達と話すこと", scores: { mint: 2, skyblue: 1 } }
  ]},
  { text: "推しに会えるとしたら、何を伝えたい？", choices: [
    { icon: "🙏", text: "「ありがとう、あなたのおかげで生きられた」", scores: { ivory: 2, lavender: 1 } },
    { icon: "💌", text: "「大好きです、ずっと応援しています」", scores: { rose: 2, ivory: 1 } },
    { icon: "🌟", text: "「あなたの夢を、私も信じている」", scores: { mint: 2, skyblue: 1 } },
    { icon: "😊", text: "「笑顔でいてくれてありがとう」", scores: { skyblue: 2, rose: 1 } }
  ]},
  { text: "あなたにとって「推す」とはどういうこと？", choices: [
    { icon: "🕊️", text: "存在するだけで世界が美しくなること", scores: { lavender: 2, ivory: 1 } },
    { icon: "🔥", text: "毎日に熱と理由を与えてくれること", scores: { mint: 2, skyblue: 1 } },
    { icon: "💎", text: "他の何にも変えられない宝物を持つこと", scores: { ivory: 2, rose: 1 } },
    { icon: "🌈", text: "自分の感情が全部肯定される感覚", scores: { rose: 2, lavender: 1 } }
  ]}
];

const results = {
  mint: {
    name: "ミントグリーン",
    sub: "Mint Green / 清新の緑",
    color: "#7cd4b4",
    gradient: "linear-gradient(135deg, #7cd4b4, #4aad8a)",
    teaserFree: "あなたは、人を支えることが自然にできる人です。ただ今は、少し周りを優先しすぎているかもしれません。もしそうなら、、、",
    hookBeforeLock: "この先では、本来の状態、ズレの理由、整え方を具体的にお伝えします。",
    lockedBody: `・自分の時間を少しだけ優先する
・無理に合わせるのをやめる
それだけでも、あなたの心は少し軽くなるはずです。
本来のあなたは、もっと自然体でいられる人です。でも今は、少し「整えすぎている」状態かもしれません。`,
    fullBody: `あなたは、人を支えることが自然にできる人です。ただ今は、少し周りを優先しすぎているかもしれません。もしそうなら、、、

・自分の時間を少しだけ優先する
・無理に合わせるのをやめる
それだけでも、あなたの心は少し軽くなるはずです。
本来のあなたは、もっと自然体でいられる人です。でも今は、少し「整えすぎている」状態かもしれません。この先では、本来の状態、ズレの理由、整え方を具体的にお伝えします。
🌿 「あなたの本当の状態を推し色で知りたい」🌿
─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,
  },
  rose: {
    name: "ローズピンク",
    sub: "Rose Pink / 恋情の薔薇",
    color: "#e87898",
    gradient: "linear-gradient(135deg, #e87898, #c4506c)",
    teaserFree: "あなたは、感情豊かに愛せる人です。ただ今は、少し気持ちが強くなりすぎているかもしれません。もしそうなら、、、",
    hookBeforeLock: "この先では、感情のズレの理由、整え方を具体的にお伝えします。",
    lockedBody: `・相手ではなく、自分の気持ちを見てみる
・少しだけ距離を取る
それだけでも、気持ちは落ち着いていきます。

本来のあなたは、愛を受け取りながら与えられる人です。でも今は、少し「与える側」に偏っている状態かもしれません。`,
    fullBody: `あなたは、感情豊かに愛せる人です。ただ今は、少し気持ちが強くなりすぎているかもしれません。もしそうなら、、、
・相手ではなく、自分の気持ちを見てみる
・少しだけ距離を取る
それだけでも、気持ちは落ち着いていきます。

本来のあなたは、愛を受け取りながら与えられる人です。でも今は、少し「与える側」に偏っている状態かもしれません。この先では、感情のズレの理由、整え方を具体的にお伝えします。
🌿 「あなたの本当の状態を推し色で知りたい」🌿
─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,
  },
  lavender: {
    name: "ラベンダー",
    sub: "Lavender / 幻夢の紫",
    color: "#c4a0e8",
    gradient: "linear-gradient(135deg, #c4a0e8, #9b72cf)",
    teaserFree: "あなたは、とても感性が豊かな人です。ただ今は、少し内側に寄りすぎているかもしれません。もしそうなら、、、",
    hookBeforeLock: "この先では、ズレの理由、現実への活かし方を具体的にお伝えします。",
    lockedBody: `・感じたことを少し言葉にする
・小さく外に出してみる
それだけでも、流れが変わっていきます。
本来のあなたは、感性を現実に活かせる人です。でも今は、少し「感じるだけ」で止まっている状態かもしれません。`,
    fullBody: `あなたは、とても感性が豊かな人です。ただ今は、少し内側に寄りすぎているかもしれません。もしそうなら、、、
・感じたことを少し言葉にする
・小さく外に出してみる
それだけでも、流れが変わっていきます。
本来のあなたは、感性を現実に活かせる人です。でも今は、少し「感じるだけ」で止まっている状態かもしれません。この先では、ズレの理由、現実への活かし方を具体的にお伝えします。
🌿 「あなたの本当の状態を推し色で知りたい」🌿
─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,
  },
  ivory: {
    name: "アイボリー",
    sub: "Ivory / 永遠の白磁",
    color: "#e8dfc4",
    gradient: "linear-gradient(135deg, #e8dfc4, #c8b890)",
    teaserFree: "あなたは、安定した判断ができる人です。ただ今は、少し感情を抑えすぎているかもしれません。もしそうなら、、、",
    hookBeforeLock: "この先では、ズレの理由、感情の整え方を具体的にお伝えします。",
    lockedBody: `・自分の気持ちを少し言葉にする
・楽しいと感じることを選ぶ
それだけでも、内側が動き始めます。
本来のあなたは、安定と感情の両方を持てる人です。でも今は、少し「整いすぎている」状態かもしれません。`,
    fullBody: `あなたは、安定した判断ができる人です。ただ今は、少し感情を抑えすぎているかもしれません。もしそうなら、、、
・自分の気持ちを少し言葉にする
・楽しいと感じることを選ぶ
それだけでも、内側が動き始めます。
本来のあなたは、安定と感情の両方を持てる人です。でも今は、少し「整いすぎている」状態かもしれません。この先では、ズレの理由、感情の整え方を具体的にお伝えします。
🌿 「あなたの本当の状態を推し色で知りたい」🌿
─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,
  },
  skyblue: {
    name: "スカイブルー",
    sub: "Sky Blue / 蒼穹の青",
    color: "#6ab8e8",
    gradient: "linear-gradient(135deg, #6ab8e8, #3a8fc4)",
    teaserFree: "あなたは、自由に動ける人です。ただ今は、少し流れに任せすぎているかもしれません。もしそうなら、、、",
    hookBeforeLock: "この先では、ズレの理由、深くなるための方法を具体的にお伝えします。",
    lockedBody: `・1つだけ続けることを決める
・少しだけ深く向き合う
それだけでも、変化が生まれます。
本来のあなたは、自由と継続を両方持てる人です。でも今は、少し「軽さ」に寄っている状態かもしれません。`,
    fullBody: `あなたは、自由に動ける人です。ただ今は、少し流れに任せすぎているかもしれません。もしそうなら、、、
・1つだけ続けることを決める
・少しだけ深く向き合う
それだけでも、変化が生まれます。
本来のあなたは、自由と継続を両方持てる人です。でも今は、少し「軽さ」に寄っている状態かもしれません。この先では、ズレの理由、深くなるための方法を具体的にお伝えします。
🌿 「あなたの本当の状態を推し色で知りたい」🌿
─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,
  }
};

const initialScores = { lavender: 0, skyblue: 0, mint: 0, rose: 0, ivory: 0 };
const petals = ["🌸", "🌺", "🌷", "💮", "🌸", "🌺"];
const butterflies = ["🦋", "🦋", "🦋"];
const petalLanes = [4, 12, 20, 80, 88, 96];
const butterflyLanes = [7, 15, 85, 93];

const styles = `
  * { box-sizing: border-box; }
  body {
    margin: 0;
    font-family: "Zen Maru Gothic", sans-serif;
    color: #333;
    background: radial-gradient(circle at 20% 20%, #f9f2ff 0%, #eef7ff 45%, #eef5f0 100%);
    overflow-x: hidden;
  }

  .page {
    min-height: 100dvh;
    position: relative;
    padding: clamp(20px, 5vh, 40px) 14px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    background: radial-gradient(circle at 20% 20%, #f9f2ff 0%, #eef7ff 45%, #eef5f0 100%);
  }

  .float-layer-back,
  .float-layer-mid {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .float-layer-back { z-index: 0; }
  .float-layer-mid { z-index: 8; }

  .container {
    position: relative;
    z-index: 2;
  }

  .float-item {
    position: absolute;
    opacity: 0;
    filter: drop-shadow(0 4px 10px rgba(255, 255, 255, 0.6));
  }

  .petal {
    font-size: 14px;
    animation: petalFloat linear infinite;
  }

  .butterfly {
    font-size: 13px;
    animation: butterflyFloat ease-in-out infinite;
  }

  @keyframes petalFloat {
    0% { transform: translateY(-10vh) translateX(0) rotate(0deg); opacity: 0; }
    15% { opacity: 0.45; }
    85% { opacity: 0.35; }
    100% { transform: translateY(110vh) translateX(40px) rotate(360deg); opacity: 0; }
  }

  @keyframes butterflyFloat {
    0% { transform: translateY(0) translateX(0) rotate(-8deg); opacity: 0; }
    20% { opacity: 0.5; }
    50% { transform: translateY(-26px) translateX(22px) rotate(8deg); opacity: 0.55; }
    80% { opacity: 0.45; }
    100% { transform: translateY(60px) translateX(-12px) rotate(-6deg); opacity: 0; }
  }

  .container {
    width: 96%;
    max-width: min(96vw, 900px);
    margin: 0 auto;
    border-radius: 24px;
    padding: 28px 10px 30px;
    background: linear-gradient(145deg, rgba(255,255,255,0.54), rgba(255,255,255,0.34));
    border: 1px solid rgba(255,255,255,0.55);
    box-shadow: 0 16px 42px rgba(158, 142, 189, 0.16), inset 0 1px 0 rgba(255,255,255,0.7);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }

  @media (min-width: 820px) {
    .container {
      max-width: min(95vw, 860px);
    }
  }

  @media (min-width: 900px) {
    .container {
      max-width: min(94vw, 900px);
    }
  }

  @media (min-height: 860px) {
    .page {
      padding-top: 5.5vh;
      padding-bottom: 5.5vh;
    }
    .container {
      padding-top: 46px;
      padding-bottom: 62px;
    }
    .header { margin-bottom: 36px; }
  }

  /* 画面高さが低い端末では、初期画面をファーストビュー内に収める */
  @media (max-height: 820px) {
    .page {
      justify-content: flex-start;
      padding-top: 8px;
      padding-bottom: 10px;
    }
    .container {
      padding-top: 12px;
      padding-bottom: 12px;
    }
    .header { margin-bottom: 10px; }
    .card { padding-top: 10px; padding-bottom: 10px; }
    .orb {
      width: 196px;
      height: 196px;
      margin-bottom: 8px;
    }
    .start-text {
      margin-bottom: 6px;
      line-height: 1.4;
      font-size: clamp(13px, 3.4vw, 14px);
      max-width: 21ch;
    }
    .start-btn {
      min-height: 50px;
      min-width: 208px;
      padding: 12px 30px;
      font-size: clamp(17px, 4.8vw, 20px);
    }
    .floating-note { margin-top: 1px; }
  }

  .header { text-align: center; margin-bottom: 20px; }
  .sub {
    color: #6b5b95;
    font-size: clamp(11px, 3vw, 12px);
    letter-spacing: 2.4px;
    text-transform: uppercase;
    margin-bottom: 10px;
    white-space: nowrap;
  }
  .title {
    font-family: "Shippori Mincho", serif;
    margin: 0 0 10px;
    font-size: clamp(32px, 7vw, 46px);
    line-height: 1.3;
    background: linear-gradient(135deg, #f08bd2 0%, #d28df5 42%, #98a9f3 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .desc {
    margin: 0;
    color: #6b6680;
    font-size: clamp(14px, 4vw, 16px);
    line-height: 1.58;
    max-width: 24ch;
    margin-inline: auto;
    text-wrap: pretty;
  }

  .card {
    border-radius: 20px;
    padding: 16px 8px;
    background: linear-gradient(150deg, rgba(255,255,255,0.8), rgba(255,255,255,0.66));
    border: 1px solid rgba(255,255,255,0.7);
    box-shadow: 0 12px 26px rgba(169, 150, 194, 0.11);
    backdrop-filter: blur(6px);
  }
  .start-screen { text-align: center; }

  .orb {
    width: 246px;
    height: 246px;
    margin: 0 auto 10px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    font-size: 44px;
    position: relative;
    border: none;
    outline: none;
    overflow: hidden;
  }
  .orb-aurora {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: conic-gradient(
      from 0deg,
      #ffc4e8 0deg,
      #d9b5ff 58deg,
      #96d9ff 122deg,
      #9eeec8 182deg,
      #ffe88e 244deg,
      #ffbfd9 302deg,
      #ffc4e8 360deg
    );
    box-shadow: 0 0 46px rgba(212, 184, 255, 0.44), 0 0 84px rgba(135, 215, 255, 0.31);
    animation: auroraSpin 26s linear infinite;
    filter: saturate(1.2) brightness(1.07) contrast(1.11);
  }
  .orb-aurora::before {
    content: "";
    position: absolute;
    inset: -6%;
    border-radius: 50%;
    background: conic-gradient(
      from 180deg,
      rgba(255, 193, 230, 0.55) 0deg,
      rgba(173, 203, 255, 0.38) 90deg,
      rgba(152, 238, 199, 0.42) 180deg,
      rgba(255, 232, 152, 0.36) 250deg,
      rgba(255, 193, 230, 0.55) 360deg
    );
    mix-blend-mode: screen;
    filter: blur(10px);
    animation: auroraDrift 17s ease-in-out infinite reverse;
  }
  .orb-flow {
    position: absolute;
    inset: 12%;
    border-radius: 50%;
    background:
      radial-gradient(circle at 28% 30%, rgba(255,255,255,0.5), rgba(255,255,255,0) 55%),
      conic-gradient(
        from 90deg,
        rgba(255, 178, 222, 0.74),
        rgba(160, 192, 255, 0.62),
        rgba(151, 241, 202, 0.6),
        rgba(255, 233, 149, 0.52),
        rgba(255, 178, 222, 0.74)
      );
    filter: blur(8px) saturate(1.14);
    animation: flowPulse 12s ease-in-out infinite, flowSpin 19s linear infinite;
  }
  @keyframes auroraSpin { to { transform: rotate(360deg); } }
  @keyframes auroraDrift {
    0%, 100% { transform: scale(1) rotate(0deg); opacity: 0.72; }
    50% { transform: scale(1.08) rotate(18deg); opacity: 0.92; }
  }
  @keyframes flowPulse {
    0%, 100% { transform: scale(0.94) rotate(0deg); opacity: 0.6; }
    35% { transform: scale(1.03) rotate(-8deg); opacity: 0.76; }
    70% { transform: scale(1.1) rotate(-18deg); opacity: 0.9; }
  }
  @keyframes flowSpin {
    from { filter: blur(8px) saturate(1.14) hue-rotate(0deg); }
    to { filter: blur(8px) saturate(1.14) hue-rotate(12deg); }
  }

  .orb-heart {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
    z-index: 2;
    animation: heartBeat 2.6s ease-in-out infinite;
    transform-origin: center;
  }
  @keyframes heartBeat {
    0%, 100% { transform: scale(1); }
    35% { transform: scale(1.14); }
    55% { transform: scale(0.98); }
  }

  .start-text {
    margin: 0 auto 8px;
    color: #555;
    font-size: clamp(14px, 3.7vw, 15px);
    line-height: 1.46;
    max-width: 22ch;
    text-wrap: pretty;
  }
  .start-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: 999px;
    padding: 18px 52px;
    background: linear-gradient(135deg, #e7b3cc, #cfa9e8);
    color: #fff;
    font-size: clamp(21px, 6vw, 26px);
    letter-spacing: 2px;
    font-family: "Shippori Mincho", serif;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(194, 160, 219, 0.36);
    min-height: 60px;
    min-width: 236px;
    text-decoration: none;
    text-align: center;
    box-sizing: border-box;
  }
  .floating-note { margin-top: 2px; color: #999; font-size: 12px; }
  .start-screen .diagnosis-quiz-start {
    width: 100%;
    justify-content: center;
    text-align: center;
    margin-top: 12px;
  }

  .progress-wrap { margin-bottom: 14px; }
  .progress-label {
    display: flex;
    justify-content: space-between;
    color: #6b5b95;
    font-size: 11px;
    margin-bottom: 8px;
  }
  .progress-bar {
    height: 4px;
    border-radius: 99px;
    overflow: hidden;
    background: rgba(0,0,0,0.09);
  }
  .progress-fill {
    height: 100%;
    background: linear-gradient(90deg, #f39acf, #b9a7ff);
    transition: width 0.3s ease;
  }
  .question-num {
    color: #c084fc;
    letter-spacing: 3px;
    font-size: 11px;
    margin-bottom: 12px;
  }
  .question-text {
    margin: 0 0 18px;
    font-size: clamp(18px, 4vw, 22px);
    line-height: 1.8;
    font-family: "Shippori Mincho", serif;
  }
  .choices { display: grid; gap: 10px; }
  .choice-btn {
    border: 1px solid rgba(192,132,252,0.25);
    border-radius: 14px;
    background: rgba(250, 247, 253, 0.8);
    color: #444;
    padding: 14px 16px;
    text-align: left;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: clamp(14px, 3.8vw, 16px);
    cursor: pointer;
    min-height: 54px;
  }
  .choice-btn:hover {
    border-color: rgba(200,100,220,0.6);
    background: rgba(238, 222, 251, 0.8);
  }
  .choice-icon {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: rgba(240,220,255,0.6);
    flex: 0 0 auto;
  }

  .result-card {
    display: flex;
    flex-direction: column;
    text-align: center;
    border-radius: 22px;
    padding: 28px 20px;
    background: linear-gradient(150deg, rgba(255,255,255,0.82), rgba(255,255,255,0.64));
    border: 1px solid rgba(255,255,255,0.72);
    box-shadow: 0 14px 28px rgba(158, 142, 189, 0.14);
    backdrop-filter: blur(6px);
  }
  .result-label { color: #c084fc; font-size: 11px; letter-spacing: 2.2px; margin-bottom: 8px; white-space: nowrap; }
  .result-ball { width: 118px; height: 118px; border-radius: 50%; margin: 0 auto 20px; }
  .result-name { margin: 0 0 8px; font-size: clamp(28px, 7vw, 38px); font-family: "Shippori Mincho", serif; }
  .result-sub { color: #555; margin-bottom: 10px; font-size: clamp(14px, 3.8vw, 16px); line-height: 1.6; }
  .result-lead {
    margin: 0 0 14px;
    font-size: clamp(15px, 3.9vw, 17px);
    font-weight: 700;
    color: #5c5470;
    line-height: 1.5;
  }
  .result-free-wrap {
    text-align: left;
    width: 100%;
    margin: 0 0 4px;
  }
  .result-free-block + .result-free-block {
    margin-top: 0;
  }
  .result-free-chunk {
    margin: 0;
    color: #6b6680;
    font-size: clamp(14px, 3.7vw, 16px);
    line-height: 1.85;
    white-space: pre-line;
  }
  .result-hook {
    margin: 14px 0 0;
    text-align: left;
    font-size: clamp(14px, 3.7vw, 16px);
    font-weight: 700;
    color: #5c5470;
    line-height: 1.75;
  }
  .result-base-cta-wrap {
    margin-top: clamp(24px, 5vh, 40px);
    width: 100%;
  }
  .result-base-guide {
    text-align: center;
    margin: 0 0 12px;
  }
  .result-base-guide-title {
    margin: 0;
    font-size: clamp(15px, 4.4vw, 18px);
    font-weight: 900;
    color: #4c1d95;
    letter-spacing: 0.01em;
    line-height: 1.45;
  }
  .result-base-guide-sub {
    margin: 6px 0 0;
    font-size: clamp(12px, 3.3vw, 14px);
    color: #6d28d9;
    line-height: 1.55;
  }
  .result-base-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    text-decoration: none;
    border-radius: 18px;
    padding: 20px 20px;
    font-size: clamp(17px, 4.8vw, 20px);
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #4f46e5, #9333ea);
    box-shadow: 0 16px 42px rgba(79, 70, 229, 0.46), 0 0 28px rgba(147, 51, 234, 0.25);
    border: 1px solid rgba(255, 255, 255, 0.35);
    min-height: 72px;
    line-height: 1.35;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
    animation: baseCtaPulse 2.8s ease-in-out infinite;
  }
  .result-base-cta:hover {
    box-shadow: 0 20px 50px rgba(147, 51, 234, 0.42);
  }
  .result-base-cta:active {
    transform: scale(0.98);
  }
  @keyframes baseCtaPulse {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-1px) scale(1.015); }
  }
  .result-body-sep {
    border: none;
    height: 1px;
    background: linear-gradient(90deg, transparent, rgba(192,132,252,0.38), transparent);
    margin: 22px 0;
  }
  .locked-result {
    position: relative;
    margin: 20px 0 0;
    text-align: left;
    border-radius: 16px;
    background: rgba(245, 240, 255, 0.4);
    border: 1px solid rgba(192, 132, 252, 0.28);
    padding: 16px 14px;
    min-height: min(240px, 42vh);
    overflow: hidden;
  }
  .locked-content {
    filter: blur(9px);
    user-select: none;
    pointer-events: none;
    opacity: 0.92;
  }
  .lock-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 12px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.38), rgba(255, 255, 255, 0.58));
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    text-align: center;
    padding: 20px 16px;
  }
  .lock-icon { font-size: 32px; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.12)); }
  .lock-title {
    font-size: clamp(13px, 3.6vw, 15px);
    font-weight: 700;
    color: #3d5a4f;
    letter-spacing: 0.02em;
    line-height: 1.45;
    max-width: 280px;
  }
  .line-unlock-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    text-decoration: none;
    background: #06C755;
    color: #fff;
    border-radius: 999px;
    padding: 14px 24px;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    box-shadow: 0 10px 28px rgba(6, 199, 85, 0.42), 0 0 36px rgba(6, 199, 85, 0.28);
    animation: lineBreath 2.6s ease-in-out infinite;
    min-height: 52px;
    min-width: min(92vw, 260px);
    white-space: nowrap;
    transition: transform 0.18s ease;
  }
  .line-unlock-btn:active {
    transform: scale(0.98);
  }
  @keyframes lineBreath {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.05); }
  }
  .result-retry-row {
    display: flex;
    justify-content: flex-end;
    width: 100%;
    margin-top: 10px;
  }
  .retry-btn {
    width: auto;
    max-width: 100%;
    border: none;
    border-radius: 8px;
    padding: 4px 2px 4px 8px;
    cursor: pointer;
    background: transparent;
    color: #9a8ab0;
    font-size: clamp(11px, 2.9vw, 12px);
    font-weight: 500;
    min-height: 0;
    line-height: 1.35;
    font-family: inherit;
    text-align: right;
    text-decoration: underline;
    text-underline-offset: 3px;
    opacity: 0.92;
  }
  .retry-btn:hover {
    color: #7a6a96;
  }
  .result-liff-error {
    width: 96%;
    max-width: min(96vw, 900px);
    margin: 0 auto 14px;
    padding: 14px 16px;
    border-radius: 16px;
    background: rgba(254, 242, 242, 0.92);
    border: 1px solid rgba(248, 113, 113, 0.45);
    color: #7f1d1d;
    text-align: left;
  }
  .result-liff-error__text {
    margin: 0;
    font-size: clamp(13px, 3.5vw, 15px);
    line-height: 1.55;
    font-weight: 600;
  }
  .result-liff-sending {
    width: 96%;
    max-width: min(96vw, 900px);
    margin: 0 auto 12px;
    padding: 12px 16px;
    border-radius: 14px;
    background: rgba(245, 240, 255, 0.85);
    border: 1px solid rgba(192, 132, 252, 0.35);
    color: #5c5470;
    font-size: clamp(13px, 3.5vw, 15px);
    font-weight: 600;
    text-align: center;
  }
  .page--immersive {
    padding: 0;
    min-height: 100dvh;
  }

  .video-stage {
    position: fixed;
    inset: 0;
    z-index: 60;
    display: flex;
    align-items: center;
    justify-content: center;
    background: radial-gradient(ellipse at 50% 30%, #2a1a3e 0%, #0f0818 55%, #08050e 100%);
    overflow: hidden;
  }

  .video-stage--welcome {
    background:
      radial-gradient(circle at 22% 18%, rgba(249, 242, 255, 0.12) 0%, transparent 42%),
      radial-gradient(circle at 78% 82%, rgba(238, 247, 255, 0.08) 0%, transparent 45%),
      radial-gradient(ellipse at 50% 40%, #1f1430 0%, #0f0818 52%, #050308 100%);
  }

  .video-layer {
    position: absolute;
    inset: 0;
    opacity: 1;
    transition: opacity 0.55s ease-out;
  }

  .video-layer--fade {
    opacity: 0;
    pointer-events: none;
  }

  .video-layer video {
    width: 100%;
    height: 100%;
    object-fit: cover;
    object-position: center center;
    display: block;
  }

  .video-stage--welcome .video-layer--welcome video {
    object-fit: cover;
    object-position: center center;
  }

  @media (min-width: 768px) {
    .video-stage--welcome .video-layer--welcome video {
      object-fit: contain;
      object-position: center top;
    }
  }

  .video-stage--final {
    background:
      radial-gradient(circle at 22% 18%, rgba(249, 242, 255, 0.12) 0%, transparent 42%),
      radial-gradient(circle at 78% 82%, rgba(238, 247, 255, 0.08) 0%, transparent 45%),
      radial-gradient(ellipse at 50% 40%, #1f1430 0%, #0f0818 52%, #050308 100%);
  }
  .video-stage--final .video-layer--final video {
    object-fit: cover;
    object-position: center center;
  }
  @media (min-width: 768px) {
    .video-stage--final .video-layer--final video {
      object-fit: contain;
      object-position: center top;
    }
  }

  .video-stage--welcome-exit .video-layer,
  .video-stage--welcome-exit .welcome-overlay {
    opacity: 0;
    transition: opacity 0.48s ease-out;
    pointer-events: none;
  }

  .welcome-overlay {
    position: absolute;
    left: 0;
    right: 0;
    top: 72%;
    bottom: auto;
    transform: translateY(-50%);
    z-index: 3;
    display: flex;
    justify-content: center;
    padding: 0 20px;
    pointer-events: none;
  }

  @media (max-width: 767px) {
    .welcome-overlay {
      top: 76%;
    }
  }

  @media (min-width: 768px) {
    .welcome-overlay {
      top: 70%;
      padding: 0 clamp(20px, 4vw, 48px);
    }
  }

  .welcome-glass-btn {
    pointer-events: auto;
    cursor: pointer;
    font-family: inherit;
    font-size: clamp(14px, 3.7vw, 16px);
    font-weight: 700;
    letter-spacing: 0.02em;
    line-height: 1.35;
    color: rgba(255, 255, 255, 0.96);
    text-shadow: 0 1px 10px rgba(0, 0, 0, 0.45);
    padding: 15px 26px;
    min-height: 52px;
    max-width: min(92vw, 340px);
    width: 100%;
    border-radius: 999px;
    border: 1px solid rgba(255, 255, 255, 0.52);
    box-shadow:
      0 0 0 1px rgba(218, 190, 120, 0.35),
      0 8px 32px rgba(80, 40, 120, 0.35),
      inset 0 1px 0 rgba(255, 255, 255, 0.42);
    background: linear-gradient(
      145deg,
      rgba(255, 255, 255, 0.26) 0%,
      rgba(244, 232, 255, 0.14) 45%,
      rgba(230, 220, 255, 0.1) 100%
    );
    backdrop-filter: blur(16px) saturate(1.2);
    -webkit-backdrop-filter: blur(16px) saturate(1.2);
    transition: transform 0.2s ease, box-shadow 0.2s ease, border-color 0.2s ease;
    animation: welcomeGlassIn 0.75s ease-out 0.15s both;
  }

  .welcome-glass-btn:hover {
    border-color: rgba(255, 248, 220, 0.65);
    box-shadow:
      0 0 0 1px rgba(235, 200, 120, 0.5),
      0 12px 40px rgba(120, 70, 180, 0.38),
      inset 0 1px 0 rgba(255, 255, 255, 0.5);
  }

  .welcome-glass-btn:active {
    transform: scale(0.98);
  }

  .welcome-overlay--dual {
    top: auto;
    bottom: clamp(22px, 7vh, 52px);
    transform: none;
    padding: 0 22px;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .welcome-line-btn {
    pointer-events: auto;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    max-width: min(92vw, 360px);
    min-height: 56px;
    padding: 16px 28px;
    border-radius: 999px;
    font-family: inherit;
    font-size: clamp(16px, 4.2vw, 18px);
    font-weight: 800;
    letter-spacing: 0.06em;
    color: #fff;
    text-decoration: none;
    background: #06C755;
    box-shadow: 0 10px 32px rgba(6, 199, 85, 0.45);
    border: 1px solid rgba(255, 255, 255, 0.35);
    transition: transform 0.15s ease, box-shadow 0.15s ease;
    animation: welcomeGlassIn 0.75s ease-out 0.15s both;
  }

  .welcome-line-btn:hover {
    box-shadow: 0 14px 40px rgba(6, 199, 85, 0.5);
  }

  .welcome-line-btn:active {
    transform: scale(0.98);
  }

  @keyframes welcomeGlassIn {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .calc-caption {
    position: absolute;
    left: 0;
    right: 0;
    bottom: clamp(18px, 6vh, 52px);
    z-index: 2;
    margin: 0 auto;
    padding: 0 20px;
    text-align: center;
    font-size: clamp(15px, 4vw, 18px);
    font-weight: 700;
    color: rgba(255, 255, 255, 0.96);
    text-shadow: 0 2px 20px rgba(0, 0, 0, 0.65), 0 0 28px rgba(168, 85, 247, 0.35);
    letter-spacing: 0.04em;
  }

  .line-gate-page {
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    padding: 28px 18px 40px;
    background: radial-gradient(circle at 20% 20%, #f9f2ff 0%, #eef7ff 45%, #eef5f0 100%);
  }
  .line-gate-card {
    width: 100%;
    max-width: 420px;
    border-radius: 22px;
    padding: 26px 20px 30px;
    background: linear-gradient(150deg, rgba(255,255,255,0.92), rgba(255,255,255,0.78));
    border: 1px solid rgba(255,255,255,0.85);
    box-shadow: 0 16px 40px rgba(158, 142, 189, 0.2);
    text-align: center;
  }
  .line-gate-title {
    font-family: "Shippori Mincho", serif;
    font-size: clamp(20px, 5vw, 24px);
    margin: 0 0 12px;
    color: #4a3f63;
    line-height: 1.45;
  }
  .line-gate-lead {
    margin: 0 0 20px;
    color: #5c5470;
    font-size: clamp(14px, 3.8vw, 16px);
    line-height: 1.75;
    text-align: left;
  }
  .line-gate-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    border: none;
    border-radius: 999px;
    padding: 16px 22px;
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 800;
    cursor: pointer;
    font-family: inherit;
    margin-top: 10px;
    min-height: 54px;
    transition: transform 0.15s ease;
  }
  .line-gate-btn:active { transform: scale(0.98); }
  .line-gate-btn--green {
    background: #06C755;
    color: #fff;
    box-shadow: 0 10px 28px rgba(6, 199, 85, 0.38);
    text-decoration: none;
  }
  .line-gate-btn--purple {
    background: linear-gradient(135deg, #7c3aed, #a855f7);
    color: #fff;
    box-shadow: 0 10px 28px rgba(124, 58, 237, 0.35);
  }
  .line-gate-note {
    margin-top: 14px;
    font-size: 12px;
    color: #8b7fa3;
    line-height: 1.55;
  }
  .result-line-next-wrap {
    margin-top: 28px;
    padding: 22px 16px 26px;
    border-radius: 20px;
    background: linear-gradient(160deg, rgba(6, 199, 85, 0.1), rgba(124, 58, 237, 0.06));
    border: 2px solid rgba(6, 199, 85, 0.28);
    width: 100%;
  }
  .result-line-next-copy {
    margin: 0 0 18px;
    font-size: clamp(14px, 3.7vw, 16px);
    line-height: 1.85;
    color: #5c5470;
    font-weight: 700;
    white-space: pre-line;
    text-align: left;
  }
  .result-line-next-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    border: none;
    border-radius: 999px;
    padding: 18px 20px;
    font-family: inherit;
    font-size: clamp(16px, 4.5vw, 18px);
    font-weight: 800;
    color: #fff;
    cursor: pointer;
    background: linear-gradient(135deg, #06C755, #05a84a);
    box-shadow: 0 12px 32px rgba(6, 199, 85, 0.38);
    transition: transform 0.18s ease;
    line-height: 1.35;
    text-decoration: none;
    box-sizing: border-box;
  }
  .result-line-next-btn:active {
    transform: scale(0.98);
  }

  .result-card--reveal {
    animation: resultReveal 0.55s ease-out both;
  }

  @keyframes resultReveal {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
  }
`;

export default function App() {
  const pendingDeepLinkRef = useRef(parseInitialResultRoute());
  const deepLinkConsumedRef = useRef(false);
  /** 診断（クイズ）完了後だけ URL を /result?type=&mode=free に同期する */
  const shouldSyncQuizResultUrlRef = useRef(false);

  const [screen, setScreen] = useState("welcome");
  const [welcomeMuted, setWelcomeMuted] = useState(true);
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState(initialScores);
  const [resultKey, setResultKey] = useState("");
  const resultKeyRef = useRef("");
  const [resultModeFull, setResultModeFull] = useState(false);
  const welcomeVideoRef = useRef(null);
  const finalVideoRef = useRef(null);
  const welcomeExitTimerRef = useRef(null);
  const welcomeSilentSkipTimerRef = useRef(null);
  const welcomeEngagedRef = useRef(false);
  const liffMsgSentRef = useRef(false);
  const liffSaveInFlightRef = useRef(false);
  const [liffCompleteError, setLiffCompleteError] = useState("");
  const [liffSaveLoading, setLiffSaveLoading] = useState(false);
  /** [DEBUG 単一路径] 自動再開無効化中 — 再有効化時は下の pageshow / auto-resume のコメントを外す */
  const [lineLoginResumeBump, setLineLoginResumeBump] = useState(0);
  void lineLoginResumeBump;
  void setLineLoginResumeBump;

  const progress = Math.round((currentQ / questions.length) * 100);
  const currentQuestion = questions[currentQ];
  const result = resultKey ? results[resultKey] : null;

  const immersive = screen === "welcome" || screen === "calculating";

  useLayoutEffect(() => {
    if (typeof window !== "undefined" && shouldSkipWelcomeToDiagnosis()) {
      setScreen("diagnosisEntry");
      return;
    }
    if (deepLinkConsumedRef.current) return;
    const p = pendingDeepLinkRef.current;
    if (p.autoMissingStorage) {
      deepLinkConsumedRef.current = true;
      setScreen("welcome");
      return;
    }
    if (p.showResult && p.resultType) {
      deepLinkConsumedRef.current = true;
      resultKeyRef.current = p.resultType;
      setResultKey(p.resultType);
      setResultModeFull(Boolean(p.modeFull));
      setScreen("result");
      if (p.replaceUrlWithCanonical && typeof window !== "undefined") {
        const base = (publicUrl || "").replace(/\/$/, "");
        const modeStr = p.modeFull ? "full" : "free";
        const qs = `?type=${encodeURIComponent(p.resultType)}&mode=${modeStr}`;
        const path = base ? `${base}/result${qs}` : `/result${qs}`;
        window.history.replaceState({}, "", path);
      }
    } else if (typeof window !== "undefined") {
      let pendingType = null;
      try {
        pendingType = normalizeTypeKey(window.sessionStorage.getItem(PENDING_LINE_SEND_KEY) || "");
      } catch (_) {
        /* ignore */
      }
      const storedType = normalizeTypeKey(readStoredOshiType() || "");
      if (pendingType && storedType && pendingType === storedType) {
        deepLinkConsumedRef.current = true;
        resultKeyRef.current = pendingType;
        setResultKey(pendingType);
        setResultModeFull(false);
        setScreen("result");
        const base = (publicUrl || "").replace(/\/$/, "");
        const qs = `?type=${encodeURIComponent(pendingType)}&mode=free`;
        const path = base ? `${base}/result${qs}` : `/result${qs}`;
        window.history.replaceState({}, "", path);
      }
    }
  }, []);

  useEffect(() => {
    if (screen !== "result" || !resultKey) return;
    if (!shouldSyncQuizResultUrlRef.current) return;
    shouldSyncQuizResultUrlRef.current = false;
    if (typeof window === "undefined") return;
    const base = (publicUrl || "").replace(/\/$/, "");
    const qs = `?type=${encodeURIComponent(resultKey)}&mode=free`;
    const path = base ? `${base}/result${qs}` : `/result${qs}`;
    window.history.replaceState({}, "", path);
  }, [screen, resultKey]);

  useEffect(() => {
    resultKeyRef.current = resultKey || "";
    if (resultKey) writeStoredOshiType(resultKey);
  }, [resultKey]);

  useEffect(() => {
    if (screen !== "welcome") return undefined;
    const v = welcomeVideoRef.current;
    if (!v) return undefined;
    v.muted = welcomeMuted;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    return undefined;
  }, [screen, welcomeMuted]);

  useEffect(() => {
    if (screen === "welcome") return undefined;
    if (welcomeSilentSkipTimerRef.current) {
      window.clearTimeout(welcomeSilentSkipTimerRef.current);
      welcomeSilentSkipTimerRef.current = null;
    }
    if (welcomeExitTimerRef.current) {
      window.clearTimeout(welcomeExitTimerRef.current);
      welcomeExitTimerRef.current = null;
    }
    return undefined;
  }, [screen]);

  useEffect(() => {
    if (screen !== "intro") return undefined;
    const t = window.setTimeout(() => setScreen("start"), INTRO_DIAGNOSIS_MS);
    return () => window.clearTimeout(t);
  }, [screen]);

  useEffect(() => () => {
    if (welcomeExitTimerRef.current) window.clearTimeout(welcomeExitTimerRef.current);
    if (welcomeSilentSkipTimerRef.current) window.clearTimeout(welcomeSilentSkipTimerRef.current);
  }, []);

  useEffect(() => {
    if (screen !== "calculating") return;
    const v = finalVideoRef.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [screen]);

  const handleWelcomeSoundOn = () => {
    if (welcomeSilentSkipTimerRef.current) {
      window.clearTimeout(welcomeSilentSkipTimerRef.current);
      welcomeSilentSkipTimerRef.current = null;
    }
    welcomeEngagedRef.current = true;
    const v = welcomeVideoRef.current;
    setWelcomeMuted(false);
    if (v) {
      v.muted = false;
      v.currentTime = 0;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  };

  const handleWelcomeEnded = () => {
    const v = welcomeVideoRef.current;
    if (welcomeEngagedRef.current) {
      if (!v || v.muted) return;
      if (welcomeExitTimerRef.current) window.clearTimeout(welcomeExitTimerRef.current);
      setWelcomeExiting(true);
      welcomeExitTimerRef.current = window.setTimeout(() => {
        welcomeExitTimerRef.current = null;
        setWelcomeExiting(false);
        setScreen("intro");
      }, 480);
      return;
    }
    if (welcomeSilentSkipTimerRef.current) {
      window.clearTimeout(welcomeSilentSkipTimerRef.current);
    }
    welcomeSilentSkipTimerRef.current = window.setTimeout(() => {
      welcomeSilentSkipTimerRef.current = null;
      setWelcomeExiting(false);
      setScreen("intro");
    }, WELCOME_MUTED_END_DELAY_MS);
  };

  /** LIFF / 専用URL から入った「診断開始前」画面でのみ呼ぶ（LINE誘導画面では呼ばない） */
  const beginDiagnosisQuiz = () => {
    setLiffCompleteError("");
    setLiffSaveLoading(false);
    liffSaveInFlightRef.current = false;
    try {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(PENDING_LINE_SEND_KEY);
    } catch (_) {
      /* ignore */
    }
    liffMsgSentRef.current = false;
    resultKeyRef.current = "";
    setScreen("quiz");
    setCurrentQ(0);
    setScores(initialScores);
    setResultKey("");
  };

  const selectChoice = (scoreMap) => {
    const nextScores = { ...scores };
    Object.entries(scoreMap).forEach(([k, v]) => { nextScores[k] += v; });
    const nextQ = currentQ + 1;
    setScores(nextScores);
    if (nextQ < questions.length) {
      setCurrentQ(nextQ);
      return;
    }
    const topResultKey = computeResultFromScores(nextScores);
    resultKeyRef.current = topResultKey;
    setResultKey(topResultKey);
    setResultModeFull(false);
    if (typeof window !== "undefined") {
      const base = (publicUrl || "").replace(/\/$/, "");
      const qs = `?type=${encodeURIComponent(topResultKey)}&mode=free`;
      const path = base ? `${base}/result${qs}` : `/result${qs}`;
      window.history.replaceState({}, "", path);
    }
    shouldSyncQuizResultUrlRef.current = false;
    setScreen("calculating");
  };

  const resetDiagnosis = () => {
    setLiffCompleteError("");
    setLiffSaveLoading(false);
    liffSaveInFlightRef.current = false;
    try {
      if (typeof window !== "undefined") window.sessionStorage.removeItem(PENDING_LINE_SEND_KEY);
    } catch (_) {
      /* ignore */
    }
    liffMsgSentRef.current = false;
    shouldSyncQuizResultUrlRef.current = false;
    clearStoredOshiType();
    if (typeof window !== "undefined") {
      const path = (window.location.pathname || "").replace(/\/$/, "") || "/";
      if (path === "/result" || path.endsWith("/result")) {
        const base = (publicUrl || "").replace(/\/$/, "");
        window.history.replaceState({}, "", `${base}/` || "/");
      }
    }
    setScreen("welcome");
    setWelcomeMuted(true);
    setWelcomeExiting(false);
    setCurrentQ(0);
    setScores(initialScores);
    resultKeyRef.current = "";
    setResultKey("");
    setResultModeFull(false);
  };

  useEffect(() => {
    if (screen !== "result") {
      setLiffCompleteError("");
      setLiffSaveLoading(false);
    }
  }, [screen]);

  /*
  useEffect(() => {
    const onPageShow = (e) => {
      if (e && e.persisted) {
        setLineLoginResumeBump((n) => n + 1);
      }
    };
    if (typeof window !== "undefined") {
      window.addEventListener("pageshow", onPageShow);
      return () => window.removeEventListener("pageshow", onPageShow);
    }
    return undefined;
  }, []);
  */

  /*
   * liff.login() 後のフルリロード等で復帰したとき:
   * liff.isLoggedIn() &&（pending または URL ?type= が finalResultKey と一致）→ handleComplete(finalResultKey) を自動実行。
   * finalResultKey は state の resultKey が空でも URL の type から復元する。
   *
   * [DEBUG 単一路径] 一時無効 — ボタン onClick → handleComplete のみで検証
   */
  /*
  useEffect(() => {
    if (screen !== "result" || !REACT_APP_LIFF_ID) return undefined;

    const urlParams = new URLSearchParams(typeof window !== "undefined" ? window.location.search || "" : "");
    const typeFromUrl = urlParams.get("type");

    let pendingRaw = "";
    try {
      pendingRaw = typeof window !== "undefined" ? window.sessionStorage.getItem(PENDING_LINE_SEND_KEY) || "" : "";
    } catch (_) {
    }
    const pending = normalizeTypeKey(pendingRaw);
    const urlType = normalizeTypeKey(typeFromUrl || "");

    const finalResultKey = resolveFinalResultKey(resultKeyRef.current || resultKey, typeFromUrl, pendingRaw);
    if (!finalResultKey) return undefined;

    const pendingOk = Boolean(pending && pending === finalResultKey);
    const urlOk = Boolean(urlType && urlType === finalResultKey);
    if (!pendingOk && !urlOk) {
      console.log("[auto-resume handleComplete] skip: pending/URL type どちらも条件不一致", {
        pending,
        urlType,
        finalResultKey,
        typeFromUrl
      });
      return undefined;
    }

    if (liffMsgSentRef.current) {
      console.log("[auto-resume handleComplete] skip: already sent");
      return undefined;
    }
    if (liffSaveInFlightRef.current) {
      console.log("[auto-resume handleComplete] skip: save in flight");
      return undefined;
    }

    console.log("[auto-resume handleComplete] schedule", {
      finalResultKey,
      pendingOk,
      urlOk,
      href: typeof window !== "undefined" ? window.location.href : ""
    });

    let cancelled = false;
    (async () => {
      try {
        liffSaveInFlightRef.current = true;
        setLiffSaveLoading(true);
        setLiffCompleteError("");
        const liffMod = await import("@line/liff");
        const liff = liffMod.default;
        console.log("[auto-resume] liff.init start");
        await liff.init({ liffId: REACT_APP_LIFF_ID });
        console.log("[auto-resume] liff.isInClient:", liff.isInClient());
        if (cancelled) return;
        console.log("[auto-resume] liff.isLoggedIn:", liff.isLoggedIn());
        if (!liff.isLoggedIn()) {
          console.log("[auto-resume handleComplete] abort: not logged in after init");
          return;
        }
        const urlParamsNow = new URLSearchParams(window.location.search || "");
        const typeFromUrlNow = urlParamsNow.get("type");
        let pendingRawNow = "";
        try {
          pendingRawNow = window.sessionStorage.getItem(PENDING_LINE_SEND_KEY) || "";
        } catch (_) {
        }
        const pendingNow = normalizeTypeKey(pendingRawNow);
        const urlTypeNow = normalizeTypeKey(typeFromUrlNow || "");
        const finalResultKeyNow = resolveFinalResultKey(resultKeyRef.current || resultKey, typeFromUrlNow, pendingRawNow);
        if (!finalResultKeyNow) {
          console.log("[auto-resume handleComplete] abort: finalResultKey が取得できない", {
            typeFromUrlNow,
            resultKeyRef: resultKeyRef.current,
            resultKey
          });
          return;
        }
        const stillPendingOk = Boolean(pendingNow && pendingNow === finalResultKeyNow);
        const stillUrlOk = Boolean(urlTypeNow && urlTypeNow === finalResultKeyNow);
        if (!stillPendingOk && !stillUrlOk) {
          console.log("[auto-resume handleComplete] abort: pending/URL 条件が init 後に失効", {
            pendingNow,
            urlTypeNow,
            finalResultKeyNow
          });
          return;
        }
        console.log("[auto-resume handleComplete] calling handleComplete", finalResultKeyNow);
        const out = await handleComplete(finalResultKeyNow);
        console.log("[auto-resume handleComplete] handleComplete returned", out);
        if (cancelled) return;
        if (out.ok) {
          liffMsgSentRef.current = true;
          setLiffCompleteError("");
          await openLineOfficialAccountLink();
        } else if (out.kind === "login_redirect") {
          console.log("[auto-resume handleComplete] still login_redirect (unexpected here)");
        } else if (out.message) {
          setLiffCompleteError(out.message);
        }
      } catch (e) {
        console.warn("[auto-resume handleComplete] catch", e);
        if (!cancelled) {
          setLiffCompleteError("送信処理でエラーが発生しました。もう一度ボタンからお試しください。");
        }
      } finally {
        if (!cancelled) {
          liffSaveInFlightRef.current = false;
          setLiffSaveLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [screen, resultKey, lineLoginResumeBump]);
  */

  const RESULT_LINE_NEXT_COPY = `この先では、

・なぜこの色になったのか
・今のあなたの状態
・現実でどう活かすか

をLINEでお届けします✨`;

  const renderLineContinueBlock = () => (
    <div className="result-line-next-wrap">
      <p className="result-line-next-copy">{RESULT_LINE_NEXT_COPY}</p>
      <button
        type="button"
        className="result-line-next-btn"
        disabled={liffSaveLoading}
        onClick={async (e) => {
          e.preventDefault();
          console.log("CLICK OK");
          const res = await handleComplete(resultKey);
          console.log("RESULT:", res);
          return; // ここで止める
        }}
      >
        LINEで続きを受け取る🩷
      </button>
    </div>
  );

  const renderOshiResultCard = (res, isFull, typeKey) => {
    const baseShopUrl = getBaseShopUrlForType(typeKey);
    const renderBaseCta = () => (
      <div className="result-base-cta-wrap">
        <div className="result-base-guide">
          <p className="result-base-guide-title">LINE登録の次は、こちらからフル鑑定へ</p>
          <p className="result-base-guide-sub">あなたの推し色に合わせた詳細診断をBASEで確認できます。</p>
        </div>
        <a
          className="result-base-cta"
          href={baseShopUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          {`▶ BASEで${res.name}のフル鑑定を見る`}
        </a>
      </div>
    );
    const header = (
      <>
        <div className="result-label">YOUR OSHI COLOR</div>
        <div className="result-ball" style={{ background: res.gradient }} />
        <h2
          className="result-name"
          style={{
            background: res.gradient,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text"
          }}
        >
          {res.name}
        </h2>
        <div className="result-sub">{res.sub}</div>
        <p className="result-lead">{`あなたの推し色は「${res.name}」`}</p>
      </>
    );

    if (isFull) {
      return (
        <section className="result-card result-card--reveal">
          {header}
          <div className="result-free-wrap">
            <div className="result-free-block">
              <p className="result-free-chunk">{res.fullBody}</p>
            </div>
          </div>
          {renderBaseCta()}
        </section>
      );
    }

    return (
      <section className="result-card result-card--reveal">
        {header}
        <div className="result-free-wrap">
          <div className="result-free-block">
            <p className="result-free-chunk">{res.teaserFree}</p>
          </div>
        </div>
        <p className="result-hook">{res.hookBeforeLock}</p>
        <div className="locked-result">
          <div className="locked-content" aria-hidden>
            <p className="result-free-chunk">{res.lockedBody}</p>
          </div>
          <div className="lock-overlay">
            <div className="lock-icon" aria-hidden>🔒</div>
            <div className="lock-title">続きの鑑定はLINEトークでお届けします。</div>
          </div>
        </div>
        {renderLineContinueBlock()}
        {renderBaseCta()}
        <div className="result-retry-row">
          <button type="button" className="retry-btn" onClick={resetDiagnosis}>
            もう一度、推し色を見つける
          </button>
        </div>
      </section>
    );
  };

  return (
    <>
      <style>{styles}</style>
      <div className={`page${immersive ? " page--immersive" : ""}`}>
        {!immersive && (
          <>
            <div className="float-layer-back">
              {petals.map((p, idx) => (
                <span
                  key={`p-${idx}`}
                  className="float-item petal"
                  style={{
                    left: `${petalLanes[idx % petalLanes.length]}%`,
                    animationDuration: `${11 + idx * 1.8}s`,
                    animationDelay: `${idx * 1.1}s`,
                    opacity: 0.17,
                    transform: "scale(0.92)"
                  }}
                >
                  {p}
                </span>
              ))}
              {butterflies.map((b, idx) => (
                <span
                  key={`b-${idx}`}
                  className="float-item butterfly"
                  style={{
                    left: `${butterflyLanes[idx % butterflyLanes.length]}%`,
                    top: `${idx % 2 === 0 ? 10 : 78}%`,
                    animationDuration: `${8 + idx * 2.2}s`,
                    animationDelay: `${idx * 1.4}s`,
                    opacity: 0.15,
                    transform: "scale(0.9)"
                  }}
                >
                  {b}
                </span>
              ))}
            </div>
            <div className="float-layer-mid">
              {petals.slice(0, 4).map((p, idx) => (
                <span
                  key={`mp-${idx}`}
                  className="float-item petal"
                  style={{
                    left: `${idx < 2 ? 10 + idx * 8 : 82 + idx * 4}%`,
                    animationDuration: `${15 + idx * 1.1}s`,
                    animationDelay: `${0.6 + idx * 0.9}s`,
                    opacity: 0.2,
                    transform: "scale(0.95)"
                  }}
                >
                  {p}
                </span>
              ))}
              {butterflies.slice(0, 2).map((b, idx) => (
                <span
                  key={`mb-${idx}`}
                  className="float-item butterfly"
                  style={{
                    left: `${idx === 0 ? 8 : 92}%`,
                    top: `${idx === 0 ? 20 : 72}%`,
                    animationDuration: `${12 + idx * 2.1}s`,
                    animationDelay: `${0.8 + idx * 1.3}s`,
                    opacity: 0.19,
                    transform: "scale(0.95)"
                  }}
                >
                  {b}
                </span>
              ))}
            </div>

            <main className="container">
          <header className="header">
            <div className="sub">✦ Color Diagnosis ✦</div>
            <h1 className="title">推し活💜推し色占い</h1>
            <p className="desc">
              あなたにふさわしい推し色を教えてくれる。
            </p>
          </header>

          {(screen === "start" || screen === "intro") && (
            <section className="card start-screen">
              <div className="orb">
                <div className="orb-aurora" />
                <div className="orb-flow" />
                <span className="orb-heart">💜</span>
              </div>
              <p className="start-text">
                公式LINEを友だち追加すると、お送りするリンクから推し色診断（全7問）へ進めます。まずはLINEへどうぞ。
              </p>
              <a className="start-btn" href={LINE_OFFICIAL_URL}>LINE登録して診断を始める✨</a>
            </section>
          )}

          {screen === "diagnosisEntry" && (
            <section className="card start-screen">
              <div className="orb">
                <div className="orb-aurora" />
                <div className="orb-flow" />
                <span className="orb-heart">💜</span>
              </div>
              <p className="start-text">
                7つの質問で、あなただけの「推し色」が見つかる。色には感情がある。あなたはどの色に選ばれるのでしょう。
              </p>
              <button type="button" className="choice-btn diagnosis-quiz-start" onClick={beginDiagnosisQuiz}>
                <span className="choice-icon" aria-hidden>✨</span>
                <span>7問の診断を始める</span>
              </button>
              <div className="floating-note">全7問・約1分</div>
            </section>
          )}

          {screen === "quiz" && currentQuestion && (
            <>
              <div className="progress-wrap">
                <div className="progress-label">
                  <span>{`Q${currentQ + 1} / ${questions.length}`}</span>
                  <span>{`${progress}%`}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${progress}%` }} />
                </div>
              </div>
              <section className="card">
                <div className="question-num">{`QUESTION ${String(currentQ + 1).padStart(2, "0")}`}</div>
                <h2 className="question-text">{currentQuestion.text}</h2>
                <div className="choices">
                  {currentQuestion.choices.map((choice, idx) => (
                    <button
                      key={`${choice.text}-${idx}`}
                      className="choice-btn"
                      onClick={() => selectChoice(choice.scores)}
                    >
                      <span className="choice-icon">{choice.icon}</span>
                      <span>{choice.text}</span>
                    </button>
                  ))}
                </div>
              </section>
            </>
          )}

          {screen === "result" && result && (
            <>
              {liffCompleteError ? (
                <div className="result-liff-error" role="alert">
                  <p className="result-liff-error__text">{liffCompleteError}</p>
                </div>
              ) : null}
              {liffSaveLoading && !liffCompleteError ? (
                <div className="result-liff-sending">結果をLINEに送信中です…</div>
              ) : null}
              {renderOshiResultCard(result, resultModeFull, resultKey)}
            </>
          )}
            </main>
          </>
        )}

        {screen === "welcome" && (
          <div
            className={`video-stage video-stage--welcome${welcomeExiting ? " video-stage--welcome-exit" : ""}`}
          >
            <div className="video-layer video-layer--welcome">
              <video
                ref={welcomeVideoRef}
                src={VIDEO.welcome}
                playsInline
                autoPlay
                muted={welcomeMuted}
                preload="auto"
                onEnded={handleWelcomeEnded}
              />
            </div>
            <div className="welcome-overlay welcome-overlay--dual">
              <button type="button" className="welcome-glass-btn" onClick={handleWelcomeSoundOn}>
                音声をオンにする
              </button>
              <a className="welcome-line-btn" href={LINE_OFFICIAL_URL} target="_blank" rel="noopener noreferrer">LINEで診断を受ける</a>
            </div>
          </div>
        )}

        {screen === "calculating" && (
          <div className="video-stage video-stage--final">
            <div className="video-layer video-layer--final">
              <video
                ref={finalVideoRef}
                src={VIDEO.final}
                playsInline
                preload="auto"
                onEnded={() => setScreen("result")}
              />
            </div>
            <p className="calc-caption">結果を導き出しています...</p>
          </div>
        )}
      </div>
    </>
  );
}

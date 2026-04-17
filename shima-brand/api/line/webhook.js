import crypto from "crypto";

const CHANNEL_SECRET = process.env.LINE_CHANNEL_SECRET;
const CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN;

const COLOR_MESSAGES = {
  mint: `🌿 あなたの推し色は「ミントグリーン」

人を支えることが、あなたにとって自然なこと。
それはとても美しい才能です。

ただ今は——
少し周りを優先しすぎているかもしれません。

もしそうなら、こっそり試してみて🌿

・自分の時間を少しだけ優先する
・無理に合わせるのをやめる

それだけで、あなたの心はふっと軽くなるはずです。

─────────────────
🌿 本来のあなたは
もっと自然体でいられる人です。

でも今は、少し「整えすぎている」状態かもしれません。

─────────────────
この先では…

✦ 本来のあなたの状態
✦ ズレの理由
✦ 整え方

をもう少し深くお伝えします。

「あなたの本当の状態を、推し色で知りたい」🌿`

─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,




  rose: `🌹 あなたの推し色は「ローズピンク」

感情豊かに愛せる人——
それがあなたの本質です。

ただ今は——
少し気持ちが強くなりすぎているかもしれません。

もしそうなら、こっそり試してみて🌹

・相手ではなく、自分の気持ちを見てみる
・少しだけ距離を取る

それだけで、気持ちはふっと落ち着いていきます。

─────────────────
🌹 本来のあなたは
愛を受け取りながら与えられる人です。

でも今は、少し「与える側」に偏っている状態かもしれません。

─────────────────
この先では…

✦ 本来のあなたの状態
✦ 感情のズレの理由
✦ 整え方

をもう少し深くお伝えします。

「あなたの本当の状態を、推し色で知りたい」🌹`

─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,



  lavender: `🪻 あなたの推し色は「ラベンダー」

感性がとても豊かな人——
それがあなたの本質です。

ただ今は——
少し内側に寄りすぎているかもしれません。

もしそうなら、こっそり試してみて🪻

・感じたことを少し言葉にする
・小さく外に出してみる

それだけで、あなたの中の流れが変わっていきます。

─────────────────
🪻 本来のあなたは
感性を現実に活かせる人です。

でも今は、少し「感じるだけ」で止まっている状態かもしれません。

─────────────────
この先では…

✦ 本来のあなたの状態
✦ ズレの理由
✦ 現実への活かし方

をもう少し深くお伝えします。

「あなたの本当の状態を、推し色で知りたい」🪻`

─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,



,

  ivory: `☀️ あなたの推し色は「アイボリー」

安定した判断ができる、芯のある人——
それがあなたの本質です。

ただ今は——
少し感情を抑えすぎているかもしれません。

もしそうなら、こっそり試してみて☀️

・自分の気持ちを少し言葉にする
・楽しいと感じることを選ぶ

それだけで、あなたの内側がふっと動き始めます。

─────────────────
☀️ 本来のあなたは
安定と感情の両方を持てる人です。

でも今は、少し「整いすぎている」状態かもしれません。

─────────────────
この先では…

✦ 本来のあなたの状態
✦ ズレの理由
✦ 感情の整え方

をもう少し深くお伝えします。

「あなたの本当の状態を、推し色で知りたい」☀️`

─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,


  skyblue: `🩵 あなたの推し色は「スカイブルー」

自由に動ける、風のような人——
それがあなたの本質です。

ただ今は——
少し流れに任せすぎているかもしれません。

もしそうなら、こっそり試してみて🩵

・1つだけ続けることを決める
・少しだけ深く向き合う

それだけで、あなたの中に変化が生まれます。

─────────────────
🩵 本来のあなたは
自由と継続を両方持てる人です。

でも今は、少し「軽さ」に寄っている状態かもしれません。

─────────────────
この先では…

✦ 本来のあなたの状態
✦ ズレの理由
✦ 深くなるための方法

をもう少し深くお伝えします。

「あなたの本当の状態を、推し色で知りたい」🩵`

─────────────────
🛍️ さらに詳しい鑑定はこちら
https://kaorinkobo.base.shop`,


,
};

function detectColor(t) {
  const lower = t.toLowerCase().trim();
  if (lower === "color=mint" || lower.includes("mint") || t.includes("ミント")) return "mint";
  if (lower === "color=rose" || lower.includes("rose") || t.includes("ローズ")) return "rose";
  if (lower === "color=lavender" || lower.includes("lavender") || t.includes("ラベンダー")) return "lavender";
  if (lower === "color=ivory" || lower.includes("ivory") || t.includes("アイボリー")) return "ivory";
  if (lower === "color=skyblue" || lower.includes("skyblue") || t.includes("スカイブルー")) return "skyblue";
  return null;
}

async function replyMessage(replyToken, text) {
  await fetch("https://api.line.me/v2/bot/message/reply", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages: [{ type: "text", text }],
    }),
  });
}

function verifySignature(body, signature) {
  const hash = crypto
    .createHmac("SHA256", CHANNEL_SECRET)
    .update(body)
    .digest("base64");
  return hash === signature;
}

export default async function handler(req, res) {
  const signature = req.headers["x-line-signature"];
  const rawBody = JSON.stringify(req.body);

  if (!verifySignature(rawBody, signature)) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  const events = req.body.events || [];

  for (const event of events) {
    if (event.type === "message" && event.message.type === "text") {
      const text = event.message.text;
      console.log("[webhook] received text:", text);
      const colorKey = detectColor(text);
      console.log("[webhook] detected colorKey:", colorKey);

      if (colorKey && COLOR_MESSAGES[colorKey]) {
        await replyMessage(event.replyToken, COLOR_MESSAGES[colorKey]);
      }
    }
  }

  return res.status(200).json({ status: "ok" });
}

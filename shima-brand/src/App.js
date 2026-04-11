import React, { useState, useRef, useEffect } from "react";

const publicUrl = process.env.PUBLIC_URL || "";
const VIDEO = {
  welcome: `${publicUrl}/videos/A_Oshiiro_welcome_1080p.mp4`,
  mid: `${publicUrl}/videos/B_Oshiiro_Mid_1080p.mp4`,
  final: `${publicUrl}/videos/C_Oshiiro_Thank_you_and_invite_1080p.mp4`
};
const PAID_OSHIIRO_DETAIL_URL = "https://line.me/R/ti/p/@877xrsvw";

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
  lavender: { name: "ラベンダー", sub: "Lavender / 幻夢の紫", color: "#c4a0e8", gradient: "linear-gradient(135deg, #c4a0e8, #9b72cf)", desc: "あなたの推し色は「ラベンダー」。静かに深く、誰よりも純粋に愛せる人。感情は内側で輝いていて、言葉にならない愛情を持っています。推しの存在を、まるで夢の中の光のように大切にしている。その優しさは、推しにとって特別な温度を持っています。", tags: ["静かな愛情家", "深く感じる人", "繊細な魂", "夢を見る人"], oshi: "「あなたがいるから、この世界は美しい」と、心の中でいつも思っているはず。言葉にしなくても、その想いはきっと届いています。" },
  skyblue:  { name: "スカイブルー", sub: "Sky Blue / 蒼穹の青", color: "#6ab8e8", gradient: "linear-gradient(135deg, #6ab8e8, #3a8fc4)", desc: "あなたの推し色は「スカイブルー」。どこまでも追いかけ続ける、エネルギーと純粋さを持った推し活の体現者。推しの成長を誰よりも信じて、全力で応援できる力があります。その熱量は本物で、推しの背中を押す風になっています。", tags: ["全力応援タイプ", "追いかける勇気", "エネルギッシュ", "ブレない信念"], oshi: "あなたが掲げるペンライトの光は、どんな大きな会場でも届いている。推しはきっとその光を知っています。" },
  mint:     { name: "ミントグリーン", sub: "Mint Green / 清新の緑", color: "#7cd4b4", gradient: "linear-gradient(135deg, #7cd4b4, #4aad8a)", desc: "あなたの推し色は「ミントグリーン」。推しと一緒に成長していきたい、前向きで清らかな愛を持つ人。推しの挑戦を自分のことのように喜び、失敗さえも「一緒に乗り越えよう」と思える強さがあります。その愛は清潔で、嫌味がなく、推しを本当の意味で支えられる色。", tags: ["共に歩む人", "前向きな愛情", "清らかさ", "成長を喜ぶ"], oshi: "推しが新しいことに挑戦するたびに、あなたは誰よりも「できる」と信じていた。その信頼が、推しを動かしています。" },
  rose:     { name: "ローズピンク", sub: "Rose Pink / 恋情の薔薇", color: "#e87898", gradient: "linear-gradient(135deg, #e87898, #c4506c)", desc: "あなたの推し色は「ローズピンク」。感情豊かに、全身で愛せる情熱の人。推しへの気持ちが溢れて止まらない、その感情の豊かさがあなたの最大の魅力。泣いて笑って、全部本物。その真っ直ぐな愛情は、推しにとって太陽のような存在です。", tags: ["情熱的な愛情家", "感情豊か", "全力で愛する", "素直な心"], oshi: "あなたの笑顔と涙は、推しへの最高の贈り物。感情を隠さないで。その真っ直ぐさが、推しを幸せにしています。" },
  ivory:    { name: "アイボリー", sub: "Ivory / 永遠の白磁", color: "#e8dfc4", gradient: "linear-gradient(135deg, #e8dfc4, #c8b890)", desc: "あなたの推し色は「アイボリー」。流行に左右されず、ずっとそこにいる。永遠の忠誠を誓うような、深くて静かな愛の持ち主。推しのすべてを「宝物」として大切にして、その存在の価値を誰よりも分かっている人。時間が経っても変わらない愛情は、本物の証。", tags: ["永遠の推し活", "ブレない愛", "深い理解者", "宝物にする人"], oshi: "デビューの頃から今まで、ずっと変わらない目で見てくれているあなた。推しにとって、あなたは特別な存在です。" }
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
      min-height: 47px;
      min-width: 194px;
      padding: 10px 28px;
      font-size: clamp(16px, 4.6vw, 19px);
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
    border: none;
    border-radius: 999px;
    padding: 16px 46px;
    background: linear-gradient(135deg, #e7b3cc, #cfa9e8);
    color: #fff;
    font-size: clamp(20px, 5.8vw, 25px);
    letter-spacing: 2px;
    font-family: "Shippori Mincho", serif;
    cursor: pointer;
    box-shadow: 0 8px 22px rgba(194, 160, 219, 0.36);
    min-height: 56px;
    min-width: 220px;
  }
  .floating-note { margin-top: 2px; color: #999; font-size: 12px; }

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
  .result-sub { color: #555; margin-bottom: 16px; font-size: clamp(14px, 3.8vw, 16px); line-height: 1.6; }
  .result-desc { text-align: left; color: #6b6680; line-height: 1.82; margin-bottom: 12px; font-size: clamp(14px, 3.7vw, 16px); }
  .tags { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; margin-bottom: 18px; }
  .tag {
    padding: 6px 12px;
    border-radius: 999px;
    font-size: 12px;
    color: #7a5a9a;
    background: rgba(240,220,255,0.45);
    border: 1px solid rgba(192,132,252,0.32);
  }
  .result-oshi {
    text-align: left;
    padding: 14px;
    border-radius: 14px;
    background: rgba(240,220,255,0.28);
    border: 1px solid rgba(192,132,252,0.24);
    color: #7b7294;
    line-height: 1.8;
    margin-bottom: 12px;
  }
  .retry-btn {
    width: 100%;
    border: 1px solid rgba(192,132,252,0.3);
    border-radius: 14px;
    padding: 14px;
    cursor: pointer;
    background: linear-gradient(135deg, rgba(232,180,232,0.26), rgba(180,212,232,0.26));
    color: #7a5a9a;
    font-size: clamp(14px, 3.8vw, 16px);
    min-height: 52px;
  }
  .locked-result {
    position: relative;
    margin-bottom: 12px;
    text-align: left;
    border-radius: 14px;
    background: rgba(245, 240, 255, 0.35);
    border: 1px solid rgba(192,132,252,0.2);
    padding: 14px;
  }
  .locked-content {
    filter: blur(10px);
    user-select: none;
    pointer-events: none;
  }
  .detail-title {
    font-size: 13px;
    color: #7a5a9a;
    letter-spacing: 0.6px;
    margin-bottom: 8px;
  }
  .detail-list {
    margin: 0 0 10px 18px;
    padding: 0;
    color: #6d6a84;
    line-height: 1.8;
  }
  .detail-lucky {
    border-radius: 10px;
    padding: 10px 12px;
    background: rgba(255,255,255,0.5);
    color: #6a6780;
  }
  .lock-overlay {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
    border-radius: 14px;
    background: linear-gradient(180deg, rgba(255,255,255,0.4), rgba(255,255,255,0.62));
    backdrop-filter: blur(3px);
    text-align: center;
    padding: 18px;
  }
  .lock-icon { font-size: 26px; }
  .lock-title {
    font-size: 14px;
    font-weight: 700;
    color: #4d6f62;
    letter-spacing: 0.3px;
  }
  .line-unlock-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    text-decoration: none;
    background: #06C755;
    color: #fff;
    border-radius: 999px;
    padding: 12px 20px;
    font-size: clamp(14px, 3.8vw, 16px);
    font-weight: 700;
    box-shadow: 0 10px 24px rgba(6, 199, 85, 0.38), 0 0 34px rgba(6, 199, 85, 0.3);
    animation: lineBreath 2.6s ease-in-out infinite;
    min-height: 52px;
    min-width: 220px;
    white-space: nowrap;
  }
  @keyframes lineBreath {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.06); }
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
    background: #0c0614;
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

  .video-stage--welcome .video-layer video {
    object-position: center center;
  }

  @media (min-width: 768px) {
    .video-stage--welcome .video-layer video {
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
    bottom: clamp(56px, 16vh, 140px);
    z-index: 3;
    display: flex;
    justify-content: center;
    padding: 0 20px;
    pointer-events: none;
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

  .paid-detail-cta-wrap {
    margin: 18px 0 14px;
  }

  .paid-detail-cta {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 100%;
    text-decoration: none;
    border-radius: 16px;
    padding: 16px 18px;
    font-size: clamp(15px, 4vw, 17px);
    font-weight: 800;
    color: #fff;
    background: linear-gradient(135deg, #a855f7, #ec4899);
    box-shadow: 0 14px 38px rgba(168, 85, 247, 0.48);
    border: 1px solid rgba(255, 255, 255, 0.38);
    min-height: 56px;
    line-height: 1.35;
    transition: transform 0.18s ease, box-shadow 0.18s ease;
  }

  .paid-detail-cta:hover {
    box-shadow: 0 18px 44px rgba(236, 72, 153, 0.42);
  }

  .paid-detail-cta:active {
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
  const [screen, setScreen] = useState("welcome");
  const [welcomeMuted, setWelcomeMuted] = useState(true);
  const [welcomeExiting, setWelcomeExiting] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [scores, setScores] = useState(initialScores);
  const [resultKey, setResultKey] = useState("");
  const [midVideoActive, setMidVideoActive] = useState(false);

  const welcomeVideoRef = useRef(null);
  const midVideoRef = useRef(null);
  const finalVideoRef = useRef(null);
  const welcomeExitTimerRef = useRef(null);

  const progress = Math.round((currentQ / questions.length) * 100);
  const currentQuestion = questions[currentQ];
  const result = resultKey ? results[resultKey] : null;

  const immersive =
    screen === "welcome" || screen === "calculating" || midVideoActive;

  useEffect(() => {
    if (screen !== "welcome") return undefined;
    const v = welcomeVideoRef.current;
    if (!v) return undefined;
    v.muted = welcomeMuted;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
    return undefined;
  }, [screen, welcomeMuted]);

  useEffect(() => () => {
    if (welcomeExitTimerRef.current) window.clearTimeout(welcomeExitTimerRef.current);
  }, []);

  useEffect(() => {
    if (!midVideoActive) return;
    const v = midVideoRef.current;
    if (!v) return;
    v.muted = false;
    v.currentTime = 0;
    const p = v.play();
    if (p && typeof p.catch === "function") p.catch(() => {});
  }, [midVideoActive]);

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
    const v = welcomeVideoRef.current;
    setWelcomeMuted(false);
    if (v) {
      v.muted = false;
      const p = v.play();
      if (p && typeof p.catch === "function") p.catch(() => {});
    }
  };

  const handleWelcomeEnded = () => {
    if (welcomeExitTimerRef.current) window.clearTimeout(welcomeExitTimerRef.current);
    setWelcomeExiting(true);
    welcomeExitTimerRef.current = window.setTimeout(() => {
      welcomeExitTimerRef.current = null;
      setScreen("start");
      setWelcomeExiting(false);
      setWelcomeMuted(true);
    }, 480);
  };

  const startQuiz = () => {
    setScreen("quiz");
    setCurrentQ(0);
    setScores(initialScores);
    setResultKey("");
    setMidVideoActive(false);
  };

  const selectChoice = (scoreMap) => {
    const nextScores = { ...scores };
    Object.entries(scoreMap).forEach(([k, v]) => { nextScores[k] += v; });
    const nextQ = currentQ + 1;
    setScores(nextScores);
    if (nextQ < questions.length) {
      if (currentQ === 4) {
        setCurrentQ(5);
        setMidVideoActive(true);
        return;
      }
      setCurrentQ(nextQ);
      return;
    }
    const topResultKey = Object.entries(nextScores).sort((a, b) => b[1] - a[1])[0][0];
    setResultKey(topResultKey);
    setScreen("calculating");
  };

  const resetDiagnosis = () => {
    setScreen("start");
    setWelcomeMuted(true);
    setWelcomeExiting(false);
    setCurrentQ(0);
    setScores(initialScores);
    setResultKey("");
    setMidVideoActive(false);
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

          {screen === "start" && (
            <section className="card start-screen">
              <div className="orb">
                <div className="orb-aurora" />
                <div className="orb-flow" />
                <span className="orb-heart">💜</span>
              </div>
              <p className="start-text">
                7つの質問で、あなただけの「推し色」が見つかる。色には感情がある。あなたはどの色に選ばれるのでしょう。
              </p>
              <button className="start-btn" onClick={startQuiz}>診断スタート</button>
              <div className="floating-note">全7問・約1分</div>
            </section>
          )}

          {screen === "quiz" && currentQuestion && !midVideoActive && (
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
            <section className="result-card result-card--reveal">
              <div className="result-label">YOUR OSHI COLOR</div>
              <div className="result-ball" style={{ background: result.gradient }} />
              <h2
                className="result-name"
                style={{
                  background: result.gradient,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text"
                }}
              >
                {result.name}
              </h2>
              <div className="result-sub">{result.sub}</div>
              <div className="result-oshi">
                <strong>✦ あなたの推しへのメッセージ</strong>
                <div>{result.oshi}</div>
              </div>
              <div className="paid-detail-cta-wrap">
                <a
                  className="paid-detail-cta"
                  href={PAID_OSHIIRO_DETAIL_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  300円の詳しいおしいろ診断へ進む
                </a>
              </div>
              <div className="locked-result">
                <div className="locked-content">
                  <div className="detail-title">✦ 詳細診断・アドバイス</div>
                  <div className="result-desc">{result.desc}</div>
                  <ul className="detail-list">
                    <li>今日の開運アクション: 深呼吸と推し活ルーティン</li>
                    <li>感情の整え方: 朝と夜で心を切り替える</li>
                    <li>対人運のポイント: 優しい言葉で流れを呼ぶ</li>
                  </ul>
                  <div className="tags">
                    {result.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
                  </div>
                  <div className="detail-lucky">
                    ラッキーカラー詳細: {result.name} をアクセントにすると運気アップ。
                  </div>
                </div>
                <div className="lock-overlay">
                  <div className="lock-icon">🔒</div>
                  <div className="lock-title">詳細な運勢はLINEでチェック</div>
                  <a
                    className="line-unlock-btn"
                    href="https://line.me/R/ti/p/@877xrsvw"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    LINEで詳細をアンロック
                  </a>
                </div>
              </div>
              <button className="retry-btn" onClick={resetDiagnosis}>もう一度占う</button>
            </section>
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
            <div className="welcome-overlay">
              <button type="button" className="welcome-glass-btn" onClick={handleWelcomeSoundOn}>
                音声をオンにして診断を始める 🔘
              </button>
            </div>
          </div>
        )}

        {screen === "quiz" && midVideoActive && (
          <div className="video-stage">
            <div className="video-layer">
              <video
                ref={midVideoRef}
                src={VIDEO.mid}
                playsInline
                preload="auto"
                onEnded={() => setMidVideoActive(false)}
              />
            </div>
          </div>
        )}

        {screen === "calculating" && (
          <div className="video-stage">
            <div className="video-layer">
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

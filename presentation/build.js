// Builds presentation/Indic_Prompt_Compressor.pptx from presentation/data.json (exported from results/01_deepseek).
// Run: node build.js
const path = require("path");
const fs = require("fs");
const pptxgen = require("pptxgenjs");
const React = require("react");
const ReactDOMServer = require("react-dom/server");
const sharp = require("sharp");
const fa = require("react-icons/fa6");
const { applyTheme } = require("/home/sg/.claude/skills/synced/d08755b0-69f3-435c-81ee-4852b5eb5aa5_0a67737c-127e-4ef5-88b7-07edba3ec5fa/pptx/scripts/apply_theme.js");

const D = JSON.parse(fs.readFileSync(path.join(__dirname, "data.json"), "utf8"));
const OUT = path.join(__dirname, "Indic_Prompt_Compressor.pptx");

// ---------------------------------------------------------------- palette "Masala Night" (no blue, no white)
const HEX = {
  bg: "1E1024", card: "2E1A36", card2: "3F2549", text: "F4E7D4", muted: "BFA3B6",
  saffron: "F4A93B", rose: "E98AA8", sage: "9BC48F", terra: "E0663F", plum: "B784C9",
  passStrong: "5E8C55", pass: "3D5A39", fail: "7A3426", na: "2E1A36",
};
const THEME = {
  name: "Masala Night", headFontFace: "Bookman Old Style", bodyFontFace: "Calibri",
  colors: {
    dk1: HEX.bg, lt1: HEX.text, dk2: HEX.card, lt2: HEX.muted,
    accent1: HEX.saffron, accent2: HEX.rose, accent3: HEX.sage, accent4: HEX.terra, accent5: HEX.plum, accent6: HEX.card2,
    hlink: HEX.saffron, folHlink: HEX.plum,
  },
};
const LANG = {
  hi: { name: "Hindi", glyph: "अ", color: HEX.saffron },
  kn: { name: "Kannada", glyph: "ಅ", color: HEX.rose },
  ta: { name: "Tamil", glyph: "அ", color: HEX.sage },
};
const CELLS = ["hi_qa", "hi_summ", "kn_qa", "kn_summ", "ta_qa", "ta_summ"];

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "Indic Prompt Compressor";
pres.author = "Onspot hackathon team";
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

// ---------------------------------------------------------------- layouts
pres.defineSlideMaster({
  title: "DARK_TITLE", background: { color: HEX.bg },
  objects: [],
});
pres.defineSlideMaster({
  title: "DIVIDER", background: { color: HEX.saffron },
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 3.0, w: W - 2 * M, h: 1.0, fontSize: 44, bold: true, color: C.text1, valign: "top", align: "left", margin: 0 }, text: "" } },
  ],
});
pres.defineSlideMaster({
  title: "CONTENT", background: { color: HEX.bg },
  margin: [0.5, 0.6, 0.6, 0.6],
  objects: [
    { placeholder: { options: { name: "title", type: "title", x: M, y: 0.62, w: W - 2 * M, h: 0.8, fontSize: 32, bold: true, color: C.background1, valign: "top", align: "left", margin: 0 }, text: "" } },
    { text: { text: "Indic Prompt Compressor · Experiment 01", options: { x: M, y: 7.0, w: 6, h: 0.3, fontSize: 10, color: C.background2, margin: 0 } } },
  ],
  slideNumber: { x: W - M - 0.6, y: 7.0, w: 0.6, h: 0.3, fontSize: 10, color: HEX.muted, align: "right" },
});

// ---------------------------------------------------------------- helpers
async function icon(name, color, size = 256) {
  const svg = ReactDOMServer.renderToStaticMarkup(React.createElement(fa[name], { color: "#" + color, size: String(size) }));
  const png = await sharp(Buffer.from(svg)).png().toBuffer();
  return "image/png;base64," + png.toString("base64");
}
function kicker(slide, text, color = HEX.saffron) {
  slide.addText(text.toUpperCase(), { x: M, y: 0.3, w: 9, h: 0.3, fontSize: 12, bold: true, color, charSpacing: 3, margin: 0, isTextBox: true, objectName: "kicker" });
}
function card(slide, x, y, w, h, fill = HEX.card, name = "card") {
  slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: name });
}
function glyph(slide, lang, x, y, d = 0.62, fs = 22) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: LANG[lang].color }, line: { color: LANG[lang].color, width: 0 }, objectName: `glyph-${lang}` });
  slide.addText(LANG[lang].glyph, { x, y, w: d, h: d, fontSize: fs, bold: true, color: HEX.bg, align: "center", valign: "middle", margin: 0, fontFace: "Nirmala UI", isTextBox: true, objectName: `glyph-${lang}-t` });
}
async function iconChip(slide, iconName, x, y, d = 0.6, fill = HEX.saffron, color = HEX.bg) {
  slide.addShape(pres.shapes.OVAL, { x, y, w: d, h: d, fill: { color: fill }, line: { color: fill, width: 0 }, objectName: "icon-chip" });
  const pad = d * 0.24;
  slide.addImage({ data: await icon(iconName, color), x: x + pad, y: y + pad, w: d - 2 * pad, h: d - 2 * pad, altText: iconName.replace(/^Fa/, "") + " icon" });
}
function txt(slide, text, o) {
  slide.addText(text, { margin: 0, isTextBox: true, color: HEX.text, fontSize: 14, valign: "top", ...o });
}
function axes(extra = {}) {
  return {
    catAxisLabelColor: HEX.muted, valAxisLabelColor: HEX.muted, catAxisLabelFontFace: "+mn-lt", valAxisLabelFontFace: "+mn-lt",
    catAxisLabelFontSize: 12, valAxisLabelFontSize: 11, valGridLine: { color: HEX.card2, size: 0.75 }, catGridLine: { style: "none" },
    catAxisLineShow: false, valAxisLineShow: false,
    dataLabelColor: HEX.text, dataLabelFontFace: "+mn-lt", dataLabelFontSize: 11,
    legendFontFace: "+mn-lt", legendColor: HEX.text, legendFontSize: 12,
    titleColor: HEX.text, titleFontFace: "+mn-lt", titleFontSize: 14,
    ...extra,
  };
}
const pct = (x) => `${Math.round(x)}%`;
const r2 = (x) => (x).toFixed(2);

// ================================================================== SLIDES
async function build() {
  // ---------------------------------------------------------------- 1. Title
  pres.addSection({ title: "Opening" });
  let s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Opening" });
  kicker(s, "Onspot hackathon · Indic Prompt Compressor");
  txt(s, "Same answer.\nA fraction of the tokens.", { x: M, y: 1.2, w: 8.4, h: 2.4, fontSize: 48, bold: true, fontFace: "Bookman Old Style", objectName: "title" });
  txt(s, "A middleware layer that shrinks Hindi, Kannada and Tamil prompts before they reach the LLM, and checks that the answers stay as good.",
    { x: M, y: 3.75, w: 7.6, h: 1.0, fontSize: 18, color: HEX.muted });
  // stat strip
  const stats1 = [["58%", "₹ saved on DeepSeek V4.1"], ["73%", "projected on GLM-5.3"], ["≥ 95%", "answer quality kept"]];
  stats1.forEach(([v, l], i) => {
    const x = M + i * 2.75;
    card(s, x, 5.3, 2.5, 1.35, HEX.card, "stat-card");
    txt(s, v, { x: x + 0.25, y: 5.42, w: 2.1, h: 0.65, fontSize: 32, bold: true, color: HEX.saffron, fontFace: "Bookman Old Style" });
    txt(s, l, { x: x + 0.25, y: 6.07, w: 2.1, h: 0.45, fontSize: 13, color: HEX.text });
  });
  // glyph cluster
  glyph(s, "hi", 9.4, 1.25, 2.2, 80); glyph(s, "kn", 10.75, 3.05, 1.9, 70); glyph(s, "ta", 9.0, 4.05, 1.7, 60);
  txt(s, "Hindi · Kannada · Tamil", { x: 9.0, y: 6.15, w: 3.7, h: 0.4, fontSize: 13, color: HEX.muted, align: "right" });
  s.addNotes("Problem: Indic prompts cost far more tokens than English. We built and validated a layer that compresses them. Headline: 58% rupee saving on DeepSeek V4.1 Flash with quality at or above 95% of the original, and 73% projected on GLM-5.3.");

  // ---------------------------------------------------------------- 2. The token tax
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
  kicker(s, "The problem");
  s.addText("Indic text pays a heavy token tax", { placeholder: "title" });
  card(s, M, 1.7, 4.3, 4.9, HEX.card);
  txt(s, "8.9×", { x: M + 0.35, y: 1.95, w: 3.8, h: 1.3, fontSize: 72, bold: true, color: HEX.rose, fontFace: "Bookman Old Style" });
  txt(s, "more tokens for the same sentence in Kannada than in English, on the GLM-5.3 tokenizer", { x: M + 0.35, y: 3.3, w: 3.6, h: 1.0, fontSize: 16 });
  txt(s, "Tokens are what you pay for. A Kannada user pays roughly nine English prices for the same question, and the answer comes back just as expensive.",
    { x: M + 0.35, y: 4.45, w: 3.6, h: 1.6, fontSize: 14, color: HEX.muted });
  const g = D.fert ? null : null;
  s.addChart(pres.charts.BAR, [{ name: "Tokens per sentence", labels: ["English", "Hindi", "Tamil", "Kannada"], values: [26.9, 115.9, 205.3, 237.8] }],
    axes({ x: 5.3, y: 1.7, w: 7.4, h: 4.9, barDir: "bar", chartColors: [HEX.muted, HEX.saffron, HEX.sage, HEX.rose], showValue: true, dataLabelPosition: "outEnd",
      dataLabelFormatCode: "0", showTitle: true, title: "Average tokens per FLORES+ sentence · GLM-5.3 tokenizer", showLegend: false, valAxisHidden: true, valGridLine: { style: "none" },
      catAxisLabelFontSize: 14, barGapWidthPct: 45, objectName: "chart-token-tax" }));
  s.addNotes("FLORES+ devtest: about 1,000 sentences that say the same thing in every language. On GLM-5.3 an English sentence averages 27 tokens; Hindi 116, Tamil 205, Kannada 238.");

  // ---------------------------------------------------------------- 3. Gap depends on the tokenizer
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Opening" });
  kicker(s, "Measured gap · FLORES+ devtest, ~1,000 parallel sentences");
  s.addText("The gap depends on the model's tokenizer", { placeholder: "title" });
  const toks = [["sarvam-105b", "Sarvam-105B"], ["gemma4", "Gemma 4"], ["gpt-4o (o200k)", "GPT-4o"], ["deepseekv4.1-flash-1017", "DeepSeek V4.1"], ["glm5.3", "GLM-5.3"]];
  s.addChart(pres.charts.BAR, ["hi", "kn", "ta"].map((l) => ({ name: LANG[l].name, labels: toks.map((t) => t[1]), values: toks.map((t) => D.gap[t[0]][l]) })),
    axes({ x: M, y: 1.65, w: 8.4, h: 5.0, barDir: "col", barGrouping: "clustered", chartColors: [HEX.saffron, HEX.rose, HEX.sage], showValue: true, dataLabelPosition: "outEnd",
      dataLabelFormatCode: "0.0×", dataLabelFontSize: 10, showLegend: true, legendPos: "t", showTitle: true, title: "Parity: tokens vs the same English text (1.0× = no gap)",
      valAxisMinVal: 0, valAxisMaxVal: 10, valAxisLabelFormatCode: "0×", barGapWidthPct: 60, objectName: "chart-parity" }));
  card(s, 9.35, 1.65, 3.38, 2.35, HEX.card);
  txt(s, "Big opportunity", { x: 9.6, y: 1.85, w: 3.0, h: 0.4, fontSize: 18, bold: true, color: HEX.saffron });
  txt(s, "GLM-5.3 (4.3–8.9×) and DeepSeek V4.1 (2.8–3.7×) tokenise Indic scripts badly. That is where compression pays.", { x: 9.6, y: 2.3, w: 2.95, h: 1.6, fontSize: 14 });
  card(s, 9.35, 4.25, 3.38, 2.4, HEX.card);
  txt(s, "Little to gain", { x: 9.6, y: 4.45, w: 3.0, h: 0.4, fontSize: 18, bold: true, color: HEX.sage });
  txt(s, "Sarvam-105B and Gemma 4 are already close to English (1.3–1.9×). The router only cleans prompts for these models.", { x: 9.6, y: 4.9, w: 2.95, h: 1.6, fontSize: 14 });
  s.addNotes("Kannada is the most expensive language on every tokenizer. The router takes the target model as an input for this reason.");

  // ---------------------------------------------------------------- 4. Divider
  pres.addSection({ title: "What we built" });
  s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: "What we built" });
  txt(s, "01", { x: M, y: 1.2, w: 3, h: 1.4, fontSize: 96, bold: true, color: HEX.bg, fontFace: "Bookman Old Style" });
  s.addText("What we built and tested", { placeholder: "title" });
  txt(s, "A pipeline, twelve compression methods, and a judged experiment of 3,600 answers", { x: M, y: 4.3, w: 11, h: 0.6, fontSize: 18, color: HEX.card });

  // ---------------------------------------------------------------- 5. Pipeline
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "What we built" });
  kicker(s, "The layer");
  s.addText("Seven steps between the user and the LLM", { placeholder: "title" });
  const steps = [
    ["FaLanguage", "Detect", "Script → Hindi, Kannada or Tamil"],
    ["FaBroom", "Clean", "Unicode, invisible characters, citations, repeats"],
    ["FaRoute", "Route", "Rule table + safety guards pick a method"],
    ["FaCompress", "Compress", "Translate to English and/or prune tokens, locally"],
    ["FaRobot", "Call LLM", "Sarvam API: DeepSeek, GLM, Sarvam, Gemma"],
    ["FaRotateLeft", "Translate", "English answer → user's language, locally"],
    ["FaReceipt", "Report", "Tokens, ₹ saved, expected quality"],
  ];
  const sw = (W - 2 * M - 6 * 0.18) / 7;
  for (let i = 0; i < steps.length; i++) {
    const x = M + i * (sw + 0.18), y = 2.05;
    card(s, x, y, sw, 3.65, i === 3 ? HEX.card2 : HEX.card, `step-${i}`);
    await iconChip(s, steps[i][0], x + (sw - 0.8) / 2, y + 0.35, 0.8, i === 3 ? HEX.saffron : HEX.plum);
    txt(s, String(i + 1).padStart(2, "0"), { x: x + 0.15, y: y + 1.35, w: sw - 0.3, h: 0.35, fontSize: 12, bold: true, color: HEX.muted, align: "center" });
    txt(s, steps[i][1], { x: x + 0.05, y: y + 1.7, w: sw - 0.1, h: 0.45, fontSize: 15, bold: true, align: "center", color: i === 3 ? HEX.saffron : HEX.text });
    txt(s, steps[i][2], { x: x + 0.15, y: y + 2.2, w: sw - 0.3, h: 1.3, fontSize: 13, color: HEX.muted, align: "center" });
  }
  txt(s, "Translation (IndicTrans2), pruning (LLMLingua-2) and sentence matching (LaBSE) run on a 4 GB laptop GPU, so they cost ₹0 and add about 1–4 s per request.",
    { x: M, y: 6.05, w: W - 2 * M, h: 0.6, fontSize: 14, color: HEX.text });
  s.addNotes("Everything except the LLM call runs locally. Paid translation APIs cost more than the tokens they save, so local models were a requirement.");

  // ---------------------------------------------------------------- 6. Methods
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "What we built" });
  kicker(s, "The menu");
  s.addText("Ten ways to shrink a prompt", { placeholder: "title" });
  const meths = [
    ["M0", "Baseline", "Original prompt, unchanged. Everything is compared to this", HEX.muted],
    ["M1", "Clean-up", "Unicode, zero-width chars, citation marks, spaces, repeated sentences", HEX.plum],
    ["M2", "Prune native", "LLMLingua-2 deletes low-value tokens; keep 80 / 60 / 40%", HEX.plum],
    ["M3", "Via English", "Translate to English, answer in English, translate back", HEX.saffron],
    ["M3_b5", "Careful English", "M3 with beam-5 translation: fewer errors, 2× slower", HEX.saffron],
    ["M3h", "Hybrid (QA)", "English context + 2 key original sentences; answer in original", HEX.saffron],
    ["M4", "Romanise", "Same language in Latin letters (ITRANS)", HEX.rose],
    ["M5", "English + 60%", "Translate, then keep 60% of the English tokens", HEX.sage],
    ["M5_80", "English + 80%", "Translate, then keep 80% of the English tokens", HEX.sage],
    ["M6", "English answer", "Native input; answer written in English, translated back", HEX.rose],
  ];
  const mw = (W - 2 * M - 4 * 0.25) / 5, mh = 2.2;
  meths.forEach(([id, name, desc, col], i) => {
    const x = M + (i % 5) * (mw + 0.25), y = 1.7 + Math.floor(i / 5) * (mh + 0.25);
    card(s, x, y, mw, mh, HEX.card, `method-${id}`);
    txt(s, id, { x: x + 0.22, y: y + 0.2, w: mw - 0.4, h: 0.55, fontSize: 24, bold: true, color: col, fontFace: "Bookman Old Style" });
    txt(s, name, { x: x + 0.22, y: y + 0.8, w: mw - 0.4, h: 0.4, fontSize: 15, bold: true });
    txt(s, desc, { x: x + 0.22, y: y + 1.22, w: mw - 0.4, h: 1.05, fontSize: 12, color: HEX.muted });
  });
  txt(s, "M0_rep (the same request sent twice) measures the noise floor. M2 counts as three methods (keep 80 / 60 / 40%), so twelve variants were run in total.",
    { x: M, y: 6.48, w: W - 2 * M, h: 0.35, fontSize: 12, color: HEX.muted });

  // ---------------------------------------------------------------- 7. How we measured
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "What we built" });
  kicker(s, "Experiment design");
  s.addText("How we measured savings and quality", { placeholder: "title" });
  const facts = [
    ["FaDatabase", "Data", "IndicQA: 50 QA + 50 summarisation items per language (frozen, seed 42). FLORES+ for the gap"],
    ["FaMicrochip", "Target model", "DeepSeek V4.1 Flash via Sarvam API, thinking off, temperature 0"],
    ["FaGavel", "Judge", "sarvam-105b, blind to the method, always reads the original text. QA: correct / partial / wrong. Summary: faithfulness + coverage + fluency"],
    ["FaScaleBalanced", "Pass rule", "Quality retained = judge mean vs original ≥ 95% (τ). Strict: 95% bootstrap CI lower bound ≥ 95%"],
  ];
  for (let i = 0; i < facts.length; i++) {
    const y = 1.75 + i * 1.22;
    await iconChip(s, facts[i][0], M, y + 0.05, 0.62, HEX.plum);
    txt(s, facts[i][1], { x: M + 0.85, y, w: 6.6, h: 0.38, fontSize: 17, bold: true, color: HEX.saffron });
    txt(s, facts[i][2], { x: M + 0.85, y: y + 0.4, w: 6.6, h: 0.75, fontSize: 14 });
  }
  const big = [["3,600", "judged answers in the final run"], ["±2 pts", "noise when the same prompt is re-sent"], ["₹94", "spent on the target model for 3,600 calls"]];
  big.forEach(([v, l], i) => {
    const y = 1.7 + i * 1.65;
    card(s, 8.45, y, 4.28, 1.45, HEX.card, "big-stat");
    txt(s, v, { x: 8.75, y: y + 0.15, w: 3.8, h: 0.75, fontSize: 36, bold: true, color: [HEX.saffron, HEX.rose, HEX.sage][i], fontFace: "Bookman Old Style" });
    txt(s, l, { x: 8.75, y: y + 0.9, w: 3.8, h: 0.4, fontSize: 14, color: HEX.muted });
  });
  s.addNotes("No human labellers for Kannada or Tamil, so the judge is an LLM. We check it against token-F1 on gold answers and with an identical-prompt resend; a Hindi spot-check by a human is pending.");

  // ---------------------------------------------------------------- 8. Journey
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "What we built" });
  kicker(s, "Four runs");
  s.addText("Each run fixed what the last one exposed", { placeholder: "title" });
  const runs = [
    ["Run 1", "Smoke · n = 5", "The judge thought for 4,000+ tokens and returned nothing for 26% of answers.", "Fix: judge with thinking off + retry", HEX.terra],
    ["Run 2", "Smoke · n = 5", "0 missing verdicts. Via English looked strong; one QA item = 20 points.", "Next: scale to 50 items", HEX.plum],
    ["Run 3", "Full · n = 50", "M3 passes 5 of 6 cells. M5 cheapest but drops facts. Tamil QA fails (0.90).", "Next: fix Tamil, soften M5", HEX.rose],
    ["Run 4", "Full · n = 50", "M5_80 is the sweet spot. Beam-5 helps summaries. The hybrid fixes Tamil names.", "Result: the rule table", HEX.sage],
  ];
  const rw = (W - 2 * M - 3 * 0.3) / 4;
  s.addShape(pres.shapes.LINE, { x: M + 0.3, y: 2.25, w: W - 2 * M - 0.6, h: 0, line: { color: HEX.card2, width: 2 }, objectName: "timeline" });
  runs.forEach(([t, sub, body, next, col], i) => {
    const x = M + i * (rw + 0.3);
    s.addShape(pres.shapes.OVAL, { x: x + 0.15, y: 2.0, w: 0.5, h: 0.5, fill: { color: col }, line: { color: col, width: 0 }, objectName: "run-dot" });
    txt(s, t, { x: x + 0.8, y: 1.98, w: rw - 0.8, h: 0.5, fontSize: 20, bold: true, color: col, fontFace: "Bookman Old Style", valign: "middle" });
    card(s, x, 2.85, rw, 3.75, HEX.card, "run-card");
    txt(s, sub, { x: x + 0.25, y: 3.05, w: rw - 0.5, h: 0.35, fontSize: 13, bold: true, color: HEX.muted });
    txt(s, body, { x: x + 0.25, y: 3.45, w: rw - 0.5, h: 1.9, fontSize: 14 });
    txt(s, next, { x: x + 0.25, y: 5.55, w: rw - 0.5, h: 0.85, fontSize: 13, bold: true, color: col });
  });
  s.addNotes("Run 1's quality numbers are invalid; we kept its write-up as a lesson. Between runs with an unchanged configuration, quality moved by at most 2 points.");

  // ---------------------------------------------------------------- 9. Divider
  pres.addSection({ title: "Results" });
  s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: "Results" });
  txt(s, "02", { x: M, y: 1.2, w: 3, h: 1.4, fontSize: 96, bold: true, color: HEX.bg, fontFace: "Bookman Old Style" });
  s.addText("Results", { placeholder: "title" });
  txt(s, "DeepSeek V4.1 Flash · 50 items per language × task · τ = 95%", { x: M, y: 4.3, w: 11, h: 0.6, fontSize: 18, color: HEX.card });

  // ---------------------------------------------------------------- 10. Savings by method
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "Savings by method");
  s.addText("Going through English saves the most", { placeholder: "title" });
  const order = ["M5", "M5_80", "M3", "M3_b5", "M2_40", "M3h", "M2_60", "M6", "M2_80", "M4", "M1"];
  const label = (m) => `${m}  (${D.agg[m].npass}/${D.agg[m].cells} pass)`;
  const colFor = (m) => { const a = D.agg[m]; const f = a.npass / a.cells; return f >= 0.8 ? HEX.sage : f >= 0.5 ? HEX.saffron : HEX.terra; };
  s.addChart(pres.charts.BAR, [{ name: "₹ saving", labels: order.map(label).reverse(), values: order.map((m) => D.agg[m].save).reverse() }],
    axes({ x: M, y: 1.6, w: 8.3, h: 5.1, barDir: "bar", chartColors: order.map(colFor).reverse(), showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0\"%\"",
      showLegend: false, showTitle: true, title: "₹ saving vs the original prompt (all cells of each method)", valAxisHidden: true, valGridLine: { style: "none" }, valAxisMaxVal: 80,
      catAxisLabelFontSize: 12, barGapWidthPct: 35, objectName: "chart-savings" }));
  const leg = [[HEX.sage, "passes τ in ≥ 80% of its cells"], [HEX.saffron, "passes in about half"], [HEX.terra, "fails in most cells"]];
  card(s, 9.2, 1.6, 3.53, 5.1, HEX.card);
  txt(s, "How to read it", { x: 9.45, y: 1.8, w: 3.1, h: 0.4, fontSize: 17, bold: true, color: HEX.saffron });
  leg.forEach(([c, t], i) => {
    s.addShape(pres.shapes.OVAL, { x: 9.45, y: 2.42 + i * 0.5, w: 0.26, h: 0.26, fill: { color: c }, line: { color: c, width: 0 }, objectName: "legend-dot" });
    txt(s, t, { x: 9.85, y: 2.36 + i * 0.5, w: 2.75, h: 0.4, fontSize: 13 });
  });
  txt(s, "The three English-route methods (M5_80, M3, M3_b5) save 58–62% and keep ≥ 95% quality in 5 of 6 cells.\n\nM5 saves 67% but loses facts in 4 cells. Romanisation (M4) saves almost nothing on DeepSeek.",
    { x: 9.45, y: 4.0, w: 3.1, h: 2.6, fontSize: 14 });
  s.addNotes("Pass counts are per language × task cell. M3h is QA only and M6 is summaries only, so they have 3 cells each.");

  // ---------------------------------------------------------------- 11. Heatmap
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "Every method in every cell");
  s.addText("The quality map: saving / quality kept", { placeholder: "title" });
  const hrows = ["M1", "M2_80", "M2_60", "M2_40", "M3", "M3_b5", "M3h", "M4", "M5", "M5_80", "M6"];
  const hdr = ["Method", "Hindi QA", "Hindi summary", "Kannada QA", "Kannada summary", "Tamil QA", "Tamil summary"];
  const cellOpts = (o) => ({ fontSize: 12, align: "center", valign: "middle", margin: 0.03, ...o });
  const rows = [hdr.map((h, i) => ({ text: h, options: cellOpts({ bold: true, color: HEX.text, fill: { color: HEX.card2 }, align: i ? "center" : "left" }) }))];
  hrows.forEach((m) => {
    const row = [{ text: m, options: cellOpts({ bold: true, color: HEX.saffron, fill: { color: HEX.card }, align: "left", fontSize: 13 }) }];
    CELLS.forEach((c) => {
      const v = D.cells[m] && D.cells[m][c];
      if (!v) { row.push({ text: "–", options: cellOpts({ color: HEX.muted, fill: { color: HEX.na } }) }); return; }
      const fill = v.pc ? HEX.passStrong : v.pm ? HEX.pass : HEX.fail;
      row.push({ text: `${pct(v.save)} · ${r2(v.ret)}`, options: cellOpts({ color: HEX.text, fill: { color: fill }, bold: v.pc }) });
    });
    rows.push(row);
  });
  s.addTable(rows, { x: M, y: 1.6, w: W - 2 * M, colW: [1.4, 1.78, 1.78, 1.78, 1.78, 1.78, 1.83], rowH: 0.39, border: { type: "solid", color: HEX.bg, pt: 2 }, objectName: "quality-map" });
  const leg2 = [[HEX.passStrong, "Strict pass: CI lower bound ≥ 95%"], [HEX.pass, "Pass on the mean (≥ 95%)"], [HEX.fail, "Below τ"]];
  leg2.forEach(([c, t], i) => {
    const x = M + i * 3.9;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: 6.45, w: 0.4, h: 0.3, rectRadius: 0.05, fill: { color: c }, line: { color: c, width: 0 }, objectName: "legend-swatch" });
    txt(s, t, { x: x + 0.55, y: 6.43, w: 3.2, h: 0.35, fontSize: 13 });
  });
  s.addNotes("Cell text: rupee saving vs the original prompt, then quality retained (1.00 = same as the original). Run 4, n = 50 per cell.");

  // ---------------------------------------------------------------- 12. Pareto scatter
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "Trade-off");
  s.addText("Savings against quality: the frontier", { placeholder: "title" });
  const sc = ["M1", "M2_80", "M6", "M2_60", "M3h", "M2_40", "M3_b5", "M3", "M5_80", "M5", "M4"];
  s.addChart(pres.charts.SCATTER, [
    { name: "X", values: sc.map((m) => D.agg[m].save) },
    { name: "Quality kept", values: sc.map((m) => +(100 * D.agg[m].mean_ret).toFixed(1)), labels: sc },
  ], axes({ x: M, y: 1.6, w: 8.6, h: 5.1, lineSize: 0, lineDataSymbol: "circle", lineDataSymbolSize: 12, chartColors: [HEX.saffron],
    showLabel: true, dataLabelFormatScatter: "custom", dataLabelPosition: "r", showLegend: false,
    showTitle: true, title: "Mean quality kept (%) vs ₹ saving (%), averaged over each method's cells",
    valAxisMinVal: 85, valAxisMaxVal: 101, valAxisMajorUnit: 5, catAxisMinVal: 0, catAxisMaxVal: 75,
    showValAxisTitle: true, valAxisTitle: "quality kept (%)", valAxisTitleColor: HEX.muted, valAxisTitleFontSize: 12,
    showCatAxisTitle: true, catAxisTitle: "₹ saving (%)", catAxisTitleColor: HEX.muted, catAxisTitleFontSize: 12,
    catGridLine: { style: "none" }, objectName: "chart-pareto" }));
  card(s, 9.5, 1.6, 3.23, 5.1, HEX.card);
  txt(s, "Read the top-right", { x: 9.75, y: 1.8, w: 2.8, h: 0.4, fontSize: 17, bold: true, color: HEX.saffron });
  txt(s, "The gridline at 95 is the pass bar (τ).", { x: 9.75, y: 2.25, w: 2.8, h: 0.6, fontSize: 13, color: HEX.muted });
  const above = ["M5_80", "M3", "M3_b5", "M3h", "M6", "M2_80", "M1"], below = ["M5", "M2_60", "M4", "M2_40"];
  const rowsTxt = (list, col) => list.map((m, i) => ({ text: `${m}   ${Math.round(D.agg[m].save)}% · ${(100 * D.agg[m].mean_ret).toFixed(1)}`, options: { color: col, breakLine: i < list.length - 1 } }));
  txt(s, "Above the bar (saving · quality)", { x: 9.75, y: 2.85, w: 2.8, h: 0.35, fontSize: 13, bold: true, color: HEX.sage });
  txt(s, rowsTxt(above, HEX.text), { x: 9.75, y: 3.2, w: 2.8, h: 1.9, fontSize: 12.5 });
  txt(s, "Below the bar", { x: 9.75, y: 5.15, w: 2.8, h: 0.35, fontSize: 13, bold: true, color: HEX.terra });
  txt(s, rowsTxt(below, HEX.text), { x: 9.75, y: 5.5, w: 2.8, h: 1.1, fontSize: 12.5 });
  s.addNotes("Averages hide per-cell differences; the rule table picks per cell. M5 sits just under the bar on average because Kannada and Tamil QA drop.");

  // ---------------------------------------------------------------- 13. Pruning curve
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "Pruning in the original script (M2)");
  s.addText("Pruning hurts Kannada and Tamil first", { placeholder: "title" });
  const ret = (m, c) => (m === "M0" ? 100 : +(100 * D.cells[m][c].ret).toFixed(1));
  const curve = (task) => ["hi", "kn", "ta"].map((l) => ({ name: LANG[l].name, labels: ["100%", "80%", "60%", "40%"], values: ["M0", "M2_80", "M2_60", "M2_40"].map((m) => ret(m, `${l}_${task}`)) }))
    .concat([{ name: "τ = 95%", labels: ["100%", "80%", "60%", "40%"], values: [95, 95, 95, 95] }]);
  const lineOpts = (x, title) => axes({ x, y: 1.6, w: 5.9, h: 4.35, chartColors: [HEX.saffron, HEX.rose, HEX.sage, HEX.text], lineSize: 3, lineDataSymbol: "circle", lineDataSymbolSize: 9,
    showLegend: true, legendPos: "b", showTitle: true, title, valAxisMinVal: 80, valAxisMaxVal: 105, valAxisMajorUnit: 5, valAxisLabelFormatCode: "0",
    showCatAxisTitle: true, catAxisTitle: "share of tokens kept", catAxisTitleColor: HEX.muted, catAxisTitleFontSize: 12, objectName: "chart-prune" });
  s.addChart(pres.charts.LINE, curve("qa"), lineOpts(M, "Question answering · quality kept (%)"));
  s.addChart(pres.charts.LINE, curve("summ"), lineOpts(M + 6.25, "Summarisation · quality kept (%)"));
  txt(s, "Kannada and Tamil are agglutinative: one long word carries several meanings, so deleting tokens removes meaning. Keeping 80% is safe in every cell, but saves only 11–17%.",
    { x: M, y: 6.1, w: W - 2 * M, h: 0.7, fontSize: 14 });

  // ---------------------------------------------------------------- 14. Best per cell
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "The rule table");
  s.addText("The best method differs by language and task", { placeholder: "title" });
  const best = { hi_qa: "M5", hi_summ: "M5_80", kn_qa: "M5_80", kn_summ: "M5_80", ta_qa: "M2_80", ta_summ: "M5" };
  const bw = 3.0, bh = 2.05;
  ["hi", "kn", "ta"].forEach((l, i) => {
    const x = M + i * (bw + 0.25);
    glyph(s, l, x, 1.62, 0.55, 20);
    txt(s, LANG[l].name, { x: x + 0.7, y: 1.66, w: 2.2, h: 0.45, fontSize: 18, bold: true, color: LANG[l].color, valign: "middle" });
    ["qa", "summ"].forEach((t, j) => {
      const y = 2.35 + j * (bh + 0.2), c = `${l}_${t}`, m = best[c], v = D.cells[m][c];
      card(s, x, y, bw, bh, HEX.card, `best-${c}`);
      txt(s, t === "qa" ? "Question answering" : "Summarisation", { x: x + 0.25, y: y + 0.18, w: bw - 0.5, h: 0.32, fontSize: 12, bold: true, color: HEX.muted });
      txt(s, pct(v.save), { x: x + 0.25, y: y + 0.5, w: 1.6, h: 0.8, fontSize: 36, bold: true, color: LANG[l].color, fontFace: "Bookman Old Style" });
      txt(s, m, { x: x + 1.75, y: y + 0.62, w: 1.05, h: 0.5, fontSize: 18, bold: true, align: "right" });
      txt(s, `₹ saved · quality ${pct(100 * v.ret)}`, { x: x + 0.25, y: y + 1.35, w: bw - 0.5, h: 0.5, fontSize: 13, color: HEX.muted });
    });
  });
  const tot = [["58%", "₹ saved overall on DeepSeek"], ["73%", "projected on GLM-5.3"], ["51%", "under the strict rule (CI ≥ 95%)"]];
  tot.forEach(([v, l], i) => {
    const y = 1.62 + i * 1.65;
    card(s, 10.4, y, 2.33, 1.45, i === 0 ? HEX.card2 : HEX.card, "total-card");
    txt(s, v, { x: 10.6, y: y + 0.12, w: 2.0, h: 0.75, fontSize: 34, bold: true, color: HEX.saffron, fontFace: "Bookman Old Style" });
    txt(s, l, { x: 10.6, y: y + 0.85, w: 2.0, h: 0.55, fontSize: 12 });
  });
  s.addNotes("Balanced profile: cheapest method whose mean quality is at least 95%. The safe profile swaps in M3_b5 for summaries and M2_80 for Kannada QA.");

  // ---------------------------------------------------------------- 15. Tamil QA deep dive
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "The hard case");
  s.addText("Tamil QA: where translation breaks", { placeholder: "title" });
  const tq = ["M2_80", "M3h", "M3", "M5_80", "M3_b5", "M5", "M4"];
  const tv = tq.map((m) => +(100 * D.cells[m].ta_qa.ret).toFixed(1));
  s.addChart(pres.charts.BAR, [{ name: "Quality kept", labels: tq.map((m) => `${m} · ${pct(D.cells[m].ta_qa.save)} saved`).reverse(), values: tv.slice().reverse() }],
    axes({ x: M, y: 1.6, w: 6.3, h: 5.1, barDir: "bar", chartColors: tq.map((m) => (D.cells[m].ta_qa.pm ? HEX.sage : D.cells[m].ta_qa.ret >= 0.94 ? HEX.saffron : HEX.terra)).reverse(),
      showValue: true, dataLabelPosition: "outEnd", dataLabelFormatCode: "0.0", showLegend: false, showTitle: true, title: "Tamil QA · quality kept (%) · bar at 95 = τ",
      valAxisMinVal: 60, valAxisMaxVal: 105, valAxisMajorUnit: 5, valAxisLabelFormatCode: "0", barGapWidthPct: 40, objectName: "chart-tamil" }));
  const fails = [
    ["புற்றுநோய்", "cancer", "→ “Psoriasis”", "Translator garbled the key word"],
    ["ஆர். கே. நாராயணன்", "R. K. Narayan", "→ “K. Narayanan”", "Name lost its initials"],
    ["(answer in the text)", "", "→ “Not mentioned”", "Fact dropped in translation"],
  ];
  fails.forEach(([src, gloss, got, why], i) => {
    const y = 1.6 + i * 1.3;
    card(s, 7.25, y, 5.48, 1.15, HEX.card, "fail-card");
    txt(s, [{ text: src, options: { fontFace: "Nirmala UI", bold: true, color: HEX.sage } }, { text: gloss ? `  (${gloss})` : "", options: { color: HEX.muted } }], { x: 7.5, y: y + 0.13, w: 5.0, h: 0.4, fontSize: 15 });
    txt(s, [{ text: got, options: { bold: true, color: HEX.terra } }, { text: `   ${why}`, options: { color: HEX.text } }], { x: 7.5, y: y + 0.58, w: 5.0, h: 0.4, fontSize: 14 });
  });
  card(s, 7.25, 5.55, 5.48, 1.15, HEX.card2, "fix-card");
  txt(s, "Fixes tried: beam-5 translation moved the errors around (0.90). The hybrid M3h fixed names but missed other answers (0.947 at 41% saving). The rule table keeps safe pruning (M2_80, 17%).",
    { x: 7.5, y: 5.65, w: 5.05, h: 1.0, fontSize: 13 });

  // ---------------------------------------------------------------- 16. What didn't work
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Results" });
  kicker(s, "Negative results, reported honestly");
  s.addText("What did not work", { placeholder: "title" });
  const rom = (tk) => [{ name: "Native script", labels: ["Hindi", "Kannada", "Tamil"], values: ["hi", "kn", "ta"].map((l) => D.gap[tk][l]) },
    { name: "Romanised (ITRANS)", labels: ["Hindi", "Kannada", "Tamil"], values: ["hi", "kn", "ta"].map((l) => D.itrans[tk][l]) }];
  const romOpts = (x, title) => axes({ x, y: 1.6, w: 4.1, h: 3.4, barDir: "col", barGrouping: "clustered", chartColors: [HEX.plum, HEX.saffron], showValue: true, dataLabelPosition: "outEnd",
    dataLabelFormatCode: "0.0×", dataLabelFontSize: 10, showLegend: true, legendPos: "b", legendFontSize: 11, showTitle: true, title, valAxisMinVal: 0, valAxisMaxVal: 10, valAxisHidden: true,
    valGridLine: { style: "none" }, barGapWidthPct: 50, objectName: "chart-romanise" });
  s.addChart(pres.charts.BAR, rom("glm5.3"), romOpts(M, "GLM-5.3 parity: romanising helps"));
  s.addChart(pres.charts.BAR, rom("deepseekv4.1-flash-1017"), romOpts(M + 4.3, "DeepSeek parity: barely, and Tamil gets worse"));
  const neg = [
    ["FaFont", "Romanisation (M4)", "Saves 2% on DeepSeek; Tamil costs 15% more and quality falls to 72%"],
    ["FaScissors", "Heavy pruning (M2_40)", "Fails every cell: 83–94% quality"],
    ["FaHashtag", "Pruning English (M5)", "Dropped numbers: “52.52%” became “32%”"],
    ["FaCommentSlash", "English QA answers (M6)", "Back-translating 2-word answers broke them; kept for summaries only"],
  ];
  for (let i = 0; i < neg.length; i++) {
    const y = 1.6 + i * 1.28;
    await iconChip(s, neg[i][0], 9.35, y + 0.05, 0.55, HEX.terra, HEX.bg);
    txt(s, neg[i][1], { x: 10.05, y, w: 2.7, h: 0.38, fontSize: 15, bold: true, color: HEX.terra });
    txt(s, neg[i][2], { x: 10.05, y: y + 0.38, w: 2.7, h: 0.85, fontSize: 12.5 });
  }
  txt(s, "Romanising only helps tokenizers that are bad at Indic scripts (GLM). On Indic-aware tokenizers it adds tokens. Tamil script is ambiguous in Latin letters (க = ka / ga / ha), so the model misreads it.",
    { x: M, y: 5.3, w: 8.4, h: 1.2, fontSize: 14 });

  // ---------------------------------------------------------------- 17. Divider
  pres.addSection({ title: "Product" });
  s = pres.addSlide({ masterName: "DIVIDER", sectionTitle: "Product" });
  txt(s, "03", { x: M, y: 1.2, w: 3, h: 1.4, fontSize: 96, bold: true, color: HEX.bg, fontFace: "Bookman Old Style" });
  s.addText("From experiment to product", { placeholder: "title" });
  txt(s, "A rule-based router and a small web app anyone can try", { x: M, y: 4.3, w: 11, h: 0.6, fontSize: 18, color: HEX.card });

  // ---------------------------------------------------------------- 18. Router
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
  kicker(s, "Routing");
  s.addText("Rules, not a model, pick the method", { placeholder: "title" });
  card(s, M, 1.6, 5.6, 5.1, HEX.card);
  txt(s, "1 · Look up the table", { x: M + 0.3, y: 1.8, w: 5, h: 0.4, fontSize: 17, bold: true, color: HEX.saffron });
  txt(s, "Key: target model × language × task × profile. Every DeepSeek row was measured in Run 4. GLM rows reuse it (marked projected). Sarvam-105B and Gemma 4 only get clean-up.",
    { x: M + 0.3, y: 2.25, w: 5.0, h: 1.3, fontSize: 14 });
  txt(s, "Why rules beat a learned router here", { x: M + 0.3, y: 3.75, w: 5, h: 0.4, fontSize: 17, bold: true, color: HEX.saffron });
  txt(s, [
    { text: "The per-cell table already gets 58% at τ", options: { bullet: true, breakLine: true } },
    { text: "A per-item router could add ~10 points, only for QA", options: { bullet: true, breakLine: true } },
    { text: "Laya's checkpoints are English-only and uncalibrated; rules are free, instant and explainable", options: { bullet: true } },
  ], { x: M + 0.3, y: 4.2, w: 5.0, h: 2.3, fontSize: 14, paraSpaceAfter: 6 });
  txt(s, "2 · Apply the guards", { x: 6.55, y: 1.6, w: 6, h: 0.4, fontSize: 17, bold: true, color: HEX.saffron });
  const guards = [
    ["FaCode", "Code or mostly Latin text", "clean only, never translate"],
    ["FaTextSlash", "Under 120 tokens", "clean only: saving not worth the latency"],
    ["FaHashtag", "Many digits", "drop the pruning step (M5 → M3)"],
    ["FaPercent", "Saves < 10% on this prompt", "fall back to clean-up"],
    ["FaCircleQuestion", "Answer says “not mentioned”", "re-send the original prompt"],
    ["FaHandPointer", "User picks a method", "override wins"],
  ];
  for (let i = 0; i < guards.length; i++) {
    const y = 2.15 + i * 0.77;
    await iconChip(s, guards[i][0], 6.55, y, 0.55, HEX.plum, HEX.bg);
    txt(s, [{ text: guards[i][1], options: { bold: true, color: HEX.text } }, { text: `  →  ${guards[i][2]}`, options: { color: HEX.muted } }], { x: 7.3, y: y + 0.08, w: 5.45, h: 0.45, fontSize: 14, valign: "middle" });
  }

  // ---------------------------------------------------------------- 19. The app
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Product" });
  kicker(s, "icomp · FastAPI + one-page frontend");
  s.addText("The app: try any prompt, see the saving", { placeholder: "title" });
  const arch = [["FaDisplay", "Web page", "type or load an IndicQA example"], ["FaServer", "FastAPI", "/api/preview (free) · /api/run"], ["FaMicrochip", "Local GPU models", "IndicTrans2 · LLMLingua-2 · LaBSE, VRAM-budgeted"], ["FaCloud", "Sarvam API", "DeepSeek · GLM · Sarvam · Gemma + judge"]];
  for (let i = 0; i < arch.length; i++) {
    const y = 1.65 + i * 1.28;
    card(s, M, y, 4.6, 1.05, HEX.card, "arch-card");
    await iconChip(s, arch[i][0], M + 0.22, y + 0.22, 0.6, i === 3 ? HEX.saffron : HEX.plum);
    txt(s, arch[i][1], { x: M + 1.05, y: y + 0.15, w: 3.4, h: 0.38, fontSize: 16, bold: true });
    txt(s, arch[i][2], { x: M + 1.05, y: y + 0.53, w: 3.4, h: 0.4, fontSize: 12.5, color: HEX.muted });
  }
  // wireframe of the page
  const fx = 5.6, fy = 1.65, fw = 7.13, fh = 5.0;
  card(s, fx, fy, fw, fh, HEX.card, "ui-frame");
  card(s, fx + 0.25, fy + 0.25, 2.6, fh - 0.5, HEX.card2, "ui-form");
  ["Task · Model · Language", "Profile · Method", "Context", "", "Question"].forEach((t, i) => {
    if (!t) return;
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 0.4, y: fy + 0.45 + i * 0.72, w: 2.3, h: i === 2 ? 1.2 : 0.45, rectRadius: 0.06, fill: { color: HEX.bg }, line: { color: HEX.bg, width: 0 }, objectName: "ui-field" });
    txt(s, t, { x: fx + 0.5, y: fy + 0.5 + i * 0.72, w: 2.1, h: 0.35, fontSize: 11, color: HEX.muted });
  });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 0.4, y: fy + 4.0, w: 1.05, h: 0.45, rectRadius: 0.06, fill: { color: HEX.bg }, line: { color: HEX.muted, width: 1 }, objectName: "ui-btn" });
  txt(s, "Preview", { x: fx + 0.4, y: fy + 4.0, w: 1.05, h: 0.45, fontSize: 11, align: "center", valign: "middle" });
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: fx + 1.6, y: fy + 4.0, w: 1.1, h: 0.45, rectRadius: 0.06, fill: { color: HEX.saffron }, line: { color: HEX.saffron, width: 0 }, objectName: "ui-btn" });
  txt(s, "Send", { x: fx + 1.6, y: fy + 4.0, w: 1.1, h: 0.45, fontSize: 11, bold: true, color: HEX.bg, align: "center", valign: "middle" });
  const rx = fx + 3.1, rwid = fw - 3.35;
  card(s, rx, fy + 0.25, rwid, 1.15, HEX.card2, "ui-decision");
  txt(s, [{ text: "M5_80", options: { bold: true, color: HEX.saffron, fontSize: 18 } }, { text: "   measured", options: { color: HEX.sage, fontSize: 11 } }], { x: rx + 0.2, y: fy + 0.35, w: rwid - 0.4, h: 0.4 });
  txt(s, "Rule table: Kannada QA on DeepSeek → M5_80 · 69% ₹ saving, quality 96.8%", { x: rx + 0.2, y: fy + 0.8, w: rwid - 0.4, h: 0.5, fontSize: 11, color: HEX.muted });
  const mtr = [["327→111", "input tokens"], ["−66%", "₹ cost"], ["96.8%", "expected quality"]];
  mtr.forEach(([v, l], i) => {
    const mx = rx + i * (rwid / 3);
    card(s, mx, fy + 1.6, rwid / 3 - 0.12, 1.0, HEX.card2, "ui-metric");
    txt(s, v, { x: mx + 0.12, y: fy + 1.7, w: rwid / 3 - 0.2, h: 0.45, fontSize: 13, bold: true, color: HEX.text });
    txt(s, l, { x: mx + 0.12, y: fy + 2.15, w: rwid / 3 - 0.3, h: 0.35, fontSize: 10.5, color: HEX.muted });
  });
  card(s, rx, fy + 2.8, rwid, 1.95, HEX.card2, "ui-answer");
  txt(s, "Answer (translated back) · Compare with original · Judge both", { x: rx + 0.2, y: fy + 2.95, w: rwid - 0.4, h: 0.35, fontSize: 11, color: HEX.muted });
  txt(s, "ಗ್ರಾನೈಟ್ ಶಿಲೆಯಿಂದ", { x: rx + 0.2, y: fy + 3.4, w: rwid - 0.4, h: 0.5, fontSize: 18, bold: true, fontFace: "Nirmala UI" });
  txt(s, "Session total: ₹ spent · ₹ saved · tokens saved", { x: rx + 0.2, y: fy + 4.1, w: rwid - 0.4, h: 0.4, fontSize: 11, color: HEX.sage });
  s.addNotes("Run: uv run uvicorn icomp.server:app. Preview is free and shows exactly what would be sent. Compare mode sends the original too and can have sarvam-105b judge both. The answer and metrics in this sketch are illustrative.");

  // ---------------------------------------------------------------- 20. Caveats
  pres.addSection({ title: "Wrap-up" });
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Wrap-up" });
  kicker(s, "Limits we know about");
  s.addText("What these numbers do and don't prove", { placeholder: "title" });
  const cav = [
    ["FaDice", "Temperature 0 is not deterministic", "46% of identical DeepSeek prompts got differently worded answers. Differences under ~3 points are noise"],
    ["FaUserCheck", "The judge is an LLM", "Checked against gold-answer F1 and a resend test. The human Hindi spot-check is still pending; no Kannada or Tamil labellers"],
    ["FaBookOpen", "Wikipedia-style text only", "IndicQA passages; real user prompts (chat, code-mixed) were not part of the experiment"],
    ["FaChartColumn", "n = 50 per cell", "CIs are ±5–9 points; per-item summary scores are too noisy to train on"],
    ["FaHourglassHalf", "Local latency", "Translation adds 1–4 s per request on a 4 GB laptop GPU"],
    ["FaCircleNodes", "GLM is projected", "Its saving uses the GLM tokenizer offline; answer quality on GLM is not measured"],
  ];
  for (let i = 0; i < cav.length; i++) {
    const x = M + (i % 2) * 6.17, y = 1.65 + Math.floor(i / 2) * 1.68;
    card(s, x, y, 5.95, 1.5, HEX.card, "caveat");
    await iconChip(s, cav[i][0], x + 0.25, y + 0.25, 0.6, HEX.rose, HEX.bg);
    txt(s, cav[i][1], { x: x + 1.1, y: y + 0.18, w: 4.65, h: 0.4, fontSize: 16, bold: true });
    txt(s, cav[i][2], { x: x + 1.1, y: y + 0.6, w: 4.65, h: 0.85, fontSize: 13, color: HEX.muted });
  }

  // ---------------------------------------------------------------- 21. Next steps
  s = pres.addSlide({ masterName: "CONTENT", sectionTitle: "Wrap-up" });
  kicker(s, "Next");
  s.addText("Where this goes next", { placeholder: "title" });
  const nxt = [
    ["01", "Validate the judge", "Human Hindi spot-check, deliberately broken answers, and a second judge (Gemma 4)"],
    ["02", "Measure on more models", "Run the frozen method menu on GLM and Indic-efficient models to replace projections"],
    ["03", "Fix Tamil QA", "Better sentence selection for the hybrid (top-3, aligned via English) to pass τ at ~40% saving"],
    ["04", "Real prompts", "Chat and code-mixed prompts; a per-item router for QA if it clearly beats the rules"],
  ];
  nxt.forEach(([n, t, b], i) => {
    const y = 1.65 + i * 1.25;
    txt(s, n, { x: M, y, w: 1.2, h: 1.0, fontSize: 40, bold: true, color: [HEX.saffron, HEX.rose, HEX.sage, HEX.plum][i], fontFace: "Bookman Old Style" });
    card(s, M + 1.35, y, W - 2 * M - 1.35, 1.05, HEX.card, "next-card");
    txt(s, t, { x: M + 1.65, y: y + 0.13, w: 4.0, h: 0.8, fontSize: 18, bold: true, valign: "middle" });
    txt(s, b, { x: M + 5.6, y: y + 0.13, w: 6.3, h: 0.8, fontSize: 14, color: HEX.muted, valign: "middle" });
  });

  // ---------------------------------------------------------------- 22. Closing
  s = pres.addSlide({ masterName: "DARK_TITLE", sectionTitle: "Wrap-up" });
  kicker(s, "In one slide");
  txt(s, "The cheapest prompt is the one that still gets the right answer.", { x: M, y: 1.0, w: 8.6, h: 1.9, fontSize: 36, bold: true, fontFace: "Bookman Old Style" });
  const fin = [["8.9×", "the Kannada token tax on GLM-5.3", HEX.rose], ["58%", "₹ saved on DeepSeek at ≥ 95% quality", HEX.saffron], ["73%", "projected saving on GLM-5.3", HEX.sage]];
  fin.forEach(([v, l, c], i) => {
    const x = M + i * 2.95;
    card(s, x, 3.45, 2.75, 2.1, HEX.card, "final-stat");
    txt(s, v, { x: x + 0.25, y: 3.65, w: 2.3, h: 0.95, fontSize: 44, bold: true, color: c, fontFace: "Bookman Old Style" });
    txt(s, l, { x: x + 0.25, y: 4.65, w: 2.3, h: 0.75, fontSize: 14 });
  });
  txt(s, "Thank you", { x: M, y: 6.1, w: 6, h: 0.6, fontSize: 24, bold: true, color: HEX.saffron, fontFace: "Bookman Old Style" });
  glyph(s, "hi", 10.0, 1.2, 1.5, 54); glyph(s, "kn", 11.1, 2.9, 1.35, 48); glyph(s, "ta", 9.75, 3.85, 1.2, 42);

  await pres.writeFile({ fileName: OUT });
  await applyTheme(OUT, THEME);
  // per-point scatter labels are written without a colour (PowerPoint would draw them black on the dark slide): give them parchment
  const JSZip = require("jszip");
  const zip = await JSZip.loadAsync(fs.readFileSync(OUT));
  for (const f of Object.keys(zip.files).filter((f) => /ppt\/charts\/chart\d+\.xml$/.test(f))) {
    let x = await zip.file(f).async("string");
    if (!x.includes("scatterChart")) continue;
    // M3_b5 (idx 6) above its point, M3 (idx 7) to the left: they sit almost on top of each other
    x = x.replace(/(<c:idx val="6"\/>[\s\S]*?<c:dLblPos val=")r("\/>)/, "$1t$2").replace(/(<c:idx val="7"\/>[\s\S]*?<c:dLblPos val=")r("\/>)/, "$1b$2");
    x = x.split('<a:rPr lang="en-US" dirty="0"/>').join(`<a:rPr lang="en-US" sz="1100" b="1" dirty="0"><a:solidFill><a:srgbClr val="${HEX.text}"/></a:solidFill></a:rPr>`);
    zip.file(f, x);
  }
  Object.keys(zip.files).filter((f) => zip.files[f].dir).forEach((f) => { delete zip.files[f]; });
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log("wrote", OUT);
}

build().catch((e) => { console.error(e); process.exit(1); });

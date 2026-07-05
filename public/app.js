const PET_KEYWORDS = [
  "cat",
  "dog",
  "puppy",
  "kitten",
  "tabby",
  "terrier",
  "retriever",
  "poodle",
  "husky",
  "spaniel",
  "chihuahua",
  "pug",
  "persian",
  "siamese",
  "rabbit",
  "hamster",
  "guinea pig",
  "parrot",
  "bird",
  "turtle",
  "goldfish",
];

const TYPE_META = {
  ISTJ: ["秩序守护者", "规矩感写在眼神里，靠谱得像家里的小队长。"],
  ISFJ: ["温柔管家", "圆润眉眼自带照顾感，安静陪伴就是它的超能力。"],
  INFJ: ["洞察治愈师", "眼神深、轮廓稳，像能读懂你今天的心情。"],
  INTJ: ["冷静策士", "五官集中且有锋芒，主打一个计划清楚、表情淡定。"],
  ISTP: ["独行玩家", "线条利落、反应敏捷，喜欢自己判断下一步。"],
  ISFP: ["软萌艺术家", "脸部柔和、色彩温暖，随手一趴都像写真。"],
  INFP: ["云朵梦想家", "大眼和柔软轮廓组合，敏感、浪漫、很会撒娇。"],
  INTP: ["好奇研究员", "观察感强，像随时在分析玩具为什么会动。"],
  ESTP: ["行动派玩伴", "眼神亮、轮廓有冲劲，下一秒就要开跑。"],
  ESFP: ["快乐显眼包", "表情外放、色彩明亮，是家里的气氛担当。"],
  ENFP: ["小太阳探险家", "眼睛有光、毛发灵动，热情和脑洞一起上线。"],
  ENTP: ["机灵辩手", "五官活跃、边界跳脱，聪明得有点不按套路。"],
  ESTJ: ["饭点总指挥", "中心感强、神态坚定，家里流程都要听它安排。"],
  ESFJ: ["社交甜心", "面部圆润又亲近，很懂用表情拿捏全场。"],
  ENFJ: ["暖场队长", "眼神稳定又有号召力，天然适合带大家开心。"],
  ENTJ: ["霸气领航员", "轮廓集中、对称度高，坐着也像在开会。"],
};

const TRAIT_LABELS = {
  E: ["外向 E", "明亮眼神和开放表情偏高"],
  I: ["内向 I", "神态收敛，观察感更强"],
  S: ["实感 S", "五官稳定，贴近当下反馈"],
  N: ["直觉 N", "额面与纹理变化带来想象感"],
  T: ["理性 T", "轮廓边界更清晰，判断感强"],
  F: ["情感 F", "圆润和暖色让亲和力上升"],
  J: ["计划 J", "脸部对称与中心感更稳定"],
  P: ["探索 P", "动态纹理多，随性气质更足"],
};

const POSTER_THEME = {
  bgTop: "#f8f7f2",
  bgMid: "#dfeee7",
  bgBottom: "#f7dca8",
  ink: "#20262e",
  muted: "#66717f",
  panel: "#ffffff",
  accent: "#ec7357",
  accent2: "#79bda8",
};

const PUBLIC_SITE_URL = "https://jw-zhang.github.io/pet-mbti-app/";

const els = {
  fileInput: document.querySelector("#fileInput"),
  dropzone: document.querySelector("#dropzone"),
  previewWrap: document.querySelector("#previewWrap"),
  previewImage: document.querySelector("#previewImage"),
  analyzeBtn: document.querySelector("#analyzeBtn"),
  demoBtn: document.querySelector("#demoBtn"),
  resetBtn: document.querySelector("#resetBtn"),
  modelStatus: document.querySelector("#modelStatus"),
  emptyState: document.querySelector("#emptyState"),
  rejectedState: document.querySelector("#rejectedState"),
  rejectReason: document.querySelector("#rejectReason"),
  analysisState: document.querySelector("#analysisState"),
  posterCanvas: document.querySelector("#posterCanvas"),
  mbtiType: document.querySelector("#mbtiType"),
  mbtiName: document.querySelector("#mbtiName"),
  petMeter: document.querySelector("#petMeter"),
  petScore: document.querySelector("#petScore"),
  traitGrid: document.querySelector("#traitGrid"),
  mbtiCopy: document.querySelector("#mbtiCopy"),
  downloadBtn: document.querySelector("#downloadBtn"),
};

let selectedFile = null;
let model = null;
let modelReady = false;
let lastImage = null;
let lastAnalysis = null;

window.addEventListener("load", () => {
  loadModel();
});

els.fileInput.addEventListener("change", (event) => {
  const [file] = event.target.files;
  if (file) setSelectedFile(file);
});

els.dropzone.addEventListener("dragover", (event) => {
  event.preventDefault();
  els.dropzone.classList.add("dragging");
});

els.dropzone.addEventListener("dragleave", () => {
  els.dropzone.classList.remove("dragging");
});

els.dropzone.addEventListener("drop", (event) => {
  event.preventDefault();
  els.dropzone.classList.remove("dragging");
  const [file] = event.dataTransfer.files;
  if (file && file.type.startsWith("image/")) setSelectedFile(file);
});

els.analyzeBtn.addEventListener("click", async () => {
  if (!selectedFile) return;
  els.analyzeBtn.disabled = true;
  els.analyzeBtn.textContent = "识别中";
  try {
    const image = await loadImage(selectedFile);
    const analysis = await analyzePetImage(image);
    if (!analysis.isPet) {
      showRejected(analysis);
      return;
    }
    await renderResult(image, analysis);
  } finally {
    els.analyzeBtn.disabled = false;
    els.analyzeBtn.textContent = "开始识别";
  }
});

els.demoBtn.addEventListener("click", async () => {
  const file = await makeDemoPetFile();
  setSelectedFile(file);
});

els.resetBtn.addEventListener("click", () => {
  selectedFile = null;
  lastImage = null;
  lastAnalysis = null;
  els.fileInput.value = "";
  els.previewWrap.hidden = true;
  els.previewImage.removeAttribute("src");
  els.analyzeBtn.disabled = true;
  els.resetBtn.disabled = true;
  showEmpty();
});

els.downloadBtn.addEventListener("click", () => {
  const link = document.createElement("a");
  link.download = `petsona-${els.mbtiType.textContent}.png`;
  link.href = els.posterCanvas.toDataURL("image/png");
  link.click();
});

async function loadModel() {
  const deadline = Date.now() + 7000;
  while ((!window.mobilenet || !window.tf) && Date.now() < deadline) {
    await wait(160);
  }
  if (!window.mobilenet) {
    setModelStatus("本地启发式", "fallback");
    return;
  }
  try {
    model = await window.mobilenet.load({ version: 2, alpha: 1.0 });
    modelReady = true;
    setModelStatus("MobileNet 已就绪", "ready");
  } catch (error) {
    console.warn(error);
    setModelStatus("本地启发式", "fallback");
  }
}

function setModelStatus(text, state) {
  els.modelStatus.textContent = text;
  els.modelStatus.className = `model-pill ${state}`;
}

function setSelectedFile(file) {
  selectedFile = file;
  if (els.previewImage.src.startsWith("blob:")) URL.revokeObjectURL(els.previewImage.src);
  els.previewImage.src = URL.createObjectURL(file);
  els.previewWrap.hidden = false;
  els.analyzeBtn.disabled = false;
  els.resetBtn.disabled = false;
  showEmpty();
}

function showEmpty() {
  els.emptyState.hidden = false;
  els.rejectedState.hidden = true;
  els.analysisState.hidden = true;
  lastImage = null;
  lastAnalysis = null;
}

function showRejected(analysis) {
  els.emptyState.hidden = true;
  els.rejectedState.hidden = false;
  els.analysisState.hidden = true;
  const percent = Math.round(analysis.petScore * 100);
  els.rejectReason.textContent = `宠物置信度 ${percent}%。建议使用正脸、光线充足、主体更靠中的宠物照片。`;
}

async function analyzePetImage(image) {
  const metrics = extractMetrics(image);
  const prediction = await classifyWithModel(image);
  const modelPetScore = prediction.petScore;
  const heuristicPetScore = clamp(
    0.12 +
      metrics.symmetry * 0.22 +
      metrics.eyeScore * 0.24 +
      metrics.texture * 0.18 +
      metrics.centerFocus * 0.16 +
      metrics.roundness * 0.12
  );
  const petScore = modelReady ? Math.max(modelPetScore, heuristicPetScore * 0.82) : heuristicPetScore;
  const isPet = petScore >= (modelReady ? 0.42 : 0.38);
  const mbti = mapMbti(metrics, prediction.petClass);

  return {
    ...metrics,
    ...mbti,
    isPet,
    petScore,
    petClass: prediction.petClass || "pet",
    source: modelReady ? "mobilenet" : "heuristic",
  };
}

async function classifyWithModel(image) {
  if (!modelReady || !model) return { petScore: 0, petClass: "" };
  const predictions = await model.classify(image, 5);
  let bestPet = { probability: 0, className: "" };
  for (const item of predictions) {
    const name = item.className.toLowerCase();
    if (PET_KEYWORDS.some((keyword) => name.includes(keyword)) && item.probability > bestPet.probability) {
      bestPet = item;
    }
  }
  return {
    petScore: bestPet.probability || 0,
    petClass: bestPet.className ? bestPet.className.split(",")[0] : "",
  };
}

function extractMetrics(image) {
  const size = 360;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, size, size);
  ctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, size, size);
  const { data } = ctx.getImageData(0, 0, size, size);

  let brightness = 0;
  let saturation = 0;
  let warmth = 0;
  let centerSat = 0;
  let outerSat = 0;
  let centerCount = 0;
  let outerCount = 0;
  let darkTopLeft = 0;
  let darkTopRight = 0;
  let edge = 0;
  let edgeCount = 0;
  const values = [];

  for (let y = 2; y < size - 2; y += 3) {
    for (let x = 2; x < size - 2; x += 3) {
      const index = (y * size + x) * 4;
      const r = data[index];
      const g = data[index + 1];
      const b = data[index + 2];
      const hsl = rgbToHsl(r, g, b);
      const luma = (r * 0.299 + g * 0.587 + b * 0.114) / 255;
      const nx = (x - size / 2) / (size / 2);
      const ny = (y - size / 2) / (size / 2);
      const dist = Math.sqrt(nx * nx + ny * ny);

      values.push(luma);
      brightness += luma;
      saturation += hsl.s;
      warmth += (r - b + 255) / 510;
      if (dist < 0.62) {
        centerSat += hsl.s;
        centerCount++;
      } else if (dist < 0.95) {
        outerSat += hsl.s;
        outerCount++;
      }
      if (y > size * 0.22 && y < size * 0.52 && x > size * 0.18 && x < size * 0.82 && luma < 0.32) {
        if (x < size / 2) darkTopLeft++;
        else darkTopRight++;
      }

      const right = ((y * size + x + 1) * 4);
      const down = (((y + 1) * size + x) * 4);
      const lumaRight = (data[right] * 0.299 + data[right + 1] * 0.587 + data[right + 2] * 0.114) / 255;
      const lumaDown = (data[down] * 0.299 + data[down + 1] * 0.587 + data[down + 2] * 0.114) / 255;
      edge += Math.abs(luma - lumaRight) + Math.abs(luma - lumaDown);
      edgeCount++;
    }
  }

  const total = values.length || 1;
  brightness /= total;
  saturation /= total;
  warmth /= total;
  const avg = brightness;
  const contrast = Math.sqrt(values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / total);
  const centerFocus = clamp(centerSat / Math.max(1, centerCount) - outerSat / Math.max(1, outerCount) + 0.5);
  const texture = clamp(edge / Math.max(1, edgeCount) * 4.2);
  const eyeBalance = 1 - Math.abs(darkTopLeft - darkTopRight) / Math.max(1, darkTopLeft + darkTopRight);
  const eyeDensity = clamp((darkTopLeft + darkTopRight) / 850);
  const eyeScore = clamp(eyeDensity * 0.65 + eyeBalance * 0.35);
  const symmetry = measureSymmetry(data, size);
  const roundness = measureRoundness(data, size);

  return {
    brightness: clamp(brightness),
    saturation: clamp(saturation),
    warmth: clamp(warmth),
    contrast: clamp(contrast * 2.4),
    centerFocus,
    texture,
    eyeScore,
    symmetry,
    roundness,
  };
}

function measureSymmetry(data, size) {
  let diff = 0;
  let count = 0;
  for (let y = Math.floor(size * 0.16); y < Math.floor(size * 0.84); y += 4) {
    for (let x = Math.floor(size * 0.16); x < size / 2; x += 4) {
      const left = (y * size + x) * 4;
      const right = (y * size + (size - x - 1)) * 4;
      const l = (data[left] * 0.299 + data[left + 1] * 0.587 + data[left + 2] * 0.114) / 255;
      const r = (data[right] * 0.299 + data[right + 1] * 0.587 + data[right + 2] * 0.114) / 255;
      diff += Math.abs(l - r);
      count++;
    }
  }
  return clamp(1 - diff / Math.max(1, count) * 1.8);
}

function measureRoundness(data, size) {
  let inner = 0;
  let outer = 0;
  for (let y = 0; y < size; y += 5) {
    for (let x = 0; x < size; x += 5) {
      const index = (y * size + x) * 4;
      const luma = (data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114) / 255;
      const nx = (x - size / 2) / (size / 2);
      const ny = (y - size / 2) / (size / 2);
      const dist = Math.sqrt(nx * nx + ny * ny);
      if (dist < 0.56 && luma > 0.18 && luma < 0.92) inner++;
      if (dist > 0.72 && dist < 0.96 && luma > 0.18 && luma < 0.92) outer++;
    }
  }
  return clamp(inner / Math.max(1, inner + outer) * 1.42);
}

function mapMbti(metrics, petClass) {
  const petName = petClass.toLowerCase();
  const dogBoost = petName.includes("dog") || petName.includes("retriever") || petName.includes("pug");
  const catBoost = petName.includes("cat") || petName.includes("tabby") || petName.includes("persian");

  const eScore = clamp(metrics.eyeScore * 0.3 + metrics.brightness * 0.26 + metrics.saturation * 0.22 + (dogBoost ? 0.18 : 0.06));
  const nScore = clamp(metrics.texture * 0.34 + metrics.centerFocus * 0.26 + metrics.contrast * 0.18 + (catBoost ? 0.08 : 0.04));
  const fScore = clamp(metrics.roundness * 0.32 + metrics.warmth * 0.28 + (1 - metrics.contrast) * 0.18 + metrics.eyeScore * 0.16);
  const jScore = clamp(metrics.symmetry * 0.36 + metrics.centerFocus * 0.28 + (1 - metrics.texture) * 0.16 + (dogBoost ? 0.06 : 0.03));

  const axes = [
    eScore >= 0.5 ? "E" : "I",
    nScore >= 0.5 ? "N" : "S",
    fScore >= 0.5 ? "F" : "T",
    jScore >= 0.5 ? "J" : "P",
  ];
  const type = axes.join("");
  const [name, copy] = TYPE_META[type];

  return {
    type,
    name,
    copy,
    traitScores: { E: eScore, N: nScore, F: fScore, J: jScore },
    traits: [
      axes[0],
      axes[1],
      axes[2],
      axes[3],
    ],
  };
}

async function renderResult(image, analysis) {
  lastImage = image;
  lastAnalysis = analysis;
  els.emptyState.hidden = true;
  els.rejectedState.hidden = true;
  els.analysisState.hidden = false;
  els.mbtiType.textContent = analysis.type;
  els.mbtiName.textContent = analysis.name;
  els.petMeter.value = analysis.petScore;
  els.petScore.textContent = `${Math.round(analysis.petScore * 100)}%`;
  els.traitGrid.innerHTML = analysis.traits
    .map((trait) => {
      const [title, desc] = TRAIT_LABELS[trait];
      return `<div class="trait"><span>${trait}</span><b>${title}</b><small>${desc}</small></div>`;
    })
    .join("");
  els.mbtiCopy.textContent = analysis.copy;
  await drawPoster(image, analysis);
}

async function drawPoster(image, analysis) {
  const canvas = els.posterCanvas;
  const ctx = canvas.getContext("2d");
  const w = canvas.width;
  const h = canvas.height;
  const accent = paletteFromAnalysis(analysis);

  const gradient = ctx.createLinearGradient(0, 0, w, h);
  gradient.addColorStop(0, POSTER_THEME.bgTop);
  gradient.addColorStop(0.55, accent.soft);
  gradient.addColorStop(1, POSTER_THEME.bgBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, w, h);

  drawPattern(ctx, w, h, accent);
  drawPosterPanel(ctx, w, h, accent);
  drawStylizedPet(ctx, w, image);
  await drawPosterText(ctx, w, h, accent, analysis);
}

function drawPosterPanel(ctx, w, h, accent) {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = POSTER_THEME.panel;
  roundRect(ctx, 76, 782, w - 152, 472, 34);
  ctx.fill();
  ctx.globalAlpha = 1;
  ctx.strokeStyle = accent.strong;
  ctx.lineWidth = 6;
  ctx.stroke();
  ctx.restore();
}

function drawStylizedPet(ctx, w, image) {
  const avatar = makePetAvatar(image);
  ctx.save();
  const x = 138;
  const y = 98;
  const size = 804;
  ctx.shadowColor = "rgba(32, 38, 46, 0.2)";
  ctx.shadowBlur = 26;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = POSTER_THEME.ink;
  ctx.lineWidth = 12;
  roundRect(ctx, x, y, size, size, 36);
  ctx.fill();
  ctx.stroke();
  ctx.clip();
  ctx.drawImage(avatar, x, y, size, size);
  ctx.restore();
}

function makePetAvatar(image) {
  const avatar = document.createElement("canvas");
  avatar.width = 720;
  avatar.height = 720;
  const actx = avatar.getContext("2d");
  const cartoon = cartoonizeSourceImage(image);
  actx.drawImage(cartoon, 0, 0, 720, 720);

  return avatar;
}

function cartoonizeSourceImage(image) {
  const smallSize = 300;
  const outSize = 720;
  const small = document.createElement("canvas");
  small.width = smallSize;
  small.height = smallSize;
  const sctx = small.getContext("2d", { willReadFrequently: true });
  const crop = coverCrop(image.naturalWidth, image.naturalHeight, smallSize, smallSize);
  sctx.imageSmoothingEnabled = true;
  sctx.filter = "saturate(1.32) contrast(1.08) brightness(1.08)";
  sctx.drawImage(image, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, smallSize, smallSize);
  sctx.filter = "none";

  const source = sctx.getImageData(0, 0, smallSize, smallSize);
  const data = source.data;
  const painted = new Uint8ClampedArray(data.length);
  const lumas = new Float32Array(smallSize * smallSize);
  const darkSpots = [];

  for (let y = 0; y < smallSize; y++) {
    for (let x = 0; x < smallSize; x++) {
      const i = (y * smallSize + x) * 4;
      const avg = averageNeighborhood(data, smallSize, x, y, 2);
      const soft = posterizeAnimeColor(avg);
      painted[i] = soft[0];
      painted[i + 1] = soft[1];
      painted[i + 2] = soft[2];
      painted[i + 3] = 255;
      const luma = (soft[0] * 0.299 + soft[1] * 0.587 + soft[2] * 0.114) / 255;
      lumas[y * smallSize + x] = luma;
      if (y > smallSize * 0.26 && y < smallSize * 0.58 && x > smallSize * 0.16 && x < smallSize * 0.84 && luma < 0.24) {
        darkSpots.push({ x, y, luma });
      }
    }
  }

  const output = sctx.createImageData(smallSize, smallSize);
  output.data.set(painted);
  for (let y = 2; y < smallSize - 2; y++) {
    for (let x = 2; x < smallSize - 2; x++) {
      const i = (y * smallSize + x) * 4;
      const gx = lumas[y * smallSize + x + 1] - lumas[y * smallSize + x - 1];
      const gy = lumas[(y + 1) * smallSize + x] - lumas[(y - 1) * smallSize + x];
      const edge = Math.sqrt(gx * gx + gy * gy);
      const centerMask = Math.abs(x - smallSize / 2) < smallSize * 0.42 && y > smallSize * 0.16 && y < smallSize * 0.84;
      if (edge > 0.075 && centerMask) {
        const ink = clamp((edge - 0.075) * 6);
        output.data[i] = output.data[i] * (1 - ink) + 28 * ink;
        output.data[i + 1] = output.data[i + 1] * (1 - ink) + 31 * ink;
        output.data[i + 2] = output.data[i + 2] * (1 - ink) + 38 * ink;
      }
    }
  }

  sctx.putImageData(output, 0, 0);

  const big = document.createElement("canvas");
  big.width = outSize;
  big.height = outSize;
  const bctx = big.getContext("2d");
  bctx.fillStyle = "#fffdf7";
  bctx.fillRect(0, 0, outSize, outSize);
  bctx.imageSmoothingEnabled = true;
  bctx.filter = "blur(5px) saturate(1.18) contrast(1.04)";
  bctx.drawImage(small, 0, 0, outSize, outSize);
  bctx.filter = "none";
  bctx.globalAlpha = 0.9;
  bctx.drawImage(small, 0, 0, outSize, outSize);
  bctx.globalAlpha = 1;
  drawAnimeFaceDetails(bctx, darkSpots, smallSize, outSize);
  drawSoftVignette(bctx, outSize);

  return big;
}

function averageNeighborhood(data, size, x, y, radius = 1) {
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let oy = -radius; oy <= radius; oy++) {
    for (let ox = -radius; ox <= radius; ox++) {
      const px = clampTo(x + ox, 0, size - 1);
      const py = clampTo(y + oy, 0, size - 1);
      const i = (py * size + px) * 4;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
  }
  return [r / count, g / count, b / count];
}

function posterizeAnimeColor(color) {
  const hsl = rgbToHsl(color[0], color[1], color[2]);
  const levels = hsl.l < 0.18 ? 7 : 5;
  hsl.s = clamp(hsl.s * 1.36 + 0.08);
  hsl.l = clamp(Math.round((hsl.l * 0.9 + 0.08) * levels) / levels);
  const rgb = hslToRgb(hsl.h, hsl.s, hsl.l);
  return rgb.map((value) => clampTo(value * 0.92 + 255 * 0.08, 0, 255));
}

function drawAnimeFaceDetails(ctx, darkSpots, sourceSize, outSize) {
  const eyes = findEyeCenters(darkSpots, sourceSize);
  if (eyes.length) {
    for (const eye of eyes) {
      const x = eye.x / sourceSize * outSize;
      const y = eye.y / sourceSize * outSize;
      const radius = outSize * 0.032;
      ctx.save();
      ctx.fillStyle = "rgba(18, 20, 27, 0.5)";
      ctx.beginPath();
      ctx.ellipse(x, y, radius * 1.18, radius * 0.9, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255, 255, 255, 0.92)";
      ctx.beginPath();
      ctx.arc(x + radius * 0.35, y - radius * 0.35, radius * 0.26, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  ctx.save();
  ctx.globalCompositeOperation = "screen";
  ctx.fillStyle = "rgba(255, 132, 145, 0.2)";
  const cheekY = outSize * 0.58;
  ctx.beginPath();
  ctx.ellipse(outSize * 0.32, cheekY, outSize * 0.07, outSize * 0.028, -0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(outSize * 0.68, cheekY, outSize * 0.07, outSize * 0.028, 0.12, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function findEyeCenters(spots, size) {
  const halves = [
    spots.filter((spot) => spot.x < size / 2),
    spots.filter((spot) => spot.x >= size / 2),
  ];
  return halves
    .map((items) => {
      if (!items.length) return null;
      const weighted = items.reduce(
        (sum, item) => {
          const weight = 1 - item.luma;
          sum.x += item.x * weight;
          sum.y += item.y * weight;
          sum.weight += weight;
          return sum;
        },
        { x: 0, y: 0, weight: 0 },
      );
      return {
        x: weighted.x / weighted.weight,
        y: weighted.y / weighted.weight,
      };
    })
    .filter(Boolean);
}

function drawSoftVignette(ctx, size) {
  const vignette = ctx.createRadialGradient(size / 2, size / 2, size * 0.18, size / 2, size / 2, size * 0.68);
  vignette.addColorStop(0, "rgba(255,255,255,0)");
  vignette.addColorStop(1, "rgba(32,38,46,0.08)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, size, size);
}

function drawPattern(ctx, w, h, accent) {
  ctx.save();
  ctx.globalAlpha = 0.2;
  ctx.fillStyle = accent.strong;
  for (let i = 0; i < 34; i++) {
    const x = (i * 173) % w;
    const y = (i * 257) % h;
    const size = 12 + (i % 4) * 8;
    if (i % 3 === 0) {
      ctx.beginPath();
      ctx.arc(x, y, size, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(x, y, size, size);
    }
  }
  ctx.restore();
}

async function drawPosterText(ctx, w, h, accent, analysis) {
  ctx.save();
  ctx.fillStyle = POSTER_THEME.ink;
  ctx.textAlign = "center";
  ctx.font = "900 178px system-ui, sans-serif";
  ctx.fillText(analysis.type, w / 2, 1000);

  ctx.fillStyle = accent.strong;
  ctx.font = "900 58px system-ui, sans-serif";
  ctx.fillText(analysis.name, w / 2, 1082);

  ctx.fillStyle = "#39424d";
  ctx.font = "700 36px system-ui, sans-serif";
  wrapText(ctx, analysis.copy, 452, 1160, 640, 50);

  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = POSTER_THEME.ink;
  ctx.lineWidth = 8;
  roundRect(ctx, 154, h - 126, 488, 72, 36);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = POSTER_THEME.ink;
  ctx.font = "900 30px system-ui, sans-serif";
  const label = `${Math.round(analysis.petScore * 100)}% PET · CARTOON`;
  ctx.fillText(label, 398, h - 80);
  await drawQrBlock(ctx, w - 218, h - 252, 142);
  ctx.restore();
}

async function drawQrBlock(ctx, x, y, size) {
  ctx.save();
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = POSTER_THEME.ink;
  ctx.lineWidth = 6;
  roundRect(ctx, x - 18, y - 18, size + 36, size + 72, 18);
  ctx.fill();
  ctx.stroke();

  const qrCanvas = document.createElement("canvas");
  qrCanvas.width = size;
  qrCanvas.height = size;
  if (window.QRCode?.toCanvas) {
    await window.QRCode.toCanvas(qrCanvas, getQrTargetUrl(), {
      width: size,
      margin: 1,
      color: { dark: POSTER_THEME.ink, light: "#ffffff" },
      errorCorrectionLevel: "M",
    });
    ctx.drawImage(qrCanvas, x, y, size, size);
  } else {
    drawFallbackQr(ctx, x, y, size);
  }

  ctx.fillStyle = POSTER_THEME.ink;
  ctx.textAlign = "center";
  ctx.font = "900 22px system-ui, sans-serif";
  ctx.fillText("扫码查看", x + size / 2, y + size + 36);
  ctx.restore();
}

function getQrTargetUrl() {
  const { hostname, href } = window.location;
  const isLocal = ["127.0.0.1", "localhost", "0.0.0.0"].includes(hostname);
  return isLocal ? PUBLIC_SITE_URL : href.split("#")[0];
}

function drawFallbackQr(ctx, x, y, size) {
  const cells = 25;
  const cell = size / cells;
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(x, y, size, size);
  ctx.fillStyle = POSTER_THEME.ink;
  for (let row = 0; row < cells; row++) {
    for (let col = 0; col < cells; col++) {
      const finder =
        (row < 7 && col < 7) ||
        (row < 7 && col >= cells - 7) ||
        (row >= cells - 7 && col < 7);
      const bit = finder || ((row * 17 + col * 29 + row * col) % 7 < 3);
      if (bit) ctx.fillRect(x + col * cell, y + row * cell, Math.ceil(cell), Math.ceil(cell));
    }
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  let line = "";
  const chars = Array.from(text);
  for (const char of chars) {
    const test = line + char;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, y);
      line = char;
      y += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, y);
}

function paletteFromAnalysis(analysis) {
  if (analysis.type.includes("F")) {
    return { soft: "#f8d8d0", warm: POSTER_THEME.bgBottom, strong: POSTER_THEME.accent };
  }
  if (analysis.type.includes("N")) {
    return { soft: POSTER_THEME.bgMid, warm: POSTER_THEME.bgBottom, strong: "#446bb3" };
  }
  return { soft: "#d8e4f6", warm: POSTER_THEME.bgBottom, strong: POSTER_THEME.accent2 };
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + width, y, x + width, y + height, radius);
  ctx.arcTo(x + width, y + height, x, y + height, radius);
  ctx.arcTo(x, y + height, x, y, radius);
  ctx.arcTo(x, y, x + width, y, radius);
  ctx.closePath();
}

function coverCrop(srcW, srcH, targetW, targetH) {
  const sourceRatio = srcW / srcH;
  const targetRatio = targetW / targetH;
  if (sourceRatio > targetRatio) {
    const sw = srcH * targetRatio;
    return { sx: (srcW - sw) / 2, sy: 0, sw, sh: srcH };
  }
  const sh = srcW / targetRatio;
  return { sx: 0, sy: (srcH - sh) / 2, sw: srcW, sh };
}

function clampTo(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const value = l * 255;
    return [value, value, value];
  }
  const hueToRgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    hueToRgb(p, q, h + 1 / 3) * 255,
    hueToRgb(p, q, h) * 255,
    hueToRgb(p, q, h - 1 / 3) * 255,
  ];
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = URL.createObjectURL(file);
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function clamp(value) {
  return Math.max(0, Math.min(1, value));
}

async function makeDemoPetFile() {
  const canvas = document.createElement("canvas");
  canvas.width = 760;
  canvas.height = 760;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f1d6a8";
  ctx.fillRect(0, 0, 760, 760);
  ctx.fillStyle = "#9a6540";
  ctx.beginPath();
  ctx.arc(380, 405, 238, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#70452d";
  ctx.beginPath();
  ctx.moveTo(185, 260);
  ctx.lineTo(265, 78);
  ctx.lineTo(330, 270);
  ctx.closePath();
  ctx.moveTo(575, 260);
  ctx.lineTo(495, 78);
  ctx.lineTo(430, 270);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#151515";
  ctx.beginPath();
  ctx.arc(300, 360, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(460, 360, 42, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(316, 344, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(476, 344, 12, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#211512";
  ctx.beginPath();
  ctx.arc(380, 452, 25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "#211512";
  ctx.lineWidth = 9;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(380, 478);
  ctx.quadraticCurveTo(342, 516, 300, 498);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(380, 478);
  ctx.quadraticCurveTo(418, 516, 460, 498);
  ctx.stroke();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  return new File([blob], "demo-pet.png", { type: "image/png" });
}

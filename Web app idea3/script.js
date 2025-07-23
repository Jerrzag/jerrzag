let grayscaleImageData = null;

// Miniature Painter Web App - Clean Rewrite

// --- DOM ELEMENTS ---
const imageInput = document.getElementById('imageInput');
const canvas = document.getElementById('mainCanvas');
const ctx = canvas.getContext('2d');
const showOriginalBtn = document.getElementById('showOriginalBtn');
const showGrayscaleBtn = document.getElementById('showGrayscaleBtn');
const paintModeBtn = document.getElementById('paintModeBtn');
const eyedropperBtn = document.getElementById('eyedropperBtn');
const undoBtn = document.getElementById('undoBtn');
const resetBtn = document.getElementById('resetBtn');
const brushSizeSlider = document.getElementById('brushSizeSlider');
const brushSizeDisplay = document.getElementById('brushSizeDisplay');
const paintPreview = document.getElementById('paintPreview');
const paletteDiv = document.getElementById('palette');

// --- APP STATE ---
let originalImage = null;
let paintedImageData = null;
let brushRadius = 16;
let currentColor = '#ff0000';
let history = [];
const HISTORY_MAX = 30;
let isPainting = false;
let isViewingOriginal = false;
let isEyedropperActive = false;
let isPaintModeOn = false;
let mouse = { x: 0, y: 0, prevX: 0, prevY: 0, overCanvas: false };

// --- UI UPDATE ---
// Color picker logic
const colorPicker = document.getElementById('colorPicker');
paintPreview.addEventListener('click', () => {
    colorPicker.value = currentColor;
    colorPicker.click();
});
colorPicker.addEventListener('input', (e) => {
    currentColor = e.target.value;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    updateUI();
});
function updateUI() {
    const hasImage = !!originalImage;
    [resetBtn, showGrayscaleBtn, showOriginalBtn, paintModeBtn, eyedropperBtn, undoBtn].forEach(btn => btn.disabled = !hasImage);
    showGrayscaleBtn.classList.toggle('active', !isViewingOriginal);
    showOriginalBtn.classList.toggle('active', isViewingOriginal);
    paintModeBtn.classList.toggle('active', isPaintModeOn);
    eyedropperBtn.classList.toggle('active', isEyedropperActive);
    paintModeBtn.disabled = isViewingOriginal || isEyedropperActive || !hasImage;
    eyedropperBtn.disabled = isPainting || !hasImage;
    undoBtn.disabled = isViewingOriginal || isEyedropperActive || history.length <= 1 || !hasImage;
    canvas.style.cursor = isEyedropperActive ? 'crosshair' : (isPaintModeOn && !isViewingOriginal ? 'none' : 'default');
    // Show preview as colorization effect: selected color's hue/saturation, midtone lightness
    const targetRGB = hexToRgb(currentColor);
    const targetHSL = rgbToHsl(targetRGB.r, targetRGB.g, targetRGB.b);
    const previewRGB = hslToRgb(targetHSL.h, targetHSL.s, 0.6); // 0.6 is a midtone
    paintPreview.style.backgroundColor = rgbToHex(previewRGB.r, previewRGB.g, previewRGB.b);
    brushSizeDisplay.textContent = brushRadius;
}

// --- IMAGE HANDLING ---
imageInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            originalImage = img;
            extractPalette(img);
            resetToGrayscale();
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
});

function resetToGrayscale() {
    if (!originalImage) return;
    paintedImageData = createGrayscale(originalImage);
    // Save a copy of the grayscale data
    grayscaleImageData = new ImageData(
        new Uint8ClampedArray(paintedImageData.data),
        paintedImageData.width,
        paintedImageData.height
    );
    history = [new ImageData(new Uint8ClampedArray(paintedImageData.data), paintedImageData.width, paintedImageData.height)];
    isViewingOriginal = false;
    isPaintModeOn = false;
    isEyedropperActive = false;
    redrawCanvas();
    updateUI();
}

function redrawCanvas() {
    if (isViewingOriginal) {
        ctx.drawImage(originalImage, 0, 0, canvas.width, canvas.height);
    } else if (paintedImageData) {
        ctx.putImageData(paintedImageData, 0, 0);
    } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
}

function drawOverlay() {
    if (isPaintModeOn && !isPainting && !isViewingOriginal && mouse.overCanvas) {
        redrawCanvas();
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, brushRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,0,0,0.7)';
        ctx.lineWidth = 1;
        ctx.stroke();
    }
}

// --- PALETTE EXTRACTION ---
function extractPalette(img, colorCount = 7) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height).data;
    const colorMap = {};
    for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i] >> 4, g = imgData[i + 1] >> 4, b = imgData[i + 2] >> 4;
        const key = `${r},${g},${b}`;
        colorMap[key] = (colorMap[key] || 0) + 1;
    }
    const sorted = Object.entries(colorMap).sort((a, b) => b[1] - a[1]);
    const palette = sorted.slice(0, colorCount).map(([key]) => {
        const [r, g, b] = key.split(',').map(c => parseInt(c, 10) << 4);
        return { r, g, b };
    });
    paletteDiv.innerHTML = '';
    palette.forEach((color, index) => {
        const swatch = document.createElement('div');
        swatch.className = 'color-swatch';
        const hex = rgbToHex(color.r, color.g, color.b);
        const hsl = rgbToHsl(color.r, color.g, color.b);
        const displayL = Math.max(0.5, hsl.l);
        const displayRgb = hslToRgb(hsl.h, hsl.s, displayL);
        swatch.style.backgroundColor = rgbToHex(displayRgb.r, displayRgb.g, displayRgb.b);
        swatch.addEventListener('click', () => {
            currentColor = hex;
            paintPreview.style.backgroundColor = currentColor;
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');
            updateUI();
        });
        paletteDiv.appendChild(swatch);
        if (index === 0) {
            currentColor = hex;
            paintPreview.style.backgroundColor = currentColor;
            swatch.classList.add('active');
        }
    });
}

// --- PAINTING ENGINE ---
canvas.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (isEyedropperActive) {
        pickColor(e.offsetX, e.offsetY);
        return;
    }
    if (isPaintModeOn && !isViewingOriginal) {
        history.push(new ImageData(new Uint8ClampedArray(paintedImageData.data), paintedImageData.width, paintedImageData.height));
        if (history.length > HISTORY_MAX) history.shift();
        isPainting = true;
        mouse.prevX = e.offsetX;
        mouse.prevY = e.offsetY;
        paintLine(mouse.prevX, mouse.prevY, e.offsetX, e.offsetY);
        updateUI();
    }
});

canvas.addEventListener('mousemove', (e) => {
    mouse.x = e.offsetX;
    mouse.y = e.offsetY;
    if (isPainting && isPaintModeOn) {
        paintLine(mouse.prevX, mouse.prevY, mouse.x, mouse.y);
        mouse.prevX = mouse.x;
        mouse.prevY = mouse.y;
    } else {
        drawOverlay();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button !== 0 || !isPainting) return;
    isPainting = false;
    paintedImageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    updateUI();
    drawOverlay();
});

canvas.addEventListener('mouseenter', () => mouse.overCanvas = true);
canvas.addEventListener('mouseleave', () => {
    isPainting = false;
    mouse.overCanvas = false;
    redrawCanvas();
});
// Prevent drag behavior on canvas
canvas.addEventListener('dragstart', e => e.preventDefault());

function paintLine(x0, y0, x1, y1) {
    const dist = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.max(1, Math.ceil(dist / (brushRadius / 4)));
    for (let i = 0; i < steps; i++) {
        const t = i / steps;
        const x = x0 + (x1 - x0) * t;
        const y = y0 + (y1 - y0) * t;
        paintAt(x, y);
    }
}

function paintAt(x, y) {
    const imgData = paintedImageData;
    const data = imgData.data;
    const grayData = grayscaleImageData.data;
    const targetRGB = hexToRgb(currentColor);
    for (let i = -brushRadius; i <= brushRadius; i++) {
        for (let j = -brushRadius; j <= brushRadius; j++) {
            if (i * i + j * j > brushRadius * brushRadius) continue;
            const px = Math.floor(x + i);
            const py = Math.floor(y + j);
            if (px < 0 || px >= canvas.width || py < 0 || py >= canvas.height) continue;
            const idx = (py * canvas.width + px) * 4;
            const gray = grayData[idx] / 255; // grayscale value [0,1]
            const targetHSL = rgbToHsl(targetRGB.r, targetRGB.g, targetRGB.b);
            // Replace only hue and saturation, keep grayscale lightness
            const newRGB = hslToRgb(targetHSL.h, targetHSL.s, gray);
            data[idx] = newRGB.r;
            data[idx+1] = newRGB.g;
            data[idx+2] = newRGB.b;
        }
    }
    redrawCanvas();
}

// --- TOOL BUTTONS ---
paintModeBtn.addEventListener('click', () => {
    isPaintModeOn = !isPaintModeOn;
    updateUI();
    drawOverlay();
});

eyedropperBtn.addEventListener('click', () => {
    isEyedropperActive = !isEyedropperActive;
    updateUI();
});

function pickColor(x, y) {
    if (!isViewingOriginal) {
        alert('Eyedropper only works on the original image. Switch to "Original" view to pick colors.');
        return;
    }
    // Sample from the visible canvas
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    if (pixel) {
        currentColor = rgbToHex(pixel[0], pixel[1], pixel[2]);
    }
    updateUI();
}

showOriginalBtn.addEventListener('click', () => {
    isViewingOriginal = true;
    isEyedropperActive = false;
    redrawCanvas();
    updateUI();
});

showGrayscaleBtn.addEventListener('click', () => {
    isViewingOriginal = false;
    redrawCanvas();
    updateUI();
});

undoBtn.addEventListener('click', () => {
    if (history.length > 1) {
        history.pop();
        paintedImageData = history[history.length - 1];
        redrawCanvas();
        updateUI();
    }
});

resetBtn.addEventListener('click', resetToGrayscale);

brushSizeSlider.addEventListener('input', (e) => {
    brushRadius = parseInt(e.target.value, 10);
    updateUI();
    drawOverlay();
});

// --- COLOR & PALETTE HELPERS ---
function createGrayscale(img) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const imgData = tempCtx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imgData.data;
    for (let i = 0; i < data.length; i += 4) {
        const avg = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
        data[i] = data[i + 1] = data[i + 2] = avg;
    }
    return imgData;
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1).toUpperCase();
}

function hexToRgb(hex) {
    if (typeof hex === 'object') return hex; // already rgb
    hex = hex.replace('#', '');
    if (hex.length === 3) hex = hex.split('').map(x=>x+x).join('');
    const num = parseInt(hex, 16);
    return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function rgbToHsl(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    let h = 0, s, l = (max + min) / 2;
    if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }
    return { h, s, l };
}

function hslToRgb(h, s, l) {
    let r, g, b;
    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1; if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }
    return { r: Math.round(r * 255), g: Math.round(g * 255), b: Math.round(b * 255) };
}

// --- INITIALIZATION ---
updateUI(); 
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');
const fs = require('fs');
const path = require('path');

const fontsDir = path.join(__dirname, '..', 'src', 'fonts');
GlobalFonts.registerFromPath(path.join(fontsDir, 'Cairo.ttf'), 'Cairo');
GlobalFonts.registerFromPath(path.join(fontsDir, 'NotoKufiArabic-Regular.ttf'), 'Noto Kufi Arabic');
GlobalFonts.registerFromPath(path.join(fontsDir, 'NotoKufiArabic-Bold.ttf'), 'Noto Kufi Arabic');

const canvas = createCanvas(800, 200);
const ctx = canvas.getContext('2d');

ctx.fillStyle = 'white';
ctx.fillRect(0, 0, 800, 200);

ctx.fillStyle = 'black';
ctx.textBaseline = 'top';
ctx.direction = 'rtl';

const text = 'بدون عنوان: التجميل العشوائي من "إنستغرام" إلى غرف الإنعاش والمحاكم';

// Test Noto
ctx.font = '700 30px "Noto Kufi Arabic", "Cairo", sans-serif';
ctx.fillText(text, 750, 50);

// Test Cairo
ctx.font = '700 30px "Cairo", sans-serif';
ctx.fillText(text, 750, 100);

fs.writeFileSync(path.join(__dirname, '..', 'test-font-output.png'), canvas.toBuffer('image/png'));
console.log('done');

const fs = require('fs');
const https = require('https');
const path = require('path');

const fonts = [
  { name: 'Cairo.ttf', url: 'https://github.com/googlefonts/cairo/raw/master/fonts/ttf/Cairo-Bold.ttf' },
  { name: 'NotoKufiArabic-Regular.ttf', url: 'https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoKufiArabic/NotoKufiArabic-Regular.ttf' },
  { name: 'NotoKufiArabic-Bold.ttf', url: 'https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoKufiArabic/NotoKufiArabic-Bold.ttf' },
  { name: 'Inter-Regular.ttf', url: 'https://github.com/google/fonts/raw/main/ofl/inter/Inter-Regular.ttf' },
  { name: 'Inter-Bold.ttf', url: 'https://github.com/google/fonts/raw/main/ofl/inter/Inter-Bold.ttf' }
];

const dest = path.join(__dirname, '..', 'src', 'fonts');
if (!fs.existsSync(dest)) {
  fs.mkdirSync(dest, { recursive: true });
}

function download(url, filename) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location, filename).then(resolve).catch(reject);
      }
      const file = fs.createWriteStream(filename);
      res.pipe(file);
      file.on('finish', () => {
        file.close();
        console.log('Downloaded ' + filename);
        resolve();
      });
    }).on('error', (err) => {
      fs.unlink(filename, () => reject(err));
    });
  });
}

async function main() {
  for (const font of fonts) {
    try {
      await download(font.url, path.join(dest, font.name));
    } catch (e) {
      console.error('Failed to download ' + font.name, e);
    }
  }
}
main();

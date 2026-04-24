const fs = require('fs');
const https = require('https');
const path = require('path');

const fonts = [
  { name: 'NotoSansArabic-Regular.ttf', url: 'https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoSansArabic/NotoSansArabic-Regular.ttf' },
  { name: 'NotoSansArabic-Bold.ttf', url: 'https://github.com/googlefonts/noto-fonts/raw/main/unhinted/ttf/NotoSansArabic/NotoSansArabic-Bold.ttf' }
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

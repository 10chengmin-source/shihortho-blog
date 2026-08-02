const sharp = require('sharp');
const path = require('path');

const [, , input, outputBase, widthArg] = process.argv;
if (!input || !outputBase) {
  console.error('Usage: node optimize-image.js <input> <outputBaseWithoutExt> [maxWidth]');
  process.exit(1);
}

const maxWidth = Number(widthArg) || 2000;

async function run() {
  const image = sharp(input).rotate();
  const resized = image.resize({ width: maxWidth, withoutEnlargement: true });

  await resized.clone().jpeg({ quality: 82, mozjpeg: true }).toFile(`${outputBase}.jpg`);
  await resized.clone().webp({ quality: 80 }).toFile(`${outputBase}.webp`);

  const meta = await sharp(`${outputBase}.jpg`).metadata();
  console.log(`Wrote ${outputBase}.jpg / .webp (${meta.width}x${meta.height})`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});

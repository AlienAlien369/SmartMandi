/* eslint-disable no-console */
const path = require('path');
const fs = require('fs');
const sharp = require('sharp');

const ROOT = path.resolve(__dirname, '..');
const inputPath = path.join(ROOT, 'src', 'utils', 'sm-logo.webp');

const androidResRoot = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');
const androidMipmap = [
  { dir: 'mipmap-mdpi', size: 48 },
  { dir: 'mipmap-hdpi', size: 72 },
  { dir: 'mipmap-xhdpi', size: 96 },
  { dir: 'mipmap-xxhdpi', size: 144 },
  { dir: 'mipmap-xxxhdpi', size: 192 },
];

async function ensureFileExists(filePath) {
  await fs.promises.access(filePath, fs.constants.R_OK);
}

async function makeSquarePng({ size, outPath }) {
  const image = sharp(inputPath).resize(size, size, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } });
  await image.png({ compressionLevel: 9 }).toFile(outPath);
}

async function main() {
  await ensureFileExists(inputPath);

  for (const { dir, size } of androidMipmap) {
    const targetDir = path.join(androidResRoot, dir);
    await fs.promises.mkdir(targetDir, { recursive: true });

    const launcher = path.join(targetDir, 'ic_launcher.png');
    const launcherRound = path.join(targetDir, 'ic_launcher_round.png');

    await makeSquarePng({ size, outPath: launcher });
    await makeSquarePng({ size, outPath: launcherRound });
  }

  console.log('Generated Android launcher icons from', path.relative(ROOT, inputPath));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});


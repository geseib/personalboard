import sharp from 'sharp';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SOURCE_DIR = path.resolve(__dirname, '..', 'images');
const OUTPUT_DIR = path.resolve(__dirname, '..', 'dist', 'images', 'optimized');

const SIZES = [
  { suffix: '', width: 1920 },
  { suffix: '-mobile', width: 960 }
];

const FORMATS = [
  { ext: 'webp', options: { quality: 80 } },
  { ext: 'jpg', options: { quality: 80, mozjpeg: true } }
];

async function optimizeImages() {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });

  const files = fs.readdirSync(SOURCE_DIR)
    .filter(f => /^Slide\d+\.png$/i.test(f));

  console.log(`Found ${files.length} source images to optimize\n`);

  let totalOriginal = 0;
  let totalOptimized = 0;

  for (const file of files) {
    const basename = path.parse(file).name;
    const inputPath = path.join(SOURCE_DIR, file);
    const originalSize = fs.statSync(inputPath).size;
    totalOriginal += originalSize;

    console.log(`${basename}.png (${(originalSize / 1024 / 1024).toFixed(1)}MB)`);

    for (const size of SIZES) {
      for (const format of FORMATS) {
        const outputName = `${basename}${size.suffix}.${format.ext}`;
        const outputPath = path.join(OUTPUT_DIR, outputName);

        await sharp(inputPath)
          .resize(size.width, null, { withoutEnlargement: true })
          .toFormat(format.ext, format.options)
          .toFile(outputPath);

        const outputSize = fs.statSync(outputPath).size;
        totalOptimized += outputSize;
        const reduction = ((1 - outputSize / originalSize) * 100).toFixed(0);
        console.log(`  → ${outputName}: ${(outputSize / 1024).toFixed(0)}KB (${reduction}% smaller)`);
      }
    }
    console.log('');
  }

  console.log('Summary:');
  console.log(`  Original total: ${(totalOriginal / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Optimized total: ${(totalOptimized / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Overall reduction: ${((1 - totalOptimized / totalOriginal) * 100).toFixed(0)}%`);
}

optimizeImages().catch(err => {
  console.error('Image optimization failed:', err);
  process.exit(1);
});

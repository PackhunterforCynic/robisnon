import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

async function optimize() {
  const assetsDir = path.resolve('src/assets');
  const publicDir = path.resolve('public');

  if (!fs.existsSync(publicDir)) {
    fs.mkdirSync(publicDir, { recursive: true });
  }

  // 1. Convert flash-bites.png to webp
  const flashBitesPng = path.join(assetsDir, 'flash-bites.png');
  const flashBitesWebp = path.join(assetsDir, 'flash-bites.webp');
  if (fs.existsSync(flashBitesPng)) {
    await sharp(flashBitesPng)
      .webp({ quality: 82 })
      .toFile(flashBitesWebp);
    console.log('Converted flash-bites.png -> flash-bites.webp');
  }

  // 2. Convert fair-switch.png to webp
  const fairSwitchPng = path.join(assetsDir, 'fair-switch.png');
  const fairSwitchWebp = path.join(assetsDir, 'fair-switch.webp');
  if (fs.existsSync(fairSwitchPng)) {
    await sharp(fairSwitchPng)
      .webp({ quality: 82 })
      .toFile(fairSwitchWebp);
    console.log('Converted fair-switch.png -> fair-switch.webp');
  }

  // 3. Copy logo.jpg to public/logo.jpg
  const logoJpg = path.join(assetsDir, 'logo.jpg');
  if (fs.existsSync(logoJpg)) {
    fs.copyFileSync(logoJpg, path.join(publicDir, 'logo.jpg'));
    console.log('Copied logo.jpg -> public/logo.jpg');
    
    // Generate crisp 32x32 favicon.png
    await sharp(logoJpg)
      .resize(32, 32)
      .png()
      .toFile(path.join(publicDir, 'favicon.png'));
    console.log('Generated public/favicon.png (32x32)');

    // Generate 192x192 apple-touch-icon.png
    await sharp(logoJpg)
      .resize(192, 192)
      .png()
      .toFile(path.join(publicDir, 'apple-touch-icon.png'));
    console.log('Generated public/apple-touch-icon.png (192x192)');
  }

  // 4. Create an ultra-crisp, elegant SVG favicon
  const svgFavicon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">
  <rect width="100" height="100" rx="20" fill="#0a0a0a"/>
  <text x="50%" y="58%" dominant-baseline="middle" text-anchor="middle" font-family="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="44" font-weight="700" fill="#ffffff" letter-spacing="-1">RJ</text>
  <circle cx="78" cy="30" r="4" fill="#6366f1"/>
</svg>`;
  fs.writeFileSync(path.join(publicDir, 'favicon.svg'), svgFavicon, 'utf-8');
  console.log('Created public/favicon.svg');
}

optimize().catch(err => {
  console.error('Error optimizing assets:', err);
  process.exit(1);
});

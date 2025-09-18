#!/usr/bin/env node
import { mkdir, readdir } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const SRC_DIR = path.resolve("public/images");
const OUT_DIR = SRC_DIR; // 直接在原目录旁生成 .avif / .webp

const exts = new Set([".jpg", ".jpeg", ".png"]);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) await walk(p);
    else {
      const ext = path.extname(entry.name).toLowerCase();
      if (!exts.has(ext)) continue;
      await convert(p);
    }
  }
}

async function convert(file) {
  const base = file.slice(0, file.lastIndexOf("."));
  const avifOut = `${base}.avif`;
  const webpOut = `${base}.webp`;

  const input = sharp(file);

  // 你可以根据图片类型区分质量，这里给一个均衡配置
  await input
    .clone()
    .avif({ quality: 50, effort: 4 }) // effort 越大越慢；50~60 画质/体积比较均衡
    .toFile(avifOut)
    .catch(() => null);

  await input
    .clone()
    .webp({ quality: 70 })
    .toFile(webpOut)
    .catch(() => null);

  // 可选：为 JPG/PNG 重写元数据/优化（保持原始作为最终兜底）
  // await input.jpeg({ quality: 80, mozjpeg: true }).toFile(`${base}.opt.jpg`)
}

await mkdir(OUT_DIR, { recursive: true });
await walk(SRC_DIR);
console.log("✅ AVIF/WebP 生成完成");

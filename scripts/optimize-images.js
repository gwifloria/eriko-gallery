#!/usr/bin/env node
import { mkdir, readdir, access } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const IMAGES_DIR = path.resolve("images");
const SUPPORTED_EXTS = new Set([".jpg", ".jpeg", ".png"]);

async function dirExists(dir) {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

async function walkDirectory(dir) {
  const imagesToProcess = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const subImages = await walkDirectory(fullPath);
        imagesToProcess.push(...subImages);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTS.has(ext)) {
          imagesToProcess.push(fullPath);
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  无法读取目录 ${dir}: ${error.message}`);
  }

  return imagesToProcess;
}

async function convertImage(sourcePath) {
  const dir = path.dirname(sourcePath);
  const name = path.basename(sourcePath, path.extname(sourcePath));
  const avifPath = path.join(dir, `${name}.avif`);
  const webpPath = path.join(dir, `${name}.webp`);

  const convertedFiles = [];

  try {
    // 转换为 AVIF 格式 (主要格式，最佳压缩比)
    await sharp(sourcePath)
      .avif({
        quality: 65,  // 稍高的质量设置
        effort: 6     // 更好的压缩效果
      })
      .toFile(avifPath);

    console.log(`✅ AVIF 转换成功: ${sourcePath} → ${avifPath}`);
    convertedFiles.push(avifPath);
  } catch (error) {
    console.error(`❌ AVIF 转换失败 ${sourcePath}: ${error.message}`);
  }

  try {
    // 转换为 WebP 格式 (fallback，广泛兼容)
    await sharp(sourcePath)
      .webp({
        quality: 75,  // WebP 使用稍高质量以保证兼容性
        effort: 6
      })
      .toFile(webpPath);

    console.log(`✅ WebP 转换成功: ${sourcePath} → ${webpPath}`);
    convertedFiles.push(webpPath);
  } catch (error) {
    console.error(`❌ WebP 转换失败 ${sourcePath}: ${error.message}`);
  }

  return convertedFiles;
}

async function addToGit(filePath) {
  try {
    execSync(`git add "${filePath}"`, { stdio: 'pipe' });
    console.log(`📝 已添加到 Git: ${filePath}`);
  } catch (error) {
    console.warn(`⚠️  无法添加到 Git ${filePath}: ${error.message}`);
  }
}

async function main() {
  console.log("🖼️  开始图片优化...");

  // 检查 images 目录是否存在
  if (!(await dirExists(IMAGES_DIR))) {
    console.log("📁 images/ 目录不存在，跳过图片优化");
    return;
  }

  // 扫描所有需要处理的图片
  const imagesToProcess = await walkDirectory(IMAGES_DIR);

  if (imagesToProcess.length === 0) {
    console.log("✨ 没有发现需要处理的图片文件");
    return;
  }

  console.log(`📊 发现 ${imagesToProcess.length} 个图片文件需要处理`);

  const convertedFiles = [];

  // 转换所有图片
  for (const imagePath of imagesToProcess) {
    const newFiles = await convertImage(imagePath);
    convertedFiles.push(...newFiles);
  }

  // 将转换后的文件添加到 Git
  if (convertedFiles.length > 0) {
    console.log(`\n📝 将 ${convertedFiles.length} 个优化文件添加到 Git...`);
    for (const filePath of convertedFiles) {
      await addToGit(filePath);
    }
  }

  console.log("\n🎉 图片优化完成！");
  console.log(`✅ 成功转换: ${convertedFiles.length} 个文件`);
  console.log("💡 原始图片文件已被 .gitignore 排除，只有 AVIF 和 WebP 文件会被提交");
}

// 运行主函数
main().catch(error => {
  console.error("💥 图片优化过程中出错:", error);
  process.exit(1);
});
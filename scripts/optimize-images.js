#!/usr/bin/env node
import { mkdir, readdir, access, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";

const ORIGIN_DIR = path.resolve("origin");
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

// 获取 git staged 的图片文件
function getStagedImageFiles() {
  try {
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map(file => path.resolve(file));

    return stagedFiles.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return SUPPORTED_EXTS.has(ext) && file.startsWith(ORIGIN_DIR);
    });
  } catch (error) {
    console.warn('⚠️  无法获取 staged 文件，fallback 到扫描全部图片');
    return null;
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
          // 检查是否已经有对应的 AVIF 文件
          const name = path.basename(entry.name, ext);
          const avifPath = path.join(IMAGES_DIR, `${name}.avif`);

          try {
            await access(avifPath);
            // 如果 AVIF 文件已存在，跳过处理
            continue;
          } catch {
            // AVIF 文件不存在，需要处理
            imagesToProcess.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  无法读取目录 ${dir}: ${error.message}`);
  }

  return imagesToProcess;
}

async function convertImage(sourcePath) {
  const name = path.basename(sourcePath, path.extname(sourcePath));
  const avifPath = path.join(IMAGES_DIR, `${name}.avif`);

  const convertedFiles = [];
  let conversionSuccess = false;

  try {
    // 确保输出目录存在
    await mkdir(IMAGES_DIR, { recursive: true });

    // 转换为 AVIF 格式 (最佳压缩比)
    await sharp(sourcePath)
      .avif({
        quality: 65,  // 稍高的质量设置
        effort: 6     // 更好的压缩效果
      })
      .toFile(avifPath);

    console.log(`✅ AVIF 转换成功: ${sourcePath} → ${avifPath}`);
    convertedFiles.push(avifPath);
    conversionSuccess = true;
  } catch (error) {
    console.error(`❌ AVIF 转换失败 ${sourcePath}: ${error.message}`);
  }

  // 如果转换成功，删除源文件
  if (conversionSuccess) {
    try {
      await unlink(sourcePath);
      console.log(`🗑️  已删除源文件: ${sourcePath}`);
    } catch (error) {
      console.warn(`⚠️  无法删除源文件 ${sourcePath}: ${error.message}`);
    }
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

  // 检查 origin 目录是否存在
  if (!(await dirExists(ORIGIN_DIR))) {
    console.log("📁 origin/ 目录不存在，跳过图片优化");
    return;
  }

  // 优先检查 staged 的图片文件
  const stagedImages = getStagedImageFiles();
  let imagesToProcess;

  if (stagedImages && stagedImages.length > 0) {
    console.log(`📋 检测到 ${stagedImages.length} 个 staged 图片文件`);
    imagesToProcess = stagedImages;
  } else {
    console.log("🔍 扫描 origin/ 目录中需要处理的图片...");
    // Fallback 到扫描全部图片（跳过已优化的）
    imagesToProcess = await walkDirectory(ORIGIN_DIR);
  }

  if (imagesToProcess.length === 0) {
    console.log("✨ 没有发现需要处理的图片文件");
    return;
  }

  console.log(`📊 准备处理 ${imagesToProcess.length} 个图片文件`);

  const convertedFiles = [];

  // 转换所有图片
  for (const imagePath of imagesToProcess) {
    console.log(`\n🔄 处理: ${path.relative(process.cwd(), imagePath)}`);
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
  console.log("💡 源文件已删除，只有优化后的 AVIF 文件会被提交");
}

// 运行主函数
main().catch(error => {
  console.error("💥 图片优化过程中出错:", error);
  process.exit(1);
});
#!/usr/bin/env node
import { mkdir, readdir, access, unlink } from "node:fs/promises";
import { execSync } from "node:child_process";
import path from "node:path";
import sharp from "sharp";
import ffmpeg from "fluent-ffmpeg";

const ORIGIN_DIR = path.resolve("origin");
const IMAGES_DIR = path.resolve("images");
const IMAGE_EXTS = new Set([".jpg", ".jpeg", ".png", ".heic", ".heif"]);
const VIDEO_EXTS = new Set([".mov"]);

async function dirExists(dir) {
  try {
    await access(dir);
    return true;
  } catch {
    return false;
  }
}

// 获取 git staged 的媒体文件（图片和视频）
function getStagedMediaFiles() {
  try {
    const stagedFiles = execSync('git diff --cached --name-only', { encoding: 'utf8' })
      .split('\n')
      .filter(Boolean)
      .map(file => path.resolve(file));

    const images = [];
    const videos = [];

    stagedFiles.forEach(file => {
      if (!file.startsWith(ORIGIN_DIR)) return;

      const ext = path.extname(file).toLowerCase();
      if (IMAGE_EXTS.has(ext)) {
        images.push(file);
      } else if (VIDEO_EXTS.has(ext)) {
        videos.push(file);
      }
    });

    return { images, videos };
  } catch (error) {
    console.warn('⚠️  无法获取 staged 文件，fallback 到扫描全部文件');
    return null;
  }
}

async function walkDirectory(dir) {
  const imagesToProcess = [];
  const videosToProcess = [];

  try {
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        const { images: subImages, videos: subVideos } = await walkDirectory(fullPath);
        imagesToProcess.push(...subImages);
        videosToProcess.push(...subVideos);
      } else {
        const ext = path.extname(entry.name).toLowerCase();
        const name = path.basename(entry.name, ext);

        if (IMAGE_EXTS.has(ext)) {
          // 检查是否已经有对应的 AVIF 文件
          const avifPath = path.join(IMAGES_DIR, `${name}.avif`);

          try {
            await access(avifPath);
            // 如果 AVIF 文件已存在，跳过处理
            continue;
          } catch {
            // AVIF 文件不存在，需要处理
            imagesToProcess.push(fullPath);
          }
        } else if (VIDEO_EXTS.has(ext)) {
          // 检查是否已经有对应的 MP4 文件
          const mp4Path = path.join(IMAGES_DIR, `${name}.mp4`);

          try {
            await access(mp4Path);
            // 如果 MP4 文件已存在，跳过处理
            continue;
          } catch {
            // MP4 文件不存在，需要处理
            videosToProcess.push(fullPath);
          }
        }
      }
    }
  } catch (error) {
    console.warn(`⚠️  无法读取目录 ${dir}: ${error.message}`);
  }

  return { images: imagesToProcess, videos: videosToProcess };
}

async function convertImage(sourcePath) {
  const name = path.basename(sourcePath, path.extname(sourcePath));
  const avifPath = path.join(IMAGES_DIR, `${name}.avif`);
  const ext = path.extname(sourcePath).toLowerCase();

  const convertedFiles = [];
  let conversionSuccess = false;
  let tempFile = null;

  try {
    // 确保输出目录存在
    await mkdir(IMAGES_DIR, { recursive: true });

    let inputPath = sourcePath;

    // 对于 HEIC/HEIF 文件，先使用 sips 转换为临时 PNG
    if (ext === '.heic' || ext === '.heif') {
      tempFile = path.join('/tmp', `temp_${name}_${Date.now()}.png`);
      try {
        execSync(`sips -s format png "${sourcePath}" --out "${tempFile}"`, { stdio: 'pipe' });
        console.log(`🔄 HEIC → PNG (临时): ${sourcePath}`);
        inputPath = tempFile;
      } catch (sipsError) {
        console.error(`❌ HEIC 预处理失败: ${sipsError.message}`);
        throw sipsError;
      }
    }

    // 转换为 AVIF 格式 (最佳压缩比)
    await sharp(inputPath)
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
  } finally {
    // 清理临时文件
    if (tempFile) {
      try {
        await unlink(tempFile);
      } catch (e) {
        // 忽略清理错误
      }
    }
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

async function convertVideo(sourcePath) {
  const name = path.basename(sourcePath, path.extname(sourcePath));
  const mp4Path = path.join(IMAGES_DIR, `${name}.mp4`);

  const convertedFiles = [];
  let conversionSuccess = false;

  try {
    // 确保输出目录存在
    await mkdir(IMAGES_DIR, { recursive: true });

    // 使用 Promise 包装 ffmpeg 转换
    await new Promise((resolve, reject) => {
      ffmpeg(sourcePath)
        .videoCodec('libx264')
        .audioCodec('aac')
        .outputOptions([
          '-crf 23',           // 质量控制（23 是平衡质量和大小的好选择）
          '-preset medium',    // 编码速度预设
          '-movflags +faststart' // 优化网络播放
        ])
        .output(mp4Path)
        .on('end', () => {
          console.log(`✅ 视频转换成功: ${sourcePath} → ${mp4Path}`);
          convertedFiles.push(mp4Path);
          conversionSuccess = true;
          resolve();
        })
        .on('error', (err) => {
          console.error(`❌ 视频转换失败 ${sourcePath}: ${err.message}`);
          reject(err);
        })
        .run();
    });
  } catch (error) {
    console.error(`❌ 视频转换过程出错 ${sourcePath}: ${error.message}`);
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
  console.log("🖼️  开始媒体文件优化...");

  // 检查 origin 目录是否存在
  if (!(await dirExists(ORIGIN_DIR))) {
    console.log("📁 origin/ 目录不存在，跳过媒体文件优化");
    return;
  }

  // 优先检查 staged 的媒体文件
  const stagedMedia = getStagedMediaFiles();
  let imagesToProcess;
  let videosToProcess;

  if (stagedMedia && (stagedMedia.images.length > 0 || stagedMedia.videos.length > 0)) {
    console.log(`📋 检测到 ${stagedMedia.images.length} 个 staged 图片文件和 ${stagedMedia.videos.length} 个 staged 视频文件`);
    imagesToProcess = stagedMedia.images;
    videosToProcess = stagedMedia.videos;
  } else {
    console.log("🔍 扫描 origin/ 目录中需要处理的媒体文件...");
    // Fallback 到扫描全部文件（跳过已优化的）
    const result = await walkDirectory(ORIGIN_DIR);
    imagesToProcess = result.images;
    videosToProcess = result.videos;
  }

  if (imagesToProcess.length === 0 && videosToProcess.length === 0) {
    console.log("✨ 没有发现需要处理的媒体文件");
    return;
  }

  console.log(`📊 准备处理 ${imagesToProcess.length} 个图片文件和 ${videosToProcess.length} 个视频文件`);

  const convertedFiles = [];

  // 转换所有图片
  if (imagesToProcess.length > 0) {
    console.log("\n📸 开始处理图片文件...");
    for (const imagePath of imagesToProcess) {
      console.log(`\n🔄 处理图片: ${path.relative(process.cwd(), imagePath)}`);
      const newFiles = await convertImage(imagePath);
      convertedFiles.push(...newFiles);
    }
  }

  // 转换所有视频
  if (videosToProcess.length > 0) {
    console.log("\n🎥 开始处理视频文件...");
    for (const videoPath of videosToProcess) {
      console.log(`\n🔄 处理视频: ${path.relative(process.cwd(), videoPath)}`);
      const newFiles = await convertVideo(videoPath);
      convertedFiles.push(...newFiles);
    }
  }

  // 将转换后的文件添加到 Git
  if (convertedFiles.length > 0) {
    console.log(`\n📝 将 ${convertedFiles.length} 个优化文件添加到 Git...`);
    for (const filePath of convertedFiles) {
      await addToGit(filePath);
    }
  }

  console.log("\n🎉 媒体文件优化完成！");
  console.log(`✅ 成功转换: ${convertedFiles.length} 个文件`);
  console.log("💡 源文件已删除，只有优化后的 AVIF 和 MP4 文件会被提交");
}

// 运行主函数
main().catch(error => {
  console.error("💥 媒体文件优化过程中出错:", error);
  process.exit(1);
});
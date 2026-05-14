const fs = require('fs');
const path = require('path');

function extractMotionPhoto(inputPath) {
    const buffer = fs.readFileSync(inputPath);
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const outputDir = path.join(__dirname, 'extracted');

    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const mp4Signature = Buffer.from([0x66, 0x74, 0x79, 0x70]);

    let jpegEnd = -1;
    let mp4Start = -1;

    // 1. 先找到 MP4 视频数据的起始位置 (ftyp 特征码)
    for (let i = 0; i < buffer.length - 4; i++) {
        if (
            buffer[i] === mp4Signature[0] &&
            buffer[i + 1] === mp4Signature[1] &&
            buffer[i + 2] === mp4Signature[2] &&
            buffer[i + 3] === mp4Signature[3]
        ) {
            const boxSize = buffer.readUInt32BE(i - 4);
            if (boxSize > 0 && boxSize < buffer.length - i + 4) {
                mp4Start = i - 4;
                break;
            }
        }
    }

    // 2. 从 MP4 起始位置往前找最后一个 JPEG 结束标记 (FF D9)
    if (mp4Start > 0) {
        for (let i = Math.min(mp4Start, buffer.length - 2); i >= 0; i--) {
            if (buffer[i] === 0xFF && buffer[i + 1] === 0xD9) {
                jpegEnd = i + 2;
                break;
            }
        }
    }

    let hasCover = false;
    let hasVideo = false;

    if (jpegEnd > 0) {
        const coverPath = path.join(outputDir, `${fileName}_cover.jpg`);
        fs.writeFileSync(coverPath, buffer.slice(0, jpegEnd));
        hasCover = true;
        console.log(`  ✅ 封面图: ${fileName}_cover.jpg`);
    }

    if (mp4Start > 0) {
        const videoBuffer = buffer.slice(mp4Start);
        const ftypCheck = videoBuffer.slice(4, 8).toString('ascii');
        if (ftypCheck === 'ftyp') {
            const videoPath = path.join(outputDir, `${fileName}_video.mp4`);
            fs.writeFileSync(videoPath, videoBuffer);
            hasVideo = true;
            console.log(`  ✅ 视频: ${fileName}_video.mp4 (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        }
    }

    if (!hasVideo) {
        console.log(`  ⚠️  未找到视频数据，跳过`);
    }

    return { fileName, hasCover, hasVideo };
}

function scanImages() {
    const imagesDir = path.join(__dirname, 'images');
    if (!fs.existsSync(imagesDir)) {
        console.log('❌ 未找到 images 文件夹，请先创建并放入小米动态照片');
        process.exit(1);
    }

    const files = fs.readdirSync(imagesDir).filter(f => {
        const ext = path.extname(f).toLowerCase();
        return ext === '.jpg' || ext === '.jpeg';
    });

    if (files.length === 0) {
        console.log('❌ images 文件夹中没有找到 .jpg 文件');
        process.exit(1);
    }

    return files;
}

function generatePhotosJson(results) {
    const photos = results
        .filter(r => r.hasCover && r.hasVideo)
        .map((r, index) => ({
            id: index + 1,
            title: r.fileName,
            cover: `./extracted/${r.fileName}_cover.jpg`,
            video: `./extracted/${r.fileName}_video.mp4`,
        }));

    const outputPath = path.join(__dirname, 'extracted', 'photos.json');
    fs.writeFileSync(outputPath, JSON.stringify(photos, null, 2), 'utf-8');
    console.log(`\n📋 已生成照片清单: extracted/photos.json (${photos.length} 张)`);
    return photos;
}

function main() {
    console.log('📁 开始扫描 images 文件夹...\n');

    const files = scanImages();
    console.log(`📸 找到 ${files.length} 个文件，开始提取\n`);

    const results = [];

    files.forEach((file, index) => {
        const filePath = path.join(__dirname, 'images', file);
        console.log(`[${index + 1}/${files.length}] 处理: ${file}`);
        const result = extractMotionPhoto(filePath);
        results.push(result);
        console.log('');
    });

    const photos = generatePhotosJson(results);

    const successCount = photos.length;
    const failCount = results.length - successCount;

    console.log(`\n🎉 处理完成！成功: ${successCount} 张，失败: ${failCount} 张`);
    console.log(`📂 提取文件位于: extracted/`);
    console.log(`🌐 打开 index.html 即可查看`);
}

main();
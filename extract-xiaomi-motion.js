// extract-xiaomi-motion.js
// 用法: node extract-xiaomi-motion.js ./your-photo.jpg

const fs = require('fs');
const path = require('path');

function extractXiaomiMotionPhoto(inputPath) {
    const buffer = fs.readFileSync(inputPath);
    const fileName = path.basename(inputPath, path.extname(inputPath));
    const outputDir = path.join(path.dirname(inputPath), 'extracted');
    
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    // 小米动态照片的视频数据存储在 JPEG 的特定标记之后
    // 标记通常为 'Xiaomi Motion Photo' 或通过 MP4 ftyp 特征码定位
    const mp4Signature = Buffer.from([0x66, 0x74, 0x79, 0x70]); // 'ftyp' in ASCII
    
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
    
    // 3. 提取静态封面图 (JPEG 部分)
    if (jpegEnd > 0) {
        const coverPath = path.join(outputDir, `${fileName}_cover.jpg`);
        fs.writeFileSync(coverPath, buffer.slice(0, jpegEnd));
        console.log(`✅ 封面图已提取: ${coverPath}`);
    }
    
    // 4. 提取视频 (MP4 部分)
    if (mp4Start > 0) {
        const videoPath = path.join(outputDir, `${fileName}_video.mp4`);
        const videoBuffer = buffer.slice(mp4Start);
        
        // 验证是否为有效 MP4
        const ftypCheck = videoBuffer.slice(4, 8).toString('ascii');
        if (ftypCheck === 'ftyp') {
            fs.writeFileSync(videoPath, videoBuffer);
            console.log(`✅ 视频已提取: ${videoPath} (${(videoBuffer.length / 1024 / 1024).toFixed(2)} MB)`);
        } else {
            console.log('⚠️  未找到有效 MP4 视频流');
        }
    } else {
        console.log('⚠️  未找到视频数据，请确认这是小米动态照片');
    }
    
    return { coverDir: outputDir, fileName };
}

// 使用
const inputFile = process.argv[2];
if (!inputFile) {
    console.log('请指定文件路径: node extract-xiaomi-motion.js ./photo.jpg');
    process.exit(1);
}

extractXiaomiMotionPhoto(inputFile);
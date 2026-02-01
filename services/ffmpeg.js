const ffmpeg = require('fluent-ffmpeg');
const path = require('path');
const fs = require('fs');

// Configure FFmpeg path if needed
// ffmpeg.setFfmpegPath('/usr/local/bin/ffmpeg');
// ffmpeg.setFfprobePath('/usr/local/bin/ffprobe');

/**
 * Get video metadata using ffprobe
 * @param {string} filepath - Path to video file
 * @returns {Promise<Object>} Video metadata
 */
function getVideoInfo(filepath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filepath, (err, metadata) => {
      if (err) {
        reject(new Error(`Failed to probe video: ${err.message}`));
        return;
      }

      const videoStream = metadata.streams.find(s => s.codec_type === 'video');
      if (!videoStream) {
        reject(new Error('No video stream found'));
        return;
      }

      const duration = parseFloat(metadata.format.duration) || 0;
      const fps = eval(videoStream.r_frame_rate) || 30;
      const width = videoStream.width || 0;
      const height = videoStream.height || 0;
      const total_frames = Math.round(duration * fps);

      resolve({
        duration,
        fps,
        width,
        height,
        total_frames
      });
    });
  });
}

/**
 * Re-encode video to target FPS with appropriate codec
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {number} targetFps - Target frame rate
 * @returns {Promise<string>} Output path
 */
function reencodeVideo(inputPath, outputPath, targetFps) {
  return new Promise(async (resolve, reject) => {
    try {
      const info = await getVideoInfo(inputPath);
      const isHighRes = info.width > 1920 || info.height > 1080;
      
      // Select codec based on resolution
      const videoCodec = isHighRes ? 'libx265' : 'libx264';
      const crf = isHighRes ? 23 : 18;

      ffmpeg(inputPath)
        .videoCodec(videoCodec)
        .audioCodec('aac')
        .audioBitrate('192k')
        .fps(targetFps)
        .addOption('-crf', crf)
        .addOption('-preset', 'fast')
        .addOption('-vsync', 'cfr')
        .addOption('-af', 'aresample=async=1')
        .on('start', (command) => {
          console.log('FFmpeg command:', command);
        })
        .on('progress', (progress) => {
          if (progress.percent) {
            console.log(`Processing: ${progress.percent.toFixed(2)}%`);
          }
        })
        .on('end', () => {
          console.log('Re-encoding completed');
          resolve(outputPath);
        })
        .on('error', (err) => {
          reject(new Error(`Re-encoding failed: ${err.message}`));
        })
        .save(outputPath);
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * Extract video segment with frame-accurate cutting (re-encodes for precision)
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output video path
 * @param {number} startTime - Start time in seconds
 * @param {number} duration - Duration in seconds
 * @returns {Promise<string>} Output path
 */
function extractSegment(inputPath, outputPath, startTime, duration) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .inputOptions([
        '-ss', startTime.toFixed(6)
      ])
      .outputOptions([
        '-t', duration.toFixed(6),
        '-c:v', 'libx264',
        '-preset', 'fast',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-avoid_negative_ts', 'make_zero'
      ])
      .on('start', (command) => {
        console.log('FFmpeg extract command:', command);
      })
      .on('end', () => {
        console.log('Extraction completed');
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`Extraction failed: ${err.message}`));
      })
      .save(outputPath);
  });
}

/**
 * Generate frame thumbnail at specific timestamp
 * @param {string} inputPath - Input video path
 * @param {string} outputPath - Output thumbnail path
 * @param {number} timestamp - Time in seconds
 * @param {number} width - Thumbnail width (default: 320)
 * @returns {Promise<string>} Output path
 */
function generateThumbnail(inputPath, outputPath, timestamp, width = 320) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .screenshots({
        timestamps: [timestamp],
        filename: path.basename(outputPath),
        folder: path.dirname(outputPath),
        size: `${width}x?`
      })
      .on('end', () => {
        console.log('Thumbnail generated');
        resolve(outputPath);
      })
      .on('error', (err) => {
        reject(new Error(`Thumbnail generation failed: ${err.message}`));
      });
  });
}

/**
 * Detect scenes using FFmpeg's scene detection filter
 * @param {string} inputPath - Input video path
 * @param {number} threshold - Scene change threshold (0-1, default: 0.3)
 * @param {number} minSceneLength - Minimum scene length in frames
 * @param {number} fps - Video frame rate
 * @returns {Promise<Array>} Array of scene objects
 */
async function detectScenesFFmpeg(inputPath, threshold = 0.3, minSceneLength = 30, fps = 24) {
  return new Promise((resolve, reject) => {
    const scenes = [];
    let lastSceneFrame = 1;
    
    ffmpeg(inputPath)
      .addOption('-vf', `select='gt(scene,${threshold})',showinfo`)
      .addOption('-f', 'null')
      .addOption('-an')
      .on('stderr', (line) => {
        // Parse scene detection output
        const match = line.match(/pts:\s*(\d+)\s*pts_time:\s*([\d.]+)/);
        if (match) {
          const ptsTime = parseFloat(match[2]);
          const frameNum = Math.round(ptsTime * fps);
          
          // Only add scene if it meets minimum length
          if (frameNum - lastSceneFrame >= minSceneLength) {
            scenes.push({
              start_frame: lastSceneFrame,
              end_frame: frameNum,
              start_time: (lastSceneFrame - 1) / fps,
              end_time: ptsTime
            });
            lastSceneFrame = frameNum + 1;
          }
        }
      })
      .on('end', async () => {
        try {
          // Add final scene to end of video
          const info = await getVideoInfo(inputPath);
          if (info.total_frames - lastSceneFrame >= minSceneLength / 2 || scenes.length === 0) {
            scenes.push({
              start_frame: lastSceneFrame,
              end_frame: info.total_frames,
              start_time: (lastSceneFrame - 1) / fps,
              end_time: info.duration
            });
          }
          resolve(scenes);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        reject(new Error(`Scene detection failed: ${err.message}`));
      })
      .output('-')
      .run();
  });
}

/**
 * Alternative scene detection using frame-by-frame comparison
 * More accurate but slower than FFmpeg's scene filter
 * @param {string} inputPath - Input video path
 * @param {number} threshold - Scene change threshold (0-1, default: 0.3)
 * @param {number} minSceneLength - Minimum scene length in frames
 * @param {number} fps - Video frame rate
 * @returns {Promise<Array>} Array of scene objects
 */
async function detectScenesFrameBased(inputPath, threshold = 0.3, minSceneLength = 30, fps = 24) {
  return new Promise((resolve, reject) => {
    const frameDiffs = [];
    
    ffmpeg(inputPath)
      .addOption('-vf', 'select=not(mod(n\,2)),metadata=print:key=lavfi.select.scene')
      .addOption('-f', 'null')
      .addOption('-an')
      .on('stderr', (line) => {
        const match = line.match(/scene:([\d.]+)/);
        if (match) {
          frameDiffs.push(parseFloat(match[1]));
        }
      })
      .on('end', async () => {
        try {
          const info = await getVideoInfo(inputPath);
          const scenes = [];
          let lastSceneFrame = 1;
          
          // Process frame differences to find scene boundaries
          for (let i = 0; i < frameDiffs.length; i++) {
            const frameNum = i * 2 + 1; // Every 2nd frame
            
            if (frameDiffs[i] > threshold) {
              if (frameNum - lastSceneFrame >= minSceneLength) {
                scenes.push({
                  start_frame: lastSceneFrame,
                  end_frame: frameNum,
                  start_time: (lastSceneFrame - 1) / fps,
                  end_time: (frameNum - 1) / fps
                });
                lastSceneFrame = frameNum + 1;
              }
            }
          }
          
          // Add final scene
          if (info.total_frames - lastSceneFrame >= minSceneLength / 2 || scenes.length === 0) {
            scenes.push({
              start_frame: lastSceneFrame,
              end_frame: info.total_frames,
              start_time: (lastSceneFrame - 1) / fps,
              end_time: info.duration
            });
          }
          
          resolve(scenes);
        } catch (err) {
          reject(err);
        }
      })
      .on('error', (err) => {
        reject(new Error(`Scene detection failed: ${err.message}`));
      })
      .output('-')
      .run();
  });
}

module.exports = {
  getVideoInfo,
  reencodeVideo,
  extractSegment,
  generateThumbnail,
  detectScenesFFmpeg,
  detectScenesFrameBased
};
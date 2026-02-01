const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const ffmpeg = require('../services/ffmpeg');
const sceneDetector = require('../services/sceneDetector');
const fileManager = require('../services/fileManager');

const router = express.Router();

// Multer configuration for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, fileManager.UPLOAD_FOLDER);
  },
  filename: (req, file, cb) => {
    const safeName = fileManager.getSafeFilename(file.originalname);
    cb(null, `temp_${Date.now()}_${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 524288000 // 500MB
  },
  fileFilter: (req, file, cb) => {
    if (fileManager.isValidExtension(file.originalname)) {
      cb(null, true);
    } else {
      cb(new Error(`Invalid file type. Allowed: ${fileManager.ALLOWED_EXTENSIONS.join(', ')}`));
    }
  }
});

/**
 * POST /upload
 * Upload video, re-encode, and detect scenes
 */
router.post('/', upload.single('file'), async (req, res) => {
  let tempPath = null;
  
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    tempPath = req.file.path;
    const originalFilename = req.file.originalname;
    const targetFps = parseInt(req.body.target_fps) || 24;
    
    // Validate target FPS
    const validFps = [16, 24, 25, 30];
    if (!validFps.includes(targetFps)) {
      fs.unlinkSync(tempPath);
      return res.status(400).json({ error: `Invalid target FPS. Must be one of: ${validFps.join(', ')}` });
    }

    console.log(`Processing upload: ${originalFilename} -> ${targetFps}fps`);

    // Generate final filename
    const outputFilename = fileManager.generateUuidFilename(originalFilename);
    const outputPath = path.join(fileManager.UPLOAD_FOLDER, outputFilename);

    // Re-encode video
    await ffmpeg.reencodeVideo(tempPath, outputPath, targetFps);

    // Delete temp file
    fs.unlinkSync(tempPath);
    tempPath = null;

    // Get video info
    const videoInfo = await ffmpeg.getVideoInfo(outputPath);

    // Detect scenes
    const scenes = await sceneDetector.detectScenes(outputPath, {
      fps: targetFps
    });

    // Return response
    res.json({
      filename: outputFilename,
      original_filename: originalFilename,
      filepath: outputPath,
      video_info: videoInfo,
      scenes: scenes,
      target_fps: targetFps
    });

  } catch (err) {
    console.error('Upload error:', err);
    
    // Cleanup temp file if exists
    if (tempPath && fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
const express = require('express');
const path = require('path');
const sceneDetector = require('../services/sceneDetector');
const fileManager = require('../services/fileManager');
const ffmpeg = require('../services/ffmpeg');

const router = express.Router();

/**
 * POST /detect-scenes
 * Re-detect scenes with different parameters
 */
router.post('/', async (req, res) => {
  try {
    const { filepath, min_scene_length, threshold } = req.body;

    if (!filepath) {
      return res.status(400).json({ error: 'filepath is required' });
    }

    // Validate path is safe
    if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fileManager.fileExists(filepath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Get video info for fps
    const videoInfo = await ffmpeg.getVideoInfo(filepath);

    // Parse min_scene_length (no lower bound restriction)
    let minSceneLength = min_scene_length;
    if (minSceneLength !== undefined) {
      minSceneLength = parseFloat(minSceneLength);
      if (isNaN(minSceneLength) || minSceneLength < 0.1 || minSceneLength > 300) {
        return res.status(400).json({ error: 'min_scene_length must be between 0.1 and 300 seconds' });
      }
    }

    // Parse threshold (0-255, lower is more sensitive)
    let thresholdValue = threshold;
    if (thresholdValue !== undefined) {
      thresholdValue = parseFloat(thresholdValue);
      if (isNaN(thresholdValue) || thresholdValue < 1 || thresholdValue > 100) {
        return res.status(400).json({ error: 'threshold must be between 1 and 100' });
      }
    }

    console.log(`Re-detecting scenes: ${filepath}, min_length=${minSceneLength}s, threshold=${thresholdValue}`);

    // Detect scenes with new parameters
    const scenes = await sceneDetector.detectScenes(filepath, {
      minSceneLength: minSceneLength,
      threshold: thresholdValue,
      fps: videoInfo.fps
    });

    res.json({ scenes });

  } catch (err) {
    console.error('Scene detection error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
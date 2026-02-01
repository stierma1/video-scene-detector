const express = require('express');
const path = require('path');
const ffmpeg = require('../services/ffmpeg');
const fileManager = require('../services/fileManager');

const router = express.Router();

/**
 * GET /preview
 * Generate frame thumbnail at specific timestamp
 */
router.get('/', async (req, res) => {
  try {
    const { filepath, timestamp } = req.query;

    if (!filepath) {
      return res.status(400).json({ error: 'filepath is required' });
    }

    if (timestamp === undefined) {
      return res.status(400).json({ error: 'timestamp is required' });
    }

    const timeValue = parseFloat(timestamp);
    if (isNaN(timeValue)) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Validate path is safe
    if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fileManager.fileExists(filepath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Get video info to validate timestamp
    const videoInfo = await ffmpeg.getVideoInfo(filepath);
    const safeTimestamp = Math.max(0, Math.min(timeValue, videoInfo.duration - 0.001));

    // Generate preview filename
    const previewFilename = fileManager.generatePreviewFilename();
    const previewPath = path.join(fileManager.UPLOAD_FOLDER, previewFilename);

    // Generate thumbnail
    await ffmpeg.generateThumbnail(filepath, previewPath, safeTimestamp, 320);

    // Return preview info
    res.json({
      preview_url: `/preview_image/${previewFilename}`,
      timestamp: safeTimestamp,
      filename: previewFilename
    });

  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /preview
 * Alternative POST method for preview generation
 */
router.post('/', async (req, res) => {
  try {
    const { filepath, timestamp } = req.body;

    if (!filepath) {
      return res.status(400).json({ error: 'filepath is required' });
    }

    if (timestamp === undefined) {
      return res.status(400).json({ error: 'timestamp is required' });
    }

    const timeValue = parseFloat(timestamp);
    if (isNaN(timeValue)) {
      return res.status(400).json({ error: 'Invalid timestamp' });
    }

    // Validate path is safe
    if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fileManager.fileExists(filepath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Get video info to validate timestamp
    const videoInfo = await ffmpeg.getVideoInfo(filepath);
    const safeTimestamp = Math.max(0, Math.min(timeValue, videoInfo.duration - 0.001));

    // Generate preview filename
    const previewFilename = fileManager.generatePreviewFilename();
    const previewPath = path.join(fileManager.UPLOAD_FOLDER, previewFilename);

    // Generate thumbnail
    await ffmpeg.generateThumbnail(filepath, previewPath, safeTimestamp, 320);

    // Return preview info
    res.json({
      preview_url: `/preview_image/${previewFilename}`,
      timestamp: safeTimestamp,
      filename: previewFilename
    });

  } catch (err) {
    console.error('Preview error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
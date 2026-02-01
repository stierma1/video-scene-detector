const express = require('express');
const path = require('path');
const ffmpeg = require('../services/ffmpeg');
const sceneDetector = require('../services/sceneDetector');
const fileManager = require('../services/fileManager');

const router = express.Router();

const MAX_EXTRACT_FRAMES = 1000;

/**
 * POST /extract
 * Extract video segment by frame range
 */
router.post('/', async (req, res) => {
  try {
    const { filepath, start_frame, end_frame, fps, start_offset, extract_frames } = req.body;

    // Validate required fields
    if (!filepath) {
      return res.status(400).json({ error: 'filepath is required' });
    }

    if (start_frame === undefined || end_frame === undefined) {
      return res.status(400).json({ error: 'start_frame and end_frame are required' });
    }

    // Validate path is safe
    if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
      return res.status(403).json({ error: 'Invalid file path' });
    }

    if (!fileManager.fileExists(filepath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    // Get video info
    const videoInfo = await ffmpeg.getVideoInfo(filepath);
    const videoFps = fps || videoInfo.fps;

    // Parse frame numbers
    let startFrame = parseInt(start_frame);
    let endFrame = parseInt(end_frame);

    if (isNaN(startFrame) || isNaN(endFrame)) {
      return res.status(400).json({ error: 'Invalid frame numbers' });
    }

    // Apply offset to start frame if provided
    if (start_offset !== undefined) {
      const offset = parseInt(start_offset);
      if (!isNaN(offset)) {
        startFrame += offset;
      }
    }

    // Apply extract_frames limit if provided, otherwise use original end_frame
    if (extract_frames !== undefined && extract_frames !== null) {
      const extractLength = parseInt(extract_frames);
      if (!isNaN(extractLength) && extractLength > 0) {
        endFrame = startFrame + extractLength - 1;
      }
    } else {
      // No extract_frames specified, use original scene end frame
      // (start_frame was already adjusted by offset, so we need to calculate relative end)
      const originalSceneLength = parseInt(end_frame) - parseInt(start_frame);
      endFrame = startFrame + originalSceneLength;
    }

    // Validate frame range
    const validation = sceneDetector.validateFrameRange(startFrame, endFrame, videoInfo.total_frames);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.errors.join(', ') });
    }

    // Calculate time range
    const startTime = (startFrame - 1) / videoFps;
    const duration = (endFrame - startFrame + 1) / videoFps;

    console.log(`Extracting: frames ${startFrame}-${endFrame} (${startTime.toFixed(3)}s, ${duration.toFixed(3)}s duration)`);

    // Generate output filename
    const outputFilename = fileManager.generateSceneFilename();
    const outputPath = path.join(fileManager.OUTPUT_FOLDER, outputFilename);

    // Extract segment
    await ffmpeg.extractSegment(filepath, outputPath, startTime, duration);

    // Return download URL
    res.json({
      download_url: `/download/${outputFilename}`,
      filename: outputFilename,
      start_frame: startFrame,
      end_frame: endFrame,
      duration: parseFloat(duration.toFixed(3))
    });

  } catch (err) {
    console.error('Extraction error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
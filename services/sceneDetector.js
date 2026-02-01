const { spawn } = require('child_process');
const path = require('path');
const ffmpeg = require('./ffmpeg');

const DEFAULT_MIN_SCENE_LENGTH = 1.0; // seconds
const DEFAULT_THRESHOLD = 20.0; // Lower is more sensitive (0-255)
const PYTHON_SCRIPT = path.join(__dirname, 'scene_detector.py');

/**
 * Detect scenes using Python pyscenedetect
 * @param {string} inputPath - Path to video file
 * @param {Object} options - Detection options
 * @returns {Promise<Array>} Array of scene objects
 */
async function detectScenes(inputPath, options = {}) {
  const videoInfo = await ffmpeg.getVideoInfo(inputPath);
  const fps = options.fps || videoInfo.fps;
  
  // Min scene length in seconds (from slider)
  let minSceneLengthSec = options.minSceneLength || DEFAULT_MIN_SCENE_LENGTH;
  
  // If value seems to be in frames (> 300), convert to seconds
  if (minSceneLengthSec > 300) {
    minSceneLengthSec = minSceneLengthSec / fps;
  }
  
  // Clamp to reasonable range (0.5 - 60 seconds)
  minSceneLengthSec = Math.max(0.5, Math.min(60, minSceneLengthSec));
  
  // Threshold for pyscenedetect (0-255, lower is more sensitive)
  const threshold = options.threshold || DEFAULT_THRESHOLD;
  
  console.log(`Detecting scenes with pyscenedetect: threshold=${threshold}, minLength=${minSceneLengthSec}s, fps=${fps}`);
  
  return new Promise((resolve, reject) => {
    const pythonProcess = spawn('python3', [
      PYTHON_SCRIPT,
      inputPath,
      '--threshold', threshold.toString(),
      '--min-scene-length', minSceneLengthSec.toString(),
      '--fps', fps.toString()
    ]);
    
    let output = '';
    let errorOutput = '';
    
    pythonProcess.stdout.on('data', (data) => {
      output += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      errorOutput += data.toString();
    });
    
    pythonProcess.on('close', (code) => {
      if (code !== 0) {
        console.error('Python scene detection error:', errorOutput);
        // Fallback to FFmpeg scene detection
        console.log('Falling back to FFmpeg scene detection...');
        fallbackDetectScenes(inputPath, minSceneLengthSec, fps)
          .then(resolve)
          .catch(reject);
        return;
      }
      
      try {
        const result = JSON.parse(output);
        
        if (result.error) {
          console.error('Scene detection error:', result.error);
          // Fallback to FFmpeg
          fallbackDetectScenes(inputPath, minSceneLengthSec, fps)
            .then(resolve)
            .catch(reject);
          return;
        }
        
        resolve(result.scenes || []);
      } catch (err) {
        console.error('Failed to parse Python output:', err);
        // Fallback to FFmpeg
        fallbackDetectScenes(inputPath, minSceneLengthSec, fps)
          .then(resolve)
          .catch(reject);
      }
    });
    
    pythonProcess.on('error', (err) => {
      console.error('Failed to start Python process:', err);
      // Fallback to FFmpeg
      fallbackDetectScenes(inputPath, minSceneLengthSec, fps)
        .then(resolve)
        .catch(reject);
    });
  });
}

/**
 * Fallback scene detection using FFmpeg
 */
async function fallbackDetectScenes(inputPath, minSceneLengthSec, fps) {
  console.log('Using FFmpeg fallback for scene detection');
  const minSceneLengthFrames = Math.round(minSceneLengthSec * fps);
  const scenes = await ffmpeg.detectScenesFFmpeg(inputPath, 0.3, minSceneLengthFrames, fps);
  
  // Get video info for validation
  const videoInfo = await ffmpeg.getVideoInfo(inputPath);
  
  // Validate and clean up scene data
  return scenes.map((scene, index) => ({
    scene_number: index + 1,
    start_frame: Math.max(1, Math.round(scene.start_frame)),
    end_frame: Math.min(videoInfo.total_frames, Math.round(scene.end_frame)),
    start_time: Math.max(0, parseFloat(scene.start_time.toFixed(3))),
    end_time: Math.min(videoInfo.duration, parseFloat(scene.end_time.toFixed(3))),
    duration: parseFloat((scene.end_time - scene.start_time).toFixed(3))
  }));
}

/**
 * Validate frame range for extraction
 * @param {number} startFrame - Start frame number
 * @param {number} endFrame - End frame number
 * @param {number} totalFrames - Total frames in video
 * @returns {Object} Validation result
 */
function validateFrameRange(startFrame, endFrame, totalFrames) {
  const errors = [];
  
  if (!Number.isInteger(startFrame) || startFrame < 1) {
    errors.push('Start frame must be a positive integer');
  }
  
  if (!Number.isInteger(endFrame) || endFrame < 1) {
    errors.push('End frame must be a positive integer');
  }
  
  if (startFrame > endFrame) {
    errors.push('Start frame must be less than or equal to end frame');
  }
  
  if (endFrame > totalFrames) {
    errors.push(`End frame cannot exceed total frames (${totalFrames})`);
  }
  
  const frameCount = endFrame - startFrame + 1;
  if (frameCount > 1000) {
    errors.push('Cannot extract more than 1000 frames at once');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    frameCount
  };
}

/**
 * Calculate frame range with offset and length
 * @param {number} startFrame - Original start frame
 * @param {number} endFrame - Original end frame
 * @param {number} offset - Frame offset (can be negative)
 * @param {number} length - Desired length in frames
 * @param {number} totalFrames - Total frames in video
 * @returns {Object} New frame range
 */
function calculateFrameRange(startFrame, endFrame, offset, length, totalFrames) {
  // Apply offset
  let newStart = startFrame + offset;
  let newEnd = endFrame + offset;
  
  // Apply length constraint if specified
  if (length && length > 0) {
    newEnd = newStart + length - 1;
  }
  
  // Clamp to valid range
  newStart = Math.max(1, newStart);
  newEnd = Math.min(totalFrames, newEnd);
  
  // Ensure start <= end
  if (newStart > newEnd) {
    newEnd = newStart;
  }
  
  return {
    start_frame: newStart,
    end_frame: newEnd,
    frame_count: newEnd - newStart + 1
  };
}

module.exports = {
  detectScenes,
  validateFrameRange,
  calculateFrameRange,
  DEFAULT_MIN_SCENE_LENGTH
};
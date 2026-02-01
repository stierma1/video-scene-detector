const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const UPLOAD_FOLDER = path.resolve(process.env.UPLOAD_FOLDER || './uploads');
const OUTPUT_FOLDER = path.resolve(process.env.OUTPUT_FOLDER || './outputs');
const ALLOWED_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv', 'webm'];

// Ensure directories exist
function ensureDirectories() {
  [UPLOAD_FOLDER, OUTPUT_FOLDER].forEach(dir => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  });
}

/**
 * Validate file extension
 * @param {string} filename - Original filename
 * @returns {boolean} True if valid
 */
function isValidExtension(filename) {
  const ext = path.extname(filename).toLowerCase().slice(1);
  return ALLOWED_EXTENSIONS.includes(ext);
}

/**
 * Get safe filename - prevents directory traversal
 * @param {string} filename - Original filename
 * @returns {string} Safe filename
 */
function getSafeFilename(filename) {
  // Remove any path components and non-alphanumeric characters except dots
  return path.basename(filename).replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Generate UUID-based filename
 * @param {string} originalFilename - Original filename for extension
 * @returns {string} UUID filename
 */
function generateUuidFilename(originalFilename) {
  const ext = path.extname(originalFilename).toLowerCase() || '.mp4';
  return `${uuidv4()}${ext}`;
}

/**
 * Generate scene output filename
 * @returns {string} Scene filename
 */
function generateSceneFilename() {
  return `scene_${uuidv4()}.mp4`;
}

/**
 * Generate preview filename
 * @returns {string} Preview filename
 */
function generatePreviewFilename() {
  return `preview_${uuidv4()}.jpg`;
}

/**
 * Validate file path is within allowed directory
 * @param {string} filepath - File path to validate
 * @param {string} allowedDir - Allowed directory
 * @returns {boolean} True if path is safe
 */
function isPathSafe(filepath, allowedDir) {
  const resolvedPath = path.resolve(filepath);
  const resolvedAllowed = path.resolve(allowedDir);
  return resolvedPath.startsWith(resolvedAllowed);
}

/**
 * Delete file if it exists
 * @param {string} filepath - Path to file
 */
function deleteFile(filepath) {
  try {
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`Deleted file: ${filepath}`);
    }
  } catch (err) {
    console.error(`Error deleting file ${filepath}:`, err.message);
  }
}

/**
 * Clean up old files (optional maintenance function)
 * @param {string} directory - Directory to clean
 * @param {number} maxAgeHours - Maximum age in hours
 */
function cleanupOldFiles(directory, maxAgeHours = 24) {
  try {
    const files = fs.readdirSync(directory);
    const now = Date.now();
    const maxAge = maxAgeHours * 60 * 60 * 1000;

    files.forEach(file => {
      const filepath = path.join(directory, file);
      const stats = fs.statSync(filepath);
      
      if (now - stats.mtime.getTime() > maxAge) {
        deleteFile(filepath);
      }
    });
  } catch (err) {
    console.error('Cleanup error:', err.message);
  }
}

/**
 * Get file size in bytes
 * @param {string} filepath - Path to file
 * @returns {number} File size
 */
function getFileSize(filepath) {
  try {
    const stats = fs.statSync(filepath);
    return stats.size;
  } catch (err) {
    return 0;
  }
}

/**
 * Check if file exists
 * @param {string} filepath - Path to file
 * @returns {boolean} True if exists
 */
function fileExists(filepath) {
  return fs.existsSync(filepath);
}

module.exports = {
  UPLOAD_FOLDER,
  OUTPUT_FOLDER,
  ALLOWED_EXTENSIONS,
  ensureDirectories,
  isValidExtension,
  getSafeFilename,
  generateUuidFilename,
  generateSceneFilename,
  generatePreviewFilename,
  isPathSafe,
  deleteFile,
  cleanupOldFiles,
  getFileSize,
  fileExists
};
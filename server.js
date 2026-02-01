const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const fileManager = require('./services/fileManager');

// Initialize express
const app = express();
const PORT = process.env.PORT || 5000;

// Ensure directories exist
fileManager.ensureDirectories();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Routes
const uploadRoute = require('./routes/upload');
const scenesRoute = require('./routes/scenes');
const extractRoute = require('./routes/extract');
const previewRoute = require('./routes/preview');

app.use('/upload', uploadRoute);
app.use('/detect-scenes', scenesRoute);
app.use('/extract', extractRoute);
app.use('/preview', previewRoute);

/**
 * GET /
 * Serve main application UI
 */
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

/**
 * GET /download/:filename
 * Download extracted scene file
 */
app.get('/download/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename (prevent directory traversal)
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(fileManager.OUTPUT_FOLDER, filename);
  
  // Validate path is safe
  if (!fileManager.isPathSafe(filepath, fileManager.OUTPUT_FOLDER)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fileManager.fileExists(filepath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  
  res.download(filepath, filename, (err) => {
    if (err) {
      console.error('Download error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Download failed' });
      }
    }
  });
});

/**
 * GET /preview_image/:filename
 * Serve preview thumbnail image
 */
app.get('/preview_image/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(fileManager.UPLOAD_FOLDER, filename);
  
  // Validate path is safe
  if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fileManager.fileExists(filepath)) {
    return res.status(404).json({ error: 'Image not found' });
  }
  
  res.sendFile(path.resolve(filepath));
});

/**
 * GET /video/:filename
 * Stream uploaded/re-encoded video
 */
app.get('/video/:filename', (req, res) => {
  const filename = req.params.filename;
  
  // Validate filename
  if (!filename || filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  
  const filepath = path.join(fileManager.UPLOAD_FOLDER, filename);
  
  // Validate path is safe
  if (!fileManager.isPathSafe(filepath, fileManager.UPLOAD_FOLDER)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  if (!fileManager.fileExists(filepath)) {
    return res.status(404).json({ error: 'Video not found' });
  }
  
  // Support range requests for video streaming
  const stat = fs.statSync(filepath);
  const fileSize = stat.size;
  const range = req.headers.range;
  
  if (range) {
    const parts = range.replace(/bytes=/, '').split('-');
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
    const chunksize = end - start + 1;
    const file = fs.createReadStream(filepath, { start, end });
    
    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': chunksize,
      'Content-Type': 'video/mp4'
    };
    
    res.writeHead(206, head);
    file.pipe(res);
  } else {
    const head = {
      'Content-Length': fileSize,
      'Content-Type': 'video/mp4'
    };
    
    res.writeHead(200, head);
    fs.createReadStream(filepath).pipe(res);
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'File too large (max 500MB)' });
  }
  
  if (err.message && err.message.includes('Invalid file type')) {
    return res.status(400).json({ error: err.message });
  }
  
  res.status(500).json({ error: err.message || 'Internal server error' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`Video Scene Detector server running on http://localhost:${PORT}`);
  console.log(`Upload folder: ${path.resolve(fileManager.UPLOAD_FOLDER)}`);
  console.log(`Output folder: ${path.resolve(fileManager.OUTPUT_FOLDER)}`);
});

module.exports = app;
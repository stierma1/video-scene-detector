# Video Scene Detector - Project Requirements Document

## Project Overview

**Purpose**: A web-based video scene detection and extraction application that allows users to upload videos, automatically detect scene boundaries using machine learning, and extract specific video segments.

**Target Users**: Content creators, video editors, and video processors who need to identify and extract scene boundaries automatically.

**Original Stack**: Python 3.13 + Flask
**Target Stack**: Node.js

---

## Core Features

### 1. Video Upload & Processing
- Accept video uploads (max 500MB)
- Supported formats: MP4, AVI, MOV, MKV, WebM
- Re-encode videos to standardized frame rates (16, 24, 25, or 30 fps)
- Codec selection:
  - H.265 (libx265) for resolutions > 1080p (better compression for 4K)
  - H.264 (libx264) for standard resolutions (universal compatibility)
- Audio: AAC codec @ 192k bitrate with async resampling

### 2. Scene Detection
- Automatic scene boundary detection using content analysis
- Configurable minimum scene length (5-300 seconds, default: 30 frames)
- Returns list of scenes with:
  - Start/end frame numbers (1-indexed)
  - Start/end timestamps (seconds)

### 3. Scene Extraction
- Extract video segments by frame range
- Fast extraction using copy codec (no re-encoding)
- Support for start offset (including negative values)
- Configurable extraction length (1-1000 frames)
- Output: MP4 format

### 4. Preview Generation
- Generate frame thumbnails at specific timestamps
- JPEG format output
- Used for start/end frame preview before extraction

### 5. Video Metadata Extraction
- Duration (seconds)
- Frame rate (fps)
- Resolution (width x height)
- Total frame count

---

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET | Serve main application UI |
| `/upload` | POST | Upload video, re-encode, detect initial scenes |
| `/detect-scenes` | POST | Re-detect scenes with different parameters |
| `/extract` | POST | Extract scene segment to MP4 |
| `/download/<filename>` | GET | Download extracted scene file |
| `/preview` | GET/POST | Generate frame thumbnail at timestamp |
| `/preview_image/<filename>` | GET | Serve preview thumbnail image |
| `/video/<filename>` | GET | Stream uploaded/re-encoded video |

---

## API Request/Response Specifications

### POST /upload
**Request**: `multipart/form-data`
- `file`: Video file
- `target_fps`: Target frame rate (16, 24, 25, or 30)

**Response**:
```json
{
  "filename": "uuid-string.mp4",
  "original_filename": "user-video.mp4",
  "filepath": "/uploads/uuid-string.mp4",
  "video_info": {
    "duration": 120.5,
    "fps": 24.0,
    "width": 1920,
    "height": 1080,
    "total_frames": 2892
  },
  "scenes": [
    {
      "start_frame": 1,
      "end_frame": 240,
      "start_time": 0.0,
      "end_time": 10.0
    }
  ],
  "target_fps": 24
}
```

### POST /detect-scenes
**Request**: `application/json`
```json
{
  "filepath": "/uploads/uuid-string.mp4",
  "min_scene_length": 60
}
```

**Response**:
```json
{
  "scenes": [...]
}
```

### POST /extract
**Request**: `application/json`
```json
{
  "filepath": "/uploads/uuid-string.mp4",
  "start_frame": 100,
  "end_frame": 340,
  "fps": 24
}
```

**Response**:
```json
{
  "download_url": "/download/scene_uuid.mp4"
}
```

### GET/POST /preview
**Parameters**:
- `filepath`: Path to video file
- `timestamp`: Time in seconds for frame extraction

**Response**: JSON with preview image path or JPEG image

---

## Data Models

### Scene Object
```typescript
interface Scene {
  start_frame: number;   // 1-indexed frame number
  end_frame: number;     // 1-indexed frame number
  start_time: number;    // Seconds (float)
  end_time: number;      // Seconds (float)
}
```

### VideoInfo Object
```typescript
interface VideoInfo {
  duration: number;      // Total seconds
  fps: number;           // Frames per second
  width: number;         // Pixels
  height: number;        // Pixels
  total_frames: number;  // Total frame count
}
```

---

## File Storage

### Uploads Directory (`/uploads`)
- Re-encoded video files (UUID-based naming)
- Preview thumbnails (`preview_UUID.jpg`)

### Outputs Directory (`/outputs`)
- Extracted scene segments (`scene_UUID.mp4`)

### File Naming Convention
- Use UUID v4 (hex) for unique identifiers
- Pattern: `{uuid}.mp4` for videos
- Pattern: `preview_{uuid}.jpg` for thumbnails
- Pattern: `scene_{uuid}.mp4` for extracted segments

---

## Video Processing Specifications

### Re-encoding Parameters
| Parameter | H.264 (<=1080p) | H.265 (>1080p) |
|-----------|-----------------|----------------|
| Codec | libx264 | libx265 |
| CRF | 18 | 23 |
| Preset | fast | fast |
| Vsync | cfr | cfr |

### Audio Parameters
- Codec: AAC
- Bitrate: 192k
- Resampling: async (for frame rate changes)

### Scene Extraction Parameters
- Codec: copy (no re-encoding for speed)
- Container: MP4
- Flag: `-avoid_negative_ts make_zero` for MP4 compatibility

---

## External Dependencies

### System Requirements
- **FFmpeg**: Video processing, re-encoding, frame extraction
- **ffprobe**: Video metadata extraction (part of FFmpeg)

### Scene Detection Algorithm
The original uses **pyscenedetect's ContentDetector**:
- Analyzes visual content changes frame-by-frame
- Returns scene boundaries based on content similarity threshold

**Node.js Alternatives**:
1. Call Python script as subprocess (keep pyscenedetect)
2. Use `ffmpeg-scene-detect` npm package
3. Implement custom detection using frame comparison
4. Use TensorFlow.js for ML-based detection

---

## Frontend Requirements

### Technology
- Single-page application
- Vanilla JavaScript (no framework required)
- HTML5 video player with native controls
- CSS3 with modern features (glassmorphism, gradients)

### UI Components
1. **Upload Section**
   - Target FPS dropdown (16, 24, 25, 30)
   - Drag-and-drop zone with file input fallback
   - Supported formats display

2. **Video Player Section**
   - HTML5 video element
   - Interactive timeline with progress bar
   - Scene markers (visual indicators at boundaries)
   - Hover tooltips showing timestamps
   - Video metadata display

3. **Scene Detection Controls**
   - Min scene length slider (5-300 seconds)
   - Re-detect button

4. **Extract Section**
   - Selected scene info display
   - Start offset input (supports negative values)
   - Extract frames input (1-1000)
   - Start/end frame preview thumbnails
   - Extract button
   - Download link (after extraction)

5. **Sidebar Panel**
   - Toggleable scene list
   - Scene thumbnails
   - Scene metadata (number, timestamp, duration)
   - Click to select/navigate

### Design Specifications
- Dark theme with gradient backgrounds (#1a1a2e, #16213e)
- Accent colors: Cyan (#00d9ff), Lime (#00ff88), Red (#ff6b6b)
- Glassmorphism effects (backdrop blur)
- Responsive flex-based layout

---

## Security Requirements

### Input Validation
- File extension whitelist validation
- Sanitize filenames (prevent directory traversal)
- Validate numeric inputs (min_scene_length, frame numbers)
- Maximum file size enforcement (500MB)

### File Handling
- Use UUID-based filenames (hide original names)
- Validate file paths prevent traversal attacks
- Store files in designated directories only

---

## Node.js Technology Recommendations

### Suggested Packages
| Purpose | Package |
|---------|---------|
| Web Framework | Express.js |
| File Uploads | Multer |
| FFmpeg Integration | fluent-ffmpeg |
| UUID Generation | uuid |
| Path Security | path (built-in) |
| Image Processing | Sharp or Jimp |
| Scene Detection | ffmpeg-scene-detect or Python subprocess |

### Project Structure (Suggested)
```
/
├── server.js              # Express app entry point
├── package.json
├── routes/
│   ├── upload.js          # Upload and re-encode
│   ├── scenes.js          # Scene detection
│   ├── extract.js         # Scene extraction
│   └── preview.js         # Thumbnail generation
├── services/
│   ├── ffmpeg.js          # FFmpeg/ffprobe wrapper
│   ├── sceneDetector.js   # Scene detection logic
│   └── fileManager.js     # File storage utilities
├── public/
│   └── index.html         # Frontend (can reuse existing)
├── uploads/
└── outputs/
```

---

## Processing Flow

```
1. UPLOAD
   User uploads video → Save temp file → Re-encode to target FPS
   → Delete original → Run scene detection → Return metadata + scenes

2. DETECT (optional re-detection)
   User adjusts min_scene_length → Run scene detection with new params
   → Return updated scene list

3. EXTRACT
   User selects scene + offset + length → Calculate frame range
   → FFmpeg extract segment (copy codec) → Return download URL

4. DOWNLOAD
   User clicks download → Serve extracted MP4 file
```

---

## Performance Considerations

### Bottlenecks
1. Video re-encoding (slowest - depends on file size/duration)
2. Scene detection (ML-based analysis)
3. Frame extraction (fast with copy codec)

### Optimization Recommendations
1. Implement job queue for long-running operations (Bull, Agenda)
2. Add progress notifications via WebSockets
3. Use worker threads for FFmpeg operations
4. Stream video responses instead of full file loads
5. Cache scene detection results
6. Consider chunked uploads for large files

---

## Error Handling

### Expected Errors
- Invalid file format
- File too large
- FFmpeg processing failure
- Scene detection failure
- Invalid frame range
- File not found

### Response Format
```json
{
  "error": "Description of the error"
}
```

---

## Configuration

### Environment Variables (Recommended)
```
UPLOAD_FOLDER=./uploads
OUTPUT_FOLDER=./outputs
MAX_FILE_SIZE=524288000
PORT=5000
```

### Constants
```javascript
const ALLOWED_EXTENSIONS = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
const TARGET_FPS_OPTIONS = [16, 24, 25, 30];
const DEFAULT_MIN_SCENE_LENGTH = 30; // frames
const MAX_EXTRACT_FRAMES = 1000;
```

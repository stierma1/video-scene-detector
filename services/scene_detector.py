#!/usr/bin/env python3
"""
Scene detection script using pyscenedetect's ContentDetector.
Called as a subprocess from the Node.js application.
"""

import sys
import json
import argparse

try:
    from scenedetect import open_video, SceneManager
    from scenedetect.detectors import ContentDetector
    from scenedetect.backends import VideoStreamCv2
except ImportError:
    print(json.dumps({"error": "pyscenedetect not installed. Run: pip install scenedetect"}), file=sys.stderr)
    sys.exit(1)


def detect_scenes(video_path, threshold=30.0, min_scene_length_sec=0.5):
    """
    Detect scenes in a video using ContentDetector.
    
    Args:
        video_path: Path to the video file
        threshold: Threshold for content detection (0-255, default 30)
        min_scene_length_sec: Minimum scene length in seconds
    
    Returns:
        List of scene dictionaries with start/end frame and time info
    """
    try:
        # Open video
        video = open_video(video_path)
        
        # Get video properties
        fps = video.frame_rate
        total_frames = video.duration.get_frames() if hasattr(video.duration, 'get_frames') else int(video.duration * fps)
        duration = video.duration.get_seconds() if hasattr(video.duration, 'get_seconds') else video.duration
        
        # Convert min scene length from seconds to frames
        min_scene_length_frames = int(min_scene_length_sec * fps)
        
        # Ensure at least 1 frame
        if min_scene_length_frames < 1:
            min_scene_length_frames = 1
        
        # Create scene manager with ContentDetector
        scene_manager = SceneManager()
        scene_manager.add_detector(ContentDetector(
            threshold=threshold,
            min_scene_len=min_scene_length_frames
        ))
        
        # Detect scenes
        scene_manager.detect_scenes(video)
        
        # Get scene list
        scene_list = scene_manager.get_scene_list()
        
        # Convert to our format
        scenes = []
        for i, (start, end) in enumerate(scene_list, 1):
            start_frame = start.get_frames() if hasattr(start, 'get_frames') else int(start.get_seconds() * fps)
            end_frame = end.get_frames() if hasattr(end, 'get_frames') else int(end.get_seconds() * fps)
            start_time = start.get_seconds() if hasattr(start, 'get_seconds') else start
            end_time = end.get_seconds() if hasattr(end, 'get_seconds') else end
            
            scenes.append({
                "scene_number": i,
                "start_frame": start_frame + 1,  # 1-indexed
                "end_frame": end_frame,
                "start_time": round(start_time, 3),
                "end_time": round(end_time, 3),
                "duration": round(end_time - start_time, 3)
            })
        
        # If no scenes detected, treat whole video as one scene
        if not scenes:
            scenes.append({
                "scene_number": 1,
                "start_frame": 1,
                "end_frame": total_frames,
                "start_time": 0.0,
                "end_time": round(duration, 3),
                "duration": round(duration, 3)
            })
        
        return {
            "success": True,
            "scenes": scenes,
            "fps": fps,
            "total_frames": total_frames,
            "duration": duration
        }
        
    except Exception as e:
        return {"error": str(e)}


def main():
    parser = argparse.ArgumentParser(description='Detect scenes in a video')
    parser.add_argument('video_path', help='Path to the video file')
    parser.add_argument('--threshold', type=float, default=20.0, help='Detection threshold (0-255), lower is more sensitive')
    parser.add_argument('--min-scene-length', type=float, default=1.0, help='Minimum scene length in seconds')
    parser.add_argument('--fps', type=float, default=None, help='Video FPS (optional, for reference)')
    
    args = parser.parse_args()
    
    result = detect_scenes(args.video_path, args.threshold, args.min_scene_length)
    
    # Output as JSON
    print(json.dumps(result))


if __name__ == '__main__':
    main()
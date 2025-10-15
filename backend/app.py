import os
import platform
import shutil
import signal
import subprocess
import time
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
from pymongo import MongoClient
from bson.objectid import ObjectId
from dotenv import load_dotenv
from mimetypes import guess_type

load_dotenv()

app = Flask(__name__)
CORS(app)

HLS_OUTPUT_ROOT = os.getenv("HLS_OUTPUT_ROOT", os.path.join(os.getcwd(), "HLS_STREAMS"))
HLS_SERVER_URL = os.getenv("HLS_SERVER_URL", "http://localhost:5000/hls/")

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017/")
DB_NAME = "livestream_app"
COLLECTION_NAME = "overlays"

try:
    client = MongoClient(MONGO_URI)
    db = client[DB_NAME]
    overlays_collection = db[COLLECTION_NAME]
    client.admin.command('ping')
except Exception as e:
    print(f"ERROR: Could not connect to MongoDB. Check URI and service status: {e}")

active_streams = {}

def overlay_doc_to_json(doc):
    doc['_id'] = str(doc['_id'])
    return doc

def start_ffmpeg_conversion(rtsp_url, stream_id):
    ffmpeg_path = shutil.which("ffmpeg")
    if not ffmpeg_path:
        raise Exception("ffmpeg not found in PATH. Install ffmpeg or ensure it's available to the Flask process.")

    output_path = os.path.join(HLS_OUTPUT_ROOT, stream_id)
    os.makedirs(output_path, exist_ok=True)
    output_m3u8 = os.path.join(output_path, "index.m3u8")
    log_file = os.path.join(output_path, "ffmpeg.log")

    command = [
        ffmpeg_path,
        "-rtsp_transport", "tcp",
        "-i", rtsp_url,
        "-c:v", "libx264",
        "-preset", "veryfast",
        "-tune", "zerolatency",
        "-sc_threshold", "0",
        "-g", "30",
        "-keyint_min", "30",
        "-c:a", "aac",
        "-b:a", "96k",
        "-hls_time", "1",
        "-hls_list_size", "3",
        "-hls_flags", "delete_segments+append_list",
        "-hls_segment_filename", os.path.join(output_path, "seg_%03d.ts"),
        output_m3u8
    ]

    is_windows = platform.system() == "Windows"

    with open(log_file, "w", buffering=1) as f:
        if is_windows:
            process = subprocess.Popen(
                command,
                stdout=f,
                stderr=subprocess.STDOUT,
                creationflags=subprocess.CREATE_NEW_PROCESS_GROUP
            )
        else:
            process = subprocess.Popen(
                command,
                stdout=f,
                stderr=subprocess.STDOUT,
                preexec_fn=os.setsid
            )

    active_streams[stream_id] = process

    wait_timeout = 30.0
    poll_interval = 0.5
    elapsed = 0.0

    def has_segments():
        try:
            files = os.listdir(output_path)
            return any(fn.endswith('.ts') for fn in files)
        except Exception:
            return False

    while elapsed < wait_timeout:
        if os.path.exists(output_m3u8) and has_segments():
            return f"{HLS_SERVER_URL}{stream_id}/index.m3u8"
        time.sleep(poll_interval)
        elapsed += poll_interval

    tail_lines = []
    try:
        with open(log_file, "r", errors="ignore") as lf:
            tail_lines = lf.read().splitlines()[-60:]
    except Exception:
        tail_lines = ["Could not read ffmpeg log."]

    proc = active_streams.pop(stream_id, None)
    if proc:
        try:
            if is_windows:
                proc.terminate()
            else:
                os.killpg(os.getpgid(proc.pid), signal.SIGTERM)
            proc.wait(timeout=5)
        except Exception:
            try:
                proc.kill()
            except Exception:
                pass

    log_tail_text = "\n".join(tail_lines)
    raise Exception(f"FFmpeg failed to generate HLS playlist in {int(wait_timeout)} seconds. Check log: {log_file}\nLast log lines:\n{log_tail_text}")

def stop_ffmpeg_conversion(stream_id):
    process = active_streams.pop(stream_id, None)
    if process:
        try:
            is_windows = platform.system() == "Windows"
            if is_windows:
                process.terminate()
            else:
                os.killpg(os.getpgid(process.pid), signal.SIGTERM)
            process.wait(timeout=5)
        except subprocess.TimeoutExpired:
            try:
                process.kill()
            except Exception:
                pass
        except Exception as e:
            print(f"Error stopping stream {stream_id}: {e}")
            return False
        return True
    return False

@app.route('/hls/<path:subpath>')
def serve_hls(subpath):
    file_path = os.path.join(HLS_OUTPUT_ROOT, subpath)
    if not os.path.exists(file_path):
        return jsonify({"error": f"File not found: {file_path}"}), 404

    directory = os.path.dirname(file_path)
    filename = os.path.basename(file_path)
    mime_type, _ = guess_type(filename)

    response = make_response(send_from_directory(directory, filename))
    response.headers['Content-Type'] = mime_type or 'application/octet-stream'
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
    response.headers['Access-Control-Allow-Methods'] = 'GET, OPTIONS'
    return response

@app.route('/api/stream/start', methods=['POST'])
def start_stream():
    data = request.get_json() or {}
    rtsp_url = data.get('rtspUrl')

    if not rtsp_url or not isinstance(rtsp_url, str) or not rtsp_url.strip():
        return jsonify({"error": "Invalid RTSP URL"}), 400

    stream_id = f"stream_{os.urandom(4).hex()}"
    try:
        hls_url = start_ffmpeg_conversion(rtsp_url, stream_id)
        return jsonify({"message": "Streaming initiated", "streamId": stream_id, "hlsUrl": hls_url})
    except Exception as e:
        print(f"start_stream error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/api/stream/stop/<stream_id>', methods=['POST'])
def stop_stream(stream_id):
    if stop_ffmpeg_conversion(stream_id):
        return jsonify({"message": f"Stream {stream_id} stopped."})
    return jsonify({"error": f"Stream {stream_id} not found or failed to stop."}), 404

@app.route('/api/overlays', methods=['POST'])
def create_overlay():
    data = request.get_json() or {}
    required_fields = ['name', 'content', 'position', 'size', 'type']
    if not all(k in data for k in required_fields):
        return jsonify({"error": "Missing required fields"}), 400

    if not isinstance(data['position'], dict) or not isinstance(data['size'], dict):
        return jsonify({"error": "Invalid position or size format"}), 400

    result = overlays_collection.insert_one(data)
    return jsonify({"message": "Overlay created", "id": str(result.inserted_id)}), 201

@app.route('/api/overlays', methods=['GET'])
def get_overlays():
    overlays = list(overlays_collection.find({}))
    return jsonify([overlay_doc_to_json(o) for o in overlays])

@app.route('/api/overlays/<overlay_id>', methods=['PUT'])
def update_overlay(overlay_id):
    data = request.get_json() or {}
    data.pop('_id', None)
    try:
        result = overlays_collection.update_one({'_id': ObjectId(overlay_id)}, {'$set': data})
        if result.matched_count == 0:
            return jsonify({"error": "Overlay not found"}), 404
        return jsonify({"message": "Overlay updated"})
    except Exception as e:
        print(f"Error updating overlay {overlay_id}: {e}")
        return jsonify({"error": "Invalid Overlay ID"}), 400

@app.route('/api/overlays/<overlay_id>', methods=['DELETE'])
def delete_overlay(overlay_id):
    try:
        result = overlays_collection.delete_one({'_id': ObjectId(overlay_id)})
        if result.deleted_count == 0:
            return jsonify({"error": "Overlay not found"}), 404
        return jsonify({"message": "Overlay deleted"})
    except Exception as e:
        print(f"Error deleting overlay {overlay_id}: {e}")
        return jsonify({"error": "Invalid Overlay ID"}), 400

if __name__ == '__main__':
    print("--- ATTEMPTING TO START FLASK SERVER ---")
    os.makedirs(HLS_OUTPUT_ROOT, exist_ok=True)
    app.run(debug=True, port=int(os.getenv("PORT", 5000)))

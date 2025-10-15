import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import Hls from 'hls.js';
import './App.css';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000/api';

function useDebouncedValue(value, delay = 500) {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const handler = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(handler);
    }, [value, delay]);
    return debounced;
}

const VideoPlayer = ({ hlsUrl, overlays, videoRef }) => {
    useEffect(() => {
        if (!hlsUrl || !videoRef.current) return;
        const video = videoRef.current;
        let hls;

        if (Hls.isSupported()) {
            hls = new Hls();
            hls.loadSource(hlsUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                if (video && typeof video.play === 'function') {
                    video.play().catch(e => console.log("Autoplay blocked:", e));
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            video.src = hlsUrl;
            video.addEventListener('loadedmetadata', () => {
                if (video && typeof video.play === 'function') {
                    video.play().catch(e => console.log("Autoplay blocked:", e));
                }
            });
        }

        return () => {
            if (hls) hls.destroy();
            else video.src = '';
        };
    }, [hlsUrl, videoRef]);

    return (
        <div className="video-container" style={{ position: 'relative' }}>
            <video
                ref={videoRef}
                controls
                autoPlay
                muted
                playsInline
                crossOrigin="anonymous"
                style={{ width: '100%', height: '100%' }}
            />

            {hlsUrl && overlays.map((overlay, index) => {
                if (overlay.type === 'logo') {
                    return (
                        <img
                            key={overlay._id || index}
                            src={
                                overlay.content.startsWith('http') || overlay.content.startsWith('data:')
                                    ? overlay.content
                                    : `data:image/png;base64,${overlay.content}`
                            }
                            alt={overlay.name}
                            style={{
                                position: 'absolute',
                                top: `${overlay.position.y}px`,
                                left: `${overlay.position.x}px`,
                                width: `${overlay.size.width}px`,
                                height: `${overlay.size.height}px`,
                                pointerEvents: 'none',
                            }}
                            onError={(e) => (e.target.style.display = 'none')}
                        />
                    );
                } else {
                    return (
                        <div
                            key={overlay._id || index}
                            style={{
                                position: 'absolute',
                                top: `${overlay.position.y}px`,
                                left: `${overlay.position.x}px`,
                                display: 'inline-flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: overlay.color || 'white',
                                fontSize: '16px',
                                fontWeight: 'bold',
                                textAlign: 'center',
                                pointerEvents: 'none',
                                whiteSpace: 'nowrap',
                            }}
                        >
                            {overlay.content}
                        </div>
                    );
                }
            })}
        </div>
    );
};



const OverlayManager = ({ overlays, setOverlays, selectedOverlay, setSelectedOverlay, fetchOverlays }) => {
    const [formData, setFormData] = useState({
    name: '',
    content: '',
    type: 'text',
    color: '#ffffff', 
    position: { x: '', y: '' },
    size: { width: '', height: '' }
});


    useEffect(() => {
        if (selectedOverlay) {
            setFormData({
                name: selectedOverlay.name || '',
                content: selectedOverlay.content || '',
                type: selectedOverlay.type || 'text',
                position: {
                    x: selectedOverlay.position?.x ?? '',
                    y: selectedOverlay.position?.y ?? ''
                },
                size: {
                    width: selectedOverlay.size?.width ?? '',
                    height: selectedOverlay.size?.height ?? ''
                }
            });
        } else {
            setFormData({
                name: '',
                content: '',
                type: 'text',
                position: { x: '', y: '' },
                size: { width: '', height: '' }
            });
        }
    }, [selectedOverlay]);
    

    const handleChange = (e) => {
        const { name, value } = e.target;
        if (['x', 'y'].includes(name)) {
            setFormData(prev => ({ ...prev, position: { ...prev.position, [name]: value } }));
        } else if (['width', 'height'].includes(name)) {
            setFormData(prev => ({ ...prev, size: { ...prev.size, [name]: value } }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const payload = {
            ...formData,
            position: { x: parseInt(formData.position.x), y: parseInt(formData.position.y) },
            size: { width: parseInt(formData.size.width), height: parseInt(formData.size.height) },
            color: formData.color 
        };

            if (selectedOverlay && selectedOverlay._id) {
                delete payload._id;
                await axios.put(`${API_BASE_URL}/overlays/${selectedOverlay._id}`, payload);
                alert('Overlay updated successfully!');
            } else {
                await axios.post(`${API_BASE_URL}/overlays`, payload);
                alert('Overlay created successfully!');
            }
            fetchOverlays();
            setSelectedOverlay(null);
        } catch (error) {
            console.error('Error saving overlay:', error.response?.data || error);
            alert('Failed to save overlay. Check console.');
        }
    };

    const handleDelete = async () => {
        if (!selectedOverlay || !window.confirm(`Are you sure you want to delete ${selectedOverlay.name}?`)) return;
        try {
            await axios.delete(`${API_BASE_URL}/overlays/${selectedOverlay._id}`);
            alert('Overlay deleted successfully!');
            fetchOverlays();
            setSelectedOverlay(null);
        } catch (error) {
            console.error('Error deleting overlay:', error);
            alert('Failed to delete overlay. Check console.');
        }
    };

    return (
        <div className="overlay-manager-panel">
            <h3>{selectedOverlay ? `Edit ${selectedOverlay.name}` : 'Create New Overlay'}</h3>
            <form onSubmit={handleSubmit}>
                <input
                    name="name"
                    value={formData.name}
                    onChange={handleChange}
                    placeholder="Overlay Name"
                    required
                />
                <input
                    name="content"
                    value={formData.content}
                    onChange={handleChange}
                    placeholder={formData.type === 'logo' ? "Logo URL or Base64" : "Text Content"}
                    required
                />
                <select name="type" value={formData.type} onChange={handleChange}>
                    <option value="text">Text Overlay</option>
                    <option value="logo">Logo/Image Overlay</option>
                </select>

                <input
                    name="x"
                    type="number"
                    value={formData.position.x}
                    onChange={handleChange}
                    placeholder="X Position"
                />
                <input
                    name="y"
                    type="number"
                    value={formData.position.y}
                    onChange={handleChange}
                    placeholder="Y Position"
                />
                <input
                    name="width"
                    type="number"
                    value={formData.size.width}
                    onChange={handleChange}
                    placeholder="Width"
                />
                <input
                    name="height"
                    type="number"
                    value={formData.size.height}
                    onChange={handleChange}
                    placeholder="Height"
                />
                {formData.type === 'text' && (
    <input
        type="color"
        name="color"
        value={formData.color}
        onChange={handleChange}
        title="Choose text color"
        style={{ marginTop: '5px' }}
    />
)}

                <button type="submit">{selectedOverlay ? 'Update Overlay' : 'Create Overlay'}</button>
                {selectedOverlay && (
                    <>
                        <button type="button" onClick={handleDelete} className="delete-btn">Delete</button>
                        <button type="button" onClick={() => setSelectedOverlay(null)}>Clear/New</button>
                    </>
                )}
            </form>
            


            <h4>Saved Overlays</h4>
            <div className="overlay-list">
                {overlays.map(o => (
                    <button
                        key={o._id}
                        onClick={() => setSelectedOverlay(o)}
                        className={selectedOverlay?._id === o._id ? 'selected' : ''}
                    >
                        {o.name} ({o.type})
                    </button>
                ))}
            </div>
        </div>
    );
};


function App() {
    const videoRef = useRef(null);
    const [inputRtspUrl, setInputRtspUrl] = useState('');
    const debouncedRtspUrl = useDebouncedValue(inputRtspUrl); 
    const [hlsUrl, setHlsUrl] = useState(null);
    const [streamId, setStreamId] = useState(null);
    const [loading, setLoading] = useState(false);
    const [overlays, setOverlays] = useState([]);
    const [selectedOverlay, setSelectedOverlay] = useState(null);

    const fetchOverlays = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/overlays`);
            setOverlays(response.data);
        } catch (error) {
            console.error('Error fetching overlays:', error);
        }
    };

    useEffect(() => {
        fetchOverlays();
    }, []);

    const handleStartStream = async () => {
        if (streamId) handleStopStream();
        setLoading(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/stream/start`, { rtspUrl: debouncedRtspUrl });
            setHlsUrl(response.data.hlsUrl);
            setStreamId(response.data.streamId);
        } catch (error) {
            console.error('Error starting stream:', error.response?.data || error);
            alert('Failed to start stream. Check console and Flask server logs.');
        } finally {
            setLoading(false);
                    }
    };

    const handleStopStream = async () => {
        if (!streamId) return;
        try {
            await axios.post(`${API_BASE_URL}/stream/stop/${streamId}`);
        } catch (error) {
            console.warn('Could not confirm stream stop on server:', error);
        } finally {
            setHlsUrl(null);
            setStreamId(null);
        }
    };

    return (
        <div className="app-container">
            <header>
                <h1>RTSP Livestream with Custom Overlays</h1>
                <p>Tech Stack: Python (Flask), MongoDB, React, FFmpeg (RTSP-to-HLS)</p>
            </header>
            <div className="content-layout">
                <div className="stream-section">
                    <h2>Live View</h2>
                    <div className="stream-controls">
                        <input
                            type="text"
                            placeholder="Enter RTSP URL"
                            value={inputRtspUrl}
                            onChange={(e) => setInputRtspUrl(e.target.value)}
                            disabled={loading}
                        />
                        <button onClick={hlsUrl ? handleStopStream : handleStartStream} disabled={loading || !debouncedRtspUrl}>
                            {loading ? 'Processing...' : hlsUrl ? 'Stop Stream' : 'Start Stream'}
                        </button>
                    </div>
                    <VideoPlayer hlsUrl={hlsUrl} overlays={overlays} videoRef={videoRef} />
                    {!hlsUrl && <p className="placeholder-text">Enter an RTSP URL and click Start to begin the livestream.</p>}
                </div>
                <div className="overlay-section">
                    <h2>Overlay Options (CRUD)</h2>
                    <OverlayManager 
                        overlays={overlays} 
                        setOverlays={setOverlays}
                        selectedOverlay={selectedOverlay}
                        setSelectedOverlay={setSelectedOverlay}
                        fetchOverlays={fetchOverlays}
                    />
                </div>
            </div>
        </div>
    );
}

export default App;


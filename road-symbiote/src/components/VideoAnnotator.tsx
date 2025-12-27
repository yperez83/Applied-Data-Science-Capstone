import React, { useRef, useState } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import Konva from 'konva';

interface Point {
  x: number;
  y: number;
  id: string;
}

interface Shape {
  id: string;
  class: string;
  color: string;
  points: Point[];
}

interface ClassDef {
  name: string;
  color: string;
}

const CLASSES: ClassDef[] = [
  { name: 'Lane Marker', color: 'cyan' },
  { name: 'Road Edge', color: 'red' },
  { name: 'Stop Line', color: 'yellow' },
  { name: 'Obstacle', color: 'orange' },
];

const VideoAnnotator: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [currentPoints, setCurrentPoints] = useState<Point[]>([]);
  const [activeClass, setActiveClass] = useState<ClassDef>(CLASSES[0]);
  const [videoDimensions, setVideoDimensions] = useState({ width: 640, height: 360 });
  const [savePath, setSavePath] = useState<string>('');
  const [activeTool, setActiveTool] = useState<'polyline' | 'magic_wand'>('polyline');
  const [isLoading, setIsLoading] = useState(false);

  // Use a sample video
  const videoSrc = "https://upload.wikimedia.org/wikipedia/commons/transcoded/c/c0/Big_Buck_Bunny_4K.webm/Big_Buck_Bunny_4K.webm.480p.vp9.webm";

  const handleVideoLoadedMetadata = () => {
    if (videoRef.current) {
      setVideoDimensions({
        width: videoRef.current.videoWidth,
        height: videoRef.current.videoHeight,
      });
    }
  };

  const handleStageClick = async (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If we clicked on a circle, don't add a new point
    if (e.target instanceof Konva.Circle) {
      return;
    }

    const stage = e.target.getStage();
    if (!stage) return;
    const pointerPosition = stage.getPointerPosition();
    if (!pointerPosition) return;

    if (activeTool === 'magic_wand') {
        // Magic Wand Logic
        if (isLoading) return;

        if (videoRef.current) {
            videoRef.current.pause();
            setIsLoading(true);

            try {
                // Capture frame
                const canvas = document.createElement('canvas');
                canvas.width = videoRef.current.videoWidth;
                canvas.height = videoRef.current.videoHeight;
                const ctx = canvas.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(async (blob) => {
                        if (blob) {
                            const formData = new FormData();
                            formData.append('file', blob, 'frame.jpg');
                            formData.append('prompt_coords', `${pointerPosition.x},${pointerPosition.y}`);

                            try {
                                const response = await fetch('http://localhost:8000/magic_segment', {
                                    method: 'POST',
                                    body: formData,
                                });

                                if (response.ok) {
                                    const pointsData = await response.json();
                                    // Convert to our Point format
                                    const newPoints: Point[] = pointsData.map((p: {x: number, y: number}, index: number) => ({
                                        x: p.x,
                                        y: p.y,
                                        id: `${Date.now()}-${index}`
                                    }));

                                    const newShape: Shape = {
                                        id: Date.now().toString(),
                                        class: activeClass.name,
                                        color: activeClass.color,
                                        points: newPoints,
                                    };

                                    setShapes((prev) => [...prev, newShape]);
                                } else {
                                    console.error('Magic segment failed:', await response.text());
                                    alert('Magic segment failed. See console.');
                                }
                            } catch (err) {
                                console.error('API Error:', err);
                                alert(`API Error: ${err}`);
                            } finally {
                                setIsLoading(false);
                            }
                        }
                    }, 'image/jpeg');
                }
            } catch (e) {
                console.error("Error capturing frame:", e);
                setIsLoading(false);
            }
        }

    } else {
        // Polyline Logic
        setCurrentPoints([
          ...currentPoints,
          {
            x: pointerPosition.x,
            y: pointerPosition.y,
            id: Date.now().toString(),
          },
        ]);
    }
  };

  const handleFinishShape = () => {
    if (currentPoints.length === 0) return;

    const newShape: Shape = {
      id: Date.now().toString(),
      class: activeClass.name,
      color: activeClass.color,
      points: currentPoints,
    };

    setShapes([...shapes, newShape]);
    setCurrentPoints([]);
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>, pointId: string, shapeId?: string) => {
    const { x, y } = e.target.attrs;

    if (shapeId) {
      // Modifying a completed shape
      setShapes(shapes.map(shape => {
        if (shape.id === shapeId) {
          return {
            ...shape,
            points: shape.points.map(p => p.id === pointId ? { ...p, x, y } : p)
          };
        }
        return shape;
      }));
    } else {
      // Modifying the current shape being drawn
      setCurrentPoints(currentPoints.map(p => p.id === pointId ? { ...p, x, y } : p));
    }
  };

  const handleLogData = () => {
    const exportData = shapes.map(shape => ({
      id: shape.id,
      class: shape.class,
      points: shape.points.map(({ x, y }) => ({ x, y }))
    }));
    console.log(JSON.stringify(exportData, null, 2));
  };

  const handleSaveData = async () => {
    if (!savePath) {
      alert("Please enter a save location.");
      return;
    }

    const exportData = shapes.map(shape => ({
      id: shape.id,
      class: shape.class,
      points: shape.points.map(({ x, y }) => ({ x, y }))
    }));

    const payload = {
        target_directory: savePath,
        file_name: 'video_01_data.json',
        shapes: exportData
    };

    try {
        const response = await fetch('http://localhost:8000/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        if (response.ok) {
            const result = await response.json();
            alert(`Success! Data saved to: ${result.path}`);
        } else {
            const errorText = await response.text();
            alert(`Error saving data: ${errorText}`);
        }
    } catch (error) {
        alert(`Network error: ${error}`);
    }
  };

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ position: 'relative', width: videoDimensions.width, height: videoDimensions.height }}>
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', display: 'block' }}
          onLoadedMetadata={handleVideoLoadedMetadata}
        />
        <Stage
          width={videoDimensions.width}
          height={videoDimensions.height}
          style={{ position: 'absolute', top: 0, left: 0, cursor: activeTool === 'magic_wand' ? (isLoading ? 'wait' : 'crosshair') : 'default' }}
          onClick={handleStageClick}
        >
          <Layer>
            {/* Render completed shapes */}
            {shapes.map((shape) => (
              <React.Fragment key={shape.id}>
                <Line
                  points={shape.points.flatMap((p) => [p.x, p.y])}
                  stroke={shape.color}
                  strokeWidth={2}
                  tension={0}
                  closed={true}
                />
                {shape.points.map((point) => (
                  <Circle
                    key={point.id}
                    x={point.x}
                    y={point.y}
                    radius={3}
                    fill="white"
                    stroke={shape.color}
                    strokeWidth={1}
                    draggable
                    onDragMove={(e) => handleDragMove(e, point.id, shape.id)}
                  />
                ))}
              </React.Fragment>
            ))}

            {/* Render current shape being drawn */}
            {currentPoints.length > 0 && (
               <React.Fragment>
                <Line
                  points={currentPoints.flatMap((p) => [p.x, p.y])}
                  stroke={activeClass.color}
                  strokeWidth={2}
                  tension={0}
                  closed={false}
                />
                {currentPoints.map((point) => (
                  <Circle
                    key={point.id}
                    x={point.x}
                    y={point.y}
                    radius={5}
                    fill="white"
                    stroke={activeClass.color}
                    strokeWidth={2}
                    draggable
                    onDragMove={(e) => handleDragMove(e, point.id)}
                  />
                ))}
              </React.Fragment>
            )}
          </Layer>
        </Stage>
      </div>

      <div style={{ padding: '20px', background: '#f0f0f0', borderRadius: '8px', minWidth: '200px' }}>
        <h3>Toolbar (v2.1 AI)</h3>

        <div style={{ marginBottom: '20px', borderBottom: '1px solid #ccc', paddingBottom: '10px' }}>
            <h4>Tools</h4>
            <div style={{ display: 'flex', gap: '5px' }}>
                <button
                    onClick={() => setActiveTool('polyline')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: activeTool === 'polyline' ? '#2196F3' : 'white',
                        color: activeTool === 'polyline' ? 'white' : 'black',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Polyline
                </button>
                <button
                    onClick={() => setActiveTool('magic_wand')}
                    style={{
                        flex: 1,
                        padding: '8px',
                        backgroundColor: activeTool === 'magic_wand' ? '#9C27B0' : 'white',
                        color: activeTool === 'magic_wand' ? 'white' : 'black',
                        border: '1px solid #ccc',
                        borderRadius: '4px',
                        cursor: 'pointer'
                    }}
                >
                    Magic Wand ✨
                </button>
            </div>
            {activeTool === 'magic_wand' && <p style={{fontSize: '0.8em', color: '#666'}}>Click on the video to auto-segment.</p>}
        </div>

        <div style={{ marginBottom: '20px' }}>
          <h4>Classes</h4>
          {CLASSES.map((cls) => (
            <button
              key={cls.name}
              onClick={() => setActiveClass(cls)}
              style={{
                display: 'block',
                width: '100%',
                padding: '10px',
                marginBottom: '5px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                backgroundColor: activeClass.name === cls.name ? '#e0e0e0' : 'white',
                borderLeft: `5px solid ${cls.color}`,
                cursor: 'pointer',
                textAlign: 'left'
              }}
            >
              {cls.name}
            </button>
          ))}
        </div>

        <div style={{ marginBottom: '20px' }}>
            <button
                onClick={handleFinishShape}
                disabled={currentPoints.length === 0}
                style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#4CAF50',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: currentPoints.length === 0 ? 'not-allowed' : 'pointer',
                    opacity: currentPoints.length === 0 ? 0.6 : 1
                }}
            >
                Finish Shape
            </button>
        </div>

        <div style={{ marginBottom: '20px', borderTop: '1px solid #ccc', paddingTop: '10px' }}>
            <label style={{ display: 'block', marginBottom: '5px', fontWeight: 'bold' }}>Save Location</label>
            <input
                type="text"
                value={savePath}
                onChange={(e) => setSavePath(e.target.value)}
                placeholder="E.g., /tmp/road_data"
                style={{
                    width: '100%',
                    padding: '8px',
                    marginBottom: '10px',
                    borderRadius: '4px',
                    border: '1px solid #ccc',
                    boxSizing: 'border-box'
                }}
            />
            <button
                onClick={handleSaveData}
                style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#FF9800',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Save Data
            </button>
        </div>

        <div>
            <button
                onClick={handleLogData}
                style={{
                    width: '100%',
                    padding: '10px',
                    backgroundColor: '#2196F3',
                    color: 'white',
                    border: 'none',
                    borderRadius: '4px',
                    cursor: 'pointer'
                }}
            >
                Log Data to Console
            </button>
        </div>
      </div>
    </div>
  );
};

export default VideoAnnotator;

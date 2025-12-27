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

  const handleStageClick = (e: Konva.KonvaEventObject<MouseEvent>) => {
    // If we clicked on a circle, don't add a new point
    if (e.target instanceof Konva.Circle) {
      return;
    }

    const stage = e.target.getStage();
    if (stage) {
      const pointerPosition = stage.getPointerPosition();
      if (pointerPosition) {
        setCurrentPoints([
          ...currentPoints,
          {
            x: pointerPosition.x,
            y: pointerPosition.y,
            id: Date.now().toString(),
          },
        ]);
      }
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

  return (
    <div style={{ display: 'flex', gap: '20px' }}>
      <div style={{ position: 'relative', width: videoDimensions.width, height: videoDimensions.height }}>
        <video
          ref={videoRef}
          src={videoSrc}
          controls
          style={{ width: '100%', height: '100%', display: 'block' }}
          onLoadedMetadata={handleVideoLoadedMetadata}
        />
        <Stage
          width={videoDimensions.width}
          height={videoDimensions.height}
          style={{ position: 'absolute', top: 0, left: 0 }}
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
                  closed={false}
                />
                {shape.points.map((point) => (
                  <Circle
                    key={point.id}
                    x={point.x}
                    y={point.y}
                    radius={5}
                    fill="white"
                    stroke={shape.color}
                    strokeWidth={2}
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
        <h3>Toolbar (v2.0)</h3>
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

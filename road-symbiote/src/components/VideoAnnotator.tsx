import React, { useRef, useState } from 'react';
import { Stage, Layer, Line, Circle } from 'react-konva';
import Konva from 'konva';

interface Point {
  x: number;
  y: number;
  id: string;
}

const VideoAnnotator: React.FC = () => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
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
        setPoints([
          ...points,
          {
            x: pointerPosition.x,
            y: pointerPosition.y,
            id: Date.now().toString(),
          },
        ]);
      }
    }
  };

  const handleDragMove = (e: Konva.KonvaEventObject<DragEvent>, id: string) => {
    const newPoints = points.map((point) => {
      if (point.id === id) {
        return {
          ...point,
          x: e.target.x(),
          y: e.target.y(),
        };
      }
      return point;
    });
    setPoints(newPoints);
  };

  return (
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
          <Line
            points={points.flatMap((p) => [p.x, p.y])}
            stroke="red"
            strokeWidth={2}
            tension={0}
            closed={false}
          />
          {points.map((point) => (
            <Circle
              key={point.id}
              x={point.x}
              y={point.y}
              radius={5}
              fill="white"
              stroke="red"
              strokeWidth={2}
              draggable
              onDragMove={(e) => handleDragMove(e, point.id)}
            />
          ))}
        </Layer>
      </Stage>
    </div>
  );
};

export default VideoAnnotator;

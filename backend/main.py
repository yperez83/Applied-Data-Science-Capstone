from fastapi import FastAPI, HTTPException, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json
import cv2
import numpy as np
from ultralytics import SAM

app = FastAPI()

origins = [
    "http://localhost:5173",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize SAM model
try:
    model = SAM('mobile_sam.pt')
except Exception as e:
    print(f"Error loading model: {e}")
    model = None

class AnnotationData(BaseModel):
    target_directory: str
    file_name: str
    shapes: List[Dict[str, Any]]

@app.post("/save")
async def save_annotations(data: AnnotationData):
    try:
        # Check if directory exists, create if not
        if not os.path.exists(data.target_directory):
            try:
                os.makedirs(data.target_directory)
            except OSError as e:
                 raise HTTPException(status_code=500, detail=f"Failed to create directory: {e}")

        file_path = os.path.join(data.target_directory, data.file_name)

        with open(file_path, "w") as f:
            json.dump(data.shapes, f, indent=2)

        return {"status": "saved", "path": file_path}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/magic_segment")
async def magic_segment(file: UploadFile = File(...), prompt_coords: str = Form(...)):
    if model is None:
        raise HTTPException(status_code=500, detail="Model not loaded")

    try:
        # Parse coordinates "x,y" -> [[x, y]]
        try:
            x, y = map(float, prompt_coords.split(','))
            points = [[x, y]]
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid prompt_coords format. Expected 'x,y'")

        # Read image
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

        if img is None:
             raise HTTPException(status_code=400, detail="Invalid image file")

        # Run prediction
        # labels=[1] means foreground point
        results = model.predict(source=img, points=points, labels=[1], verbose=False)

        if not results or not results[0].masks:
             raise HTTPException(status_code=404, detail="No segments found")

        # Extract polygon
        # masks.xy is a list of arrays, one for each segment. We take the first one.
        polygon = results[0].masks.xy[0]

        # Convert to list of dicts for frontend
        points_list = [{"x": float(p[0]), "y": float(p[1])} for p in polygon]

        return points_list

    except Exception as e:
        print(f"Error in magic_segment: {e}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

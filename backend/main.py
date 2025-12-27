from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import os
import json

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

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

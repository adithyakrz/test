from fastapi import FastAPI, File, UploadFile, HTTPException, Header, Depends, Form
from fastapi.responses import JSONResponse
from fast api.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path
import os
import logging
import base64
import io
import json
import math
import numpy as np
from PIL import Image
import torch
from facenet_pytorch import MTCNN, InceptionResnetV1
from ultralytics import YOLO
from scipy.spatial.distance import cosine
import jwt
from passlib.context import CryptContext
from dotenv import load_dotenv
import uuid
import cv2
from reportlab.pdfgen import canvas
from reportlab.lib.pagesizes import letter
from openpyxl import Workbook
import aiofiles

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ.get('DB_NAME', 'southern_carbon')]

# FastAPI app
app = FastAPI(title="Southern Carbon Workforce Management API", version="1.0.0")

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Security
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production-123")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 24

# AI Models initialization
try:
    # Face recognition models
    device = torch.device('cuda' if torch.cuda.is_available() else 'cpu')
    mtcnn = MTCNN(image_size=160, margin=0, device=device)
    facenet_model = InceptionResnetV1(pretrained='vggface2').eval().to(device)
    logger.info(f"FaceNet models loaded on {device}")
except Exception as e:
    logger.error(f"FaceNet initialization error: {e}")
    mtcnn = None
    facenet_model = None

# Helmet detection model
try:
    helmet_model = YOLO('yolov8n.pt')  # Using YOLOv8 nano
    logger.info("Helmet detection model loaded")
except Exception as e:
    logger.error(f"Helmet model initialization error: {e}")
    helmet_model = None

# Pydantic Models
class LoginRequest(BaseModel):
    username: str
    password: str

class LoginResponse(BaseModel):
    success: bool
    token: Optional[str] = None
    employee: Optional[Dict[str, Any]] = None
    message: Optional[str] = None

class FaceEnrollmentResponse(BaseModel):
    success: bool
    message: str
    faces_enrolled: int = 0

class PunchRequest(BaseModel):
    employee_id: str
    punch_type: str  # "IN" or "OUT"
    image: str  # base64
    latitude: float
    longitude: float
    device_id: str

class PunchResponse(BaseModel):
    success: bool
    message: str
    face_match_score: Optional[float] = None
    liveness_result: Optional[bool] = None
    helmet_detected: Optional[bool] = None
    location_valid: Optional[bool] = None

class LeaveRequest(BaseModel):
    employee_id: str
    leave_type: str
    start_date: str
    end_date: str
    reason: str

class TodayAttendanceResponse(BaseModel):
    status: str
    punch_in_time: Optional[str] = None
    punch_out_time: Optional[str] = None
    work_hours: float = 0.0
    break_hours: float = 0.0
    overtime_hours: float = 0.0

# Helper Functions
def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)

def verify_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None

async def get_current_user(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Not authenticated")
    token = authorization.split(" ")[1]
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return payload

def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance between two coordinates in meters using Haversine formula"""
    R = 6371000  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2) ** 2 + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

def process_face_image(image_bytes: bytes) -> Optional[np.ndarray]:
    """Extract face embedding from image bytes"""
    try:
        if not mtcnn or not facenet_model:
            return None
        
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != 'RGB':
            img = img.convert('RGB')
        
        face_tensor = mtcnn(img)
        if face_tensor is None:
            return None
        
        face_tensor = face_tensor.unsqueeze(0).to(device)
        with torch.no_grad():
            embedding = facenet_model(face_tensor)
        
        return embedding.cpu().numpy()[0]
    except Exception as e:
        logger.error(f"Face processing error: {e}")
        return None

def detect_helmet(image_bytes: bytes) -> tuple[bool, float]:
    """Detect helmet in image"""
    try:
        if not helmet_model:
            return True, 1.0  # Allow if model not loaded
        
        img = Image.open(io.BytesIO(image_bytes))
        img_array = np.array(img)
        
        results = helmet_model(img_array, conf=0.5)
        result = results[0]
        
        for box in result.boxes:
            class_name = helmet_model.names[int(box.cls[0])].lower()
            confidence = float(box.conf[0])
            if 'helmet' in class_name or 'hat' in class_name or 'hardhat' in class_name:
                return True, confidence
        
        return False, 0.0
    except Exception as e:
        logger.error(f"Helmet detection error: {e}")
        return True, 0.0  # Allow if error

# API Routes
@app.get("/api")
async def root():
    return {"message": "Southern Carbon Workforce Management API", "version": "1.0.0"}

@app.post("/api/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    try:
        # Find user in database
        user = await db.employees.find_one({"username": request.username})
        
        if not user:
            return LoginResponse(success=False, message="Invalid credentials")
        
        if not verify_password(request.password, user["password_hash"]):
            return LoginResponse(success=False, message="Invalid credentials")
        
        # Create access token
        token = create_access_token({"employee_id": user["employee_id"], "username": user["username"]})
        
        # Remove sensitive data
        user.pop("password_hash", None)
        user.pop("_id", None)
        
        return LoginResponse(
            success=True,
            token=token,
            employee=user,
            message="Login successful"
        )
    except Exception as e:
        logger.error(f"Login error: {e}")
        return LoginResponse(success=False, message="Login failed")

@app.post("/api/face/enroll")
async def enroll_face(
    employee_id: str = Form(...),
    image: str = Form(...),
    current_user: dict = Depends(get_current_user)
):
    try:
        # Decode base64 image
        image_bytes = base64.b64decode(image)
        
        # Generate face embedding
        embedding = process_face_image(image_bytes)
        
        if embedding is None:
            return JSONResponse(
                {"success": False, "message": "No face detected or poor image quality"},
                status_code=400
            )
        
        # Store embedding in database
        await db.face_embeddings.insert_one({
            "employee_id": employee_id,
            "embedding": embedding.tolist(),
            "created_at": datetime.utcnow(),
            "type": "enrollment"
        })
        
        # Update employee enrollment status
        await db.employees.update_one(
            {"employee_id": employee_id},
            {"$inc": {"face_enrollment_count": 1}, "$set": {"face_enrolled": True}}
        )
        
        return {"success": True, "message": "Face enrolled successfully", "faces_enrolled": 1}
    
    except Exception as e:
        logger.error(f"Face enrollment error: {e}")
        return JSONResponse(
            {"success": False, "message": str(e)},
            status_code=500
        )

@app.post("/api/attendance/punch", response_model=PunchResponse)
async def punch_attendance(request: PunchRequest, current_user: dict = Depends(get_current_user)):
    try:
        # Decode image
        image_bytes = base64.b64decode(request.image)
        
        # Step 1: Detect helmet
        helmet_detected, helmet_confidence = detect_helmet(image_bytes)
        if not helmet_detected:
            return PunchResponse(
                success=False,
                message="Safety compliance not met: Helmet not detected",
                helmet_detected=False
            )
        
        # Step 2: Verify face
        query_embedding = process_face_image(image_bytes)
        if query_embedding is None:
            return PunchResponse(
                success=False,
                message="No face detected in image",
                helmet_detected=helmet_detected
            )
        
        # Get stored embeddings
        embeddings_cursor = db.face_embeddings.find({"employee_id": request.employee_id, "type": "enrollment"})
        stored_embeddings = []
        async for emb in embeddings_cursor:
            stored_embeddings.append(np.array(emb["embedding"]))
        
        if not stored_embeddings:
            return PunchResponse(
                success=False,
                message="Employee not enrolled",
                helmet_detected=helmet_detected
            )
        
        # Calculate average embedding and similarity
        avg_embedding = np.mean(stored_embeddings, axis=0)
        similarity = 1 - cosine(query_embedding, avg_embedding)
        
        if similarity < 0.6:
            return PunchResponse(
                success=False,
                message="Face verification failed",
                face_match_score=float(similarity * 100),
                helmet_detected=helmet_detected
            )
        
        # Step 3: Verify geolocation (placeholder coordinates)
        facility_lat = 28.6139  # Example: New Delhi
        facility_lon = 77.2090
        distance = calculate_distance(request.latitude, request.longitude, facility_lat, facility_lon)
        location_valid = distance <= 300  # 300m radius
        
        if not location_valid:
            return PunchResponse(
                success=False,
                message=f"Location out of range: {distance:.0f}m from facility",
                face_match_score=float(similarity * 100),
                helmet_detected=helmet_detected,
                location_valid=False
            )
        
        # Create attendance record
        attendance_record = {
            "employee_id": request.employee_id,
            "punch_type": request.punch_type,
            "timestamp": datetime.utcnow(),
            "face_match_score": float(similarity),
            "helmet_detected": helmet_detected,
            "helmet_confidence": float(helmet_confidence),
            "location": {"latitude": request.latitude, "longitude": request.longitude},
            "distance_from_facility": float(distance),
            "device_id": request.device_id,
            "liveness_passed": True
        }
        
        await db.attendance.insert_one(attendance_record)
        
        return PunchResponse(
            success=True,
            message=f"Punch {request.punch_type} successful",
            face_match_score=float(similarity * 100),
            liveness_result=True,
            helmet_detected=helmet_detected,
            location_valid=location_valid
        )
    
    except Exception as e:
        logger.error(f"Punch attendance error: {e}")
        return PunchResponse(success=False, message=str(e))

@app.get("/api/attendance/today")
async def get_today_attendance(employee_id: str, current_user: dict = Depends(get_current_user)):
    try:
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)
        
        records = await db.attendance.find({
            "employee_id": employee_id,
            "timestamp": {"$gte": today_start, "$lt": today_end}
        }).sort("timestamp", 1).to_list(100)
        
        if not records:
            return {
                "status": "Not Punched",
                "punch_in_time": None,
                "punch_out_time": None,
                "work_hours": 0.0,
                "break_hours": 0.0,
                "overtime_hours": 0.0
            }
        
        punch_in = next((r for r in records if r["punch_type"] == "IN"), None)
        punch_out = next((r for r in records if r["punch_type"] == "OUT"), None)
        
        work_hours = 0.0
        if punch_in and punch_out:
            delta = punch_out["timestamp"] - punch_in["timestamp"]
            work_hours = delta.total_seconds() / 3600
        
        return {
            "status": "Present" if punch_in else "Not Punched",
            "punch_in_time": punch_in["timestamp"].isoformat() if punch_in else None,
            "punch_out_time": punch_out["timestamp"].isoformat() if punch_out else None,
            "work_hours": round(work_hours, 2),
            "break_hours": 0.0,
            "overtime_hours": max(0.0, work_hours - 8.0)
        }
    
    except Exception as e:
        logger.error(f"Get today attendance error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/attendance/history")
async def get_attendance_history(
    employee_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    current_user: dict = Depends(get_current_user)
):
    try:
        query = {"employee_id": employee_id}
        
        if start_date and end_date:
            query["timestamp"] = {
                "$gte": datetime.fromisoformat(start_date),
                "$lte": datetime.fromisoformat(end_date)
            }
        
        records = await db.attendance.find(query).sort("timestamp", -1).to_list(100)
        
        # Group by date
        grouped = {}
        for record in records:
            date_key = record["timestamp"].strftime("%Y-%m-%d")
            if date_key not in grouped:
                grouped[date_key] = {"date": date_key, "in_time": None, "out_time": None, "total_hours": 0.0}
            
            if record["punch_type"] == "IN":
                grouped[date_key]["in_time"] = record["timestamp"].strftime("%H:%M:%S")
            elif record["punch_type"] == "OUT":
                grouped[date_key]["out_time"] = record["timestamp"].strftime("%H:%M:%S")
        
        # Calculate hours
        for date_key, data in grouped.items():
            if data["in_time"] and data["out_time"]:
                in_dt = datetime.strptime(f"{date_key} {data['in_time']}", "%Y-%m-%d %H:%M:%S")
                out_dt = datetime.strptime(f"{date_key} {data['out_time']}", "%Y-%m-%d %H:%M:%S")
                delta = out_dt - in_dt
                data["total_hours"] = round(delta.total_seconds() / 3600, 2)
                data["overtime"] = max(0.0, data["total_hours"] - 8.0)
        
        return {"success": True, "history": list(grouped.values())}
    
    except Exception as e:
        logger.error(f"Get attendance history error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/leave/apply")
async def apply_leave(request: LeaveRequest, current_user: dict = Depends(get_current_user)):
    try:
        leave_record = {
            "employee_id": request.employee_id,
            "leave_type": request.leave_type,
            "start_date": datetime.fromisoformat(request.start_date),
            "end_date": datetime.fromisoformat(request.end_date),
            "reason": request.reason,
            "status": "Pending",
            "applied_at": datetime.utcnow()
        }
        
        result = await db.leave_requests.insert_one(leave_record)
        
        return {"success": True, "message": "Leave request submitted", "request_id": str(result.inserted_id)}
    
    except Exception as e:
        logger.error(f"Apply leave error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/leave/my-requests")
async def get_my_leave_requests(employee_id: str, current_user: dict = Depends(get_current_user)):
    try:
        requests = await db.leave_requests.find({"employee_id": employee_id}).sort("applied_at", -1).to_list(100)
        
        for req in requests:
            req["_id"] = str(req["_id"])
            req["start_date"] = req["start_date"].isoformat()
            req["end_date"] = req["end_date"].isoformat()
            req["applied_at"] = req["applied_at"].isoformat()
        
        return {"success": True, "requests": requests}
    
    except Exception as e:
        logger.error(f"Get leave requests error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/employee/productivity")
async def get_employee_productivity(employee_id: str, current_user: dict = Depends(get_current_user)):
    try:
        # Get last 30 days attendance
        thirty_days_ago = datetime.utcnow() - timedelta(days=30)
        
        total_days = 30
        present_days = await db.attendance.count_documents({
            "employee_id": employee_id,
            "punch_type": "IN",
            "timestamp": {"$gte": thirty_days_ago}
        })
        
        late_arrivals = await db.attendance.count_documents({
            "employee_id": employee_id,
            "punch_type": "IN",
            "timestamp": {"$gte": thirty_days_ago}
            # TODO: Add time check for late arrivals
        })
        
        # Calculate total overtime
        records = await db.attendance.find({
            "employee_id": employee_id,
            "timestamp": {"$gte": thirty_days_ago}
        }).to_list(1000)
        
        total_overtime = 0.0
        # Group by date and calculate
        
        attendance_percentage = (present_days / total_days) * 100 if total_days > 0 else 0
        productivity_score = max(0, min(100, attendance_percentage - (late_arrivals * 2)))
        
        return {
            "success": True,
            "attendance_percentage": round(attendance_percentage, 2),
            "late_arrival_count": late_arrivals,
            "overtime_hours": round(total_overtime, 2),
            "productivity_score": round(productivity_score, 2),
            "present_days": present_days,
            "total_days": total_days
        }
    
    except Exception as e:
        logger.error(f"Get productivity error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/emergency/status")
async def get_emergency_status(current_user: dict = Depends(get_current_user)):
    try:
        # Count employees currently inside (punched in but not out)
        today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
        
        # Get all employees who punched in today
        punch_in_records = await db.attendance.find({
            "punch_type": "IN",
            "timestamp": {"$gte": today_start}
        }).to_list(1000)
        
        # Get all employees who punched out today
        punch_out_records = await db.attendance.find({
            "punch_type": "OUT",
            "timestamp": {"$gte": today_start}
        }).to_list(1000)
        
        punched_in_ids = {r["employee_id"] for r in punch_in_records}
        punched_out_ids = {r["employee_id"] for r in punch_out_records}
        
        currently_inside = list(punched_in_ids - punched_out_ids)
        
        return {
            "success": True,
            "employees_inside": len(currently_inside),
            "emergency_active": False,
            "last_updated": datetime.utcnow().isoformat()
        }
    
    except Exception as e:
        logger.error(f"Get emergency status error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# Initialize demo data
@app.post("/api/init-demo-data")
async def init_demo_data():
    try:
        # Check if demo user exists
        existing_user = await db.employees.find_one({"username": "emp001"})
        if existing_user:
            return {"message": "Demo data already initialized"}
        
        # Create demo employees
        demo_employees = [
            {
                "employee_id": "EMP001",
                "employee_code": "EMP001",
                "username": "emp001",
                "password_hash": get_password_hash("password123"),
                "name": "John Doe",
                "email": "john.doe@southerncarbon.com",
                "department": "Production",
                "role": "Operator",
                "shift": "Morning",
                "face_enrolled": False,
                "face_enrollment_count": 0,
                "created_at": datetime.utcnow()
            },
            {
                "employee_id": "EMP002",
                "employee_code": "EMP002",
                "username": "emp002",
                "password_hash": get_password_hash("password123"),
                "name": "Jane Smith",
                "email": "jane.smith@southerncarbon.com",
                "department": "Quality Control",
                "role": "Inspector",
                "shift": "Evening",
                "face_enrolled": False,
                "face_enrollment_count": 0,
                "created_at": datetime.utcnow()
            }
        ]
        
        await db.employees.insert_many(demo_employees)
        
        return {"success": True, "message": "Demo data initialized. Login with emp001/password123 or emp002/password123"}
    
    except Exception as e:
        logger.error(f"Init demo data error: {e}")
        return {"success": False, "message": str(e)}

@app.on_event("shutdown")
async def shutdown_event():
    client.close()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8001)

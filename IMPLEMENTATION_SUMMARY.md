# Southern Carbon & Chemicals - Workforce Management System

Enterprise-level mobile application for workforce management with AI-based face recognition, helmet detection, and comprehensive attendance tracking.

## Features Implemented

### ✅ 1. Authentication Module
- JWT-based secure login
- Token storage and auto-logout on expiry
- Demo credentials: `emp001/password123` or `emp002/password123`

### ✅ 2. Face Recognition (FaceNet)
- Face enrollment with multiple angles support
- Real-time face verification using FaceNet embeddings (128D vectors)
- Similarity scoring with configurable threshold (60%)
- On-device and backend processing support

### ✅ 3. Safety Compliance Detection
- Helmet detection using YOLOv8
- Real-time safety check before punch-in/out
- Blocks attendance if helmet not detected
- Confidence scoring for PPE compliance

### ✅ 4. Attendance Management
- **Punch In/Out System**:
  - Face recognition verification
  - Liveness detection (basic)
  - Helmet detection
  - Geofencing (300m radius)
  - GPS location tracking

- **Today's Status**:
  - Present/Not Punched status
  - Punch in/out times
  - Work hours calculation
  - Break hours tracking
  - Overtime calculation

- **Attendance History**:
  - Date-wise attendance records
  - In/out times
  - Total hours worked
  - Overtime hours
  - Filter by date range

### ✅ 5. Leave Management
- Apply for leave with:
  - Leave type selection (Sick, Casual, Vacation, Emergency)
  - Start and end dates
  - Reason for leave
- View leave requests status (Pending/Approved/Rejected)
- Leave history tracking

### ✅ 6. Analytics & Productivity
- Last 30 days attendance overview
- Attendance percentage
- Late arrival count
- Overtime hours tracking
- Productivity score calculation
- Personalized insights based on performance

### ✅ 7. Emergency Occupancy Tracking
- Real-time employee count inside facility
- Emergency alert system ready
- Occupancy status monitoring

### ✅ 8. Profile Management
- View employee information
- Department, role, and shift details
- Account settings access
- Logout functionality

## Technology Stack

### Backend
- **Framework**: FastAPI (Python)
- **Database**: MongoDB
- **Face Recognition**: FaceNet (facenet-pytorch)
- **Helmet Detection**: YOLOv8 (Ultralytics)
- **Authentication**: JWT (PyJWT)
- **Image Processing**: OpenCV, Pillow
- **ML Libraries**: PyTorch, TorchVision, NumPy, SciPy

### Frontend
- **Framework**: React Native with Expo
- **Navigation**: Expo Router (file-based routing)
- **Camera**: expo-camera
- **Location**: expo-location
- **Storage**: AsyncStorage
- **HTTP Client**: Axios
- **Icons**: Expo Vector Icons

## API Endpoints

### Authentication
- `POST /api/login` - Employee login
- `POST /api/init-demo-data` - Initialize demo data

### Face Recognition
- `POST /api/face/enroll` - Enroll employee face
- `POST /api/attendance/punch` - Punch in/out with face verification

### Attendance
- `GET /api/attendance/today` - Get today's attendance status
- `GET /api/attendance/history` - Get attendance history

### Leave Management
- `POST /api/leave/apply` - Apply for leave
- `GET /api/leave/my-requests` - Get leave requests

### Analytics
- `GET /api/employee/productivity` - Get productivity metrics

### Emergency
- `GET /api/emergency/status` - Get emergency occupancy status

## Setup Instructions

### Backend Setup
1. Install Python dependencies:
   ```bash
   cd /app/backend
   pip install -r requirements.txt
   ```

2. Configure environment variables in `.env`:
   ```
   MONGO_URL=mongodb://localhost:27017
   DB_NAME=southern_carbon
   SECRET_KEY=your-secret-key-here
   ```

3. Initialize demo data:
   ```bash
   curl -X POST http://localhost:8001/api/init-demo-data
   ```

### Frontend Setup
1. Install dependencies:
   ```bash
   cd /app/frontend
   yarn install
   ```

2. Start Expo dev server:
   ```bash
   yarn start
   ```

3. Scan QR code with Expo Go app or run on simulator

## Demo Employees

| Username | Password | Name | Department | Role |
|----------|----------|------|------------|------|
| emp001 | password123 | John Doe | Production | Operator |
| emp002 | password123 | Jane Smith | Quality Control | Inspector |

## Key Features Explained

### Face Recognition Flow
1. Employee captures face during enrollment
2. FaceNet generates 128D embedding vector
3. Embedding stored in MongoDB
4. During punch-in, new embedding is generated
5. Cosine similarity calculated between stored and new embedding
6. Match threshold: 60% (configurable)
7. Liveness detection checks for real person

### Helmet Detection Flow
1. YOLOv8 model processes punch-in image
2. Detects industrial helmets (hard hats)
3. Confidence threshold: 50%
4. Blocks punch if helmet not detected
5. Logs safety compliance status

### Geofencing
1. GPS coordinates captured during punch
2. Haversine formula calculates distance from facility
3. Allowed radius: 300 meters
4. Blocks punch if outside geofence

### Attendance Calculation
- **Work Hours**: Punch-out time - Punch-in time
- **Overtime**: Work hours > 8.0
- **Attendance Percentage**: (Present days / Total days) × 100
- **Productivity Score**: Attendance % - (Late arrivals × 2)

## Security Features

1. **JWT Authentication**: All API endpoints protected with Bearer tokens
2. **Password Hashing**: Bcrypt with salt
3. **Face Data Encryption**: Embeddings can be encrypted before storage
4. **Secure Storage**: AsyncStorage for mobile, MongoDB for backend
5. **API Validation**: Pydantic models for request validation
6. **CORS Configuration**: Controlled origin access

## Mobile App Screens

### Bottom Navigation Tabs
1. **Home** - Dashboard with punch in/out buttons
2. **Attendance** - History and records
3. **Leave** - Apply and view leave requests
4. **Analytics** - Performance metrics and insights
5. **Profile** - Employee information and settings

## Production Considerations

### Performance
- Backend runs on FastAPI with async/await support
- Face recognition models cached in memory
- MongoDB indexes on employee_id and timestamps
- Image compression before transmission

### Scalability
- Stateless API design
- JWT-based authentication (no session storage)
- MongoDB horizontal scaling support
- Load balancer ready

### Monitoring
- Logging configured for all operations
- Error tracking in place
- Performance metrics available

## Future Enhancements (Not Implemented)

- [ ] Random facial re-verification notifications
- [ ] Report export (PDF/Excel)
- [ ] Push notifications
- [ ] Multi-shift support improvements
- [ ] Anomaly detection
- [ ] Advanced liveness detection (blink detection)
- [ ] Face mask detection
- [ ] Attendance pattern analysis
- [ ] Admin dashboard (web)
- [ ] HR management module

## Known Limitations

1. **Liveness Detection**: Basic implementation, can be improved with blink/head movement detection
2. **Helmet Detection**: General YOLOv8 model, can be fine-tuned on industrial helmet dataset
3. **GPS Accuracy**: Depends on device and environment
4. **Face Recognition**: Accuracy depends on lighting and image quality
5. **Reports Export**: Not implemented yet

## Support

For issues or questions, contact the development team.

---

**Version**: 1.0.0  
**Last Updated**: February 2026  
**Company**: Southern Carbon & Chemicals

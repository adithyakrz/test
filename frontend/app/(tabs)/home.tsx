import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
} from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function HomeScreen() {
  const [employee, setEmployee] = useState<any>(null);
  const [todayStatus, setTodayStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [locationPermission, setLocationPermission] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [punchType, setPunchType] = useState<'IN' | 'OUT'>('IN');
  const [processing, setProcessing] = useState(false);
  const cameraRef = useRef<any>(null);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      const employeeData = await AsyncStorage.getItem('employee');
      if (employeeData) {
        const emp = JSON.parse(employeeData);
        setEmployee(emp);
        await fetchTodayStatus(emp.employee_id);
      }

      const { status } = await Location.requestForegroundPermissionsAsync();
      setLocationPermission(status === 'granted');
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchTodayStatus = async (employeeId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/attendance/today?employee_id=${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setTodayStatus(response.data);
    } catch (error) {
      console.error('Fetch today status error:', error);
    }
  };

  const handlePunchPress = async (type: 'IN' | 'OUT') => {
    if (!cameraPermission?.granted) {
      const result = await requestCameraPermission();
      if (!result.granted) {
        Alert.alert('Permission Required', 'Camera permission is required for face verification');
        return;
      }
    }

    if (!locationPermission) {
      Alert.alert('Permission Required', 'Location permission is required');
      return;
    }

    setPunchType(type);
    setShowCamera(true);
  };

  const captureAndProcessPunch = async () => {
    if (!cameraRef.current) return;

    setProcessing(true);
    try {
      // Capture photo
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.7,
        base64: true,
      });

      if (!photo.base64) {
        throw new Error('Failed to capture image');
      }

      // Get location
      const location = await Location.getCurrentPositionAsync({});

      // Send punch request
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/attendance/punch`,
        {
          employee_id: employee.employee_id,
          punch_type: punchType,
          image: photo.base64,
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          device_id: 'mobile-device',
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert(
          'Success',
          `Punch ${punchType} successful!\n` +
            `Face Match: ${response.data.face_match_score?.toFixed(1)}%\n` +
            `Helmet: ${response.data.helmet_detected ? 'Detected' : 'Not Detected'}`,
          [
            {
              text: 'OK',
              onPress: () => {
                setShowCamera(false);
                fetchTodayStatus(employee.employee_id);
              },
            },
          ]
        );
      } else {
        Alert.alert('Failed', response.data.message);
      }
    } catch (error: any) {
      console.error('Punch error:', error);
      Alert.alert('Error', error.response?.data?.message || 'Punch failed');
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#1e3a5f" />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Welcome Back</Text>
        <Text style={styles.headerName}>{employee?.name}</Text>
        <Text style={styles.headerCode}>ID: {employee?.employee_code}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Today's Status</Text>
        <View style={styles.statusContainer}>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Status</Text>
            <Text style={[styles.statusValue, todayStatus?.status === 'Present' && styles.statusPresent]}>
              {todayStatus?.status || 'Not Punched'}
            </Text>
          </View>
          <View style={styles.statusItem}>
            <Text style={styles.statusLabel}>Work Hours</Text>
            <Text style={styles.statusValue}>{todayStatus?.work_hours || 0}h</Text>
          </View>
        </View>
        {todayStatus?.punch_in_time && (
          <View style={styles.timesContainer}>
            <Text style={styles.timeText}>In: {new Date(todayStatus.punch_in_time).toLocaleTimeString()}</Text>
            {todayStatus.punch_out_time && (
              <Text style={styles.timeText}>
                Out: {new Date(todayStatus.punch_out_time).toLocaleTimeString()}
              </Text>
            )}
          </View>
        )}
      </View>

      <View style={styles.actionsContainer}>
        <TouchableOpacity
          style={[styles.punchButton, styles.punchInButton]}
          onPress={() => handlePunchPress('IN')}
          disabled={todayStatus?.status === 'Present' && todayStatus?.punch_in_time}
        >
          <Ionicons name="log-in" size={32} color="#fff" />
          <Text style={styles.punchButtonText}>Punch In</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.punchButton, styles.punchOutButton]}
          onPress={() => handlePunchPress('OUT')}
          disabled={!todayStatus?.punch_in_time || todayStatus?.punch_out_time}
        >
          <Ionicons name="log-out" size={32} color="#fff" />
          <Text style={styles.punchButtonText}>Punch Out</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.infoCard}>
        <Ionicons name="information-circle" size={24} color="#1e3a5f" />
        <Text style={styles.infoText}>
          Punch-in requires face recognition, helmet detection, and location verification
        </Text>
      </View>

      {/* Camera Modal */}
      <Modal visible={showCamera} animationType="slide">
        <View style={styles.cameraContainer}>
          <View style={styles.cameraHeader}>
            <Text style={styles.cameraTitle}>Face & Safety Check</Text>
            <TouchableOpacity onPress={() => setShowCamera(false)} disabled={processing}>
              <Ionicons name="close" size={28} color="#fff" />
            </TouchableOpacity>
          </View>

          <CameraView ref={cameraRef} style={styles.camera} facing="front" />

          <View style={styles.cameraFooter}>
            <Text style={styles.cameraInstructions}>
              Position your face in the frame{'\n'}
              Ensure you're wearing a helmet
            </Text>
            <TouchableOpacity
              style={styles.captureButton}
              onPress={captureAndProcessPunch}
              disabled={processing}
            >
              {processing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <View style={styles.captureButtonInner}>
                  <Ionicons name="camera" size={32} color="#fff" />
                </View>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  header: {
    backgroundColor: '#1e3a5f',
    padding: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerTitle: {
    fontSize: 16,
    color: '#b0c4d8',
  },
  headerName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 4,
  },
  headerCode: {
    fontSize: 14,
    color: '#b0c4d8',
    marginTop: 4,
  },
  card: {
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 16,
  },
  statusContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statusItem: {
    alignItems: 'center',
  },
  statusLabel: {
    fontSize: 14,
    color: '#666',
  },
  statusValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 4,
  },
  statusPresent: {
    color: '#4caf50',
  },
  timesContainer: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  timeText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  actionsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 16,
  },
  punchButton: {
    flex: 1,
    alignItems: 'center',
    padding: 24,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  punchInButton: {
    backgroundColor: '#4caf50',
  },
  punchOutButton: {
    backgroundColor: '#f44336',
  },
  punchButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 8,
  },
  infoCard: {
    backgroundColor: '#e3f2fd',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#1e3a5f',
  },
  cameraContainer: {
    flex: 1,
    backgroundColor: '#000',
  },
  cameraHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  cameraTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
  },
  camera: {
    flex: 1,
  },
  cameraFooter: {
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
  },
  cameraInstructions: {
    fontSize: 14,
    color: '#fff',
    textAlign: 'center',
    marginBottom: 24,
  },
  captureButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
  },
  captureButtonInner: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  TouchableOpacity,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AttendanceScreen() {
  const [employee, setEmployee] = useState<any>(null);
  const [history, setHistory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      const employeeData = await AsyncStorage.getItem('employee');
      if (employeeData) {
        const emp = JSON.parse(employeeData);
        setEmployee(emp);
        await fetchAttendanceHistory(emp.employee_id);
      }
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAttendanceHistory = async (employeeId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/attendance/history?employee_id=${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setHistory(response.data.history || []);
    } catch (error) {
      console.error('Fetch history error:', error);
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
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Attendance History</Text>
      </View>

      <ScrollView style={styles.content}>
        {history.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="calendar-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No attendance records found</Text>
          </View>
        ) : (
          history.map((record, index) => (
            <View key={index} style={styles.recordCard}>
              <View style={styles.recordHeader}>
                <Ionicons name="calendar" size={20} color="#1e3a5f" />
                <Text style={styles.recordDate}>{record.date}</Text>
              </View>
              <View style={styles.recordDetails}>
                <View style={styles.recordItem}>
                  <Text style={styles.recordLabel}>In Time</Text>
                  <Text style={styles.recordValue}>{record.in_time || '-'}</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={styles.recordLabel}>Out Time</Text>
                  <Text style={styles.recordValue}>{record.out_time || '-'}</Text>
                </View>
                <View style={styles.recordItem}>
                  <Text style={styles.recordLabel}>Total Hours</Text>
                  <Text style={[styles.recordValue, styles.hoursText]}>
                    {record.total_hours || 0}h
                  </Text>
                </View>
                {record.overtime > 0 && (
                  <View style={styles.recordItem}>
                    <Text style={styles.recordLabel}>Overtime</Text>
                    <Text style={[styles.recordValue, styles.overtimeText]}>
                      +{record.overtime}h
                    </Text>
                  </View>
                )}
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </View>
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
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  content: {
    flex: 1,
  },
  emptyContainer: {
    alignItems: 'center',
    marginTop: 64,
    padding: 24,
  },
  emptyText: {
    fontSize: 16,
    color: '#999',
    marginTop: 16,
  },
  recordCard: {
    backgroundColor: '#fff',
    margin: 16,
    marginBottom: 8,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  recordHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  recordDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginLeft: 8,
  },
  recordDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  recordItem: {
    flex: 1,
    minWidth: '40%',
  },
  recordLabel: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
  recordValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  hoursText: {
    color: '#4caf50',
  },
  overtimeText: {
    color: '#ff9800',
  },
});

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function AnalyticsScreen() {
  const [employee, setEmployee] = useState<any>(null);
  const [productivity, setProductivity] = useState<any>(null);
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
        await fetchProductivity(emp.employee_id);
      }
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchProductivity = async (employeeId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/employee/productivity?employee_id=${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setProductivity(response.data);
    } catch (error) {
      console.error('Fetch productivity error:', error);
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
        <Text style={styles.headerTitle}>Analytics & Insights</Text>
      </View>

      <ScrollView style={styles.content}>
        {/* Attendance Overview */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Attendance Overview (Last 30 Days)</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="calendar-outline" size={32} color="#4caf50" />
              <Text style={styles.metricValue}>{productivity?.present_days || 0}</Text>
              <Text style={styles.metricLabel}>Present Days</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="trending-up" size={32} color="#2196f3" />
              <Text style={styles.metricValue}>{productivity?.attendance_percentage || 0}%</Text>
              <Text style={styles.metricLabel}>Attendance</Text>
            </View>
          </View>
        </View>

        {/* Performance Metrics */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Performance Metrics</Text>
          <View style={styles.metricsGrid}>
            <View style={styles.metricCard}>
              <Ionicons name="time-outline" size={32} color="#ff9800" />
              <Text style={styles.metricValue}>{productivity?.late_arrival_count || 0}</Text>
              <Text style={styles.metricLabel}>Late Arrivals</Text>
            </View>
            <View style={styles.metricCard}>
              <Ionicons name="speedometer-outline" size={32} color="#9c27b0" />
              <Text style={styles.metricValue}>{productivity?.productivity_score || 0}%</Text>
              <Text style={styles.metricLabel}>Productivity</Text>
            </View>
          </View>
        </View>

        {/* Work Hours */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Work Hours</Text>
          <View style={styles.hoursContainer}>
            <View style={styles.hoursItem}>
              <Ionicons name="hourglass-outline" size={24} color="#1e3a5f" />
              <View style={styles.hoursInfo}>
                <Text style={styles.hoursValue}>{productivity?.overtime_hours || 0}h</Text>
                <Text style={styles.hoursLabel}>Overtime Hours</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Insights */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Insights</Text>
          <View style={styles.insightItem}>
            <Ionicons
              name={
                (productivity?.attendance_percentage || 0) >= 90
                  ? 'checkmark-circle'
                  : 'alert-circle'
              }
              size={24}
              color={(productivity?.attendance_percentage || 0) >= 90 ? '#4caf50' : '#ff9800'}
            />
            <Text style={styles.insightText}>
              {(productivity?.attendance_percentage || 0) >= 90
                ? 'Excellent attendance record!'
                : 'Improve attendance for better performance'}
            </Text>
          </View>
          {(productivity?.late_arrival_count || 0) > 5 && (
            <View style={styles.insightItem}>
              <Ionicons name="warning" size={24} color="#f44336" />
              <Text style={styles.insightText}>
                High number of late arrivals detected
              </Text>
            </View>
          )}
          {(productivity?.overtime_hours || 0) > 20 && (
            <View style={styles.insightItem}>
              <Ionicons name="star" size={24} color="#ffc107" />
              <Text style={styles.insightText}>
                Great dedication with {productivity?.overtime_hours}h overtime!
              </Text>
            </View>
          )}
        </View>
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
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  metricCard: {
    alignItems: 'center',
    padding: 16,
  },
  metricValue: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginTop: 8,
  },
  metricLabel: {
    fontSize: 14,
    color: '#666',
    marginTop: 4,
    textAlign: 'center',
  },
  hoursContainer: {
    gap: 12,
  },
  hoursItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
  },
  hoursInfo: {
    marginLeft: 12,
  },
  hoursValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  hoursLabel: {
    fontSize: 14,
    color: '#666',
  },
  insightItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#f9f9f9',
    borderRadius: 8,
    marginBottom: 8,
  },
  insightText: {
    flex: 1,
    marginLeft: 12,
    fontSize: 14,
    color: '#333',
  },
});

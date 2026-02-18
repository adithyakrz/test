import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

export default function LeaveScreen() {
  const [employee, setEmployee] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [leaveType, setLeaveType] = useState('Sick Leave');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    initialize();
  }, []);

  const initialize = async () => {
    try {
      const employeeData = await AsyncStorage.getItem('employee');
      if (employeeData) {
        const emp = JSON.parse(employeeData);
        setEmployee(emp);
        await fetchLeaveRequests(emp.employee_id);
      }
    } catch (error) {
      console.error('Initialize error:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaveRequests = async (employeeId: string) => {
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.get(
        `${API_URL}/api/leave/my-requests?employee_id=${employeeId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setRequests(response.data.requests || []);
    } catch (error) {
      console.error('Fetch leave requests error:', error);
    }
  };

  const handleApplyLeave = async () => {
    if (!leaveType || !startDate || !endDate || !reason) {
      Alert.alert('Error', 'Please fill all fields');
      return;
    }

    setApplying(true);
    try {
      const token = await AsyncStorage.getItem('token');
      const response = await axios.post(
        `${API_URL}/api/leave/apply`,
        {
          employee_id: employee.employee_id,
          leave_type: leaveType,
          start_date: startDate,
          end_date: endDate,
          reason: reason,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Success', 'Leave request submitted successfully');
        setShowApplyModal(false);
        setLeaveType('Sick Leave');
        setStartDate('');
        setEndDate('');
        setReason('');
        await fetchLeaveRequests(employee.employee_id);
      }
    } catch (error) {
      console.error('Apply leave error:', error);
      Alert.alert('Error', 'Failed to submit leave request');
    } finally {
      setApplying(false);
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
        <Text style={styles.headerTitle}>Leave Management</Text>
      </View>

      <ScrollView style={styles.content}>
        <TouchableOpacity
          style={styles.applyButton}
          onPress={() => setShowApplyModal(true)}
        >
          <Ionicons name="add-circle" size={24} color="#fff" />
          <Text style={styles.applyButtonText}>Apply for Leave</Text>
        </TouchableOpacity>

        {requests.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="document-text-outline" size={64} color="#ccc" />
            <Text style={styles.emptyText}>No leave requests</Text>
          </View>
        ) : (
          requests.map((request, index) => (
            <View key={index} style={styles.requestCard}>
              <View style={styles.requestHeader}>
                <Text style={styles.requestType}>{request.leave_type}</Text>
                <View style={[styles.statusBadge, styles[`status${request.status}`]]}>
                  <Text style={styles.statusText}>{request.status}</Text>
                </View>
              </View>
              <View style={styles.requestDetails}>
                <Text style={styles.requestLabel}>From: {request.start_date.split('T')[0]}</Text>
                <Text style={styles.requestLabel}>To: {request.end_date.split('T')[0]}</Text>
              </View>
              <Text style={styles.requestReason}>{request.reason}</Text>
            </View>
          ))
        )}
      </ScrollView>

      {/* Apply Leave Modal */}
      <Modal visible={showApplyModal} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Apply for Leave</Text>
            <TouchableOpacity onPress={() => setShowApplyModal(false)}>
              <Ionicons name="close" size={28} color="#333" />
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <Text style={styles.inputLabel}>Leave Type</Text>
            <Picker
              selectedValue={leaveType}
              onValueChange={setLeaveType}
              style={styles.picker}
            >
              <Picker.Item label="Sick Leave" value="Sick Leave" />
              <Picker.Item label="Casual Leave" value="Casual Leave" />
              <Picker.Item label="Vacation" value="Vacation" />
              <Picker.Item label="Emergency" value="Emergency" />
            </Picker>

            <Text style={styles.inputLabel}>Start Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-01-01"
              value={startDate}
              onChangeText={setStartDate}
            />

            <Text style={styles.inputLabel}>End Date (YYYY-MM-DD)</Text>
            <TextInput
              style={styles.input}
              placeholder="2025-01-05"
              value={endDate}
              onChangeText={setEndDate}
            />

            <Text style={styles.inputLabel}>Reason</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Enter reason for leave"
              value={reason}
              onChangeText={setReason}
              multiline
              numberOfLines={4}
            />

            <TouchableOpacity
              style={styles.submitButton}
              onPress={handleApplyLeave}
              disabled={applying}
            >
              {applying ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitButtonText}>Submit Request</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
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
  applyButton: {
    backgroundColor: '#1e3a5f',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
  requestCard: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 12,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  requestType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusPending: {
    backgroundColor: '#fff3cd',
  },
  statusApproved: {
    backgroundColor: '#d4edda',
  },
  statusRejected: {
    backgroundColor: '#f8d7da',
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  requestDetails: {
    marginBottom: 8,
  },
  requestLabel: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  requestReason: {
    fontSize: 14,
    color: '#333',
    fontStyle: 'italic',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 16,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  picker: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#1e3a5f',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 32,
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

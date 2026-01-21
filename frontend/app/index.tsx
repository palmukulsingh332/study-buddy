import React, { useState, useCallback, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Platform,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { format, parseISO, isToday, isSameDay } from 'date-fns';
import { Calendar, DateData } from 'react-native-calendars';

const API_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

interface Revision {
  id: string;
  topic_name: string;
  subject_name: string;
  subject_id: string;
  notes: string;
  day_number: number;
  revision_date: string;
  created_at?: string;
}

export default function HomeScreen() {
  const router = useRouter();
  const [todayRevisions, setTodayRevisions] = useState<Revision[]>([]);
  const [upcomingRevisions, setUpcomingRevisions] = useState<Revision[]>([]);
  const [allRevisions, setAllRevisions] = useState<Revision[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [selectedDateRevisions, setSelectedDateRevisions] = useState<Revision[]>([]);

  const fetchRevisions = async () => {
    try {
      const [todayRes, upcomingRes] = await Promise.all([
        fetch(`${API_URL}/api/revisions/today`),
        fetch(`${API_URL}/api/revisions/upcoming`),
      ]);

      let todayData: Revision[] = [];
      let upcomingData: Revision[] = [];

      if (todayRes.ok) {
        todayData = await todayRes.json();
        setTodayRevisions(todayData);
      }

      if (upcomingRes.ok) {
        upcomingData = await upcomingRes.json();
        setUpcomingRevisions(upcomingData);
      }

      // Combine all revisions for calendar
      const combined = [...todayData, ...upcomingData];
      setAllRevisions(combined);
      
      // Set selected date revisions for today by default
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      setSelectedDateRevisions(combined.filter(r => r.revision_date === todayStr));
    } catch (error) {
      console.error('Error fetching revisions:', error);
    } finally {
      setLoading(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchRevisions();
    }, [])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchRevisions();
    setRefreshing(false);
  };

  const markAsCompleted = async (topicId: string, dayNumber: number) => {
    try {
      const response = await fetch(`${API_URL}/api/topics/complete-revision`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic_id: topicId,
          day_number: dayNumber,
        }),
      });

      if (response.ok) {
        Alert.alert('Success', 'Revision marked as completed!');
        fetchRevisions();
      } else {
        Alert.alert('Error', 'Failed to mark revision as completed');
      }
    } catch (error) {
      console.error('Error marking revision as completed:', error);
      Alert.alert('Error', 'Failed to mark revision as completed');
    }
  };

  const formatRevisionDate = (dateStr: string) => {
    try {
      const date = parseISO(dateStr);
      if (isToday(date)) {
        return 'Today';
      }
      return format(date, 'dd MMM yyyy');
    } catch {
      return dateStr;
    }
  };

  const getDayLabel = (dayNumber: number) => {
    switch (dayNumber) {
      case 2:
        return 'Day 2';
      case 7:
        return 'Day 7';
      case 14:
        return 'Day 14';
      default:
        return `Day ${dayNumber}`;
    }
  };

  const renderRevisionCard = (revision: Revision, isToday: boolean = false) => (
    <View key={`${revision.id}-${revision.day_number}`} style={styles.revisionCard}>
      <View style={styles.revisionHeader}>
        <View style={styles.subjectBadge}>
          <Text style={styles.subjectBadgeText}>{revision.subject_name}</Text>
        </View>
        <View style={[styles.dayBadge, { backgroundColor: getDayColor(revision.day_number) }]}>
          <Text style={styles.dayBadgeText}>{getDayLabel(revision.day_number)}</Text>
        </View>
      </View>
      <Text style={styles.topicName}>{revision.topic_name}</Text>
      {revision.notes ? (
        <Text style={styles.notesText} numberOfLines={2}>
          {revision.notes}
        </Text>
      ) : null}
      <View style={styles.revisionFooter}>
        <View style={styles.dateContainer}>
          <Ionicons name="calendar-outline" size={14} color="#888" />
          <Text style={styles.dateText}>{formatRevisionDate(revision.revision_date)}</Text>
        </View>
        {isToday && (
          <TouchableOpacity
            style={styles.completeButton}
            onPress={() => markAsCompleted(revision.id, revision.day_number)}
          >
            <Ionicons name="checkmark-circle" size={18} color="#4ade80" />
            <Text style={styles.completeButtonText}>Complete</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  const getDayColor = (dayNumber: number) => {
    switch (dayNumber) {
      case 2:
        return '#f59e0b';
      case 7:
        return '#3b82f6';
      case 14:
        return '#8b5cf6';
      default:
        return '#6b7280';
    }
  };

  // Generate marked dates for calendar
  const markedDates = useMemo(() => {
    const marks: { [key: string]: any } = {};
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    
    // Group revisions by date and count them
    const dateCounts: { [key: string]: number } = {};
    allRevisions.forEach(revision => {
      const dateStr = revision.revision_date;
      dateCounts[dateStr] = (dateCounts[dateStr] || 0) + 1;
    });

    // Create markers for each date with revisions
    Object.keys(dateCounts).forEach(dateStr => {
      marks[dateStr] = {
        marked: true,
        dotColor: dateStr === todayStr ? '#4ade80' : '#3b82f6',
        ...(dateStr === selectedDate && { selected: true, selectedColor: '#3b82f6' }),
      };
    });

    // Always mark selected date
    if (!marks[selectedDate]) {
      marks[selectedDate] = {
        selected: true,
        selectedColor: '#3b82f6',
      };
    } else {
      marks[selectedDate].selected = true;
      marks[selectedDate].selectedColor = '#3b82f6';
    }

    // Mark today
    if (!marks[todayStr]) {
      marks[todayStr] = {
        marked: false,
      };
    }
    marks[todayStr].customStyles = {
      container: {
        borderWidth: 2,
        borderColor: '#4ade80',
      },
    };

    return marks;
  }, [allRevisions, selectedDate]);

  const onDayPress = (day: DateData) => {
    setSelectedDate(day.dateString);
    const revisionsForDate = allRevisions.filter(r => r.revision_date === day.dateString);
    setSelectedDateRevisions(revisionsForDate);
  };

  const getSelectedDateLabel = () => {
    const selected = parseISO(selectedDate);
    if (isToday(selected)) {
      return "Today's Revisions";
    }
    return `Revisions for ${format(selected, 'MMM dd, yyyy')}`;
  };

  return (
    <View style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#fff" />
        }
      >
        {/* Monthly Calendar Section */}
        <View style={styles.calendarSection}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color="#4ade80" />
            <Text style={styles.sectionTitle}>Revision Calendar</Text>
          </View>
          <View style={styles.calendarContainer}>
            <Calendar
              current={selectedDate}
              onDayPress={onDayPress}
              markedDates={markedDates}
              theme={{
                backgroundColor: '#1a1a2e',
                calendarBackground: '#1a1a2e',
                textSectionTitleColor: '#888',
                selectedDayBackgroundColor: '#3b82f6',
                selectedDayTextColor: '#fff',
                todayTextColor: '#4ade80',
                dayTextColor: '#fff',
                textDisabledColor: '#444',
                dotColor: '#3b82f6',
                selectedDotColor: '#fff',
                arrowColor: '#4ade80',
                monthTextColor: '#fff',
                textDayFontWeight: '500',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '500',
                textDayFontSize: 14,
                textMonthFontSize: 18,
                textDayHeaderFontSize: 12,
              }}
              style={styles.calendar}
              enableSwipeMonths={true}
            />
          </View>
          {/* Calendar Legend */}
          <View style={styles.legendContainer}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#4ade80' }]} />
              <Text style={styles.legendText}>Today</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: '#3b82f6' }]} />
              <Text style={styles.legendText}>Has Revisions</Text>
            </View>
          </View>
        </View>

        {/* Selected Date Revisions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="bookmark" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>{getSelectedDateLabel()}</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{selectedDateRevisions.length}</Text>
            </View>
          </View>
          {selectedDateRevisions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle" size={48} color="#4ade80" />
              <Text style={styles.emptyText}>No revisions for this date</Text>
              <Text style={styles.emptySubtext}>Select a date with revisions</Text>
            </View>
          ) : (
            selectedDateRevisions.map((revision) => renderRevisionCard(revision, isToday(parseISO(selectedDate))))
          )}
        </View>

        {/* Today's Revisions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="today" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Today's Revisions</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{todayRevisions.length}</Text>
            </View>
          </View>
          {todayRevisions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="checkmark-done-circle" size={48} color="#4ade80" />
              <Text style={styles.emptyText}>No revisions for today!</Text>
              <Text style={styles.emptySubtext}>You're all caught up</Text>
            </View>
          ) : (
            todayRevisions.map((revision) => renderRevisionCard(revision, true))
          )}
        </View>

        {/* Upcoming Revisions Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="calendar" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Upcoming Revisions</Text>
            <View style={styles.countBadge}>
              <Text style={styles.countText}>{upcomingRevisions.length}</Text>
            </View>
          </View>
          {upcomingRevisions.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="book-outline" size={48} color="#6b7280" />
              <Text style={styles.emptyText}>No upcoming revisions</Text>
              <Text style={styles.emptySubtext}>Add topics to start tracking</Text>
            </View>
          ) : (
            upcomingRevisions.map((revision) => renderRevisionCard(revision, false))
          )}
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        <TouchableOpacity style={styles.navButton} onPress={() => router.push('/subjects')}>
          <Ionicons name="library" size={24} color="#fff" />
          <Text style={styles.navButtonText}>Subjects</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.navButton, styles.addButton]}
          onPress={() => router.push('/add-topic')}
        >
          <Ionicons name="add-circle" size={32} color="#4ade80" />
          <Text style={styles.navButtonText}>Add Topic</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f0f1a',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
    flex: 1,
  },
  countBadge: {
    backgroundColor: '#2a2a40',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  countText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 14,
  },
  revisionCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#3b82f6',
  },
  revisionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  subjectBadge: {
    backgroundColor: '#2a2a40',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  subjectBadgeText: {
    color: '#a5b4fc',
    fontSize: 12,
    fontWeight: '600',
  },
  dayBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  dayBadgeText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  topicName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  notesText: {
    fontSize: 14,
    color: '#888',
    marginBottom: 8,
  },
  revisionFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dateText: {
    color: '#888',
    fontSize: 13,
    marginLeft: 4,
  },
  completeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(74, 222, 128, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  completeButtonText: {
    color: '#4ade80',
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  emptyCard: {
    backgroundColor: '#1a1a2e',
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
  },
  emptyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginTop: 12,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 14,
    marginTop: 4,
  },
  bottomNav: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    backgroundColor: '#1a1a2e',
    paddingVertical: 12,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 28 : 12,
    borderTopWidth: 1,
    borderTopColor: '#2a2a40',
  },
  navButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addButton: {
    marginLeft: 16,
  },
  navButtonText: {
    color: '#fff',
    fontSize: 12,
    marginTop: 4,
  },
});

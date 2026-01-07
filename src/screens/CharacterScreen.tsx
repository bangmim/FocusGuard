import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamList } from '../navigation/types';
import { useCharacterStore } from '../store/characterStore';
import { useFocusTimer } from '../hooks/useFocusTimer';
import CharacterDisplay from '../components/CharacterDisplay';

type CharacterScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'Character'
>;

interface CharacterScreenProps {
  navigation: CharacterScreenNavigationProp;
}

const CharacterScreen: React.FC<CharacterScreenProps> = ({ navigation }) => {
  const { charLevel, currentXP, status, totalFocusTime, addXP, reset } =
    useCharacterStore();
  const [isFocusing, setIsFocusing] = useState(false);

  // 집중 타이머 활성화
  useFocusTimer(isFocusing);

  const handleStartFocus = () => {
    setIsFocusing(true);
    Alert.alert(
      '집중 모드 시작',
      '집중 시간이 추적됩니다. 1분마다 경험치가 증가합니다.',
    );
  };

  const handleStopFocus = () => {
    setIsFocusing(false);
    Alert.alert('집중 모드 종료', '집중 시간 추적이 중지되었습니다.');
  };

  const handleTestXP = () => {
    addXP(50);
    Alert.alert('경험치 추가', '경험치 50이 추가되었습니다.');
  };

  const handleReset = () => {
    Alert.alert('캐릭터 초기화', '모든 데이터를 초기화하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '초기화',
        style: 'destructive',
        onPress: () => {
          reset();
          setIsFocusing(false);
          Alert.alert('초기화 완료', '캐릭터가 초기 상태로 돌아갔습니다.');
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>캐릭터 육성</Text>
        <Text style={styles.subtitle}>집중하면 캐릭터가 성장합니다!</Text>
      </View>

      <CharacterDisplay showDetails={true} />

      <View style={styles.controlsContainer}>
        <View style={styles.focusControls}>
          <Text style={styles.sectionTitle}>집중 모드</Text>
          {!isFocusing ? (
            <TouchableOpacity
              style={[styles.button, styles.startButton]}
              onPress={handleStartFocus}
            >
              <Text style={styles.buttonText}>집중 시작</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.button, styles.stopButton]}
              onPress={handleStopFocus}
            >
              <Text style={styles.buttonText}>집중 종료</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.debugSection}>
          <Text style={styles.sectionTitle}>디버그 (테스트용)</Text>
          <TouchableOpacity
            style={[styles.button, styles.testButton]}
            onPress={handleTestXP}
          >
            <Text style={styles.buttonText}>경험치 +50 (테스트)</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.button, styles.resetButton]}
            onPress={handleReset}
          >
            <Text style={styles.buttonText}>초기화</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>현재 상태</Text>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>레벨:</Text>
            <Text style={styles.statValue}>{charLevel}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>경험치:</Text>
            <Text style={styles.statValue}>{currentXP}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>상태:</Text>
            <Text style={styles.statValue}>{status}</Text>
          </View>
          <View style={styles.statRow}>
            <Text style={styles.statLabel}>누적 시간:</Text>
            <Text style={styles.statValue}>
              {Math.floor(totalFocusTime / 60)}분
            </Text>
          </View>
        </View>

        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={[styles.button, styles.navButton]}
            onPress={() => navigation.navigate('FocusTimer')}
          >
            <Text style={styles.buttonText}>집중 타이머로 이동</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#fff',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#666',
  },
  controlsContainer: {
    padding: 16,
  },
  focusControls: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  startButton: {
    backgroundColor: '#4caf50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  testButton: {
    backgroundColor: '#2196f3',
  },
  resetButton: {
    backgroundColor: '#ff9800',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  debugSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statsContainer: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  navigationSection: {
    marginTop: 16,
  },
  navButton: {
    backgroundColor: '#2196f3',
  },
});

export default CharacterScreen;

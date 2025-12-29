import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import { useCharacterStore } from '../store/characterStore';
import { useBlockedAppsStore } from '../store/blockedAppsStore';
import { useFocusTimer } from '../hooks/useFocusTimer';
import { usageStatsModule, usageStatsEmitter } from '../native/UsageStatsModule';
import { overlayModule } from '../native/OverlayModule';
import CharacterDisplay from '../components/CharacterDisplay';

const FocusTimerScreen: React.FC = () => {
  const { startFocus, stopFocus } = useCharacterStore();
  const { isMonitoring, setIsMonitoring, blockedPackages } =
    useBlockedAppsStore();
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusTime, setFocusTime] = useState(0); // 초 단위
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(
    null,
  );

  // 집중 타이머 활성화
  useFocusTimer(isFocusing);

  // 금지 앱 감지 리스너
  useEffect(() => {
    if (!isMonitoring) {
      return;
    }

    const subscription = usageStatsEmitter.addListener(
      'APP_CHANGED',
      async (data: { packageName: string }) => {
        const { packageName } = data;
        const isBlocked = useBlockedAppsStore.getState().isBlocked(packageName);

        if (isBlocked) {
          // 금지 앱 실행 감지 - 오버레이 표시
          console.log('금지 앱 감지:', packageName);
          overlayModule.startOverlayService();
        }
      },
    );

    return () => {
      subscription.remove();
    };
  }, [isMonitoring]);

  // 집중 시간 타이머
  useEffect(() => {
    if (isFocusing) {
      const interval = setInterval(() => {
        setFocusTime(prev => prev + 1);
      }, 1000);
      setTimerInterval(interval);
    } else {
      if (timerInterval) {
        clearInterval(timerInterval);
        setTimerInterval(null);
      }
      setFocusTime(0);
    }

    return () => {
      if (timerInterval) {
        clearInterval(timerInterval);
      }
    };
  }, [isFocusing]);

  const handleStartFocus = async () => {
    // 권한 확인
    const usageStatsGranted =
      await usageStatsModule.isUsageStatsPermissionGranted();
    const overlayGranted = await overlayModule.isOverlayPermissionGranted();

    if (!usageStatsGranted) {
      Alert.alert(
        '권한 필요',
        '사용 통계 접근 권한이 필요합니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => usageStatsModule.requestUsageStatsPermission(),
          },
        ],
      );
      return;
    }

    if (!overlayGranted) {
      Alert.alert(
        '권한 필요',
        '다른 앱 위에 그리기 권한이 필요합니다.',
        [
          { text: '취소', style: 'cancel' },
          {
            text: '설정으로 이동',
            onPress: () => overlayModule.requestOverlayPermission(),
          },
        ],
      );
      return;
    }

    // 집중 시작
    setIsFocusing(true);
    setIsMonitoring(true);
    startFocus();

    // 앱 모니터링 시작 (1초마다 체크)
    usageStatsModule.startMonitoring(1000);

    Alert.alert('집중 모드 시작', '금지된 앱을 실행하면 차단 화면이 표시됩니다.');
  };

  const handleStopFocus = () => {
    Alert.alert('집중 모드 종료', '집중 모드를 종료하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '종료',
        onPress: () => {
          setIsFocusing(false);
          setIsMonitoring(false);
          stopFocus();
          overlayModule.stopOverlayService();
          setFocusTime(0);
          // 모니터링은 자동으로 중지됨 (스레드가 종료되면)
        },
      },
    ]);
  };

  // 시간 포맷팅 (초 -> 시:분:초)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(
        2,
        '0',
      )}:${String(secs).padStart(2, '0')}`;
    } else {
      return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(
        2,
        '0',
      )}`;
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.content}>
        {/* 캐릭터 표시 영역 */}
        <View style={styles.characterSection}>
          <View style={styles.characterContainer}>
            {/* Placeholder 이미지 - 나중에 실제 이미지로 교체 */}
            <View style={styles.characterImagePlaceholder}>
              <Text style={styles.characterEmoji}>
                {useCharacterStore.getState().status === 'EGG' && '🥚'}
                {useCharacterStore.getState().status === 'BABY' && '👶'}
                {useCharacterStore.getState().status === 'CRYING' && '😢'}
                {useCharacterStore.getState().status === 'SLEEPING' && '😴'}
              </Text>
            </View>
          </View>
        </View>

        {/* 타이머 영역 */}
        <View style={styles.timerSection}>
          <Text style={styles.timerText}>{formatTime(focusTime)}</Text>
          <Text style={styles.timerLabel}>집중 시간</Text>
        </View>

        {/* 컨트롤 버튼 */}
        <View style={styles.controlsSection}>
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

        {/* 캐릭터 정보 */}
        <View style={styles.infoSection}>
          <CharacterDisplay showDetails={true} />
        </View>

        {/* 금지 앱 목록 (디버그용) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>금지 앱 목록 (디버그)</Text>
            {blockedPackages.map((pkg, index) => (
              <Text key={index} style={styles.debugText}>
                {pkg}
              </Text>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  characterSection: {
    alignItems: 'center',
    marginTop: 40,
    marginBottom: 30,
  },
  characterContainer: {
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: '#fff',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  characterImagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 100,
  },
  characterEmoji: {
    fontSize: 100,
  },
  timerSection: {
    alignItems: 'center',
    marginBottom: 40,
  },
  timerText: {
    fontSize: 64,
    fontWeight: 'bold',
    color: '#333',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  timerLabel: {
    fontSize: 18,
    color: '#666',
  },
  controlsSection: {
    marginBottom: 30,
  },
  button: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  startButton: {
    backgroundColor: '#4caf50',
  },
  stopButton: {
    backgroundColor: '#f44336',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  infoSection: {
    marginBottom: 20,
  },
  debugSection: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    marginTop: 20,
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  debugText: {
    fontSize: 12,
    color: '#666',
    marginBottom: 4,
  },
});

export default FocusTimerScreen;


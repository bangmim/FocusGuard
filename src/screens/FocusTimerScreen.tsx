import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  ScrollView,
  TextInput,
} from 'react-native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { RootStackParamList } from '../navigation/types';
import { useCharacterStore } from '../store/characterStore';
import { useBlockedAppsStore } from '../store/blockedAppsStore';
import { useFocusTimer } from '../hooks/useFocusTimer';
import {
  usageStatsModule,
  usageStatsEmitter,
} from '../native/UsageStatsModule';
import { overlayModule } from '../native/OverlayModule';
import CharacterDisplay from '../components/CharacterDisplay';
import AnimatedCharacter from '../components/AnimatedCharacter';

type FocusTimerScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  'FocusTimer'
>;

interface FocusTimerScreenProps {
  navigation: FocusTimerScreenNavigationProp;
}

const FocusTimerScreen: React.FC<FocusTimerScreenProps> = ({ navigation }) => {
  const insets = useSafeAreaInsets();
  const { startFocus, stopFocus } = useCharacterStore();
  const { isMonitoring, setIsMonitoring, blockedPackages } =
    useBlockedAppsStore();
  const [isFocusing, setIsFocusing] = useState(false);
  const [focusTime, setFocusTime] = useState(0); // 초 단위
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [detectedApps, setDetectedApps] = useState<
    Array<{ packageName: string; timestamp: number }>
  >([]);
  const [customPackageName, setCustomPackageName] = useState('');

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
        console.log('[FocusTimer] 앱 변경 감지:', packageName);

        // 감지된 앱 목록에 추가 (최대 20개 유지)
        setDetectedApps(prev => {
          const newList = [
            { packageName, timestamp: Date.now() },
            ...prev.filter(app => app.packageName !== packageName),
          ].slice(0, 20);
          return newList;
        });

        const isBlocked = useBlockedAppsStore.getState().isBlocked(packageName);
        console.log(
          '[FocusTimer] 금지 앱 여부:',
          isBlocked,
          '금지 목록:',
          useBlockedAppsStore.getState().blockedPackages,
        );

        if (isBlocked) {
          // 금지 앱 실행 감지 - 오버레이 표시
          console.log('[FocusTimer] 금지 앱 감지! 오버레이 시작:', packageName);
          try {
            await overlayModule.startOverlayService();
            console.log('[FocusTimer] 오버레이 서비스 시작 완료');
          } catch (error) {
            console.error('[FocusTimer] 오버레이 시작 실패:', error);
          }
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
      timerIntervalRef.current = interval;

      return () => {
        if (timerIntervalRef.current) {
          clearInterval(timerIntervalRef.current);
          timerIntervalRef.current = null;
        }
      };
    } else {
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
        timerIntervalRef.current = null;
      }
      setFocusTime(0);
    }
  }, [isFocusing]);

  const handleStartFocus = async () => {
    // 권한 확인
    const usageStatsGranted =
      await usageStatsModule.isUsageStatsPermissionGranted();
    const overlayGranted = await overlayModule.isOverlayPermissionGranted();

    if (!usageStatsGranted) {
      Alert.alert('권한 필요', '사용 통계 접근 권한이 필요합니다.', [
        { text: '취소', style: 'cancel' },
        {
          text: '설정으로 이동',
          onPress: () => usageStatsModule.requestUsageStatsPermission(),
        },
      ]);
      return;
    }

    if (!overlayGranted) {
      Alert.alert('권한 필요', '다른 앱 위에 그리기 권한이 필요합니다.', [
        { text: '취소', style: 'cancel' },
        {
          text: '설정으로 이동',
          onPress: () => overlayModule.requestOverlayPermission(),
        },
      ]);
      return;
    }

    // 집중 시작
    try {
      setIsFocusing(true);
      setIsMonitoring(true);
      startFocus();

      // 앱 모니터링 시작 (500ms마다 체크 - 더 빠른 감지)
      console.log('[FocusTimer] 모니터링 시작, 금지 앱 목록:', blockedPackages);
      usageStatsModule.startMonitoring(500);
    } catch (error) {
      console.error('[FocusTimer] 집중 모드 시작 실패:', error);
      Alert.alert('오류', '집중 모드를 시작하는 중 오류가 발생했습니다.');
      setIsFocusing(false);
      setIsMonitoring(false);
    }

    Alert.alert(
      '집중 모드 시작',
      '금지된 앱을 실행하면 차단 화면이 표시됩니다.',
    );
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
          usageStatsModule.stopMonitoring(); // 모니터링 스레드 명시적으로 중지
          setFocusTime(0);
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
    <ScrollView
      style={styles.container}
      contentContainerStyle={{ paddingBottom: insets.bottom }}
    >
      <View style={styles.content}>
        {/* 캐릭터 표시 영역 */}
        <View style={styles.characterSection}>
          <View style={styles.characterContainer}>
            <AnimatedCharacter
              status={useCharacterStore.getState().status}
              size={200}
            />
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

        {/* 네비게이션 버튼 */}
        <View style={styles.navigationSection}>
          <TouchableOpacity
            style={[styles.button, styles.navButton]}
            onPress={() => navigation.navigate('Character')}
          >
            <Text style={styles.buttonText}>캐릭터 육성 보기</Text>
          </TouchableOpacity>
        </View>

        {/* 테스트 버튼 (디버그용) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>모니터링 테스트</Text>
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={async () => {
                try {
                  console.log('[FocusTimer] 현재 앱 확인 테스트');
                  const currentApp =
                    await usageStatsModule.getCurrentAppPackage();
                  if (currentApp) {
                    Alert.alert('현재 앱', `패키지명: ${currentApp}`);
                    setDetectedApps(prev => {
                      const newList = [
                        { packageName: currentApp, timestamp: Date.now() },
                        ...prev.filter(app => app.packageName !== currentApp),
                      ].slice(0, 20);
                      return newList;
                    });
                  } else {
                    Alert.alert(
                      '알림',
                      '현재 실행 중인 앱을 감지할 수 없습니다.',
                    );
                  }
                } catch (error) {
                  console.error('[FocusTimer] 현재 앱 확인 실패:', error);
                  Alert.alert('오류', '앱 확인 중 오류가 발생했습니다.');
                }
              }}
            >
              <Text style={styles.buttonText}>현재 앱 확인 (테스트)</Text>
            </TouchableOpacity>
            <Text style={styles.debugSubtitle}>
              모니터링 상태: {isMonitoring ? '활성화' : '비활성화'}
            </Text>
          </View>
        )}

        {/* 감지된 앱 목록 (디버그용) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>감지된 앱 목록 (실시간)</Text>
            <Text style={styles.debugSubtitle}>
              앱을 실행하면 여기에 패키지명이 표시됩니다
            </Text>
            {detectedApps.length === 0 ? (
              <Text style={styles.debugText}>아직 감지된 앱이 없습니다</Text>
            ) : (
              detectedApps.map((app, index) => {
                const isBlocked = useBlockedAppsStore
                  .getState()
                  .isBlocked(app.packageName);
                return (
                  <View key={index} style={styles.detectedAppRow}>
                    <Text
                      style={[
                        styles.debugText,
                        isBlocked && styles.blockedAppText,
                      ]}
                    >
                      {app.packageName}
                      {isBlocked && ' ⛔'}
                    </Text>
                    <TouchableOpacity
                      style={styles.addButton}
                      onPress={() => {
                        useBlockedAppsStore
                          .getState()
                          .addBlockedApp(app.packageName);
                        Alert.alert(
                          '추가 완료',
                          `${app.packageName}이(가) 금지 목록에 추가되었습니다.`,
                        );
                      }}
                    >
                      <Text style={styles.addButtonText}>+ 금지</Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 금지 앱 목록 (디버그용) */}
        {__DEV__ && (
          <View style={styles.debugSection}>
            <Text style={styles.debugTitle}>현재 금지 앱 목록</Text>
            {blockedPackages.length === 0 ? (
              <Text style={styles.debugText}>금지된 앱이 없습니다</Text>
            ) : (
              blockedPackages.map((pkg, index) => (
                <View key={index} style={styles.detectedAppRow}>
                  <Text style={styles.debugText}>{pkg}</Text>
                  <TouchableOpacity
                    style={styles.removeButton}
                    onPress={() => {
                      useBlockedAppsStore.getState().removeBlockedApp(pkg);
                      Alert.alert(
                        '제거 완료',
                        `${pkg}이(가) 금지 목록에서 제거되었습니다.`,
                      );
                    }}
                  >
                    <Text style={styles.removeButtonText}>제거</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}

            {/* 패키지명 직접 추가 */}
            <View style={styles.addPackageSection}>
              <Text style={styles.debugSubtitle}>패키지명 직접 추가</Text>
              <TextInput
                style={styles.packageInput}
                placeholder="예: com.ngn.android.webtoon"
                value={customPackageName}
                onChangeText={setCustomPackageName}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <TouchableOpacity
                style={[styles.button, styles.addButton]}
                onPress={() => {
                  if (customPackageName.trim()) {
                    useBlockedAppsStore
                      .getState()
                      .addBlockedApp(customPackageName.trim());
                    Alert.alert(
                      '추가 완료',
                      `${customPackageName.trim()}이(가) 금지 목록에 추가되었습니다.`,
                    );
                    setCustomPackageName('');
                  } else {
                    Alert.alert('알림', '패키지명을 입력해주세요.');
                  }
                }}
              >
                <Text style={styles.buttonText}>금지 목록에 추가</Text>
              </TouchableOpacity>
            </View>
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
    flex: 1,
  },
  debugSubtitle: {
    fontSize: 11,
    color: '#999',
    marginBottom: 8,
    fontStyle: 'italic',
  },
  detectedAppRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 4,
  },
  blockedAppText: {
    color: '#f44336',
    fontWeight: 'bold',
  },
  addButton: {
    backgroundColor: '#4caf50',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  addButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  removeButton: {
    backgroundColor: '#f44336',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  removeButtonText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
  },
  navigationSection: {
    marginBottom: 20,
  },
  navButton: {
    backgroundColor: '#2196f3',
  },
  testButton: {
    backgroundColor: '#9c27b0',
    marginTop: 8,
  },
  addPackageSection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  packageInput: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    marginBottom: 8,
  },
});

export default FocusTimerScreen;

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { usageStatsModule } from '../native/UsageStatsModule';
import { overlayModule } from '../native/OverlayModule';

const PermissionScreen: React.FC = () => {
  const [usageStatsGranted, setUsageStatsGranted] = useState(false);
  const [overlayGranted, setOverlayGranted] = useState(false);

  useEffect(() => {
    checkPermissions();
  }, []);

  const checkPermissions = async () => {
    try {
      const usageStats = await usageStatsModule.isUsageStatsPermissionGranted();
      const overlay = await overlayModule.isOverlayPermissionGranted();
      setUsageStatsGranted(usageStats);
      setOverlayGranted(overlay);
    } catch (error) {
      console.error('권한 확인 오류:', error);
    }
  };

  const handleRequestUsageStats = () => {
    usageStatsModule.requestUsageStatsPermission();
    Alert.alert(
      '권한 설정 안내',
      '설정 화면에서 FocusGuard를 찾아 "사용 통계 접근" 권한을 허용해주세요.\n\n설정 완료 후 돌아오면 자동으로 확인됩니다.',
      [
        {
          text: '확인',
          onPress: () => {
            // 사용자가 설정에서 돌아올 때 권한 재확인
            const interval = setInterval(async () => {
              const granted =
                await usageStatsModule.isUsageStatsPermissionGranted();
              if (granted) {
                setUsageStatsGranted(true);
                clearInterval(interval);
              }
            }, 1000);
          },
        },
      ],
    );
  };

  const handleRequestOverlay = () => {
    overlayModule.requestOverlayPermission();
    Alert.alert(
      '권한 설정 안내',
      '설정 화면에서 FocusGuard를 찾아 "다른 앱 위에 그리기" 권한을 허용해주세요.\n\n설정 완료 후 돌아오면 자동으로 확인됩니다.',
      [
        {
          text: '확인',
          onPress: () => {
            // 사용자가 설정에서 돌아올 때 권한 재확인
            const interval = setInterval(async () => {
              const granted = await overlayModule.isOverlayPermissionGranted();
              if (granted) {
                setOverlayGranted(true);
                clearInterval(interval);
              }
            }, 1000);
          },
        },
      ],
    );
  };

  const handleTestOverlay = () => {
    if (!overlayGranted) {
      Alert.alert(
        '권한 필요',
        '먼저 "다른 앱 위에 그리기" 권한을 허용해주세요.',
      );
      return;
    }
    overlayModule.startOverlayService();
    Alert.alert(
      '알림',
      '오버레이 서비스가 시작되었습니다. 5초 후 자동으로 종료됩니다.',
    );
    setTimeout(() => {
      overlayModule.stopOverlayService();
    }, 5000);
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>FocusGuard 권한 설정</Text>
        <Text style={styles.subtitle}>
          앱 사용량 모니터링과 차단 기능을 위해 다음 권한이 필요합니다.
        </Text>
      </View>

      <View style={styles.section}>
        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionTitle}>사용 통계 접근 권한</Text>
            <View
              style={[
                styles.statusBadge,
                usageStatsGranted ? styles.granted : styles.denied,
              ]}
            >
              <Text style={styles.statusText}>
                {usageStatsGranted ? '허용됨' : '거부됨'}
              </Text>
            </View>
          </View>
          <Text style={styles.permissionDescription}>
            현재 실행 중인 앱을 감지하여 차단 기능을 제공하기 위해 필요합니다.
            {'\n\n'}
            설정 방법:
            {'\n'}1. 아래 버튼을 눌러 설정 화면으로 이동
            {'\n'}2. "사용 통계 접근" 또는 "사용 현황 접근" 찾기
            {'\n'}3. FocusGuard 선택 후 허용
          </Text>
          <TouchableOpacity
            style={[styles.button, usageStatsGranted && styles.buttonDisabled]}
            onPress={handleRequestUsageStats}
            disabled={usageStatsGranted}
          >
            <Text style={styles.buttonText}>
              {usageStatsGranted ? '권한 허용됨' : '권한 설정하기'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.permissionCard}>
          <View style={styles.permissionHeader}>
            <Text style={styles.permissionTitle}>다른 앱 위에 그리기 권한</Text>
            <View
              style={[
                styles.statusBadge,
                overlayGranted ? styles.granted : styles.denied,
              ]}
            >
              <Text style={styles.statusText}>
                {overlayGranted ? '허용됨' : '거부됨'}
              </Text>
            </View>
          </View>
          <Text style={styles.permissionDescription}>
            차단 화면을 다른 앱 위에 표시하기 위해 필요합니다.
            {'\n\n'}
            설정 방법:
            {'\n'}1. 아래 버튼을 눌러 설정 화면으로 이동
            {'\n'}2. "다른 앱 위에 그리기" 또는 "앱 표시" 찾기
            {'\n'}3. FocusGuard 선택 후 허용
          </Text>
          <TouchableOpacity
            style={[styles.button, overlayGranted && styles.buttonDisabled]}
            onPress={handleRequestOverlay}
            disabled={overlayGranted}
          >
            <Text style={styles.buttonText}>
              {overlayGranted ? '권한 허용됨' : '권한 설정하기'}
            </Text>
          </TouchableOpacity>
        </View>

        {usageStatsGranted && overlayGranted && (
          <View style={styles.testSection}>
            <Text style={styles.testTitle}>권한 테스트</Text>
            <Text style={styles.testDescription}>
              모든 권한이 허용되었습니다. 오버레이 기능을 테스트해보세요.
            </Text>
            <TouchableOpacity
              style={[styles.button, styles.testButton]}
              onPress={handleTestOverlay}
            >
              <Text style={styles.buttonText}>오버레이 테스트</Text>
            </TouchableOpacity>
          </View>
        )}

        <TouchableOpacity
          style={[styles.button, styles.refreshButton]}
          onPress={checkPermissions}
        >
          <Text style={styles.buttonText}>권한 상태 새로고침</Text>
        </TouchableOpacity>
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
    lineHeight: 20,
  },
  section: {
    padding: 16,
  },
  permissionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
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
  permissionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  permissionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  granted: {
    backgroundColor: '#4caf50',
  },
  denied: {
    backgroundColor: '#f44336',
  },
  statusText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  permissionDescription: {
    fontSize: 14,
    color: '#666',
    lineHeight: 20,
    marginBottom: 16,
  },
  button: {
    backgroundColor: '#2196f3',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonDisabled: {
    backgroundColor: '#9e9e9e',
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  testSection: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 20,
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#4caf50',
  },
  testTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  testDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 16,
  },
  testButton: {
    backgroundColor: '#4caf50',
  },
  refreshButton: {
    backgroundColor: '#ff9800',
    marginTop: 8,
  },
});

export default PermissionScreen;

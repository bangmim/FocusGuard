import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useCharacterStore, CharacterStatus } from '../store/characterStore';
import AnimatedCharacter from './AnimatedCharacter';

interface CharacterDisplayProps {
  showDetails?: boolean;
}

const CharacterDisplay: React.FC<CharacterDisplayProps> = ({
  showDetails = true,
}) => {
  const { charLevel, currentXP, status, totalFocusTime } = useCharacterStore();

  // 상태별 표시 텍스트
  const statusText: Record<CharacterStatus, string> = {
    EGG: '🥚 알',
    BABY: '👶 아기',
    CRYING: '😢 울고 있음',
    SLEEPING: '😴 잠자는 중',
  };

  // 다음 진화까지 필요한 경험치 계산
  const getNextEvolutionXP = (): number => {
    switch (status) {
      case 'EGG':
        return 100;
      case 'BABY':
        return 300;
      case 'CRYING':
        return 500;
      case 'SLEEPING':
        return 0; // 최종 진화
      default:
        return 0;
    }
  };

  const nextEvolutionXP = getNextEvolutionXP();
  const progressPercentage =
    nextEvolutionXP > 0
      ? Math.min((currentXP / nextEvolutionXP) * 100, 100)
      : 100;

  // 시간 포맷팅 (초 -> 시:분:초)
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}시간 ${minutes}분 ${secs}초`;
    } else if (minutes > 0) {
      return `${minutes}분 ${secs}초`;
    } else {
      return `${secs}초`;
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.characterCard}>
        <AnimatedCharacter status={status} size={120} />
        <Text style={styles.statusText}>{statusText[status]}</Text>
        <Text style={styles.levelText}>레벨 {charLevel}</Text>
      </View>

      {showDetails && (
        <View style={styles.detailsContainer}>
          <View style={styles.xpContainer}>
            <Text style={styles.label}>경험치</Text>
            <Text style={styles.value}>
              {currentXP} / {nextEvolutionXP > 0 ? nextEvolutionXP : 'MAX'} XP
            </Text>
            {nextEvolutionXP > 0 && (
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    { width: `${progressPercentage}%` },
                  ]}
                />
              </View>
            )}
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.label}>누적 집중 시간</Text>
            <Text style={styles.value}>{formatTime(totalFocusTime)}</Text>
          </View>
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  characterCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
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
  statusText: {
    fontSize: 20,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  levelText: {
    fontSize: 16,
    color: '#666',
  },
  detailsContainer: {
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
  xpContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#e0e0e0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#4caf50',
    borderRadius: 4,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

export default CharacterDisplay;

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CharacterStatus = 'EGG' | 'BABY' | 'CRYING' | 'SLEEPING';

export interface CharacterState {
  charLevel: number;
  currentXP: number;
  status: CharacterStatus;
  totalFocusTime: number; // 초 단위
  lastFocusUpdateTime: number; // 마지막 집중 시간 업데이트 시각 (타임스탬프)
}

interface CharacterActions {
  // 집중 시간 추가 (초 단위)
  addFocusTime: (seconds: number) => void;
  // 경험치 직접 추가
  addXP: (xp: number) => void;
  // 레벨 업
  levelUp: () => void;
  // 진화 체크
  checkEvolution: () => void;
  // 상태 초기화
  reset: () => void;
  // 집중 시작
  startFocus: () => void;
  // 집중 종료
  stopFocus: () => void;
}

// 진화에 필요한 경험치 (레벨별)
const EVOLUTION_XP_THRESHOLDS = {
  EGG: 100, // EGG -> BABY
  BABY: 300, // BABY -> CRYING
  CRYING: 500, // CRYING -> SLEEPING
};

// 레벨업에 필요한 경험치 (레벨당)
const XP_PER_LEVEL = 100;

// 진화 순서
const EVOLUTION_SEQUENCE: CharacterStatus[] = [
  'EGG',
  'BABY',
  'CRYING',
  'SLEEPING',
];

// 초기 상태
const initialState: CharacterState = {
  charLevel: 1,
  currentXP: 0,
  status: 'EGG',
  totalFocusTime: 0,
  lastFocusUpdateTime: 0,
};

export const useCharacterStore = create<CharacterState & CharacterActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      // 집중 시간 추가 (1분 = 60초마다 경험치 +10)
      addFocusTime: (seconds: number) => {
        const state = get();
        const newTotalTime = state.totalFocusTime + seconds;

        // 1분(60초)마다 경험치 10씩 증가
        const minutesAdded = Math.floor(seconds / 60);
        const xpToAdd = minutesAdded * 10;

        if (xpToAdd > 0) {
          set(prevState => {
            const newXP = prevState.currentXP + xpToAdd;
            return {
              ...prevState,
              totalFocusTime: newTotalTime,
              currentXP: newXP,
            };
          });

          // 경험치 추가 후 레벨업 및 진화 체크
          get().checkEvolution();
        } else {
          set({ totalFocusTime: newTotalTime });
        }
      },

      // 경험치 직접 추가
      addXP: (xp: number) => {
        set(prevState => ({
          ...prevState,
          currentXP: prevState.currentXP + xp,
        }));
        get().checkEvolution();
      },

      // 레벨 업
      levelUp: () => {
        set(prevState => {
          const newLevel = prevState.charLevel + 1;
          // 레벨업 시 경험치는 다음 레벨 기준으로 조정
          return {
            ...prevState,
            charLevel: newLevel,
            currentXP: Math.max(
              0,
              prevState.currentXP - prevState.charLevel * XP_PER_LEVEL,
            ),
          };
        });
      },

      // 진화 체크 및 실행
      checkEvolution: () => {
        const state = get();
        const currentStatusIndex = EVOLUTION_SEQUENCE.indexOf(state.status);

        // 이미 최종 진화 상태면 리턴
        if (currentStatusIndex === EVOLUTION_SEQUENCE.length - 1) {
          return;
        }

        // 현재 상태에 따른 진화 경험치 임계값
        let evolutionThreshold = 0;
        if (state.status === 'EGG') {
          evolutionThreshold = EVOLUTION_XP_THRESHOLDS.EGG;
        } else if (state.status === 'BABY') {
          evolutionThreshold = EVOLUTION_XP_THRESHOLDS.BABY;
        } else if (state.status === 'CRYING') {
          evolutionThreshold = EVOLUTION_XP_THRESHOLDS.CRYING;
        }

        // 경험치가 임계값을 넘으면 진화
        if (
          state.currentXP >= evolutionThreshold &&
          currentStatusIndex < EVOLUTION_SEQUENCE.length - 1
        ) {
          const nextStatusIndex = currentStatusIndex + 1;
          const nextStatus = EVOLUTION_SEQUENCE[
            nextStatusIndex
          ] as CharacterStatus;

          set({
            status: nextStatus,
            currentXP: state.currentXP - evolutionThreshold, // 진화 후 남은 경험치
          });
        }
      },

      // 상태 초기화
      reset: () => {
        set(initialState);
      },

      // 집중 시작
      startFocus: () => {
        set({
          lastFocusUpdateTime: Date.now(),
        });
      },

      // 집중 종료
      stopFocus: () => {
        const state = get();
        if (state.lastFocusUpdateTime > 0) {
          const focusDuration = Math.floor(
            (Date.now() - state.lastFocusUpdateTime) / 1000,
          ); // 초 단위
          if (focusDuration > 0) {
            get().addFocusTime(focusDuration);
          }
        }
        set({
          lastFocusUpdateTime: 0,
        });
      },
    }),
    {
      name: 'character-storage', // AsyncStorage 키
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);

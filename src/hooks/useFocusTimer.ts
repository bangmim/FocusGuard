import { useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useCharacterStore } from '../store/characterStore';

/**
 * 집중 시간을 자동으로 추적하는 훅
 * 1분마다 경험치를 자동으로 증가시킵니다.
 */
export const useFocusTimer = (isActive: boolean) => {
  const { addFocusTime, startFocus, stopFocus } = useCharacterStore();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const lastUpdateTimeRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!isActive) {
      // 집중 모드가 비활성화되면 타이머 정리
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      stopFocus();
      return;
    }

    // 집중 시작
    startFocus();
    lastUpdateTimeRef.current = Date.now();

    // 1분(60초)마다 경험치 추가
    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = Math.floor(
        (now - lastUpdateTimeRef.current) / 1000,
      );

      if (elapsedSeconds >= 60) {
        // 1분 이상 경과했으면 경험치 추가
        addFocusTime(60);
        lastUpdateTimeRef.current = now;
      }
    }, 60000); // 1분마다 체크

    // 앱 상태 변경 감지 (백그라운드/포그라운드)
    const subscription = AppState.addEventListener(
      'change',
      (nextAppState: AppStateStatus) => {
        const now = Date.now();

        if (
          appStateRef.current.match(/inactive|background/) &&
          nextAppState === 'active'
        ) {
          // 앱이 포그라운드로 돌아옴
          const elapsedSeconds = Math.floor(
            (now - lastUpdateTimeRef.current) / 1000,
          );
          if (elapsedSeconds >= 60) {
            addFocusTime(Math.min(elapsedSeconds, 60)); // 최대 1분까지만
          }
          lastUpdateTimeRef.current = now;
        } else if (
          appStateRef.current === 'active' &&
          nextAppState.match(/inactive|background/)
        ) {
          // 앱이 백그라운드로 감
          const elapsedSeconds = Math.floor(
            (now - lastUpdateTimeRef.current) / 1000,
          );
          if (elapsedSeconds >= 60) {
            addFocusTime(Math.min(elapsedSeconds, 60)); // 최대 1분까지만
          }
          lastUpdateTimeRef.current = now;
        }

        appStateRef.current = nextAppState;
      },
    );

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      subscription.remove();
      stopFocus();
    };
  }, [isActive, addFocusTime, startFocus, stopFocus]);
};

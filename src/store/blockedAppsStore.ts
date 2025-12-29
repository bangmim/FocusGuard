import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

interface BlockedAppsState {
  blockedPackages: string[]; // 패키지명 배열
  isMonitoring: boolean; // 모니터링 활성화 여부
}

interface BlockedAppsActions {
  addBlockedApp: (packageName: string) => void;
  removeBlockedApp: (packageName: string) => void;
  setBlockedApps: (packages: string[]) => void;
  setIsMonitoring: (isMonitoring: boolean) => void;
  isBlocked: (packageName: string) => boolean;
  reset: () => void;
}

// 기본 금지 앱 목록 (인스타그램, 유튜브 등)
const DEFAULT_BLOCKED_APPS = [
  'com.instagram.android', // Instagram
  'com.google.android.youtube', // YouTube
  'com.facebook.katana', // Facebook
  'com.twitter.android', // Twitter
  'com.snapchat.android', // Snapchat
  'com.netflix.mediaclient', // Netflix
  'com.tiktok.android', // TikTok
];

const initialState: BlockedAppsState = {
  blockedPackages: DEFAULT_BLOCKED_APPS,
  isMonitoring: false,
};

export const useBlockedAppsStore = create<
  BlockedAppsState & BlockedAppsActions
>()(
  persist(
    (set, get) => ({
      ...initialState,

      addBlockedApp: (packageName: string) => {
        set(state => {
          if (!state.blockedPackages.includes(packageName)) {
            return {
              blockedPackages: [...state.blockedPackages, packageName],
            };
          }
          return state;
        });
      },

      removeBlockedApp: (packageName: string) => {
        set(state => ({
          blockedPackages: state.blockedPackages.filter(
            pkg => pkg !== packageName,
          ),
        }));
      },

      setBlockedApps: (packages: string[]) => {
        set({ blockedPackages: packages });
      },

      setIsMonitoring: (isMonitoring: boolean) => {
        set({ isMonitoring });
      },

      isBlocked: (packageName: string) => {
        return get().blockedPackages.includes(packageName);
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'blocked-apps-storage',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);


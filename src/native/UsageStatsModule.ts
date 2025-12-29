import { NativeModules, NativeEventEmitter } from 'react-native';

const { UsageStatsModule } = NativeModules;

export interface UsageStatsModuleType {
  isUsageStatsPermissionGranted(): Promise<boolean>;
  requestUsageStatsPermission(): void;
  getCurrentAppPackage(): Promise<string | null>;
  startMonitoring(intervalMs: number): void;
}

export const usageStatsModule = UsageStatsModule as UsageStatsModuleType;

export const usageStatsEmitter = new NativeEventEmitter(UsageStatsModule);

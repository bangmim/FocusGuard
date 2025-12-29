import { NativeModules } from 'react-native';

const { OverlayModule } = NativeModules;

export interface OverlayModuleType {
  isOverlayPermissionGranted(): Promise<boolean>;
  requestOverlayPermission(): void;
  startOverlayService(): void;
  stopOverlayService(): void;
}

export const overlayModule = OverlayModule as OverlayModuleType;

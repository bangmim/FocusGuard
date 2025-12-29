package com.focusguard

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*

class OverlayModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {

    override fun getName(): String {
        return "OverlayModule"
    }

    /**
     * SYSTEM_ALERT_WINDOW 권한이 허용되어 있는지 확인
     */
    @ReactMethod
    fun isOverlayPermissionGranted(promise: Promise) {
        try {
            val granted = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(reactApplicationContext)
            } else {
                true
            }
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", "권한 확인 중 오류 발생: ${e.message}", e)
        }
    }

    /**
     * SYSTEM_ALERT_WINDOW 권한 요청 화면으로 이동
     */
    @ReactMethod
    fun requestOverlayPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                val intent = Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${reactApplicationContext.packageName}")
                )
                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                reactApplicationContext.startActivity(intent)
            }
        } catch (e: Exception) {
            // 권한 요청 실패 처리
        }
    }

    /**
     * Overlay 서비스 시작
     */
    @ReactMethod
    fun startOverlayService() {
        try {
            val intent = Intent(reactApplicationContext, OverlayService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactApplicationContext.startForegroundService(intent)
            } else {
                reactApplicationContext.startService(intent)
            }
        } catch (e: Exception) {
            // 서비스 시작 실패 처리
        }
    }

    /**
     * Overlay 서비스 중지
     */
    @ReactMethod
    fun stopOverlayService() {
        try {
            val intent = Intent(reactApplicationContext, OverlayService::class.java)
            reactApplicationContext.stopService(intent)
        } catch (e: Exception) {
            // 서비스 중지 실패 처리
        }
    }
}


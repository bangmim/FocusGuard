package com.focusguard

import android.app.AppOpsManager
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.provider.Settings
import com.facebook.react.bridge.*
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.TimeUnit

class UsageStatsModule(reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
    
    private val usageStatsManager: UsageStatsManager? by lazy {
        reactContext.getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
    }
    
    @Volatile
    private var monitoringThread: Thread? = null

    override fun getName(): String {
        return "UsageStatsModule"
    }

    /**
     * Usage Stats 권한이 허용되어 있는지 확인
     */
    @ReactMethod
    fun isUsageStatsPermissionGranted(promise: Promise) {
        try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            }
            
            val granted = mode == AppOpsManager.MODE_ALLOWED
            promise.resolve(granted)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", "권한 확인 중 오류 발생: ${e.message}", e)
        }
    }

    /**
     * Usage Stats 설정 화면으로 이동
     */
    @ReactMethod
    fun requestUsageStatsPermission() {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS)
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            reactApplicationContext.startActivity(intent)
        } catch (e: Exception) {
            sendEvent("ERROR", createErrorMap("설정 화면 열기 실패: ${e.message}"))
        }
    }

    /**
     * 현재 실행 중인 앱의 패키지명 가져오기
     */
    @ReactMethod
    fun getCurrentAppPackage(promise: Promise) {
        try {
            if (!isUsageStatsPermissionGrantedSync()) {
                promise.reject("PERMISSION_DENIED", "Usage Stats 권한이 필요합니다")
                return
            }

            val currentTime = System.currentTimeMillis()
            val stats = usageStatsManager?.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                currentTime - TimeUnit.MINUTES.toMillis(1),
                currentTime
            )

            if (stats.isNullOrEmpty()) {
                promise.resolve(null)
                return
            }

            // 가장 최근에 사용된 앱 찾기
            var mostRecentUsedApp: UsageStats? = null
            for (usageStats in stats) {
                if (mostRecentUsedApp == null || 
                    usageStats.lastTimeUsed > mostRecentUsedApp.lastTimeUsed) {
                    mostRecentUsedApp = usageStats
                }
            }

            val packageName = mostRecentUsedApp?.packageName
            promise.resolve(packageName)
        } catch (e: Exception) {
            promise.reject("GET_CURRENT_APP_ERROR", "현재 앱 정보 가져오기 실패: ${e.message}", e)
        }
    }

    /**
     * 앱 사용량 모니터링 시작 (주기적으로 이벤트 전송)
     */
    @ReactMethod
    fun startMonitoring(intervalMs: Int) {
        try {
            // 기존 모니터링 스레드가 있으면 중지
            stopMonitoring()
            
            if (!isUsageStatsPermissionGrantedSync()) {
                sendEvent("ERROR", createErrorMap("Usage Stats 권한이 필요합니다"))
                return
            }

            // 모니터링 로직은 별도 스레드에서 실행
            val thread = Thread {
                var lastPackageName: String? = null
                while (!Thread.currentThread().isInterrupted) {
                    try {
                        val currentTime = System.currentTimeMillis()
                        val stats = usageStatsManager?.queryUsageStats(
                            UsageStatsManager.INTERVAL_BEST,
                            currentTime - TimeUnit.SECONDS.toMillis(5),
                            currentTime
                        )

                        if (!stats.isNullOrEmpty()) {
                            var mostRecentUsedApp: UsageStats? = null
                            for (usageStats in stats) {
                                if (mostRecentUsedApp == null || 
                                    usageStats.lastTimeUsed > mostRecentUsedApp.lastTimeUsed) {
                                    mostRecentUsedApp = usageStats
                                }
                            }

                            val currentPackageName = mostRecentUsedApp?.packageName
                            if (currentPackageName != null && currentPackageName != lastPackageName) {
                                lastPackageName = currentPackageName
                                val params = Arguments.createMap()
                                params.putString("packageName", currentPackageName)
                                sendEvent("APP_CHANGED", params)
                            }
                        }

                        Thread.sleep(intervalMs.toLong())
                    } catch (e: InterruptedException) {
                        Thread.currentThread().interrupt()
                        break
                    } catch (e: Exception) {
                        sendEvent("ERROR", createErrorMap("모니터링 중 오류: ${e.message}"))
                        break
                    }
                }
                monitoringThread = null
            }
            
            monitoringThread = thread
            thread.start()
        } catch (e: Exception) {
            sendEvent("ERROR", createErrorMap("모니터링 시작 실패: ${e.message}"))
        }
    }

    /**
     * 앱 사용량 모니터링 중지
     */
    @ReactMethod
    fun stopMonitoring() {
        monitoringThread?.let { thread ->
            if (thread.isAlive) {
                thread.interrupt()
            }
            monitoringThread = null
        }
    }

    /**
     * 동기적으로 Usage Stats 권한 확인
     */
    private fun isUsageStatsPermissionGrantedSync(): Boolean {
        return try {
            val appOps = reactApplicationContext.getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    android.os.Process.myUid(),
                    reactApplicationContext.packageName
                )
            }
            mode == AppOpsManager.MODE_ALLOWED
        } catch (e: Exception) {
            false
        }
    }

    /**
     * React Native로 이벤트 전송
     */
    private fun sendEvent(eventName: String, params: WritableMap?) {
        reactApplicationContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
            .emit(eventName, params)
    }

    /**
     * 에러 맵 생성
     */
    private fun createErrorMap(message: String): WritableMap {
        val errorMap = Arguments.createMap()
        errorMap.putString("message", message)
        return errorMap
    }
}


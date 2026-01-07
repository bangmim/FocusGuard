package com.focusguard

import android.app.*
import android.app.usage.UsageStats
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.WritableMap
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.concurrent.TimeUnit
import android.content.SharedPreferences
import android.app.ActivityManager

class MonitoringService : Service() {
    
    private var usageStatsManager: UsageStatsManager? = null
    private var monitoringThread: Thread? = null
    private var isMonitoring = false
    private var intervalMs = 300L // 더 빠른 감지를 위해 300ms로 단축
    private var lastCheckedPackageName: String? = null // 마지막으로 체크한 앱
    
    private val CHANNEL_ID = "FocusGuardMonitoringChannel"
    private val NOTIFICATION_ID = 2
    
    // 기본 금지 앱 목록
    private val defaultBlockedApps = setOf(
        "com.instagram.android",
        "com.google.android.youtube",
        "com.facebook.katana",
        "com.twitter.android",
        "com.snapchat.android",
        "com.netflix.mediaclient",
        "com.tiktok.android"
    )
    
    private fun getCurrentForegroundApp(): String? {
        // 현재 포그라운드 앱 확인
        try {
            val time = System.currentTimeMillis()
            val stats = usageStatsManager?.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                time - 1000, // 1초 전부터
                time
            )
            
            if (stats != null && stats.isNotEmpty()) {
                // 가장 최근에 사용된 앱 찾기
                var mostRecentUsedApp: UsageStats? = null
                var latestTime: Long = 0
                
                for (usageStats in stats) {
                    val appTime = maxOf(
                        usageStats.lastTimeUsed,
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                            usageStats.lastTimeVisible
                        } else {
                            usageStats.lastTimeUsed
                        }
                    )
                    
                    if (appTime > latestTime) {
                        latestTime = appTime
                        mostRecentUsedApp = usageStats
                    }
                }
                
                return mostRecentUsedApp?.packageName
            }
        } catch (e: Exception) {
            android.util.Log.e("MonitoringService", "포그라운드 앱 확인 실패: ${e.message}", e)
        }
        return null
    }
    
    private fun getBlockedApps(): Set<String> {
        val packages = mutableSetOf<String>()
        packages.addAll(defaultBlockedApps) // 기본 목록 먼저 추가
        
        // SharedPreferences에서 금지 앱 목록 가져오기
        // AsyncStorage는 SharedPreferences를 사용하므로 "blocked-apps-storage" 키로 저장됨
        try {
            val prefs = getSharedPreferences("blocked-apps-storage", Context.MODE_PRIVATE)
            
            // Zustand persist는 전체 객체를 JSON 문자열로 저장
            // 형식: {"state":{"blockedPackages":["pkg1","pkg2"],"isMonitoring":false},"version":0}
            val allKeys = prefs.all
            android.util.Log.d("MonitoringService", "SharedPreferences 모든 키: ${allKeys.keys}")
            
            // "state" 키로 저장된 JSON 문자열 찾기
            val blockedAppsJson = prefs.getString("state", null)
            
            android.util.Log.d("MonitoringService", "SharedPreferences JSON (state): $blockedAppsJson")
            
            if (blockedAppsJson != null) {
                try {
                    // JSON 파싱: blockedPackages 배열 추출
                    var jsonStr = blockedAppsJson.trim()
                    
                    // "blockedPackages" 키 찾기
                    val packagesStart = jsonStr.indexOf("\"blockedPackages\"")
                    if (packagesStart != -1) {
                        val arrayStart = jsonStr.indexOf("[", packagesStart)
                        val arrayEnd = jsonStr.indexOf("]", arrayStart)
                        
                        if (arrayStart != -1 && arrayEnd != -1) {
                            val arrayContent = jsonStr.substring(arrayStart + 1, arrayEnd)
                            
                            // 빈 배열인 경우 처리
                            if (arrayContent.isNotBlank()) {
                                val packageList = arrayContent.split(",")
                                    .map { it.trim().removeSurrounding("\"", "\"") }
                                    .filter { it.isNotEmpty() && it != "null" && !it.contains(":") && !it.contains("{") && !it.contains("}") }
                                
                                packages.addAll(packageList)
                                android.util.Log.d("MonitoringService", "✅ 파싱된 패키지: $packageList")
                            } else {
                                android.util.Log.d("MonitoringService", "금지 앱 목록이 비어있음")
                            }
                        }
                    } else {
                        android.util.Log.w("MonitoringService", "blockedPackages 키를 찾을 수 없음")
                    }
                } catch (e: Exception) {
                    android.util.Log.e("MonitoringService", "JSON 파싱 오류: ${e.message}", e)
                    e.printStackTrace()
                }
            } else {
                android.util.Log.w("MonitoringService", "SharedPreferences에 'state' 키가 없음")
            }
        } catch (e: Exception) {
            android.util.Log.e("MonitoringService", "금지 앱 목록 로드 실패: ${e.message}", e)
            e.printStackTrace()
        }
        
        android.util.Log.d("MonitoringService", "✅ 최종 금지 앱 목록 (${packages.size}개): $packages")
        return packages
    }
    
    override fun onCreate() {
        super.onCreate()
        usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager
        createNotificationChannel()
    }
    
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            intervalMs = intent?.getLongExtra("intervalMs", 500L) ?: 500L
            
            // 알림 채널이 생성되었는지 확인
            createNotificationChannel()
            
            // startForeground는 반드시 onCreate나 onStartCommand에서 호출되어야 함
            // Android 14+ (targetSdk 36)에서는 FOREGROUND_SERVICE_SPECIAL_USE 권한 필요
            try {
                val notification = createNotification()
                startForeground(NOTIFICATION_ID, notification)
                android.util.Log.d("MonitoringService", "Foreground 서비스 시작 성공")
            } catch (e: SecurityException) {
                android.util.Log.e("MonitoringService", "Foreground 서비스 시작 실패 (권한 오류): ${e.message}", e)
                // 권한 오류가 발생해도 모니터링은 시작 시도
            } catch (e: Exception) {
                android.util.Log.e("MonitoringService", "Foreground 서비스 시작 실패: ${e.message}", e)
            }
            
            startMonitoring()
            android.util.Log.d("MonitoringService", "서비스 시작 완료: intervalMs=$intervalMs")
        } catch (e: Exception) {
            android.util.Log.e("MonitoringService", "서비스 시작 실패: ${e.message}", e)
            // 에러가 발생해도 서비스는 계속 실행 (모니터링 시도)
            try {
                startMonitoring()
            } catch (e2: Exception) {
                android.util.Log.e("MonitoringService", "모니터링 시작도 실패: ${e2.message}", e2)
                stopSelf()
            }
        }
        return START_STICKY
    }
    
    override fun onBind(intent: Intent?): IBinder? {
        return null
    }
    
    override fun onDestroy() {
        super.onDestroy()
        stopMonitoring()
    }
    
    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val notificationManager = getSystemService(NotificationManager::class.java)
                // 이미 채널이 존재하는지 확인
                if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        "FocusGuard 모니터링",
                        NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "집중 모드 앱 모니터링 서비스"
                    }
                    notificationManager.createNotificationChannel(channel)
                }
            } catch (e: Exception) {
                android.util.Log.e("MonitoringService", "알림 채널 생성 실패: ${e.message}", e)
            }
        }
    }
    
    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FocusGuard 모니터링 중")
            .setContentText("집중 모드가 활성화되어 있습니다")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .build()
    }
    
    private fun startMonitoring() {
        if (isMonitoring) {
            return
        }
        
        isMonitoring = true
        
        monitoringThread = Thread {
            var lastPackageName: String? = null
            android.util.Log.d("MonitoringService", "모니터링 스레드 시작")
            while (isMonitoring && !Thread.currentThread().isInterrupted) {
                try {
                    // 현재 포그라운드 앱 패키지 이름만 확인 (감지 시간 없이)
                    val currentPackageName = getCurrentForegroundApp()
                    
                    android.util.Log.v("MonitoringService", "현재 포그라운드 앱: $currentPackageName")
                    
                    // FocusGuard 앱이면 오버레이 서비스 종료하고 체크하지 않음 (우선 체크)
                    if (currentPackageName == applicationContext.packageName) {
                        // 항상 오버레이 서비스를 종료 (재시작 방지)
                        android.util.Log.d("MonitoringService", "FocusGuard 앱 감지, 오버레이 서비스 즉시 종료")
                        try {
                            val overlayStopIntent = Intent(applicationContext, OverlayService::class.java)
                            applicationContext.stopService(overlayStopIntent)
                            android.util.Log.d("MonitoringService", "오버레이 서비스 종료 완료")
                        } catch (e: Exception) {
                            android.util.Log.e("MonitoringService", "오버레이 서비스 종료 실패: ${e.message}", e)
                        }
                        lastPackageName = currentPackageName // 업데이트하여 다음 루프에서도 스킵
                        Thread.sleep(intervalMs)
                        continue // 다음 루프로
                    }
                    
                    // FocusGuard가 아닌 경우 항상 금지 앱 체크 (백그라운드에서 포그라운드로 돌아왔을 때도 체크)
                    if (currentPackageName != null) {
                        // 앱이 변경되었을 때만 이벤트 전송
                        if (currentPackageName != lastPackageName) {
                            lastPackageName = currentPackageName
                            
                            // 이벤트 전송 (React Native에서도 처리)
                            val params = Arguments.createMap()
                            params.putString("packageName", currentPackageName)
                            android.util.Log.d("MonitoringService", "이벤트 전송 시도: APP_CHANGED")
                            sendEvent("APP_CHANGED", params)
                            android.util.Log.d("MonitoringService", "이벤트 전송 완료")
                        }
                        
                        // 금지 앱 목록 확인 (매번 체크)
                        val blockedApps = getBlockedApps()
                        val isBlocked = blockedApps.contains(currentPackageName)
                        
                        android.util.Log.d("MonitoringService", "현재 앱: $currentPackageName, 금지 여부: $isBlocked")
                        
                        // 금지 앱이면 오버레이 시작 (오버레이가 없을 때만)
                        if (isBlocked) {
                            // 오버레이 차단 플래그 확인 (앱으로 돌아가기 버튼 클릭 후 일시적 차단)
                            val prefs = getSharedPreferences("focusguard_prefs", Context.MODE_PRIVATE)
                            val overlayBlockedUntil = prefs.getLong("overlay_blocked_until", 0)
                            val isOverlayBlocked = System.currentTimeMillis() < overlayBlockedUntil
                            
                            if (isOverlayBlocked) {
                                android.util.Log.d("MonitoringService", "오버레이 차단 중 (앱으로 돌아가기 후 일시적 차단)")
                                Thread.sleep(intervalMs)
                                continue
                            }
                            
                            // 오버레이 서비스가 실행 중인지 확인
                            val isOverlayRunning = isServiceRunning(OverlayService::class.java)
                            
                            if (!isOverlayRunning) {
                                android.util.Log.w("MonitoringService", "⚠️ 금지 앱 감지! 오버레이 시작: $currentPackageName")
                                android.util.Log.d("MonitoringService", "전체 금지 목록: $blockedApps")
                                try {
                                    // 오버레이 권한 확인
                                    val canDrawOverlays = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                        android.provider.Settings.canDrawOverlays(applicationContext)
                                    } else {
                                        true
                                    }
                                    
                                    android.util.Log.d("MonitoringService", "오버레이 권한: $canDrawOverlays")
                                    
                                    if (canDrawOverlays) {
                                        val overlayIntent = Intent(applicationContext, OverlayService::class.java)
                                        overlayIntent.putExtra("blockedPackageName", currentPackageName)
                                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                            applicationContext.startForegroundService(overlayIntent)
                                        } else {
                                            applicationContext.startService(overlayIntent)
                                        }
                                        android.util.Log.d("MonitoringService", "✅ 오버레이 서비스 시작 완료")
                                    } else {
                                        android.util.Log.w("MonitoringService", "❌ 오버레이 권한이 없습니다")
                                    }
                                } catch (e: Exception) {
                                    android.util.Log.e("MonitoringService", "❌ 오버레이 시작 실패: ${e.message}", e)
                                    e.printStackTrace()
                                }
                            } else {
                                android.util.Log.d("MonitoringService", "오버레이 서비스가 이미 실행 중입니다")
                            }
                        } else {
                            // 허용된 앱이면 오버레이 서비스 종료
                            if (currentPackageName != lastPackageName) {
                                try {
                                    val overlayStopIntent = Intent(applicationContext, OverlayService::class.java)
                                    applicationContext.stopService(overlayStopIntent)
                                    android.util.Log.d("MonitoringService", "허용된 앱으로 변경, 오버레이 서비스 종료")
                                } catch (e: Exception) {
                                    android.util.Log.e("MonitoringService", "오버레이 서비스 종료 실패: ${e.message}", e)
                                }
                            }
                        }
                    }
                    
                    Thread.sleep(intervalMs)
                } catch (e: InterruptedException) {
                    Thread.currentThread().interrupt()
                    break
                } catch (e: Exception) {
                    android.util.Log.e("MonitoringService", "모니터링 오류: ${e.message}", e)
                    break
                }
            }
            monitoringThread = null
        }
        
        monitoringThread?.start()
    }
    
    private fun stopMonitoring() {
        isMonitoring = false
        monitoringThread?.interrupt()
        monitoringThread = null
    }
    
    // 서비스가 실행 중인지 확인하는 헬퍼 메서드
    private fun isServiceRunning(serviceClass: Class<*>): Boolean {
        val activityManager = getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
        val runningServices = activityManager.getRunningServices(Integer.MAX_VALUE)
        
        for (service in runningServices) {
            if (serviceClass.name == service.service.className) {
                return true
            }
        }
        return false
    }
    
    private fun sendEvent(eventName: String, params: WritableMap?) {
        try {
            val reactContext = MainApplication.reactApplicationContext
            if (reactContext != null) {
                val emitter = reactContext.getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
                emitter?.emit(eventName, params)
            } else {
                android.util.Log.w("MonitoringService", "ReactApplicationContext가 null입니다. 이벤트 전송 건너뜀: $eventName")
            }
        } catch (e: Exception) {
            android.util.Log.e("MonitoringService", "이벤트 전송 실패: ${e.message}", e)
        }
    }
}


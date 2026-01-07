package com.focusguard

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.IBinder
import android.provider.Settings
import android.content.pm.PackageManager
import android.content.Context
import android.content.SharedPreferences
import android.graphics.Color
import android.graphics.Typeface
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import androidx.core.content.ContextCompat

class OverlayService : Service() {

    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private val CHANNEL_ID = "FocusGuardOverlayChannel"
    private val NOTIFICATION_ID = 1
    private var isServiceStopping = false
    private var lastCheckedApp: String? = null // 마지막으로 체크한 앱 (캐싱)
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    
    // 통합된 포그라운드 체크 Runnable (중복 제거)
    private val foregroundCheckRunnable = object : Runnable {
        override fun run() {
            if (isServiceStopping) {
                return
            }
            
            val currentApp = getCurrentForegroundApp()
            
            // FocusGuard가 포그라운드면 즉시 종료
            if (currentApp == packageName) {
                android.util.Log.d("OverlayService", "FocusGuard 포그라운드 감지, 오버레이 종료")
                isServiceStopping = true
                hideOverlay()
                stopSelf()
                return
            }
            
            // 앱이 변경되었거나, 오버레이가 사라졌다면 재표시 (단, FocusGuard가 아닌 경우에만)
            if (currentApp != null && currentApp != lastCheckedApp) {
                lastCheckedApp = currentApp
                if (overlayView == null && canDrawOverlays(this@OverlayService)) {
                    android.util.Log.d("OverlayService", "오버레이가 사라짐, 재표시 시도")
                    showOverlay()
                }
            }
            
            handler.postDelayed(this, 500) // 0.5초마다 체크 (빠른 감지)
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
            // FocusGuard 앱이 포그라운드에 있으면 오버레이를 시작하지 않음 (최우선 체크)
            val currentForegroundApp = getCurrentForegroundApp()
            android.util.Log.d("OverlayService", "onStartCommand 호출, 현재 포그라운드 앱: $currentForegroundApp")
            
            if (currentForegroundApp == packageName) {
                android.util.Log.d("OverlayService", "FocusGuard 앱이 포그라운드에 있음, 오버레이 시작 안 함 및 서비스 종료")
                hideOverlay()
                stopSelf()
                return START_NOT_STICKY // 재시작하지 않음
            }
            
            // 알림 채널이 생성되었는지 확인
            createNotificationChannel()
            
            // Foreground Service로 시작 (알림 필수)
            // Android 14+ (targetSdk 36)에서는 FOREGROUND_SERVICE_SPECIAL_USE 권한 필요
            try {
                val notification = createNotification()
                startForeground(NOTIFICATION_ID, notification)
                android.util.Log.d("OverlayService", "Foreground 서비스 시작 성공")
            } catch (e: SecurityException) {
                android.util.Log.e("OverlayService", "Foreground 서비스 시작 실패 (권한 오류): ${e.message}", e)
                // 권한 오류가 발생해도 오버레이는 표시 시도
            } catch (e: Exception) {
                android.util.Log.e("OverlayService", "Foreground 서비스 시작 실패: ${e.message}", e)
            }
            
            // 오버레이 시작 전에 한 번 더 확인
            val finalCheck = getCurrentForegroundApp()
            if (finalCheck == packageName) {
                android.util.Log.d("OverlayService", "오버레이 시작 직전 FocusGuard 확인, 시작 취소 및 서비스 종료")
                hideOverlay()
                stopSelf()
                return START_NOT_STICKY
            }
            
            // 오버레이 권한 확인 후 표시
            if (canDrawOverlays(this)) {
                isServiceStopping = false
                lastCheckedApp = null // 초기화
                showOverlay()
                
                // 주기적으로 포그라운드 앱 체크 (FocusGuard 감지용) - 즉시 시작
                handler.post(foregroundCheckRunnable)
            } else {
                android.util.Log.w("OverlayService", "오버레이 권한이 없습니다")
                // 권한이 없어도 서비스는 계속 실행 (알림만 표시)
            }
            
            android.util.Log.d("OverlayService", "서비스 시작 완료")
        } catch (e: Exception) {
            android.util.Log.e("OverlayService", "서비스 시작 실패: ${e.message}", e)
            // 에러가 발생해도 서비스는 계속 실행
        }
        return START_NOT_STICKY // FocusGuard로 돌아왔을 때 재시작하지 않도록
    }
    
    private fun getCurrentForegroundApp(): String? {
        // 현재 포그라운드 앱 확인 (최적화: 시간 범위 조정)
        try {
            val usageStatsManager = getSystemService(android.content.Context.USAGE_STATS_SERVICE) as? android.app.usage.UsageStatsManager
            val time = System.currentTimeMillis()
            val stats = usageStatsManager?.queryUsageStats(
                android.app.usage.UsageStatsManager.INTERVAL_BEST,
                time - 1000, // 1초 전부터 (너무 짧으면 정확도 떨어짐)
                time
            )
            
            if (stats != null && stats.isNotEmpty()) {
                var mostRecentUsedApp: android.app.usage.UsageStats? = null
                var latestTime: Long = 0
                
                for (usageStats in stats) {
                    val appTime = maxOf(
                        usageStats.lastTimeUsed,
                        if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.Q) {
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
            android.util.Log.e("OverlayService", "포그라운드 앱 확인 실패: ${e.message}", e)
        }
        return null
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                val notificationManager = getSystemService(NotificationManager::class.java)
                // 이미 채널이 존재하는지 확인
                if (notificationManager.getNotificationChannel(CHANNEL_ID) == null) {
                    val channel = NotificationChannel(
                        CHANNEL_ID,
                        "FocusGuard Overlay Service",
                        NotificationManager.IMPORTANCE_LOW
                    ).apply {
                        description = "디지털 디톡스 차단 화면 서비스"
                    }
                    notificationManager.createNotificationChannel(channel)
                }
            } catch (e: Exception) {
                android.util.Log.e("OverlayService", "알림 채널 생성 실패: ${e.message}", e)
            }
        }
    }

    private fun createNotification(): Notification {
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("FocusGuard")
            .setContentText("차단 화면이 활성화되어 있습니다")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setOngoing(true)
            .build()
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null
    }

    private fun showOverlay() {
        // FocusGuard가 포그라운드면 오버레이 표시하지 않음
        val currentApp = getCurrentForegroundApp()
        if (currentApp == packageName) {
            android.util.Log.d("OverlayService", "showOverlay: FocusGuard 포그라운드, 오버레이 표시 취소")
            hideOverlay()
            stopSelf()
            return
        }
        
        // 기존 오버레이가 있으면 제거 후 다시 생성
        hideOverlay()
        
        // 오버레이 권한 재확인
        if (!canDrawOverlays(this)) {
            android.util.Log.w("OverlayService", "오버레이 권한이 없어서 오버레이를 표시할 수 없습니다")
            return
        }

        try {
            android.util.Log.d("OverlayService", "오버레이 생성 시작")
            // 오버레이 레이아웃 생성
            val layout = LinearLayout(this).apply {
                orientation = LinearLayout.VERTICAL
                gravity = Gravity.CENTER
                setBackgroundColor(Color.parseColor("#E8F5E9")) // 연한 초록색 배경
                setPadding(40, 60, 40, 60)
            }

        // 캐릭터 이모지 (우는 모습)
        val characterEmoji = TextView(this).apply {
            text = "😢"
            textSize = 120f
            gravity = Gravity.CENTER
            setPadding(0, 20, 0, 30)
        }
        layout.addView(characterEmoji)

        // 메시지 텍스트
        val messageText = TextView(this).apply {
            text = "지금 포기하면 캐릭터가 아파요!"
            textSize = 24f
            setTextColor(Color.parseColor("#333333"))
            gravity = Gravity.CENTER
            setTypeface(null, Typeface.BOLD)
            setPadding(0, 0, 0, 40)
        }
        layout.addView(messageText)

        // 추가 안내 메시지
        val subMessageText = TextView(this).apply {
            text = "집중 시간을 지켜주세요"
            textSize = 18f
            setTextColor(Color.parseColor("#666666"))
            gravity = Gravity.CENTER
            setPadding(0, 0, 0, 50)
        }
        layout.addView(subMessageText)

        // 앱으로 돌아가기 버튼
        val backButton = Button(this).apply {
            text = "앱으로 돌아가기"
            textSize = 18f
            setBackgroundColor(Color.parseColor("#4CAF50"))
            setTextColor(Color.WHITE)
            setPadding(60, 20, 60, 20)
            setOnClickListener {
                // FocusGuard 앱으로 돌아가기
                try {
                    android.util.Log.d("OverlayService", "앱으로 돌아가기 버튼 클릭")
                    
                    // 오버레이 시작 차단 플래그 설정 (3초간) - MonitoringService가 오버레이를 시작하지 않도록
                    val prefs = getSharedPreferences("focusguard_prefs", Context.MODE_PRIVATE)
                    prefs.edit().putLong("overlay_blocked_until", System.currentTimeMillis() + 3000).apply()
                    android.util.Log.d("OverlayService", "오버레이 차단 플래그 설정 (3초간)")
                    
                    // 서비스 종료 플래그 설정 (재표시 방지)
                    isServiceStopping = true
                    handler.removeCallbacks(foregroundCheckRunnable)
                    
                    // 오버레이 즉시 숨기기
                    hideOverlay()
                    android.util.Log.d("OverlayService", "오버레이 숨김")
                    
                    // 서비스 즉시 종료 (오버레이 재표시 방지)
                    stopSelf()
                    android.util.Log.d("OverlayService", "서비스 종료 요청")
                    
                    // FocusGuard 앱으로 즉시 이동
                    try {
                        // MainActivity를 직접 명시하여 실행
                        val intent = Intent(applicationContext, com.focusguard.MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                            addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                        
                        android.util.Log.d("OverlayService", "Intent 생성 완료, 실행 시도")
                        startActivity(intent)
                        android.util.Log.d("OverlayService", "앱 실행 완료")
                    } catch (e: Exception) {
                        android.util.Log.e("OverlayService", "앱 실행 실패: ${e.message}", e)
                        e.printStackTrace()
                        
                        // 대체 방법: 패키지명으로 실행 시도
                        try {
                            val packageManager = packageManager
                            val launchIntent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)
                            launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                            startActivity(launchIntent)
                            android.util.Log.d("OverlayService", "대체 방법으로 앱 실행 성공")
                        } catch (e2: Exception) {
                            android.util.Log.e("OverlayService", "대체 방법도 실패: ${e2.message}", e2)
                        }
                    }
                    
                } catch (e: Exception) {
                    android.util.Log.e("OverlayService", "버튼 클릭 처리 실패: ${e.message}", e)
                    e.printStackTrace()
                }
            }
        }
        layout.addView(backButton)

        overlayView = layout

        val params = WindowManager.LayoutParams(
            WindowManager.LayoutParams.MATCH_PARENT,
            WindowManager.LayoutParams.MATCH_PARENT,
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
            } else {
                @Suppress("DEPRECATION")
                WindowManager.LayoutParams.TYPE_PHONE
            },
            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                    WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                    WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED or
                    WindowManager.LayoutParams.FLAG_WATCH_OUTSIDE_TOUCH,
            PixelFormat.TRANSLUCENT
        ).apply {
            gravity = Gravity.CENTER
            // 버튼 영역만 터치 가능하도록 설정
        }

            try {
                windowManager?.addView(overlayView, params)
                android.util.Log.d("OverlayService", "오버레이 표시 성공")
            } catch (e: SecurityException) {
                android.util.Log.e("OverlayService", "오버레이 권한 오류: ${e.message}", e)
                overlayView = null
            } catch (e: Exception) {
                android.util.Log.e("OverlayService", "오버레이 표시 실패: ${e.message}", e)
                overlayView = null
            }
        } catch (e: Exception) {
            android.util.Log.e("OverlayService", "오버레이 생성 실패: ${e.message}", e)
        }
    }

    private fun hideOverlay() {
        overlayView?.let {
            try {
                windowManager?.removeView(it)
            } catch (e: Exception) {
                e.printStackTrace()
            }
            overlayView = null
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        android.util.Log.d("OverlayService", "onDestroy 호출")
        isServiceStopping = true
        handler.removeCallbacks(foregroundCheckRunnable)
        hideOverlay()
        lastCheckedApp = null
        android.util.Log.d("OverlayService", "오버레이 제거 완료")
    }

    companion object {
        /**
         * SYSTEM_ALERT_WINDOW 권한이 허용되어 있는지 확인
         */
        fun canDrawOverlays(context: android.content.Context): Boolean {
            return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                Settings.canDrawOverlays(context)
            } else {
                true
            }
        }
    }
}


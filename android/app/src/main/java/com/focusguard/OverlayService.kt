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
    private val handler = android.os.Handler(android.os.Looper.getMainLooper())
    private val recheckRunnable = object : Runnable {
        override fun run() {
            if (!isServiceStopping && overlayView == null && canDrawOverlays(this@OverlayService)) {
                android.util.Log.d("OverlayService", "오버레이가 사라짐, 재표시")
                showOverlay()
                handler.postDelayed(this, 2000)
            }
        }
    }

    override fun onCreate() {
        super.onCreate()
        windowManager = getSystemService(WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        try {
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
            
            // 오버레이 권한 확인 후 표시
            if (canDrawOverlays(this)) {
                isServiceStopping = false
                showOverlay()
                
                // 주기적으로 오버레이가 표시되어 있는지 확인하고 재표시 (서비스가 종료되지 않은 경우에만)
                handler.postDelayed(recheckRunnable, 2000)
            } else {
                android.util.Log.w("OverlayService", "오버레이 권한이 없습니다")
                // 권한이 없어도 서비스는 계속 실행 (알림만 표시)
            }
            
            android.util.Log.d("OverlayService", "서비스 시작 완료")
        } catch (e: Exception) {
            android.util.Log.e("OverlayService", "서비스 시작 실패: ${e.message}", e)
            // 에러가 발생해도 서비스는 계속 실행
        }
        return START_STICKY
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
                    
                    // 서비스 종료 플래그 설정 (재표시 방지)
                    isServiceStopping = true
                    handler.removeCallbacks(recheckRunnable)
                    
                    // 오버레이 즉시 숨기기
                    hideOverlay()
                    android.util.Log.d("OverlayService", "오버레이 숨김")
                    
                    // MainActivity를 직접 명시하여 실행
                    val intent = Intent(applicationContext, com.focusguard.MainActivity::class.java).apply {
                        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                        addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP)
                    }
                    
                    android.util.Log.d("OverlayService", "Intent 생성 완료, 실행 시도")
                    startActivity(intent)
                    android.util.Log.d("OverlayService", "앱 실행 완료")
                    
                    // 서비스 종료 (오버레이가 필요 없으므로)
                    stopSelf()
                    android.util.Log.d("OverlayService", "서비스 종료 요청")
                } catch (e: Exception) {
                    android.util.Log.e("OverlayService", "앱 실행 실패: ${e.message}", e)
                    e.printStackTrace()
                    
                    // 대체 방법: 패키지명으로 실행 시도
                    try {
                        com.focusguard.MonitoringService.startCooldown()
                        isServiceStopping = true
                        handler.removeCallbacks(recheckRunnable)
                        hideOverlay()
                        val packageManager = packageManager
                        val launchIntent = packageManager.getLaunchIntentForPackage(applicationContext.packageName)
                        launchIntent?.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
                        startActivity(launchIntent)
                        android.util.Log.d("OverlayService", "대체 방법으로 앱 실행 성공")
                        stopSelf()
                    } catch (e2: Exception) {
                        android.util.Log.e("OverlayService", "대체 방법도 실패: ${e2.message}", e2)
                    }
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
        handler.removeCallbacks(recheckRunnable)
        hideOverlay()
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


<?php
/* =========================================================
   push/setup.php — VAPID Setup & Verification Tool
   بوست وظيفتك — يُستخدم مرة واحدة فقط ثم يُحذف!
   ========================================================= */

// ── Security: Only allow local or with a secret token ──────
$setupToken = 'wdf_setup_2026';  // غيّر هذا المفتاح إذا أردت
$provided   = $_GET['token'] ?? '';

if ($provided !== $setupToken) {
    http_response_code(403);
    die('<h2 style="color:red;font-family:sans-serif;">⛔ الوصول محظور. أضف ?token=' . $setupToken . ' للعنوان.</h2>');
}

require_once __DIR__ . '/config.php';

// ── Check OpenSSL availability ──────────────────────────────
$opensslOk     = extension_loaded('openssl');
$curlOk        = extension_loaded('curl');
$phpVersion    = phpversion();
$ecKeySupport  = false;
$vapidKeyValid = false;
$keyError      = '';

// ── Verify VAPID private key loads correctly ────────────────
if ($opensslOk) {
    $privKey = @openssl_pkey_get_private(VAPID_PRIVATE_KEY_PEM);
    if ($privKey) {
        $details = openssl_pkey_get_details($privKey);
        if ($details && isset($details['ec'])) {
            $ecKeySupport  = true;
            $vapidKeyValid = true;
        } else {
            $keyError = 'المفتاح محمّل لكنه ليس EC key';
        }
    } else {
        $keyError = openssl_error_string() ?: 'فشل تحميل المفتاح الخاص';
    }
}

// ── Check files & permissions ────────────────────────────────
$subsFile    = SUBSCRIPTIONS_FILE;
$latestFile  = LATEST_JOB_FILE;
$logFile     = PUSH_LOG_FILE;
$pushDir     = __DIR__;

$subsExists   = file_exists($subsFile);
$subsWritable = $subsExists ? is_writable($subsFile) : is_writable(dirname($subsFile));
$latestExists = file_exists($latestFile);
$logWritable  = is_writable($pushDir);

// ── Auto-create subscriptions.json if missing ────────────────
$created = [];
if (!$subsExists) {
    if (@file_put_contents($subsFile, '[]', LOCK_EX) !== false) {
        @chmod($subsFile, 0644);
        $created[] = 'subscriptions.json';
        $subsExists  = true;
        $subsWritable = true;
    }
}
if (!$latestExists) {
    $defaultLatest = json_encode([
        'title'   => 'وظيفة جديدة | New Job',
        'body'    => 'وظائف جديدة متاحة الآن على وظيفتك',
        'url'     => SITE_ORIGIN,
        'time'    => date('c'),
        'icon'    => SITE_ORIGIN . '/images/icon-192.png',
    ], JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    if (@file_put_contents($latestFile, $defaultLatest, LOCK_EX) !== false) {
        @chmod($latestFile, 0644);
        $created[] = 'latest.json';
        $latestExists = true;
    }
}

// ── Generate ADMIN_TOKEN display ─────────────────────────────
$adminToken = ADMIN_TOKEN;

// ── Count current subscriptions ──────────────────────────────
$subsCount = 0;
if ($subsExists) {
    $subs = loadSubscriptions();
    $subsCount = count($subs);
}

// ── Test VAPID JWT generation ─────────────────────────────────
$jwtTest    = false;
$jwtError   = '';
$testEndpoint = 'https://fcm.googleapis.com/fcm/send/test';
if ($vapidKeyValid) {
    try {
        $jwt = buildVapidJWT($testEndpoint);
        $jwtTest = !empty($jwt);
    } catch (Throwable $e) {
        $jwtError = $e->getMessage();
    }
}

// ── Status helper ─────────────────────────────────────────────
function badge(bool $ok, string $yes = '✅ نعم', string $no = '❌ لا'): string {
    return $ok
        ? "<span style='color:#22c55e;font-weight:bold;'>$yes</span>"
        : "<span style='color:#ef4444;font-weight:bold;'>$no</span>";
}
?>
<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>إعداد Push Notifications — وظيفتك</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body {
            font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
            background: #0f172a;
            color: #e2e8f0;
            min-height: 100vh;
            padding: 2rem 1rem;
        }
        .container { max-width: 820px; margin: 0 auto; }
        h1 {
            font-size: 1.8rem;
            color: #38bdf8;
            border-bottom: 2px solid #1e40af;
            padding-bottom: .75rem;
            margin-bottom: 1.5rem;
        }
        .card {
            background: #1e293b;
            border: 1px solid #334155;
            border-radius: 12px;
            padding: 1.25rem 1.5rem;
            margin-bottom: 1.25rem;
        }
        .card h2 {
            font-size: 1.1rem;
            color: #94a3b8;
            margin-bottom: 1rem;
            display: flex;
            align-items: center;
            gap: .5rem;
        }
        table { width: 100%; border-collapse: collapse; font-size: .92rem; }
        td { padding: .55rem .5rem; border-bottom: 1px solid #1e3a5f; vertical-align: middle; }
        td:first-child { color: #94a3b8; width: 45%; }
        .code-box {
            background: #0f172a;
            border: 1px solid #334155;
            border-radius: 8px;
            padding: .75rem 1rem;
            font-family: monospace;
            font-size: .82rem;
            color: #7dd3fc;
            word-break: break-all;
            margin-top: .5rem;
        }
        .warning {
            background: #7c2d12;
            border: 1px solid #c2410c;
            border-radius: 8px;
            padding: 1rem 1.25rem;
            color: #fed7aa;
            margin-bottom: 1.25rem;
            display: flex;
            gap: .75rem;
            align-items: flex-start;
        }
        .warning .icon { font-size: 1.5rem; flex-shrink: 0; }
        .info {
            background: #1e3a5f;
            border: 1px solid #1d4ed8;
            border-radius: 8px;
            padding: 1rem 1.25rem;
            color: #bfdbfe;
            margin-bottom: 1.25rem;
        }
        .created-box {
            background: #14532d;
            border: 1px solid #16a34a;
            border-radius: 8px;
            padding: .75rem 1rem;
            color: #bbf7d0;
            margin-bottom: 1.25rem;
        }
        .btn {
            display: inline-block;
            padding: .6rem 1.25rem;
            border-radius: 8px;
            text-decoration: none;
            font-weight: bold;
            font-size: .9rem;
            margin-top: .5rem;
            cursor: pointer;
            border: none;
        }
        .btn-danger { background: #dc2626; color: #fff; }
        .btn-info   { background: #0284c7; color: #fff; }
    </style>
</head>
<body>
<div class="container">
    <h1>🔧 إعداد Push Notifications — وظيفتك</h1>

    <div class="warning">
        <div class="icon">⚠️</div>
        <div>
            <strong>تحذير أمني:</strong> هذا الملف مخصص للإعداد الأولي فقط.
            <strong>احذفه فوراً</strong> بعد التحقق من أن كل شيء يعمل بشكل صحيح!<br>
            <small>المسار: <code>/push/setup.php</code></small>
        </div>
    </div>

    <?php if (!empty($created)): ?>
    <div class="created-box">
        ✅ <strong>تم إنشاء الملفات التالية تلقائياً:</strong>
        <?php foreach ($created as $f): ?>
            <code><?= htmlspecialchars($f) ?></code>
        <?php endforeach; ?>
    </div>
    <?php endif; ?>

    <!-- System Requirements -->
    <div class="card">
        <h2>⚙️ متطلبات النظام</h2>
        <table>
            <tr><td>إصدار PHP</td><td><?= htmlspecialchars($phpVersion) ?></td></tr>
            <tr><td>امتداد OpenSSL</td><td><?= badge($opensslOk) ?></td></tr>
            <tr><td>امتداد cURL</td><td><?= badge($curlOk) ?></td></tr>
            <tr><td>دعم EC Keys</td><td><?= badge($ecKeySupport) ?></td></tr>
            <tr>
                <td>openssl_pkey_derive</td>
                <td><?= badge(function_exists('openssl_pkey_derive'), '✅ متاح (PHP 8.1+)', '⚠️ غير متاح — سيُستخدم الـ fallback') ?></td>
            </tr>
        </table>
    </div>

    <!-- VAPID Keys -->
    <div class="card">
        <h2>🔑 VAPID Keys</h2>
        <table>
            <tr>
                <td>المفتاح العام (Public Key)</td>
                <td>
                    <div class="code-box"><?= htmlspecialchars(VAPID_PUBLIC_KEY) ?></div>
                </td>
            </tr>
            <tr>
                <td>صلاحية المفتاح الخاص</td>
                <td>
                    <?= badge($vapidKeyValid) ?>
                    <?php if ($keyError): ?>
                        <small style="color:#f87171;"> — <?= htmlspecialchars($keyError) ?></small>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <td>اختبار توليد JWT</td>
                <td>
                    <?= badge($jwtTest) ?>
                    <?php if ($jwtError): ?>
                        <small style="color:#f87171;"> — <?= htmlspecialchars($jwtError) ?></small>
                    <?php endif; ?>
                </td>
            </tr>
            <tr><td>البريد الإلكتروني (Subject)</td><td><?= htmlspecialchars(VAPID_SUBJECT) ?></td></tr>
            <tr><td>الموقع (Origin)</td><td><?= htmlspecialchars(SITE_ORIGIN) ?></td></tr>
        </table>
    </div>

    <!-- Files & Permissions -->
    <div class="card">
        <h2>📁 الملفات والصلاحيات</h2>
        <table>
            <tr>
                <td>subscriptions.json</td>
                <td>
                    <?= badge($subsExists, '✅ موجود', '❌ غير موجود') ?>
                    — <?= badge($subsWritable, '✅ قابل للكتابة', '❌ للقراءة فقط') ?>
                    — عدد المشتركين: <strong><?= $subsCount ?></strong>
                </td>
            </tr>
            <tr>
                <td>latest.json</td>
                <td><?= badge($latestExists, '✅ موجود', '❌ غير موجود') ?></td>
            </tr>
            <tr>
                <td>مجلد push/</td>
                <td><?= badge($logWritable, '✅ قابل للكتابة', '❌ للقراءة فقط') ?></td>
            </tr>
        </table>
    </div>

    <!-- Admin Token -->
    <div class="card">
        <h2>🛡️ Admin Token</h2>
        <p style="color:#94a3b8;font-size:.9rem;margin-bottom:.5rem;">
            استخدم هذا الـ Token في لوحة الإدارة للوصول إلى endpoints المحمية:
        </p>
        <div class="code-box"><?= htmlspecialchars($adminToken) ?></div>
    </div>

    <!-- Quick Links -->
    <div class="card">
        <h2>🔗 روابط سريعة للاختبار</h2>
        <table>
            <tr>
                <td>صفحة التشخيص</td>
                <td>
                    <a class="btn btn-info" href="/push/diagnostics.php?token=<?= urlencode($setupToken) ?>" target="_blank">
                        فتح التشخيص ↗
                    </a>
                </td>
            </tr>
            <tr>
                <td>إحصائيات الاشتراكات</td>
                <td>
                    <a class="btn btn-info" href="/push/stats.php" target="_blank">
                        عرض الإحصائيات ↗
                    </a>
                </td>
            </tr>
            <tr>
                <td>لوحة تشخيص Push</td>
                <td>
                    <a class="btn btn-info" href="/admin/push-diagnostics.html" target="_blank">
                        لوحة الإدارة ↗
                    </a>
                </td>
            </tr>
        </table>
    </div>

    <!-- Delete Notice -->
    <div class="info">
        <strong>📋 الخطوات التالية:</strong>
        <ol style="margin-top:.5rem;padding-right:1.25rem;line-height:2;">
            <li>تأكد أن جميع العناصر أعلاه تُظهر ✅</li>
            <li>انسخ Admin Token واحفظه في مكان آمن</li>
            <li>اختبر إرسال إشعار من لوحة الإدارة</li>
            <li><strong style="color:#fca5a5;">احذف هذا الملف (setup.php) فوراً!</strong></li>
        </ol>
    </div>

    <p style="color:#475569;font-size:.8rem;text-align:center;margin-top:1rem;">
        وظيفتك — Push Notifications Setup Tool v1.0 | <?= date('Y-m-d H:i:s') ?>
    </p>
</div>
</body>
</html>

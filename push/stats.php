<?php
/* =========================================================
   stats.php — Push Notification Stats (for Admin Panel)
   GET → returns subscriber count + recent log + diagnostics
   Protected: requires X-Admin-Token header
   ========================================================= */
require_once __DIR__ . '/config.php';
setCorsHeaders();
header('Content-Type: application/json; charset=utf-8');

/* ── Admin token guard ─────────────────────────────────── */
$tok = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_GET['token'] ?? '');
if ($tok !== ADMIN_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    jsonResponse(['ok' => false, 'error' => 'GET required'], 405);
}

$subs   = loadSubscriptions();
$active = array_values(array_filter($subs, fn($s) => $s['active'] ?? true));

// Per-device breakdown
$devices = array_count_values(array_column($active, 'device'));

// Recent push log
$logFile = PUSH_LOG_FILE;
$log     = [];
if (file_exists($logFile)) {
    $log = json_decode(@file_get_contents($logFile), true) ?: [];
}

// Recent debug log (last 20 lines)
$debugLog = [];
$debugFile = __DIR__ . '/push-debug.log';
if (file_exists($debugFile)) {
    $lines = file($debugFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $debugLog = array_slice($lines, -20);
}

// Config diagnostics
$vapidOk    = !empty(VAPID_PUBLIC_KEY) && !empty(VAPID_PRIVATE_KEY_PEM);
$privKeyOk  = false;
$keyError   = '';
if ($vapidOk) {
    $key = openssl_pkey_get_private(VAPID_PRIVATE_KEY_PEM);
    if ($key) {
        $privKeyOk = true;
    } else {
        $keyError = openssl_error_string();
    }
}

// Subscriptions file writable?
$subsDir = dirname(SUBSCRIPTIONS_FILE);
$fileWritable = is_writable($subsDir);

jsonResponse([
    'ok'            => true,
    'total'         => count($subs),
    'active'        => count($active),
    'configured'    => $vapidOk,
    'privateKeyOk'  => $privKeyOk,
    'keyError'      => $keyError,
    'fileWritable'  => $fileWritable,
    'devices'       => $devices,
    'log'           => array_slice($log, 0, 10),
    'debugLog'      => $debugLog,
    'phpVersion'    => phpversion(),
    'opensslVersion'=> OPENSSL_VERSION_TEXT ?? 'unknown',
    'serverTime'    => date('c'),
]);

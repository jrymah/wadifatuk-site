<?php
ob_start(); // ✅ Buffer output — prevents UTF-8 BOM from corrupting JSON response
/* =========================================================
   send.php — إرسال Push Notification لكل المشتركين
   POST body (JSON):
   {
     "title": "وظيفة جديدة في أرامكو",
     "body":  "وظائف هندسية - الدمام",
     "url":   "/job-detail.html?id=123",
     "tag":   "job-123"
   }
   Protected: requires X-Admin-Token header
   ========================================================= */
require_once __DIR__ . '/config.php';
setCorsHeaders();
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    jsonResponse(['ok' => false, 'error' => 'POST required'], 405);
}

/* ── Admin token guard ──────────────────────────────────────────── */
$reqToken = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? '';
if ($reqToken !== ADMIN_TOKEN) {
    pushLog('warning', 'Unauthorized send.php request', ['ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown']);
    jsonResponse(['ok' => false, 'error' => 'Unauthorized'], 403);
}

/* ── Read payload ──────────────────────────────────── */
$raw  = file_get_contents('php://input');
$data = json_decode($raw, true);
if (!is_array($data)) {
    jsonResponse(['ok' => false, 'error' => 'Invalid JSON body'], 400);
}

$title = mb_substr(trim($data['title'] ?? ''), 0, 100);
$body  = mb_substr(trim($data['body']  ?? ''), 0, 200);
$url   = trim($data['url']   ?? '/');
$tag   = trim($data['tag']   ?? 'wadifatuk-job-' . time());
$icon  = $data['icon']  ?? '/images/icon-192x192.png';
$badge = $data['badge'] ?? '/images/icon-72x72.png';

if (!$title) {
    jsonResponse(['ok' => false, 'error' => 'title is required'], 400);
}

pushLog('info', 'Send push request received', [
    'title' => $title,
    'body'  => $body,
    'url'   => $url,
]);

/* ── Write latest.json (Service Worker fetches this as fallback) ── */
$latest = [
    'title'     => $title,
    'body'      => $body,
    'url'       => $url,
    'tag'       => $tag,
    'icon'      => $icon,
    'badge'     => $badge,
    'updatedAt' => date('c'),
];
$latestWritten = @file_put_contents(
    LATEST_JOB_FILE,
    json_encode($latest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT),
    LOCK_EX
);
if ($latestWritten === false) {
    pushLog('warning', 'Could not write latest.json — check file permissions');
}

/* ── Check VAPID config ─────────────────────────────── */
if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY_PEM) {
    pushLog('error', 'VAPID keys not configured');
    jsonResponse(['ok' => false, 'error' => 'VAPID not configured'], 500);
}

/* ── Load subscriptions ─────────────────────────────── */
$subs = loadSubscriptions();
pushLog('info', 'Loaded subscriptions', ['total' => count($subs)]);

if (empty($subs)) {
    pushLog('info', 'No subscriptions found — nothing to send');
    jsonResponse([
        'ok'      => true,
        'sent'    => 0,
        'failed'  => 0,
        'expired' => 0,
        'total'   => 0,
        'message' => 'No subscriptions yet',
    ]);
}

/* ── Build push payload ─────────────────────────────── */
$pushPayload = [
    'title' => $title,
    'body'  => $body,
    'url'   => $url,
    'tag'   => $tag,
    'icon'  => $icon,
    'badge' => $badge,
];

/* ── Send to each ───────────────────────────────────── */
$sent    = 0;
$failed  = 0;
$expired = [];
$errors  = [];

foreach ($subs as $sub) {
    if (!($sub['active'] ?? true)) {
        pushLog('debug', 'Skipping inactive subscription', ['id' => $sub['id'] ?? '?']);
        continue;
    }

    $endpoint = $sub['endpoint'] ?? '';
    if (!$endpoint) {
        $failed++;
        continue;
    }

    $result = sendPushToEndpoint($sub, $pushPayload);

    if ($result['success']) {
        $sent++;
        pushLog('info', 'Push sent successfully', [
            'id'       => $sub['id'] ?? '?',
            'code'     => $result['code'],
            'endpoint' => substr($endpoint, 0, 60),
        ]);
    } elseif ($result['error'] === 'expired') {
        $expired[] = $endpoint;
        $failed++;
        pushLog('info', 'Subscription expired — will remove', [
            'endpoint' => substr($endpoint, 0, 60),
        ]);
    } else {
        $failed++;
        $errors[] = $result['error'];
        pushLog('warning', 'Push failed', [
            'error'    => $result['error'],
            'code'     => $result['code'],
            'endpoint' => substr($endpoint, 0, 60),
        ]);
    }
}

/* ── Remove expired subscriptions ────────────────────── */
if (!empty($expired)) {
    $clean = array_values(array_filter($subs, fn($s) => !in_array($s['endpoint'], $expired, true)));
    saveSubscriptions($clean);
    pushLog('info', 'Removed expired subscriptions', ['count' => count($expired)]);
}

/* ── Log result ─────────────────────────────────────── */
$logFile = PUSH_LOG_FILE;
$log = [];
if (file_exists($logFile)) {
    $log = json_decode(@file_get_contents($logFile), true) ?: [];
}
array_unshift($log, [
    'at'      => date('c'),
    'title'   => $title,
    'sent'    => $sent,
    'failed'  => $failed,
    'expired' => count($expired),
    'total'   => count($subs),
    'errors'  => array_slice($errors, 0, 5),
]);
$log = array_slice($log, 0, 50);
@file_put_contents($logFile, json_encode($log, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE), LOCK_EX);

pushLog('info', 'Push campaign done', [
    'sent'    => $sent,
    'failed'  => $failed,
    'expired' => count($expired),
    'total'   => count($subs),
]);

jsonResponse([
    'ok'      => true,
    'sent'    => $sent,
    'failed'  => $failed,
    'expired' => count($expired),
    'total'   => count($subs),
]);

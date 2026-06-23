<?php
/* =========================================================
   diagnostics.php — Push System Full Diagnostic
   Protected: requires X-Admin-Token header or ?token= param
   ========================================================= */
require_once __DIR__ . '/config.php';
setCorsHeaders();
header('Content-Type: application/json; charset=utf-8');

/* ── Admin token guard ─────────────────────────────────── */
$token = $_SERVER['HTTP_X_ADMIN_TOKEN'] ?? ($_GET['token'] ?? '');
if ($token !== ADMIN_TOKEN) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden'], JSON_UNESCAPED_UNICODE);
    exit;
}

$results = [];

// 1. PHP & OpenSSL
$results['php_version']     = phpversion();
$results['openssl_version'] = defined('OPENSSL_VERSION_TEXT') ? OPENSSL_VERSION_TEXT : 'unknown';
$results['openssl_enabled'] = extension_loaded('openssl');
$results['curl_enabled']    = extension_loaded('curl');

// 2. VAPID Keys
$results['vapid_public_key_set']   = !empty(VAPID_PUBLIC_KEY);
$results['vapid_private_key_set']  = !empty(VAPID_PRIVATE_KEY_PEM);
$results['vapid_public_key_len']   = strlen(VAPID_PUBLIC_KEY);
$results['vapid_subject']          = VAPID_SUBJECT;

// 3. Private key load test
$privKey = openssl_pkey_get_private(VAPID_PRIVATE_KEY_PEM);
$results['private_key_loadable']   = (bool)$privKey;
$results['private_key_error']      = $privKey ? null : openssl_error_string();
if ($privKey) {
    $details = openssl_pkey_get_details($privKey);
    $results['key_type']  = $details['type'] === OPENSSL_KEYTYPE_EC ? 'EC (correct)' : 'wrong type: '.$details['type'];
    $results['key_bits']  = $details['bits'];
    $results['key_curve'] = $details['ec']['curve_name'] ?? 'unknown';
}

// 4. JWT Build test
try {
    $testEndpoint = 'https://fcm.googleapis.com/fcm/send/test';
    $jwt = buildVapidJWT($testEndpoint);
    $results['jwt_build'] = 'OK';
    $parts = explode('.', $jwt);
    $results['jwt_parts'] = count($parts);
} catch (Throwable $e) {
    $results['jwt_build'] = 'FAILED: ' . $e->getMessage();
}

// 5. Files & Permissions
$results['subscriptions_file_exists'] = file_exists(SUBSCRIPTIONS_FILE);
$results['subscriptions_dir_writable'] = is_writable(dirname(SUBSCRIPTIONS_FILE));
$results['latest_json_exists']        = file_exists(LATEST_JOB_FILE);

// 6. Subscriptions
$subs   = loadSubscriptions();
$active = array_filter($subs, fn($s) => $s['active'] ?? true);
$results['subscriptions_total']  = count($subs);
$results['subscriptions_active'] = count($active);

// Sample first sub (masked)
if (!empty($subs)) {
    $s = reset($subs);
    $results['sample_sub'] = [
        'endpoint_prefix' => substr($s['endpoint'] ?? '', 0, 50) . '...',
        'has_p256dh'      => !empty($s['keys']['p256dh']),
        'has_auth'        => !empty($s['keys']['auth']),
        'p256dh_len'      => strlen(b64url_decode($s['keys']['p256dh'] ?? '')),
        'auth_len'        => strlen(b64url_decode($s['keys']['auth'] ?? '')),
        'active'          => $s['active'] ?? true,
        'device'          => $s['device'] ?? 'unknown',
        'browser'         => $s['browser'] ?? 'unknown',
    ];
}

// 7. Encryption test
if (!empty($subs) && !empty($privKey)) {
    $s = reset($subs);
    if (!empty($s['keys']['p256dh']) && !empty($s['keys']['auth'])) {
        try {
            $enc = encryptPayload('{"test":true}', $s['keys']['p256dh'], $s['keys']['auth']);
            $results['encryption_test'] = 'OK (body_len=' . strlen($enc['body']) . ')';
        } catch (Throwable $e) {
            $results['encryption_test'] = 'FAILED: ' . $e->getMessage();
        }
    } else {
        $results['encryption_test'] = 'SKIPPED: no keys in subscription';
    }
} else {
    $results['encryption_test'] = 'SKIPPED: no subscription or key';
}

// 8. Recent log
$log = [];
if (file_exists(PUSH_LOG_FILE)) {
    $log = json_decode(@file_get_contents(PUSH_LOG_FILE), true) ?: [];
}
$results['recent_sends'] = array_slice($log, 0, 5);

// 9. Debug log
$debugFile = __DIR__ . '/push-debug.log';
if (file_exists($debugFile)) {
    $lines = file($debugFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES) ?: [];
    $results['debug_log'] = array_map(function($l) { return json_decode($l, true) ?: $l; }, array_slice($lines, -30));
} else {
    $results['debug_log'] = [];
}

$results['server_time'] = date('c');
$results['status']      = 'diagnostic_complete';

jsonResponse($results);

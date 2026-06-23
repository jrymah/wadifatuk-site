<?php
/* =========================================================
   subscribe.php — حفظ / حذف Push Subscription
   POST  → حفظ subscription جديد
   DELETE → حذف subscription
   GET   → إحصائيات (للأدمن)
   ========================================================= */
require_once __DIR__ . '/config.php';
setCorsHeaders();
header('Content-Type: application/json; charset=utf-8');

$method = $_SERVER['REQUEST_METHOD'];
$raw    = file_get_contents('php://input');
$data   = json_decode($raw, true);

if ($method === 'POST') {
    // ── Ensure subscriptions file exists before any write ─────────
    if (!file_exists(SUBSCRIPTIONS_FILE)) {
        $dir = dirname(SUBSCRIPTIONS_FILE);
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        @file_put_contents(SUBSCRIPTIONS_FILE, '[]', LOCK_EX);
        @chmod(SUBSCRIPTIONS_FILE, 0644);
        pushLog('info', 'subscriptions.json created for first time');
    }

    // ── Validate ──────────────────────────────────────────
    if (!is_array($data)) {
        jsonResponse(['ok' => false, 'error' => 'Invalid JSON payload'], 400);
    }

    $endpoint = trim($data['endpoint'] ?? '');
    $p256dh   = trim($data['keys']['p256dh'] ?? '');
    $auth     = trim($data['keys']['auth']   ?? '');

    if (!$endpoint || !filter_var($endpoint, FILTER_VALIDATE_URL)) {
        jsonResponse(['ok' => false, 'error' => 'Invalid endpoint URL'], 400);
    }
    if (!$p256dh) {
        jsonResponse(['ok' => false, 'error' => 'Missing p256dh key'], 400);
    }
    if (!$auth) {
        jsonResponse(['ok' => false, 'error' => 'Missing auth secret'], 400);
    }

    // Validate key lengths (base64url)
    $p256dhDecoded = b64url_decode($p256dh);
    $authDecoded   = b64url_decode($auth);
    if (strlen($p256dhDecoded) !== 65) {
        pushLog('warning', 'Invalid p256dh length', ['len' => strlen($p256dhDecoded), 'endpoint' => substr($endpoint, 0, 60)]);
        // Don't reject — some browsers may vary
    }

    // ── Detect device/browser ─────────────────────────────
    $ua      = $_SERVER['HTTP_USER_AGENT'] ?? '';
    $browser = 'Unknown';
    $device  = 'desktop';
    // Check Samsung BEFORE Chrome (Samsung UA also contains 'Chrome')
    if (preg_match('/SamsungBrowser\/(\d+)/i', $ua, $m)) {
        $browser = 'Samsung ' . $m[1];
    } elseif (preg_match('/Edg\/(\d+)/i', $ua, $m)) {
        $browser = 'Edge ' . $m[1];
    } elseif (preg_match('/OPR\/(\d+)/i', $ua, $m)) {
        $browser = 'Opera ' . $m[1];
    } elseif (preg_match('/Chrome\/(\d+)/i', $ua, $m)) {
        $browser = 'Chrome ' . $m[1];
    } elseif (preg_match('/Firefox\/(\d+)/i', $ua, $m)) {
        $browser = 'Firefox ' . $m[1];
    } elseif (preg_match('/Safari\/(\d+)/i', $ua)) {
        $browser = 'Safari';
    }
    if (preg_match('/Android/i', $ua)) {
        $device = preg_match('/SamsungBrowser/i', $ua) ? 'samsung' : 'android';
    } elseif (preg_match('/iPhone|iPad/i', $ua)) {
        $device = 'ios';
    }

    // ── Load & de-duplicate ───────────────────────────────
    $subs = loadSubscriptions();
    foreach ($subs as &$s) {
        if ($s['endpoint'] === $endpoint) {
            // Update keys if they changed
            $s['keys']      = ['p256dh' => $p256dh, 'auth' => $auth];
            $s['active']    = true;
            $s['updatedAt'] = date('c');
            saveSubscriptions($subs);
            pushLog('info', 'Subscription refreshed', ['endpoint' => substr($endpoint, 0, 60)]);
            jsonResponse(['ok' => true, 'msg' => 'refreshed', 'count' => count($subs)]);
        }
    }
    unset($s);

    // ── Append ───────────────────────────────────────────
    $newSub = [
        'id'         => uniqid('sub_', true),
        'endpoint'   => $endpoint,
        'keys'       => ['p256dh' => $p256dh, 'auth' => $auth],
        'device'     => $device,
        'browser'    => $browser,
        'createdAt'  => date('c'),
        'updatedAt'  => date('c'),
        'active'     => true,
    ];
    $subs[] = $newSub;
    saveSubscriptions($subs);

    pushLog('info', 'New subscription saved', [
        'endpoint' => substr($endpoint, 0, 60),
        'device'   => $device,
        'browser'  => $browser,
    ]);

    jsonResponse(['ok' => true, 'msg' => 'subscribed', 'count' => count($subs)]);
}

if ($method === 'DELETE') {
    $endpoint = trim($data['endpoint'] ?? '');
    if (!$endpoint) {
        jsonResponse(['ok' => false, 'error' => 'No endpoint provided'], 400);
    }
    $subs = loadSubscriptions();
    $new  = array_values(array_filter($subs, fn($s) => $s['endpoint'] !== $endpoint));
    saveSubscriptions($new);
    pushLog('info', 'Subscription removed', ['endpoint' => substr($endpoint, 0, 60)]);
    jsonResponse(['ok' => true, 'msg' => 'unsubscribed', 'count' => count($new)]);
}

if ($method === 'GET') {
    $subs   = loadSubscriptions();
    $active = array_values(array_filter($subs, fn($s) => $s['active'] ?? true));
    jsonResponse([
        'ok'      => true,
        'count'   => count($active),
        'total'   => count($subs),
        'devices' => array_count_values(array_column($active, 'device')),
    ]);
}

jsonResponse(['ok' => false, 'error' => 'Method not allowed'], 405);

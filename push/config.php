<?php
/* =========================================================
   VAPID Configuration — بوست وظيفتك
   Push Notifications Backend v4 — RFC 8291 compliant
   ========================================================= */

/* ── VAPID Keys ─────────────────────────────────────────── */
define('VAPID_PUBLIC_KEY',      'BAbfIgT3scWQH_IEbwfpbI36F3hABqKzc-3MkdihomtgfSUF7-5qSNHfedXTrdIh2wJgFUliozHPsoX8lcy30Vs');
define('VAPID_PRIVATE_KEY_PEM', "-----BEGIN PRIVATE KEY-----\nMIGHAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBG0wawIBAQQgzdQN7uM2dFnJOv3N\n9eTLdlh7l0JoUwvbHvExQ0Z7jtahRANCAAQG3yIE97HFkB/yBG8H6WyN+hd4QAai\ns3PtzJHYoaJrYH0lBe/uakjR33nV063SIdsCYBVJYqMxz7KF/JXMt9Fb\n-----END PRIVATE KEY-----");
define('VAPID_SUBJECT',         'mailto:admin@wadifatuk.com');

/* ── File Paths ─────────────────────────────────────────── */
define('SUBSCRIPTIONS_FILE', __DIR__ . '/subscriptions.json');
define('LATEST_JOB_FILE',    __DIR__ . '/latest.json');
define('PUSH_LOG_FILE',      __DIR__ . '/push-log.json');

/* ── Settings ───────────────────────────────────────────── */
define('PUSH_TTL',      86400);
define('SITE_ORIGIN',  'https://www.wadifatuk.com');
define('MAX_PAYLOAD',  3900);
/* Admin token for protected endpoints (send.php, diagnostics.php) */
define('ADMIN_TOKEN',  'wdf_adm_' . hash('sha256', 'Aajrymah@4431_' . VAPID_PUBLIC_KEY));

/* ── CORS helper ────────────────────────────────────────── */
function setCorsHeaders() {
    $origin  = $_SERVER['HTTP_ORIGIN'] ?? '';
    $allowed = [
        'https://www.wadifatuk.com',
        'https://wadifatuk.com',
    ];
    if (in_array($origin, $allowed, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
    } else {
        header('Access-Control-Allow-Origin: https://www.wadifatuk.com');
    }
    header('Vary: Origin');
    header('Access-Control-Allow-Methods: GET, POST, DELETE, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Admin-Token');
    header('Access-Control-Max-Age: 86400');
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') { http_response_code(204); exit; }
}

/* ── JSON response helper ───────────────────────────────── */
function jsonResponse(array $data, int $code = 200): void {
    http_response_code($code);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

/* ── Push Logger ────────────────────────────────────────── */
function pushLog(string $level, string $message, array $context = []): void {
    $entry = [
        'time'    => date('c'),
        'level'   => $level,
        'message' => $message,
        'context' => $context,
    ];
    $logFile = __DIR__ . '/push-debug.log';
    @file_put_contents($logFile, json_encode($entry, JSON_UNESCAPED_UNICODE) . "\n", FILE_APPEND | LOCK_EX);
    // Keep log under 500KB
    if (file_exists($logFile) && filesize($logFile) > 500000) {
        $lines = file($logFile);
        $lines = array_slice($lines, -200);
        file_put_contents($logFile, implode('', $lines), LOCK_EX);
    }
}

/* ── Load subscriptions ─────────────────────────────────── */
function loadSubscriptions(): array {
    if (!file_exists(SUBSCRIPTIONS_FILE)) return [];
    $raw = @file_get_contents(SUBSCRIPTIONS_FILE);
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : [];
}

/* ── Save subscriptions ─────────────────────────────────── */
function saveSubscriptions(array $subs): void {
    $file = SUBSCRIPTIONS_FILE;
    $dir  = dirname($file);

    // Ensure directory exists
    if (!is_dir($dir)) {
        @mkdir($dir, 0755, true);
    }

    // Ensure file exists (create empty array if first time)
    if (!file_exists($file)) {
        @file_put_contents($file, '[]', LOCK_EX);
        @chmod($file, 0644);
    }

    $json   = json_encode(array_values($subs), JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    $result = @file_put_contents($file, $json, LOCK_EX);

    if ($result === false) {
        pushLog('error', 'CRITICAL: Failed to write subscriptions.json', [
            'file'         => $file,
            'dir_exists'   => is_dir($dir),
            'dir_writable' => is_writable($dir),
            'file_exists'  => file_exists($file),
            'file_writable'=> file_exists($file) ? is_writable($file) : false,
        ]);
    }
}

/* ── base64url helpers ──────────────────────────────────── */
function b64url_encode(string $data): string {
    return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
}
function b64url_decode(string $data): string {
    $padded = str_pad(strtr($data, '-_', '+/'), strlen($data) % 4 ? strlen($data) + 4 - (strlen($data) % 4) : strlen($data), '=');
    return base64_decode($padded);
}

/* ── Convert DER EC signature → raw r||s (64 bytes) ─────── */
function der_to_raw(string $der): string {
    // Parse DER SEQUENCE
    if (ord($der[0]) !== 0x30) {
        throw new \RuntimeException('Invalid DER sequence');
    }
    $offset = 2;
    // Skip length byte(s) for sequence
    if (ord($der[1]) & 0x80) {
        $offset += ord($der[1]) & 0x7f;
        $offset++;
    }
    // r component
    if (ord($der[$offset]) !== 0x02) throw new \RuntimeException('Expected INTEGER for r');
    $offset++;
    $rLen = ord($der[$offset++]);
    $r    = substr($der, $offset, $rLen);
    $offset += $rLen;
    // s component
    if (ord($der[$offset]) !== 0x02) throw new \RuntimeException('Expected INTEGER for s');
    $offset++;
    $sLen = ord($der[$offset++]);
    $s    = substr($der, $offset, $sLen);
    // Pad to 32 bytes each
    $r = str_pad(ltrim($r, "\x00"), 32, "\x00", STR_PAD_LEFT);
    $s = str_pad(ltrim($s, "\x00"), 32, "\x00", STR_PAD_LEFT);
    return $r . $s;
}

/* ── Build VAPID JWT ─────────────────────────────────────── */
function buildVapidJWT(string $endpoint): string {
    $parsed   = parse_url($endpoint);
    if (!$parsed || !isset($parsed['scheme'], $parsed['host'])) {
        throw new \InvalidArgumentException('Invalid endpoint URL: ' . $endpoint);
    }
    $audience = $parsed['scheme'] . '://' . $parsed['host'];
    $now      = time();
    $header   = b64url_encode(json_encode(['typ' => 'JWT', 'alg' => 'ES256']));
    $payload  = b64url_encode(json_encode([
        'aud' => $audience,
        'exp' => $now + 43200,
        'sub' => VAPID_SUBJECT,
        'iat' => $now,
    ]));
    $input   = "$header.$payload";
    $privKey = openssl_pkey_get_private(VAPID_PRIVATE_KEY_PEM);
    if (!$privKey) {
        throw new \RuntimeException('Failed to load VAPID private key: ' . openssl_error_string());
    }
    $signed = openssl_sign($input, $der, $privKey, OPENSSL_ALGO_SHA256);
    if (!$signed) {
        throw new \RuntimeException('Failed to sign JWT: ' . openssl_error_string());
    }
    return $input . '.' . b64url_encode(der_to_raw($der));
}

/* ═══════════════════════════════════════════════════════════
   ENCRYPTED PUSH MESSAGE — Full ECDH + HKDF + AES-128-GCM
   RFC 8291 / RFC 8030 compliant
   ═══════════════════════════════════════════════════════════ */

/**
 * Encrypt a push payload using RFC 8291 (Web Push Encryption).
 *
 * @param  string $payload     The plaintext JSON string
 * @param  string $p256dhB64  Subscriber's p256dh key (base64url)
 * @param  string $authB64    Subscriber's auth secret (base64url)
 * @return array{body: string, salt: string, localPublicKey: string}
 */
function encryptPayload(string $payload, string $p256dhB64, string $authB64): array {
    // ── Decode subscriber keys ──────────────────────────────
    $recipientPublicKey = b64url_decode($p256dhB64);
    $authSecret         = b64url_decode($authB64);

    if (strlen($recipientPublicKey) !== 65) {
        throw new \InvalidArgumentException('p256dh key must be 65 bytes uncompressed, got ' . strlen($recipientPublicKey));
    }
    if (strlen($authSecret) !== 16) {
        throw new \InvalidArgumentException('auth secret must be 16 bytes, got ' . strlen($authSecret));
    }

    // ── Generate ephemeral EC key pair ──────────────────────
    $localKey = openssl_pkey_new(['curve_name' => 'prime256v1', 'private_key_type' => OPENSSL_KEYTYPE_EC]);
    if (!$localKey) {
        throw new \RuntimeException('Failed to generate EC key: ' . openssl_error_string());
    }
    $localKeyDetails     = openssl_pkey_get_details($localKey);
    $localPublicKeyPoint = "\x04"
        . str_pad($localKeyDetails['ec']['x'], 32, "\x00", STR_PAD_LEFT)
        . str_pad($localKeyDetails['ec']['y'], 32, "\x00", STR_PAD_LEFT);

    // ── ECDH shared secret ──────────────────────────────────────────────
    // Load recipient's public key (SubjectPublicKeyInfo DER wrapper for P-256)
    $spkiDer = "\x30\x59\x30\x13\x06\x07\x2a\x86\x48\xce\x3d\x02\x01"
             . "\x06\x08\x2a\x86\x48\xce\x3d\x03\x01\x07\x03\x42\x00"
             . $recipientPublicKey;
    $pem = "-----BEGIN PUBLIC KEY-----\n"
         . chunk_split(base64_encode($spkiDer), 64, "\n")
         . "-----END PUBLIC KEY-----";
    $recipientPubKeyObj = openssl_pkey_get_public($pem);
    if (!$recipientPubKeyObj) {
        throw new \RuntimeException('Failed to load recipient public key: ' . openssl_error_string());
    }

    // ── PHP 8.1+: openssl_pkey_derive (correct ECDH) ────────────────────
    // ── PHP 7.4-8.0: openssl_dh_compute_key fallback ────────────────────
    $sharedSecret = '';
    if (function_exists('openssl_pkey_derive')) {
        $result = openssl_pkey_derive($recipientPubKeyObj, $localKey, 32);
        if ($result === false) {
            throw new \RuntimeException('ECDH derive failed: ' . openssl_error_string());
        }
        $sharedSecret = $result;
    } else {
        $dhResult = '';
        openssl_dh_compute_key($dhResult, $recipientPubKeyObj, $localKey);
        $sharedSecret = $dhResult;
    }
    if ($sharedSecret === '' || $sharedSecret === false) {
        throw new \RuntimeException('ECDH produced empty shared secret: ' . openssl_error_string());
    }

    // ── Salt ────────────────────────────────────────────────
    $salt = random_bytes(16);

    // ── HKDF-SHA-256 key derivation (RFC 8291) ──────────────
    // PRK = HMAC-SHA-256(auth_secret, ECDH_secret)
    $prk = hash_hmac('sha256', $sharedSecret, $authSecret, true);

    // key_info = "WebPush: info\x00" || recipientPublicKey || localPublicKey
    $keyInfo = "WebPush: info\x00" . $recipientPublicKey . $localPublicKeyPoint;
    $ikm     = hkdfExpand($prk, $keyInfo, 32);

    // content-encryption key
    $cekInfo = "Content-Encoding: aes128gcm\x00";
    $cek     = hkdf($salt, $ikm, $cekInfo, 16);

    // nonce
    $nonceInfo = "Content-Encoding: nonce\x00";
    $nonce     = hkdf($salt, $ikm, $nonceInfo, 12);

    // ── Padding + Encryption ────────────────────────────────
    // Add record delimiter \x02 (no padding)
    $padded    = $payload . "\x02";
    $encrypted = openssl_encrypt($padded, 'aes-128-gcm', $cek, OPENSSL_RAW_DATA, $nonce, $tag);
    if ($encrypted === false) {
        throw new \RuntimeException('AES-128-GCM encryption failed: ' . openssl_error_string());
    }
    $ciphertext = $encrypted . $tag;

    // ── Build record header (RFC 8291 §2) ───────────────────
    // salt (16) + rs (4, big-endian) + keyid_len (1) + keyid (65)
    $rs     = pack('N', 4096);       // record size
    $header = $salt . $rs . chr(65) . $localPublicKeyPoint;

    return [
        'body'           => $header . $ciphertext,
        'salt'           => b64url_encode($salt),
        'localPublicKey' => b64url_encode($localPublicKeyPoint),
    ];
}

/**
 * HKDF Extract + Expand (single-step).
 */
function hkdf(string $salt, string $ikm, string $info, int $length): string {
    $prk = hash_hmac('sha256', $ikm, $salt, true);
    return hkdfExpand($prk, $info, $length);
}

/**
 * HKDF Expand.
 */
function hkdfExpand(string $prk, string $info, int $length): string {
    $output = '';
    $T      = '';
    $i      = 1;
    while (strlen($output) < $length) {
        $T       = hash_hmac('sha256', $T . $info . chr($i++), $prk, true);
        $output .= $T;
    }
    return substr($output, 0, $length);
}

/* ── Send single push (with encrypted payload) ───────────── */
function sendPushToEndpoint(array $sub, array $payloadData = []): array {
    $result = ['success' => false, 'code' => 0, 'error' => ''];

    if (empty($sub['endpoint'])) {
        $result['error'] = 'empty_endpoint';
        return $result;
    }

    $endpoint = $sub['endpoint'];
    $p256dh   = $sub['keys']['p256dh'] ?? '';
    $auth     = $sub['keys']['auth']   ?? '';

    pushLog('debug', 'Sending push', [
        'endpoint' => substr($endpoint, 0, 60) . '...',
        'hasKeys'  => (!empty($p256dh) && !empty($auth)),
    ]);

    try {
        $jwt      = buildVapidJWT($endpoint);
        $vapidKey = VAPID_PUBLIC_KEY;
    } catch (\Throwable $e) {
        pushLog('error', 'VAPID JWT build failed', ['msg' => $e->getMessage()]);
        $result['error'] = 'jwt_failed: ' . $e->getMessage();
        return $result;
    }

    // ── Build HTTP headers & body ───────────────────────────
    $postBody = '';
    $headers  = [
        'Authorization: vapid t=' . $jwt . ', k=' . $vapidKey,
        'TTL: ' . PUSH_TTL,
        'Urgency: normal',
    ];

    if (!empty($payloadData) && !empty($p256dh) && !empty($auth)) {
        // Encrypt the payload
        $jsonPayload = json_encode($payloadData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (strlen($jsonPayload) > MAX_PAYLOAD) {
            // Truncate body if needed
            $payloadData['body'] = mb_substr($payloadData['body'], 0, 100) . '...';
            $jsonPayload = json_encode($payloadData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        }

        try {
            $enc = encryptPayload($jsonPayload, $p256dh, $auth);
            $postBody = $enc['body'];
            $headers[] = 'Content-Type: application/octet-stream';
            $headers[] = 'Content-Encoding: aes128gcm';
            $headers[] = 'Content-Length: ' . strlen($postBody);
        } catch (\Throwable $e) {
            pushLog('error', 'Payload encryption failed', ['msg' => $e->getMessage()]);
            // Fall through — send without payload
            $headers[] = 'Content-Length: 0';
            $headers[] = 'Content-Type: application/octet-stream';
        }
    } else {
        // No keys — send trigger-only (SW will fetch latest.json)
        $headers[] = 'Content-Length: 0';
        $headers[] = 'Content-Type: application/octet-stream';
    }

    // ── cURL request ────────────────────────────────────────
    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_POSTFIELDS     => $postBody,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 15,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_SSL_VERIFYPEER => true,
        CURLOPT_FOLLOWLOCATION => false,
        CURLOPT_HEADER         => true,  // capture response headers for debugging
    ]);

    $response    = curl_exec($ch);
    $httpCode    = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError   = curl_error($ch);
    $headerSize  = curl_getinfo($ch, CURLINFO_HEADER_SIZE);
    $responseBody= $response ? substr($response, $headerSize) : '';
    curl_close($ch);

    pushLog('debug', 'Push response', [
        'code'      => $httpCode,
        'curlError' => $curlError,
        'endpoint'  => substr($endpoint, 0, 60),
        'body'      => substr($responseBody, 0, 200),
    ]);

    $result['code'] = $httpCode;

    if ($curlError) {
        $result['error'] = 'curl: ' . $curlError;
        return $result;
    }

    // 201 = Created (FCM/GCM success), 200 = OK (some servers)
    if ($httpCode === 201 || $httpCode === 200) {
        $result['success'] = true;
        return $result;
    }

    // 410 Gone or 404 Not Found = subscription expired
    if ($httpCode === 410 || $httpCode === 404) {
        $result['error'] = 'expired';
        return $result;
    }

    $result['error'] = "http_{$httpCode}: " . substr($responseBody, 0, 200);
    return $result;
}

<?php
/**
 * Supabase Proxy — بوست وظيفتك
 * يُعيد توجيه طلبات REST API من المتصفح إلى Supabase
 * بدون مشاكل CORS لأن الطلب يمر عبر خادم Hostinger
 *
 * الاستخدام: /api/sb-proxy.php?path=jobs
 *            /api/sb-proxy.php?path=jobs&id=eq.5
 */

// ── إعدادات Supabase ──────────────────────────────────────────
const SB_URL = 'https://zkelkmfxjobrsnvyaanv.supabase.co/rest/v1';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InprZWxrbWZ4am9icnNudnlhYW52Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODE3MjEyMDMsImV4cCI6MjA5NzI5NzIwM30.4DlZhfnxOKeitCqjt9_1Anw00XkDhKxcZnOQTj5EYck';

// ── CORS للسماح بالطلبات من wadifatuk.com ─────────────────────
header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PATCH, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Prefer, Authorization, apikey');
header('Cache-Control: no-cache, no-store');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── بناء رابط Supabase الكامل ─────────────────────────────────
$path     = preg_replace('/[^a-zA-Z0-9_\-]/', '', $_GET['path'] ?? 'jobs');
// السماح فقط بالجداول المعروفة
$allowedTables = ['jobs', 'email_subscribers'];
if (!in_array($path, $allowedTables)) {
    http_response_code(403);
    echo json_encode(['error' => 'forbidden', 'message' => 'جدول غير مسموح به'], JSON_UNESCAPED_UNICODE);
    exit;
}
// استثناء 'path' و 't' (timestamp لمنع الكاش — لا يُرسَل لـ Supabase)
$queryStr = http_build_query(array_diff_key($_GET, ['path' => 1, 't' => 1]));
$fullUrl  = SB_URL . '/' . $path . ($queryStr ? '?' . $queryStr : '');


// ── القراءة من body (للـ POST/PATCH) ─────────────────────────
$requestBody = file_get_contents('php://input');
$method      = strtoupper($_SERVER['REQUEST_METHOD']);

// ── إعداد cURL ────────────────────────────────────────────────
$ch = curl_init($fullUrl);

$curlHeaders = [
    'apikey: '        . SB_KEY,
    'Authorization: Bearer ' . SB_KEY,
    'Content-Type: application/json',
];

// أضف Prefer header إذا كان موجوداً في الطلب الأصلي
if (isset($_SERVER['HTTP_PREFER'])) {
    $curlHeaders[] = 'Prefer: ' . $_SERVER['HTTP_PREFER'];
} elseif (in_array($method, ['POST', 'PATCH'])) {
    $curlHeaders[] = 'Prefer: return=representation';
}

curl_setopt_array($ch, [
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT        => 15,
    CURLOPT_FOLLOWLOCATION => true,
    CURLOPT_HTTPHEADER     => $curlHeaders,
    CURLOPT_SSL_VERIFYPEER => true,
]);

// تعيين Method
switch ($method) {
    case 'POST':
        curl_setopt($ch, CURLOPT_POST, true);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
        break;
    case 'PATCH':
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'PATCH');
        curl_setopt($ch, CURLOPT_POSTFIELDS, $requestBody);
        break;
    case 'DELETE':
        curl_setopt($ch, CURLOPT_CUSTOMREQUEST, 'DELETE');
        break;
    default: // GET
        break;
}

// ── تنفيذ الطلب ───────────────────────────────────────────────
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
$curlErr  = curl_error($ch);
curl_close($ch);

// ── معالجة الأخطاء ────────────────────────────────────────────
if ($response === false || $curlErr) {
    http_response_code(503);
    echo json_encode([
        'error'   => 'proxy_error',
        'message' => 'تعذّر الاتصال بـ Supabase: ' . $curlErr
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// ── إرسال الاستجابة كما هي من Supabase ───────────────────────
http_response_code($httpCode ?: 200);
echo $response;

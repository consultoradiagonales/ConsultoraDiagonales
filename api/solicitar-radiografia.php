<?php
/**
 * SOLICITAR-RADIOGRAFIA.PHP
 * Sistema de gating para radiografías PRIVADAS
 * Consultora Diagonales | Validación Backend
 *
 * Endpoint: POST /api/solicitar-radiografia
 * Content-Type: application/json
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido. Use POST.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['error' => 'JSON inválido.']);
    exit;
}

if (empty($data['nombre']) || empty($data['email'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Nombre y email son requeridos']);
    exit;
}

$radiografiaId = trim((string)($data['radiografiaId'] ?? ''));
$nombre = trim((string)($data['nombre'] ?? ''));
$email = trim((string)($data['email'] ?? ''));
$telefono = trim((string)($data['telefono'] ?? ''));
$organizacion = trim((string)($data['organizacion'] ?? ''));

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email inválido']);
    exit;
}

if (strlen($nombre) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'El nombre debe tener al menos 3 caracteres']);
    exit;
}

$listaBlanca = [
    'info.consultoradiagonales@gmail.com',
];

$emailAutorizado = in_array(strtolower($email), array_map('strtolower', $listaBlanca), true);

if (!$emailAutorizado) {
    $solicitud = [
        'radiografia_id' => $radiografiaId,
        'nombre' => $nombre,
        'email' => $email,
        'telefono' => $telefono,
        'organizacion' => $organizacion,
        'timestamp' => date('Y-m-d H:i:s'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'estado' => 'pendiente',
    ];

    $solicitudesFile = __DIR__ . '/solicitudes.json';
    $solicitudes = [];

    if (file_exists($solicitudesFile)) {
        $contenido = file_get_contents($solicitudesFile);
        $solicitudes = json_decode($contenido, true) ?? [];
    }

    $solicitudes[] = $solicitud;

    if (!file_put_contents($solicitudesFile, json_encode($solicitudes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar solicitud']);
        exit;
    }

    $to = 'admin@consultoradiagonales.com.ar';
    $subject = "Nueva solicitud de acceso: Radiografía {$radiografiaId}";
    $message = "Solicitud de acceso a radiografía:\n\n"
        . "Nombre: {$nombre}\n"
        . "Email: {$email}\n"
        . "Teléfono: {$telefono}\n"
        . "Organización: {$organizacion}\n"
        . "Radiografía: {$radiografiaId}\n"
        . "IP: {$_SERVER['REMOTE_ADDR'] ?? 'unknown'}\n"
        . "Fecha: " . date('Y-m-d H:i:s') . "\n\n"
        . "Revisar en: /api/solicitudes.json";

    $headers = "Content-Type: text/plain; charset=UTF-8\r\n"
        . "From: sistema@consultoradiagonales.com.ar\r\n";

    @mail($to, $subject, $message, $headers);

    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'No autorizado',
        'message' => 'Tu solicitud ha sido registrada. El administrador la revisará pronto.'
    ]);
    exit;
}

$token = bin2hex(random_bytes(32));

$tokenData = [
    'token' => $token,
    'radiografiaId' => $radiografiaId,
    'email' => $email,
    'nombre' => $nombre,
    'createdAt' => time(),
    'expiresAt' => time() + (30 * 24 * 60 * 60),
];

if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$_SESSION['radiografia_token_' . $radiografiaId] = $tokenData;

$tokensFile = __DIR__ . '/tokens.json';
$tokens = [];

if (file_exists($tokensFile)) {
    $contenido = file_get_contents($tokensFile);
    $tokens = json_decode($contenido, true) ?? [];
}

$tokens[$token] = $tokenData;
file_put_contents($tokensFile, json_encode($tokens, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

$to = $email;
$subject = "✅ Acceso aprobado: Radiografía Consultora Diagonales";
$message = "Hola {$nombre},\n\n"
    . "Tu solicitud de acceso ha sido aprobada.\n\n"
    . "Ya puedes acceder a la radiografía.\n\n"
    . "Token: {$token}\n"
    . "Válido hasta: " . date('d/m/Y H:i', $tokenData['expiresAt']) . "\n\n"
    . "Consultora Diagonales\n"
    . "https://consultoradiagonales.com.ar";

$headers = "Content-Type: text/plain; charset=UTF-8\r\n"
    . "From: sistema@consultoradiagonales.com.ar\r\n";

@mail($to, $subject, $message, $headers);

http_response_code(200);
echo json_encode([
    'success' => true,
    'token' => $token,
    'message' => 'Acceso aprobado. Abriendo radiografía...',
    'expiresAt' => date('d/m/Y H:i', $tokenData['expiresAt']),
    'radiografiaId' => $radiografiaId,
]);

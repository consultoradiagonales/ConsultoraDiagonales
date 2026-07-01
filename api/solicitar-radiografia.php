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
header('Access-Control-Allow-Methods: POST');
header('Access-Control-Allow-Headers: Content-Type');

// CORS preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Método no permitido. Use POST.']);
    exit;
}

// Recibir datos
$data = json_decode(file_get_contents('php://input'), true);

// Validar datos recibidos
if (empty($data['nombre']) || empty($data['email'])) {
    http_response_code(400);
    echo json_encode(['error' => 'Nombre y email son requeridos']);
    exit;
}

// Extraer datos
$radiografiaId = trim($data['radiografiaId'] ?? '');
$nombre = trim($data['nombre'] ?? '');
$email = trim($data['email'] ?? '');
$telefono = trim($data['telefono'] ?? '');
$organizacion = trim($data['organizacion'] ?? '');

// Validar email
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['error' => 'Email inválido']);
    exit;
}

// Validar nombre (mínimo 3 caracteres)
if (strlen($nombre) < 3) {
    http_response_code(400);
    echo json_encode(['error' => 'El nombre debe tener al menos 3 caracteres']);
    exit;
}

// ============================================================
// LISTA BLANCA DE EMAILS AUTORIZADOS
// EDITA ESTO para agregar emails que tienen acceso automático
// ============================================================
$listaBlanca = [
    'fernando@consultoradiagonales.com.ar',
    'admin@consultoradiagonales.com.ar',
    'fernandogenazzini@gmail.com',
    // Agregar más emails aquí según necesites
];

// ============================================================
// VALIDAR CONTRA LISTA BLANCA
// ============================================================
$emailAutorizado = in_array(strtolower($email), array_map('strtolower', $listaBlanca));

if (!$emailAutorizado) {
    // Email NO está en lista blanca
    // Registrar solicitud para que admin la procese después
    
    $solicitud = [
        'radiografia_id' => $radiografiaId,
        'nombre' => $nombre,
        'email' => $email,
        'telefono' => $telefono,
        'organizacion' => $organizacion,
        'timestamp' => date('Y-m-d H:i:s'),
        'ip' => $_SERVER['REMOTE_ADDR'] ?? 'unknown',
        'estado' => 'pendiente'
    ];
    
    // Guardar solicitud en JSON
    $solicitudesFile = __DIR__ . '/solicitudes.json';
    $solicitudes = [];
    
    if (file_exists($solicitudesFile)) {
        $contenido = file_get_contents($solicitudesFile);
        $solicitudes = json_decode($contenido, true) ?? [];
    }
    
    $solicitudes[] = $solicitud;
    
    // Guardar
    if (!file_put_contents($solicitudesFile, json_encode($solicitudes, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE))) {
        http_response_code(500);
        echo json_encode(['error' => 'Error al registrar solicitud']);
        exit;
    }
    
    // Enviar email a admin (opcional)
    $to = 'admin@consultoradiagonales.com.ar';
    $subject = "Nueva solicitud de acceso: Radiografía {$radiografiaId}";
    $message = "Solicitud de acceso a radiografía:\n\n"
        . "Nombre: {$nombre}\n"
        . "Email: {$email}\n"
        . "Teléfono: {$telefono}\n"
        . "Organización: {$organizacion}\n"
        . "Radiografía: {$radiografiaId}\n"
        . "IP: {$_SERVER['REMOTE_ADDR']}\n"
        . "Fecha: " . date('Y-m-d H:i:s') . "\n\n"
        . "Revisar en: /api/solicitudes.json";
    
    $headers = "Content-Type: text/plain; charset=UTF-8\r\n"
        . "From: sistema@consultoradiagonales.com.ar\r\n";
    
    @mail($to, $subject, $message, $headers);
    
    // Responder al cliente
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'error' => 'No autorizado',
        'message' => 'Tu solicitud ha sido registrada. El administrador la revisará pronto.'
    ]);
    exit;
}

// ============================================================
// EMAIL AUTORIZADO - GENERAR TOKEN
// ============================================================

// Generar token seguro
$token = bin2hex(random_bytes(32));

// Crear objeto de token
$tokenData = [
    'token' => $token,
    'radiografiaId' => $radiografiaId,
    'email' => $email,
    'nombre' => $nombre,
    'createdAt' => time(),
    'expiresAt' => time() + (30 * 24 * 60 * 60) // 30 días
];

// Guardar token en sesión (opcional - si usas sesiones PHP)
if (session_status() === PHP_SESSION_NONE) {
    @session_start();
}

$_SESSION['radiografia_token_' . $radiografiaId] = $tokenData;

// Guardar token en JSON (más confiable)
$tokensFile = __DIR__ . '/tokens.json';
$tokens = [];

if (file_exists($tokensFile)) {
    $contenido = file_get_contents($tokensFile);
    $tokens = json_decode($contenido, true) ?? [];
}

$tokens[$token] = $tokenData;

file_put_contents($tokensFile, json_encode($tokens, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));

// Enviar email de confirmación (opcional)
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

// ============================================================
// RESPONDER CON ÉXITO
// ============================================================

http_response_code(200);
echo json_encode([
    'success' => true,
    'token' => $token,
    'message' => 'Acceso aprobado. Abriendo radiografía...',
    'expiresAt' => date('d/m/Y H:i', $tokenData['expiresAt']),
    'radiografiaId' => $radiografiaId
]);

?>

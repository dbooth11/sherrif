<?php
/**
 * Shareff Email API
 *
 * Standalone email endpoint for testing and direct use.
 * Also included by api.php as a utility for shared email functions.
 *
 * Standalone usage:
 *   POST /email.php?action=test     - Send a test email
 *   POST /email.php?action=invite   - Send an invite email
 *   GET  /email.php?action=status   - Check if mail() is available
 *
 * When included by api.php:
 *   Provides: sendEmail(), buildHtml(), FROM_EMAIL, FROM_NAME, WELCOME_PAGE_URL
 */

// ============ Config (safe to re-include) ============

if (!defined('FROM_EMAIL')) define('FROM_EMAIL', 'shareff@dbooth.net');
if (!defined('FROM_NAME')) define('FROM_NAME', 'Shareff');
if (!defined('WELCOME_PAGE_URL')) define('WELCOME_PAGE_URL', 'https://www.dbooth.net/shareff/welcome.html');

// ============ Standalone Router ============
// Only runs when email.php is accessed directly (not when included by api.php)

if (basename($_SERVER['SCRIPT_FILENAME']) === 'email.php') {

    header('Content-Type: application/json');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    header('Access-Control-Allow-Headers: Content-Type, X-Shareff-Key');

    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        http_response_code(200);
        exit;
    }

    // API key validation
    if (!defined('API_KEY')) define('API_KEY', 'sh2_2270d1d4054dde1695f2ccb4f5a84af0');
    $providedKey = $_SERVER['HTTP_X_SHAREFF_KEY'] ?? '';
    if ($providedKey !== API_KEY) {
        http_response_code(403);
        echo json_encode(['error' => 'Forbidden']);
        exit;
    }

    $action = $_GET['action'] ?? '';

    switch ($action) {
        case 'status':
            handleStatus();
            break;
        case 'test':
            handleTest();
            break;
        case 'invite':
            handleInvite();
            break;
        default:
            emailJsonResponse(['error' => 'Unknown action. Use: status, test, invite'], 400);
    }
}

// ============ Standalone Handlers ============

/**
 * Check if email is available on this server
 */
function handleStatus() {
    $mailExists = function_exists('mail');
    $sendmailPath = ini_get('sendmail_path');

    emailJsonResponse([
        'mail_available' => $mailExists,
        'sendmail_path' => $sendmailPath ?: '(not set)',
        'from_email' => FROM_EMAIL,
        'server' => php_uname('n')
    ]);
}

/**
 * Send a test email to verify delivery
 */
function handleTest() {
    $data = emailGetJsonInput();
    $to = $data['to'] ?? '';

    if (!$to || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
        emailJsonResponse(['error' => 'Valid "to" email required'], 400);
    }

    $subject = 'Shareff Email Test';
    $html = buildHtml(
        'Email Test',
        '<p>If you are reading this, Shareff email is working correctly.</p>'
        . '<p style="color:#666;font-size:13px;">Sent at: ' . date('Y-m-d H:i:s T') . '</p>'
    );

    $sent = sendEmail($to, $subject, $html);

    if ($sent) {
        emailJsonResponse(['success' => true, 'message' => "Test email sent to $to"]);
    } else {
        emailJsonResponse(['error' => 'mail() returned false. Check server mail config.'], 500);
    }
}

/**
 * Send an invite email (standalone endpoint)
 */
function handleInvite() {
    $data = emailGetJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $adminName = $data['adminName'] ?? '';
    $userEmail = $data['userEmail'] ?? '';
    $userName = $data['userName'] ?? '';
    $extensionUrl = $data['extensionUrl'] ?? '';

    if (!$adminEmail || !$userEmail || !$userName) {
        emailJsonResponse(['error' => 'Missing required fields: adminEmail, userEmail, userName'], 400);
    }

    $sent = sendInviteEmail($adminEmail, $adminName, $userEmail, $userName, $extensionUrl);

    if ($sent) {
        emailJsonResponse(['success' => true, 'message' => "Invite sent to $userEmail"]);
    } else {
        emailJsonResponse(['error' => 'Failed to send email'], 500);
    }
}

// ============ Shared Email Functions ============
// These are used by both email.php (standalone) and api.php (via require_once)

/**
 * Send an HTML email via PHP mail()
 */
function sendEmail($to, $subject, $htmlBody, $replyTo = null) {
    $headers = [
        'From' => FROM_NAME . ' <' . FROM_EMAIL . '>',
        'MIME-Version' => '1.0',
        'Content-Type' => 'text/html; charset=UTF-8',
        'X-Mailer' => 'Shareff/2.1'
    ];

    if ($replyTo) {
        $headers['Reply-To'] = $replyTo;
    }

    $headerString = '';
    foreach ($headers as $key => $value) {
        $headerString .= "$key: $value\r\n";
    }

    return mail($to, $subject, $htmlBody, $headerString);
}

/**
 * Build a consistent HTML email template
 */
function buildHtml($heading, $bodyContent, $footerEmail = null, $ctaButton = null) {
    $footer = '';
    if ($footerEmail) {
        $footer = "<p style='color:#999;font-size:12px;margin-top:30px;'>"
            . "This invite was sent via Shareff on behalf of $footerEmail.</p>";
    }

    $cta = '';
    if ($ctaButton) {
        $cta = "<p style='margin-top:30px;'>$ctaButton</p>";
    }

    return "
    <div style='font-family:system-ui,-apple-system,sans-serif;max-width:600px;margin:0 auto;padding:20px;'>
        <h2 style='color:#4CAF50;'>$heading</h2>
        $bodyContent
        $cta
        $footer
    </div>
    ";
}

/**
 * Build and send an invite email
 * Shared by api.php's handleSendInvite() and email.php's standalone invite action
 */
function sendInviteEmail($adminEmail, $adminName, $userEmail, $userName, $extensionUrl = '') {
    if (!$adminName) {
        $adminName = 'A friend';
    }

    $subject = "$adminName wants to share links with you on Shareff";

    $html = buildHtml(
        "$adminName wants to share links with you!",
        "<p>Hey $userName!</p>"
        . "<p>$adminName invited you to <strong>Shareff</strong> &mdash; a simple way to share links while browsing.</p>"
        . "<div style='background:#f5f5f5;padding:20px;border-radius:8px;margin:20px 0;'>"
        . "  <h3 style='margin-top:0;'>Getting started:</h3>"
        . "  <ol style='padding-left:20px;'>"
        . "    <li style='margin-bottom:10px;'><strong>Install the extension:</strong><br>"
        . "      <a href='$extensionUrl' style='color:#4CAF50;'>$extensionUrl</a></li>"
        . "    <li style='margin-bottom:10px;'><strong>Enter your info:</strong> Click the extension and add your name and email</li>"
        . "    <li style='margin-bottom:10px;'><strong>Connect:</strong> Go to Settings &rarr; \"+ Connect\" under Receive Links</li>"
        . "    <li style='margin-bottom:10px;'><strong>Enter this email:</strong> "
        . "      <code style='background:#e8e8e8;padding:2px 6px;border-radius:4px;'>$adminEmail</code></li>"
        . "  </ol>"
        . "</div>"
        . "<p>That's it! Now you can send links directly to each other's browser.</p>"
        . "<p>Right-click any page and select your friend's name from the Shareff menu.</p>",
        $adminEmail,
        "<a href='" . WELCOME_PAGE_URL . "' style='background:#4CAF50;color:white;padding:12px 24px;"
        . "text-decoration:none;border-radius:6px;display:inline-block;'>Learn More About Shareff</a>"
    );

    return sendEmail($userEmail, $subject, $html, $adminEmail);
}

// ============ Standalone Utilities ============
// Prefixed to avoid collision with api.php's own versions

function emailGetJsonInput() {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw, true);
    return $data ?: [];
}

function emailJsonResponse($data, $code = 200) {
    http_response_code($code);
    echo json_encode($data);
    exit;
}

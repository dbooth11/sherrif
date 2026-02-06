<?php
/**
 * Shareff v2 API
 *
 * Flat file storage backend for the Shareff browser extension.
 * Each admin has their own JSON file in /data/admins/
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Shareff-Key');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

// API key validation - blocks unauthorized access
const API_KEY = 'sh2_2270d1d4054dde1695f2ccb4f5a84af0';

$providedKey = $_SERVER['HTTP_X_SHAREFF_KEY'] ?? '';
if ($providedKey !== API_KEY) {
    http_response_code(403);
    echo json_encode(['error' => 'Forbidden']);
    exit;
}

const DATA_DIR = __DIR__ . '/data/admins/';
const MAX_LINKS = 100;

// Include shared email utilities if available (provides sendEmail, buildHtml, sendInviteEmail)
$emailLib = __DIR__ . '/email.php';
if (file_exists($emailLib)) {
    require_once $emailLib;
}

// Ensure data directory exists
if (!is_dir(DATA_DIR)) {
    mkdir(DATA_DIR, 0755, true);
}

// Get action from query string
$action = $_GET['action'] ?? '';

// Route request
try {
    switch ($action) {
        case 'register':
            handleRegister();
            break;
        case 'addUser':
            handleAddUser();
            break;
        case 'removeUser':
            handleRemoveUser();
            break;
        case 'createGroup':
            handleCreateGroup();
            break;
        case 'updateGroup':
            handleUpdateGroup();
            break;
        case 'deleteGroup':
            handleDeleteGroup();
            break;
        case 'send':
            handleSend();
            break;
        case 'getLinks':
            handleGetLinks();
            break;
        case 'getAdmin':
            handleGetAdmin();
            break;
        case 'sendInvite':
            handleSendInvite();
            break;
        case 'getUserStatus':
            handleGetUserStatus();
            break;
        case 'deleteAdmin':
            handleDeleteAdmin();
            break;
        default:
            jsonResponse(['error' => 'Unknown action'], 400);
    }
} catch (Exception $e) {
    jsonResponse(['error' => $e->getMessage()], 500);
}

// ============ Handlers ============

/**
 * Register or update an admin
 */
function handleRegister() {
    $data = getJsonInput();

    $email = $data['email'] ?? '';
    $name = $data['name'] ?? '';

    if (!$email || !$name) {
        jsonResponse(['error' => 'Missing email or name'], 400);
    }

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        jsonResponse(['error' => 'Invalid email format'], 400);
    }

    $admin = loadAdmin($email);

    if (!$admin) {
        // Create new admin
        $admin = [
            'email' => $email,
            'name' => $name,
            'users' => [],
            'groups' => [],
            'links' => []
        ];
    } else {
        // Update existing admin's name
        $admin['name'] = $name;
    }

    saveAdmin($email, $admin);
    jsonResponse(['success' => true]);
}

/**
 * Add a user to admin's pool
 * If user already exists with status=pending, update to connected and send welcome link
 */
function handleAddUser() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $userEmail = $data['userEmail'] ?? '';
    $userName = $data['userName'] ?? '';
    $status = $data['status'] ?? 'connected'; // Default to connected for backward compat

    if (!$adminEmail || !$userEmail || !$userName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    // Check if user already exists
    $existingIndex = -1;
    foreach ($admin['users'] as $index => $user) {
        if ($user['email'] === $userEmail) {
            $existingIndex = $index;
            break;
        }
    }

    if ($existingIndex >= 0) {
        $existingUser = $admin['users'][$existingIndex];

        // If they were pending and are now connecting, update status and send welcome
        if (isset($existingUser['status']) && $existingUser['status'] === 'pending') {
            $admin['users'][$existingIndex]['status'] = 'connected';
            $admin['users'][$existingIndex]['connectedAt'] = time();

            // Send welcome link from admin to new user
            $welcomeLink = [
                'id' => generateId(),
                'from' => $adminEmail,
                'fromName' => $admin['name'],
                'url' => WELCOME_PAGE_URL,
                'title' => 'Welcome to Shareff! Here\'s how it works',
                'ts' => round(microtime(true) * 1000),
                'target' => $userEmail
            ];
            array_unshift($admin['links'], $welcomeLink);

            saveAdmin($adminEmail, $admin);
            jsonResponse(['success' => true, 'statusChanged' => true, 'newStatus' => 'connected']);
        } else {
            // Already connected, just return success
            jsonResponse(['success' => true, 'statusChanged' => false]);
        }
    }

    // New user - add them
    $admin['users'][] = [
        'email' => $userEmail,
        'name' => $userName,
        'status' => $status,
        'addedAt' => time()
    ];

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true]);
}

/**
 * Remove a user from admin's pool
 */
function handleRemoveUser() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $userEmail = $data['userEmail'] ?? '';

    if (!$adminEmail || !$userEmail) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    // Remove user
    $admin['users'] = array_values(array_filter($admin['users'], function($user) use ($userEmail) {
        return $user['email'] !== $userEmail;
    }));

    // Also remove from all groups
    foreach ($admin['groups'] as &$group) {
        $group['members'] = array_values(array_filter($group['members'], function($member) use ($userEmail) {
            return $member !== $userEmail;
        }));
    }

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true]);
}

/**
 * Create a new group
 */
function handleCreateGroup() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $groupName = $data['groupName'] ?? '';
    $members = $data['members'] ?? [];

    if (!$adminEmail || !$groupName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    $groupId = generateId();

    $admin['groups'][] = [
        'id' => $groupId,
        'name' => $groupName,
        'members' => $members
    ];

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true, 'groupId' => $groupId]);
}

/**
 * Update an existing group
 */
function handleUpdateGroup() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $groupId = $data['groupId'] ?? '';
    $groupName = $data['groupName'] ?? null;
    $members = $data['members'] ?? null;

    if (!$adminEmail || !$groupId) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    $found = false;
    foreach ($admin['groups'] as &$group) {
        if ($group['id'] === $groupId) {
            if ($groupName !== null) {
                $group['name'] = $groupName;
            }
            if ($members !== null) {
                $group['members'] = $members;
            }
            $found = true;
            break;
        }
    }

    if (!$found) {
        jsonResponse(['error' => 'Group not found'], 404);
    }

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true]);
}

/**
 * Delete a group
 */
function handleDeleteGroup() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $groupId = $data['groupId'] ?? '';

    if (!$adminEmail || !$groupId) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    $admin['groups'] = array_values(array_filter($admin['groups'], function($group) use ($groupId) {
        return $group['id'] !== $groupId;
    }));

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true]);
}

/**
 * Send a link
 */
function handleSend() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $from = $data['from'] ?? '';
    $fromName = $data['fromName'] ?? '';
    $url = $data['url'] ?? '';
    $title = $data['title'] ?? $url;
    $target = $data['target'] ?? '';

    if (!$adminEmail || !$from || !$fromName || !$url || !$target) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    $linkId = generateId();

    $link = [
        'id' => $linkId,
        'from' => $from,
        'fromName' => $fromName,
        'url' => $url,
        'title' => $title,
        'ts' => round(microtime(true) * 1000),
        'target' => $target
    ];

    // Add to beginning of links array
    array_unshift($admin['links'], $link);

    // Trim to max links
    if (count($admin['links']) > MAX_LINKS) {
        $admin['links'] = array_slice($admin['links'], 0, MAX_LINKS);
    }

    saveAdmin($adminEmail, $admin);
    jsonResponse(['success' => true, 'id' => $linkId]);
}

/**
 * Get links (admin or recipient view)
 */
function handleGetLinks() {
    $adminEmail = $_GET['adminEmail'] ?? '';
    $userEmail = $_GET['userEmail'] ?? null;

    if (!$adminEmail) {
        jsonResponse(['error' => 'Missing adminEmail'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    if ($userEmail) {
        // Recipient view - filter links
        $userGroups = [];
        foreach ($admin['groups'] as $group) {
            if (in_array($userEmail, $group['members'])) {
                $userGroups[] = $group['id'];
            }
        }

        $filteredLinks = array_filter($admin['links'], function($link) use ($userEmail, $userGroups) {
            // Links sent to groups the user is in
            if (in_array($link['target'], $userGroups)) {
                return true;
            }
            // Links sent directly to this user
            if ($link['target'] === $userEmail) {
                return true;
            }
            // Links this user sent (so they can see their own)
            if ($link['from'] === $userEmail) {
                return true;
            }
            return false;
        });

        jsonResponse([
            'links' => array_values($filteredLinks),
            'adminName' => $admin['name']
        ]);
    } else {
        // Admin view - return everything including user status
        $usersWithStatus = array_map(function($user) {
            return [
                'email' => $user['email'],
                'name' => $user['name'],
                'status' => $user['status'] ?? 'connected',
                'addedAt' => $user['addedAt'] ?? null,
                'invitedAt' => $user['invitedAt'] ?? null,
                'connectedAt' => $user['connectedAt'] ?? null
            ];
        }, $admin['users']);

        jsonResponse([
            'links' => $admin['links'],
            'users' => $usersWithStatus,
            'groups' => $admin['groups']
        ]);
    }
}

/**
 * Get admin info (for recipient setup)
 */
function handleGetAdmin() {
    $adminEmail = $_GET['adminEmail'] ?? '';

    if (!$adminEmail) {
        jsonResponse(['error' => 'Missing adminEmail'], 400);
    }

    $admin = loadAdmin($adminEmail);

    if ($admin) {
        jsonResponse([
            'exists' => true,
            'name' => $admin['name']
        ]);
    } else {
        jsonResponse([
            'exists' => false
        ]);
    }
}

/**
 * Send invite email to a user
 * Uses shared sendInviteEmail() from email.php
 */
function handleSendInvite() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $adminName = $data['adminName'] ?? '';
    $userEmail = $data['userEmail'] ?? '';
    $userName = $data['userName'] ?? '';
    $extensionUrl = $data['extensionUrl'] ?? 'https://chrome.google.com/webstore/detail/shareff/YOUR_EXTENSION_ID';

    if (!$adminEmail || !$userEmail || !$userName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    // Use admin's stored name if not provided
    if (!$adminName) {
        $adminName = $admin['name'] ?? 'A friend';
    }

    // Send using shared email utility
    $sent = sendInviteEmail($adminEmail, $adminName, $userEmail, $userName, $extensionUrl);

    if ($sent) {
        // Update user's invitedAt timestamp
        foreach ($admin['users'] as &$user) {
            if ($user['email'] === $userEmail) {
                $user['invitedAt'] = time();
                break;
            }
        }
        saveAdmin($adminEmail, $admin);

        jsonResponse(['success' => true, 'message' => 'Invite sent']);
    } else {
        jsonResponse(['error' => 'Failed to send email'], 500);
    }
}

/**
 * Get status of users for an admin
 */
function handleGetUserStatus() {
    $adminEmail = $_GET['adminEmail'] ?? '';

    if (!$adminEmail) {
        jsonResponse(['error' => 'Missing adminEmail'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    $userStatuses = [];
    foreach ($admin['users'] as $user) {
        $userStatuses[] = [
            'email' => $user['email'],
            'name' => $user['name'],
            'status' => $user['status'] ?? 'connected',
            'addedAt' => $user['addedAt'] ?? null,
            'invitedAt' => $user['invitedAt'] ?? null,
            'connectedAt' => $user['connectedAt'] ?? null
        ];
    }

    jsonResponse(['users' => $userStatuses]);
}

/**
 * Delete an admin's data file (erase network)
 */
function handleDeleteAdmin() {
    $data = getJsonInput();
    $adminEmail = $data['adminEmail'] ?? '';

    if (!$adminEmail) {
        jsonResponse(['error' => 'Missing adminEmail'], 400);
    }

    $filename = DATA_DIR . sanitizeFilename($adminEmail) . '.json';

    if (!file_exists($filename)) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    unlink($filename);
    jsonResponse(['success' => true]);
}

// ============ Helpers ============

/**
 * Get JSON input from request body
 */
function getJsonInput(): array {
    $input = file_get_contents('php://input');
    $data = json_decode($input, true);

    if (json_last_error() !== JSON_ERROR_NONE) {
        jsonResponse(['error' => 'Invalid JSON'], 400);
    }

    return $data ?? [];
}

/**
 * Send JSON response and exit
 */
function jsonResponse(array $data, int $status = 200): void {
    http_response_code($status);
    echo json_encode($data);
    exit;
}

/**
 * Load admin data from file
 */
function loadAdmin(string $email): ?array {
    $filename = DATA_DIR . sanitizeFilename($email) . '.json';

    if (!file_exists($filename)) {
        return null;
    }

    $content = file_get_contents($filename);
    return json_decode($content, true);
}

/**
 * Save admin data to file
 */
function saveAdmin(string $email, array $data): void {
    $filename = DATA_DIR . sanitizeFilename($email) . '.json';
    file_put_contents($filename, json_encode($data, JSON_PRETTY_PRINT));
}

/**
 * Sanitize email for use as filename
 */
function sanitizeFilename(string $email): string {
    // Replace @ and . with safe characters
    return preg_replace('/[^a-zA-Z0-9_-]/', '_', $email);
}

/**
 * Generate unique ID
 */
function generateId(): string {
    return base_convert(time(), 10, 36) . bin2hex(random_bytes(3));
}

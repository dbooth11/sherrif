<?php
/**
 * SpitNet v2 API
 *
 * Flat file storage backend for the SpitNet browser extension.
 * Each admin has their own JSON file in /data/admins/
 */

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit;
}

const DATA_DIR = __DIR__ . '/data/admins/';
const MAX_LINKS = 100;

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
 */
function handleAddUser() {
    $data = getJsonInput();

    $adminEmail = $data['adminEmail'] ?? '';
    $userEmail = $data['userEmail'] ?? '';
    $userName = $data['userName'] ?? '';

    if (!$adminEmail || !$userEmail || !$userName) {
        jsonResponse(['error' => 'Missing required fields'], 400);
    }

    $admin = loadAdmin($adminEmail);
    if (!$admin) {
        jsonResponse(['error' => 'Admin not found'], 404);
    }

    // Check if user already exists
    foreach ($admin['users'] as $user) {
        if ($user['email'] === $userEmail) {
            jsonResponse(['error' => 'User already exists'], 400);
        }
    }

    $admin['users'][] = [
        'email' => $userEmail,
        'name' => $userName
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
        // Admin view - return everything
        jsonResponse([
            'links' => $admin['links'],
            'users' => $admin['users'],
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

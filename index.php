<?php
// Redirect to actual file location
$path = $_SERVER['REQUEST_URI'];
$path = str_replace('/storage/', '/', $path);
$actualPath = '/home/eloraftp' . $path;

if (file_exists($actualPath)) {
    $mimeType = mime_content_type($actualPath);
    header('Content-Type: ' . $mimeType);
    header('Cache-Control: public, max-age=31536000'); // 1 year cache
    readfile($actualPath);
} else {
    http_response_code(404);
    echo 'File not found';
}
?>
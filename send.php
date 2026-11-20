<?php
/*
  Website form mailer
  ---------------------------------------------------------------
  Receives the contact form and emails it to the inbox below. It runs on
  any cPanel hosting with PHP; there is nothing to install.

  The settings between the @config markers are written by kit.js from
  site.json (form.to, form.from, name). Change them there and run
  "node tools/kit.js sync", or edit them here for a one-off fix.

  $to    The inbox that receives every message.
  $from  The sender address. Keep it on the website's own domain so the
         emails aren't marked as spam. If the host requires the sender
         to exist, create it in cPanel > Email Accounts.

  Replies go straight to the visitor: just press Reply in the inbox.
*/

// @config
$to   = 'contact@boutiquetours.wales';
$from = 'website@boutiquetours.wales';
$site = 'Boutique Tours of North Wales';
$brandBg = '#ffffff';
$brandInk = '#2b2b2d';
$brandAccent = '#7c6629';
// /@config

// ---------------------------------------------------------------------------

header('X-Content-Type-Options: nosniff');
header('Cache-Control: no-store');

$wantsJson = isset($_SERVER['HTTP_ACCEPT']) && strpos($_SERVER['HTTP_ACCEPT'], 'application/json') !== false;

// Sends the answer back: JSON for the website's own scripts, or a page for
// browsers without JavaScript (a thank-you page, or a short error page).
function finish($ok, $message, $wantsJson, $status)
{
    http_response_code($status);
    if ($wantsJson) {
        header('Content-Type: application/json; charset=utf-8');
        echo json_encode(array('ok' => $ok, 'message' => $message));
        exit;
    }
    if ($ok) {
        header('Location: thank-you.html', true, 303);
        exit;
    }
    header('Content-Type: text/html; charset=utf-8');
    $safe = htmlspecialchars($message, ENT_QUOTES, 'UTF-8');
    echo '<!doctype html><html lang="en-GB"><head><meta charset="utf-8">'
        . '<meta name="viewport" content="width=device-width, initial-scale=1">'
        . '<meta name="robots" content="noindex"><title>Message not sent</title>'
        . '<style>body{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px;'
        . 'background:' . $GLOBALS['brandBg'] . ';color:' . $GLOBALS['brandInk'] . ';font:17px/1.6 system-ui,sans-serif}main{max-width:520px}'
        . 'h1{font-size:1.6rem;line-height:1.2}a{color:' . $GLOBALS['brandAccent'] . '}</style></head><body><main>'
        . '<h1>Your message wasn&rsquo;t sent</h1><p>' . $safe . '</p>'
        . '<p><a href="contact.html">Back to the enquiry form</a>. Please try again in a few minutes.</p></main></body></html>';
    exit;
}

// Reads one posted value as plain text, trimmed to a maximum length.
function field($name, $max)
{
    if (!isset($_POST[$name])) {
        return '';
    }
    $value = $_POST[$name];
    if (is_array($value)) {
        $value = implode(', ', array_map('strval', $value));
    }
    $value = trim(str_replace("\0", '', (string) $value));
    if (function_exists('mb_substr')) {
        return mb_substr($value, 0, $max, 'UTF-8');
    }
    return substr($value, 0, $max);
}

// Collapses line breaks, so a value can never add lines to an email header.
function one_line($value)
{
    return trim(preg_replace('/[\r\n\t]+/', ' ', $value));
}

if (!isset($_SERVER['REQUEST_METHOD']) || $_SERVER['REQUEST_METHOD'] !== 'POST') {
    finish(false, 'This address only accepts messages sent from the forms on our website.', $wantsJson, 405);
}

// Spam traps. Bots fill the hidden field, or send the form a moment after
// it opens ("elapsed" is measured in the visitor's browser, in milliseconds).
// They get a normal "thank you" so they learn nothing.
if (field('company_website', 200) !== '') {
    finish(true, 'Thank you.', $wantsJson, 200);
}
$elapsed = field('elapsed', 12);
if ($elapsed !== '' && preg_match('/^\d+$/', $elapsed) && (int) $elapsed < 1500) {
    finish(true, 'Thank you.', $wantsJson, 200);
}

// A light limit on repeat sends from one connection: 6 every 10 minutes.
$ip = isset($_SERVER['REMOTE_ADDR']) ? $_SERVER['REMOTE_ADDR'] : 'unknown';
$limitFile = rtrim(sys_get_temp_dir(), '/\\') . DIRECTORY_SEPARATOR . 'site-form-' . sha1($ip . '|' . $to);
$now = time();
$recent = array();
if (is_readable($limitFile)) {
    $saved = json_decode((string) @file_get_contents($limitFile), true);
    if (is_array($saved)) {
        foreach ($saved as $stamp) {
            if (is_int($stamp) && $stamp > $now - 600) {
                $recent[] = $stamp;
            }
        }
    }
}
if (count($recent) >= 6) {
    finish(false, 'You have sent several messages in a short time. Please wait a few minutes and try again.', $wantsJson, 429);
}

// The fields every form shares.
$name     = one_line(field('name', 100));
$email    = one_line(field('email', 150));
$phone    = one_line(field('phone', 40));
if ($phone === '') {
    $phone = one_line(field('whatsapp', 40));
}
$business = one_line(field('business', 120));
$service  = one_line(field('service', 60));
if ($service === '') {
    $service = one_line(field('interest', 60));
}
$callTime = one_line(field('time', 40));
$message  = field('message', 5000);
$details  = field('details', 15000);
$formName = one_line(field('form', 40));
$page     = one_line(field('page', 200));
$cta      = one_line(field('cta', 80));
$timeZone = one_line(field('tz', 60));

if ($name === '') {
    finish(false, 'Please enter your name.', $wantsJson, 422);
}
if ($email === '' || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    finish(false, 'Please enter a valid email address, like name@business.com.', $wantsJson, 422);
}
if ($phone !== '' && !preg_match('/^[0-9+()\-.\s]{7,40}$/', $phone)) {
    finish(false, 'Please enter your phone number with the country code, using numbers only.', $wantsJson, 422);
}

// Any other answers (the brief form sends these when JavaScript is off).
$known = array('name', 'email', 'phone', 'whatsapp', 'business', 'service', 'interest', 'time', 'message',
    'details', 'form', 'page', 'cta', 'tz', 'elapsed', 'company_website');
$extras = array();
foreach ($_POST as $key => $unused) {
    if (in_array($key, $known, true) || count($extras) >= 60) {
        continue;
    }
    $label = ucfirst(str_replace(array('_', '-'), ' ', preg_replace('/[^A-Za-z0-9_\-]/', '', (string) $key)));
    $value = field($key, 2000);
    if ($label !== '' && $value !== '') {
        $extras[] = $label . ': ' . $value;
    }
}

// Build the email.
if ($formName === '') {
    $formName = 'Website inquiry';
}
$subject = $formName . ($service !== '' ? ' (' . $service . ')' : '') . ' from ' . $name;

$lines = array();
$lines[] = $formName . ' from the ' . $site . ' website';
$lines[] = str_repeat('-', 48);
$lines[] = 'Name: ' . $name;
$lines[] = 'Email: ' . $email;
$lines[] = 'Phone: ' . ($phone !== '' ? $phone : 'Not given');
if ($business !== '') {
    $lines[] = 'Business: ' . $business;
}
if ($service !== '') {
    $lines[] = 'Interested in: ' . $service;
}
if ($callTime !== '') {
    $lines[] = 'Best time for a call: ' . $callTime;
}
if ($timeZone !== '') {
    $lines[] = 'Their time zone: ' . $timeZone;
}
if ($message !== '') {
    $lines[] = '';
    $lines[] = 'Message:';
    $lines[] = $message;
}
if ($details !== '') {
    $lines[] = '';
    $lines[] = $details;
}
if ($extras) {
    $lines[] = '';
    $lines[] = 'Other answers:';
    foreach ($extras as $extra) {
        $lines[] = $extra;
    }
}
$lines[] = '';
$lines[] = str_repeat('-', 48);
if ($cta !== '') {
    $lines[] = 'Button pressed: ' . $cta;
}
if ($page !== '') {
    $lines[] = 'Sent from: ' . $page;
}
$lines[] = 'Received: ' . gmdate('D, j M Y, H:i') . ' UTC';
$lines[] = 'Reply to this email to answer ' . $name . ' directly.';

$body = str_replace(array("\r\n", "\r"), "\n", implode("\n", $lines));
$body = wordwrap($body, 990, "\n", true);

$encodedSubject = '=?UTF-8?B?' . base64_encode($subject) . '?=';
$encodedSite = '=?UTF-8?B?' . base64_encode($site) . '?=';
$encodedName = '=?UTF-8?B?' . base64_encode($name) . '?=';
$headers = implode("\r\n", array(
    'From: ' . $encodedSite . ' <' . $from . '>',
    'Reply-To: ' . $encodedName . ' <' . $email . '>',
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
));

$sent = @mail($to, $encodedSubject, $body, $headers, '-f' . $from);
if (!$sent) {
    // Some hosts don't allow setting the envelope sender; try without it.
    $sent = @mail($to, $encodedSubject, $body, $headers);
}

if (!$sent) {
    finish(false, 'We couldn\'t send your message just now.', $wantsJson, 500);
}

$recent[] = $now;
@file_put_contents($limitFile, json_encode($recent), LOCK_EX);

finish(true, 'Thank you. Your message is on its way, and we will reply soon.', $wantsJson, 200);

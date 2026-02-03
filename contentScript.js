// contentScript.js
// Example usage: inject a keyboard shortcut (Ctrl+Shift+Y) to call the PHP endpoint
// from any page. You can remove this file if you only use the popup.

function callPhpFromContentScript() {
  const payload = {
    from: 'content-script',
    url: window.location.href,
    timestamp: Date.now()
  };

  chrome.runtime.sendMessage(
    {
      type: 'PHP_REQUEST',
      payload
    },
    (response) => {
      if (chrome.runtime.lastError) {
        console.error('Message error:', chrome.runtime.lastError.message);
        return;
      }

      if (!response) {
        console.error('No response from background');
        return;
      }

      if (!response.ok) {
        console.error('PHP error:', response);
        return;
      }

      console.log('Response from PHP (content script):', response.body);
    }
  );
}

document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'y') {
    callPhpFromContentScript();
  }
});

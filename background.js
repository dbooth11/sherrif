// background.js
// Handles all network requests to the PHP backend to avoid CORS issues.
// Make sure the domain of your PHP server is listed in `permissions` in manifest.json.

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'PHP_REQUEST') {
    const { endpoint, payload, method } = message;

    const url = endpoint || 'http://www.dbooth.net/api';
    const httpMethod = (method || 'POST').toUpperCase();

    const fetchOptions = {
      method: httpMethod,
      headers: {}
    };

    if (httpMethod !== 'GET' && payload !== undefined) {
      fetchOptions.headers['Content-Type'] = 'application/json';
      fetchOptions.body = JSON.stringify(payload);
    }

    fetch(url, fetchOptions)
      .then(async (res) => {
        const contentType = res.headers.get('content-type') || '';
        let body;

        try {
          if (contentType.includes('application/json')) {
            body = await res.json();
          } else {
            body = await res.text();
          }
        } catch (e) {
          body = null;
        }

        sendResponse({
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          body
        });
      })
      .catch((err) => {
        console.error('Background fetch error:', err);
        sendResponse({
          ok: false,
          error: true,
          message: err && err.message ? err.message : 'Unknown error'
        });
      });

    // indicate we will respond asynchronously
    return true;
  }

  // For other messages, do nothing special
  return false;
});

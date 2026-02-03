// popup.js
// Sends a message to the background script which performs the PHP request.

const endpointInput = document.getElementById('endpoint');
const payloadInput = document.getElementById('payload');
const sendButton = document.getElementById('send');
const statusDiv = document.getElementById('status');
const resultDiv = document.getElementById('result');

// Optional: prefill the endpoint with the default from manifest/your server
endpointInput.value = 'http://www.dbooth.net/api';

sendButton.addEventListener('click', () => {
  statusDiv.textContent = 'Sending request...';
  resultDiv.textContent = '';

  let payload;
  const payloadText = payloadInput.value.trim();
  if (payloadText) {
    try {
      payload = JSON.parse(payloadText);
    } catch (e) {
      statusDiv.textContent = 'Invalid JSON in payload.';
      return;
    }
  }

  chrome.runtime.sendMessage(
    {
      type: 'PHP_REQUEST',
      endpoint: endpointInput.value.trim() || undefined,
      payload,
      method: 'POST'
    },
    (response) => {
      if (chrome.runtime.lastError) {
        statusDiv.textContent = 'Message error: ' + chrome.runtime.lastError.message;
        return;
      }

      if (!response) {
        statusDiv.textContent = 'No response from background.';
        return;
      }

      if (!response.ok) {
        statusDiv.textContent = 'Request failed: ' + (response.statusText || response.status);
      } else {
        statusDiv.textContent = 'Request succeeded (' + response.status + ').';
      }

      try {
        resultDiv.textContent = typeof response.body === 'string'
          ? response.body
          : JSON.stringify(response.body, null, 2);
      } catch (e) {
        resultDiv.textContent = String(response.body);
      }
    }
  );
});

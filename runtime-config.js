/* Shared by the bundled app and the unbundled admin page. No credentials belong here. */
(function (root) {
  const endpoints = {
    'board.seibtribe.us': 'https://hvr92xfbo6.execute-api.us-east-1.amazonaws.com/production',
    'board.dev.seibtribe.us': 'https://rxbslpk6u9.execute-api.us-east-1.amazonaws.com/dev',
    'pbod.seibtribe.us': 'https://3unsrrsapf.execute-api.us-east-1.amazonaws.com/pbod'
  };
  function validateApiBaseUrl(value) {
    const url = new URL(value);
    const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
      throw new Error('API URL must use HTTPS (or HTTP on localhost), without credentials, query parameters or fragments.');
    }
    return url.href.replace(/\/+$/, '');
  }
  function resolveApiBaseUrl(hostname, explicitUrl) {
    return explicitUrl ? validateApiBaseUrl(explicitUrl) : endpoints[hostname] || '';
  }
  function getApiBaseUrl() {
    return resolveApiBaseUrl(root.location?.hostname || root.window?.location?.hostname, root.PERSONAL_BOARD_CONFIG?.apiBaseUrl);
  }
  root.PersonalBoardConfig = Object.freeze({ getApiBaseUrl, resolveApiBaseUrl, validateApiBaseUrl });
})(globalThis);

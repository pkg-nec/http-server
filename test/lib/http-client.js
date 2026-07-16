const { request: undiciRequest, Agent} = require('undici');

/**
 * Fetch-based HTTP client utility
 * Provides Promise-based async/await API similar to the `request` library
 * but using Node.js's built-in undici (the engine behind global.fetch).
 *
 * Uses decompress:false so raw wire bytes are returned, matching `request`
 * library behavior and preserving gzip-body test fixtures.
 */

/**
 * Builds an HTTP/HTTPS request with options
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @param {string} options.method - HTTP method (default: GET)
 * @param {string|Buffer} options.body - Request body
 * @param {object} options.headers - Custom headers
 * @param {object} options.auth - Basic auth: { username, password }
 * @param {boolean} options.rejectUnauthorized - HTTPS cert validation (default: true)
 * @param {number} options.timeout - Request timeout in ms
 * @param {string} options.redirect - Redirect handling: 'follow', 'manual', 'error' (default: 'follow')
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
async function makeRequest(url, options = {}) {
  const {
    method = 'GET',
    body = undefined,
    headers = {},
    auth = undefined,
    rejectUnauthorized = true,
    timeout = undefined,
    redirect = 'follow',
  } = options;

  const requestHeaders = { ...headers };

  // Add Basic auth header if provided
  if (auth && auth.username !== undefined && auth.password !== undefined) {
    const credentials = Buffer.from(
      `${auth.username}:${auth.password}`
    ).toString('base64');
    requestHeaders['Authorization'] = `Basic ${credentials}`;
  }

  // Map fetch-style redirect to undici maxRedirections
  // 'manual' → 0 redirects (return 3xx as-is), 'follow' → follow up to 10
  const maxRedirections = redirect === 'manual' ? 0 : 10;

  // Build undici dispatcher with TLS and optional timeout settings
  const connectOpts = { rejectUnauthorized };
  const agentOpts = { connect: connectOpts };
  if (timeout !== undefined) {
    agentOpts.headersTimeout = timeout;
    agentOpts.bodyTimeout = timeout;
  }
  const dispatcher = new Agent(agentOpts);

  const undiciOpts = {
    method,
    headers: requestHeaders,
    body: body !== undefined ? body : null,
    // decompress:false preserves raw wire bytes, matching the `request`
    // library's behavior (it did NOT auto-decompress Content-Encoding: gzip)
    decompress: false,
    maxRedirections,
    dispatcher,
  };

  const response = await undiciRequest(url, undiciOpts);

  // Collect response body as Buffer then decode as utf8 string
  const chunks = [];
  for await (const chunk of response.body) {
    chunks.push(chunk);
  }
  const responseBody = Buffer.concat(chunks).toString('utf8');

  return {
    statusCode: response.statusCode,
    body: responseBody,
    headers: response.headers,
  };
}

/**
 * Send a GET request
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
async function get(url, options = {}) {
  return makeRequest(url, { ...options, method: 'GET' });
}

/**
 * Send a POST request
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
async function post(url, options = {}) {
  return makeRequest(url, { ...options, method: 'POST' });
}

/**
 * Send an HTTP request with specified method
 * @param {string} url - Request URL
 * @param {object} options - Request options
 * @returns {Promise<{statusCode: number, body: string, headers: object}>}
 */
async function request(url, options = {}) {
  return makeRequest(url, options);
}

module.exports = {
  get,
  post,
  request,
};

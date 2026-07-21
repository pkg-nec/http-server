# http-server-e2e

An independent, rigorous E2E test suite for `@pkg-nec/http-server`.

**Purpose:** To verify that new upstream versions work flawlessly, prevent regressions, and transparently track known behavior changes over time.

## Version Verification Log

### v14.3.2, v14.3.1 & v14.3.0
* **Status:** Verified Stable.
* **Details:** All core E2E tests pass flawlessly with no regressions detected.

### v14.2.0
* **Status:** Verified Stable (with known behavior change).
* **Details:** Documented a change in the `html-encoding-sniffer` package. It was upgraded to conform to the WHATWG Encoding Standard, resulting in `iso-8859-1` being correctly aliased to `windows-1252`. Our test suite was updated to strictly verify this compliance across legacy and modern versions.

### v14.1.4 & v14.1.2
* **Status:** Verified Baseline Stability.
* **Details:** Established robust testing for core features:
  * **minimist:** CLI flag parsing, CORS, caching, `--no-dotfiles`, and `--tls` alias.
  * **portfinder:** Fallback port allocation when default ports are blocked.
  * **Architecture:** Built with strict process isolation and dynamic OS-level port allocation to prevent `EADDRINUSE` race conditions during parallel test execution.

## Running the Suite

To run the test suite locally against a specific upstream version:

```bash
# 1. Clone the repository
git clone https://github.com/pkg-nec/http-server.git
cd http-server/e2e

# 2. Install a target version of the server
npm install @pkg-nec/http-server@14.3.1

# 3. Execute the Tap-based parallel test suite
npm test
```

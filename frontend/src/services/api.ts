// v3: Stratavore HTTP API client (fetch-based, no axios)
// Base URL is /api/v1 — nginx proxies this to the Stratavore daemon

const baseURL = (import.meta as any).env?.VITE_STRATAVORE_API_URL ?? '/api/v1';
const timeout = 10000;

interface AxiosLikeResponse<T = any> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config?: any;
}

interface AxiosLikeError extends Error {
  response?: AxiosLikeResponse;
  config?: any;
}

/**
 * Simple fetch wrapper that mimics axios interface for GET/POST requests
 * Maintains compatibility with existing service code
 */
class FetchClient {
  constructor(
    private baseURL: string,
    private defaultHeaders: Record<string, string> = {}
  ) {}

  async get<T = any>(url: string, config?: { params?: Record<string, string> }): Promise<AxiosLikeResponse<T>> {
    const fullUrl = this.buildUrl(url, config?.params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(fullUrl, {
        method: 'GET',
        headers: this.defaultHeaders,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const data = await response.json();

      if (!response.ok) {
        const error: AxiosLikeError = new Error(response.statusText);
        error.response = {
          data,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          config: { url: fullUrl, method: 'GET' },
        };
        error.config = { url: fullUrl, method: 'GET' };
        console.error('[stratavore]', fullUrl, error.message);
        throw error;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutError: AxiosLikeError = new Error('timeout of ' + timeout + 'ms exceeded');
        timeoutError.config = { url: fullUrl, method: 'GET' };
        console.error('[stratavore]', fullUrl, timeoutError.message);
        throw timeoutError;
      }
      if (err instanceof Error) {
        console.error('[stratavore]', fullUrl, err.message);
      }
      throw err;
    }
  }

  async post<T = any>(url: string, data?: any, config?: any): Promise<AxiosLikeResponse<T>> {
    const fullUrl = this.buildUrl(url, config?.params);
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(fullUrl, {
        method: 'POST',
        headers: this.defaultHeaders,
        body: JSON.stringify(data || {}),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const responseData = await response.json();

      if (!response.ok) {
        const error: AxiosLikeError = new Error(response.statusText);
        error.response = {
          data: responseData,
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          config: { url: fullUrl, method: 'POST', data },
        };
        error.config = { url: fullUrl, method: 'POST', data };
        console.error('[stratavore]', fullUrl, error.message);
        throw error;
      }

      return {
        data: responseData,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (err) {
      clearTimeout(timeoutId);
      if (err instanceof Error && err.name === 'AbortError') {
        const timeoutError: AxiosLikeError = new Error('timeout of ' + timeout + 'ms exceeded');
        timeoutError.config = { url: fullUrl, method: 'POST', data };
        console.error('[stratavore]', fullUrl, timeoutError.message);
        throw timeoutError;
      }
      if (err instanceof Error) {
        console.error('[stratavore]', fullUrl, err.message);
      }
      throw err;
    }
  }

  private buildUrl(path: string, params?: Record<string, string>): string {
    let url = this.baseURL + path;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(params).toString();
      url += '?' + queryString;
    }
    return url;
  }
}

export const stratavoreApi = new FetchClient(baseURL, {
  'Content-Type': 'application/json',
});

// Legacy api instance — kept temporarily while old pages are removed
const api = new FetchClient('/api', {
  'Content-Type': 'application/json',
});

export default api;

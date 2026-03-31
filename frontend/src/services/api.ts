// v3: Stratavore HTTP API client
// Base URL is /api/v1 — nginx proxies this to the Stratavore daemon
// Replaced axios with native fetch for security (CVE in axios 1.14.1 and 0.30.4)

const baseURL = (import.meta as any).env?.VITE_STRATAVORE_API_URL ?? '/api/v1';

interface FetchClientOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

interface FetchResponse<T> {
  data: T;
  status: number;
  statusText: string;
  headers: Record<string, string>;
  config?: any;
}

class FetchClient {
  private baseURL: string;
  private defaultHeaders: Record<string, string>;
  private timeout: number;

  constructor(baseURL: string, options?: { headers?: Record<string, string>; timeout?: number }) {
    this.baseURL = baseURL;
    this.defaultHeaders = options?.headers ?? {};
    this.timeout = options?.timeout ?? 10000;
  }

  private async request<T>(
    endpoint: string,
    options: FetchClientOptions = {}
  ): Promise<FetchResponse<T>> {
    const url = new URL(endpoint.startsWith('/') ? endpoint : `/${endpoint}`, this.baseURL).toString();
    const headers = { ...this.defaultHeaders, ...options.headers };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), options.timeout ?? this.timeout);

    try {
      const response = await fetch(url, {
        method: options.method ?? 'GET',
        headers,
        body: options.body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const contentType = response.headers.get('content-type');
      let data: T;

      if (contentType?.includes('application/json')) {
        data = await response.json();
      } else {
        data = await response.text() as any;
      }

      if (!response.ok) {
        const error = new Error(`HTTP ${response.status}: ${response.statusText}`) as any;
        error.response = { data, status: response.status, statusText: response.statusText };
        error.config = { url, method: options.method, headers };
        console.error(`[stratavore] ${url} ${response.status}`, error.message);
        throw error;
      }

      return {
        data,
        status: response.status,
        statusText: response.statusText,
        headers: Object.fromEntries(response.headers.entries()),
      };
    } catch (error: any) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        const timeoutError = new Error(`Request timeout after ${options.timeout ?? this.timeout}ms`) as any;
        timeoutError.code = 'ECONNABORTED';
        console.error(`[stratavore] ${url} timeout`);
        throw timeoutError;
      }
      console.error(`[stratavore] ${url}`, error.message);
      throw error;
    }
  }

  async get<T>(endpoint: string, options?: { params?: Record<string, any> }): Promise<FetchResponse<T>> {
    let url = endpoint;
    if (options?.params) {
      const query = new URLSearchParams();
      Object.entries(options.params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          query.append(key, String(value));
        }
      });
      const queryString = query.toString();
      url = queryString ? `${endpoint}?${queryString}` : endpoint;
    }
    return this.request<T>(url, { method: 'GET' });
  }

  async post<T>(endpoint: string, data?: any): Promise<FetchResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<FetchResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async patch<T>(endpoint: string, data?: any): Promise<FetchResponse<T>> {
    return this.request<T>(endpoint, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<FetchResponse<T>> {
    return this.request<T>(endpoint, { method: 'DELETE' });
  }
}

// Create the stratavoreApi instance with the same interface as before
export const stratavoreApi = new FetchClient(baseURL, {
  headers: { 'Content-Type': 'application/json' },
  timeout: 10000,
});

// Legacy api instance — kept temporarily while old pages are removed
const api = new FetchClient('/api', {
  headers: { 'Content-Type': 'application/json' },
});

export default api;

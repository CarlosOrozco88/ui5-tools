import fetch, { RequestInit } from 'node-fetch';

const Fetch = {
  async fetch(url: string, options: RequestInit = {}) {
    const mergedOptions = {
      ...options,
    };

    const response = await fetch(url, mergedOptions);

    if (response.ok) {
      return response;
    }
    throw new Error(`${response.status}`);
  },

  async buffer(url: string, options: RequestInit = {}) {
    const response = await Fetch.fetch(url, options);
    return response.buffer();
  },

  async file(url: string, options: RequestInit = {}) {
    const response = await Fetch.fetch(url, {
      timeout: 5000,
      ...options,
    });
    return response.text();
  },

  setUnautorized(useStrictSSL?: boolean, rejectUnauthorized?: boolean) {
    const originalReject = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    if (useStrictSSL === false && !rejectUnauthorized) {
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
    }
    return {
      restore: () => {
        process.env.NODE_TLS_REJECT_UNAUTHORIZED = originalReject;
      },
    };
  },
};
export default Fetch;

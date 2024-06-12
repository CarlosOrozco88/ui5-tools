import fetch, { RequestInit } from 'node-fetch';
import https from 'https';
import { XMLParser } from 'fast-xml-parser';
import { Headers } from 'node-fetch';
const originalReject = https.globalAgent.options.rejectUnauthorized;

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
    let response;
    try {
      response = await Fetch.fetch(url, {
        timeout: 5000,
        ...options,
      });
    } catch (error) {
      console.log(error);
      throw error;
    }
    return response.text();
  },

  setUnautorized(useStrictSSL?: boolean, rejectUnauthorized?: boolean) {
    if (useStrictSSL === false && !rejectUnauthorized) {
      https.globalAgent.options.rejectUnauthorized = false;
    }
    return {
      restore: () => {
        if (originalReject !== undefined) {
          https.globalAgent.options.rejectUnauthorized = originalReject;
        } else {
          delete https.globalAgent.options.rejectUnauthorized;
        }
      },
    };
  },

  async getXMLFile(url: string, oImportOptions: { user?: string; pwd?: string }) {
    const data = await this.getFile(url, oImportOptions);
    const res = Fetch.parseXML(data);
    return res;
  },

  async getFile(url: string, oImportOptions: { user?: string; pwd?: string }) {
    const headers = new Headers();
    headers.set(
      'Authorization',
      'Basic ' + Buffer.from((oImportOptions.user ?? '') + ':' + (oImportOptions.pwd ?? '')).toString('base64')
    );

    const httpsAgent = new https.Agent({
      rejectUnauthorized: false,
    });

    const { default: Config } = await import('../Utils/ConfigVscode');
    const unaut = Fetch.setUnautorized(false, !!Config.deployer('rejectUnauthorized'));
    const data = await Fetch.file(url, {
      timeout: 0,
      headers: headers,
      agent: httpsAgent,
    });
    unaut.restore();
    return data;
  },

  parseXML(XMLdata: string) {
    const parser = new XMLParser({ ignoreAttributes: false });
    const jsonData = parser.parse(XMLdata);
    return jsonData;
  },
};
export default Fetch;

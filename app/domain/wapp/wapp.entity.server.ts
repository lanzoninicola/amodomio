import { ok, serverError } from "~/utils/http-response.server";
import tryit from "~/utils/try-it";

interface WappEntityEntityProps {
  url: string | undefined;
  sessionName: string | undefined;
  secretKey: string | undefined;
}

interface GenerateTokenResponseOkPayload {
  status: string;
  session: string;
  token: string;
  full: string;
}

interface GenerateTokenResponseErrorPayload {
  message: string;
}

class WappEntityEntity {
  private _url: string | undefined;
  private _sessionName: string | undefined;
  private _secretKey: string | undefined;

  private _token: string | null | undefined = null;

  constructor({ url, sessionName, secretKey }: WappEntityEntityProps) {
    this.setUrl(url);
    this.setSessionName(sessionName);
    this.setSecretKey(secretKey);
  }

  setUrl(url: string | undefined) {
    this._url = url;
  }

  setSessionName(sessionName: string | undefined) {
    this._sessionName = sessionName;
  }

  setSecretKey(secretKey: string | undefined) {
    this._secretKey = secretKey;
  }

  async heartbeat() {
    const endpointUrl = `${this._url}/api/${this._sessionName}/${this._secretKey}/generate-token1`;

    return fetch(endpointUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Ok: data returned: { status: 201, payload: { status: 'ok', session: '1', token: '1', full: '1' }
   * Service not available: throw new Error(<message>);
   * Token misspelled: throw new Error(<message>);
   */
  async generateToken() {
    if (this._token) {
      return {
        status: 201,
        payload: {
          status: "success",
          session: this._sessionName,
          token: this._token,
          full: `${this._sessionName}:${this._token}`,
        },
      };
    }

    const endpointUrl = `${this._url}/api/${this._sessionName}/${this._secretKey}/generate-token`;

    const [err, res] = await tryit(
      fetch(endpointUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      })
    );

    if (err) {
      throw new Error(err.message);
    }

    const resData = await res?.json();

    if (res?.status !== 201) {
      throw new Error(resData?.message);
    }

    this._token = resData?.token;

    return {
      status: res?.status,
      payload: resData,
    };
  }

  async startSession() {
    const endpointUrl = `${this._url}/api/${this._sessionName}/start-session`;

    const [errToken, resToken] = await tryit(this.generateToken());

    if (errToken) {
      throw new Error(errToken.message);
    }

    const payload = JSON.stringify({
      webhook: "",
      waitQrCode: true,
    });

    const [err, res] = await tryit(
      fetch(endpointUrl, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resToken?.payload?.token}`,
          "Content-Type": "application/json",
        },
        body: payload,
      })
    );

    if (err) {
      throw new Error(err.message);
    }

    const resData = await res?.json();

    return {
      status: 200,
      payload: resData,
    };
  }

  async createQRCode(): Promise<{
    status: number;
    payload: {
      status: "INITIALIZING" | "CLOSED" | "QRCODE";
      qrCode: string;
      urlcode: string;
      version: string;
      session: string;
    };
  }> {
    return await this.startSession();
  }

  async statusSession() {
    const endpointUrl = `${this._url}/api/${this._sessionName}/status-session`;

    const [errToken, resToken] = await tryit(this.generateToken());

    if (errToken) {
      throw new Error(errToken.message);
    }

    const [err, res] = await tryit(
      fetch(endpointUrl, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${resToken?.payload?.token}`,
          "Content-Type": "application/json",
        },
      })
    );

    if (err) {
      throw new Error(err.message);
    }

    const resData = await res?.json();

    if (resData?.status === "CLOSED") {
      throw new Error("No sessions available");
    }

    return {
      status: res?.status,
      payload: resData,
    };
  }
}

const wappUrl = process.env.WAPP_URL;
const wappSecretKey = process.env.WAPP_SECRET_KEY;
const wappSessionName = process.env.WAPP_SESSION_NAME;

export const wappEntity = new WappEntityEntity({
  url: wappUrl,
  sessionName: wappSessionName,
  secretKey: wappSecretKey,
});

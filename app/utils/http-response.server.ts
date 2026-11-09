import { json } from "@remix-run/node";

type LoaderOrActionReturnData = Record<string, any> | string | undefined;

interface HttpResponseOptions {
  throwIt?: boolean;
  cors?: boolean;
  corsOrigin?: string;
  corsAllowHeaders?: string[];
  corsAllowMethods?: string[];
  headers?: HeadersInit;
}

export interface HttpResponse {
  status: number;
  message?: string;
  action?: string;
  payload?: any;
}

export function notFound(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 404, fallbackMessage: "Não encontrado" },
    data
  );
  return doResponse(response, options);
}

export function badRequest(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 400, fallbackMessage: "Requisição inválida" },
    data
  );
  return doResponse(response, options);
}

export function unauthorized(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 401, fallbackMessage: "Não autorizado" },
    data
  );
  return doResponse(response, options);
}

export function forbidden(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 403, fallbackMessage: "Proibido" },
    data
  );
  return doResponse(response, options);
}

export function serverError(error: Error | any, options?: HttpResponseOptions) {
  const response = formatResponse(
    { status: 500, fallbackMessage: "Erro interno do servidor" },
    error instanceof Error
      ? { message: error.message, payload: error.stack }
      : { message: error }
  );

  return doResponse(response, options);
}

/**
 *
 * @param data
 * @param options
 * @returns
 *
 * return ok({ message: "Dados públicos" }, {
  cors: true,
  corsOrigin: "chrome-extension://iijdfmmdkbindnkfhankpnjhjnppkmad",
  corsAllowHeaders: ["Content-Type", "x-api-key", "Authorization"],
  corsAllowMethods: ["GET", "OPTIONS"]
});
 */
export function ok(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse({ status: 200, fallbackMessage: "Ok" }, data);
  return doResponse(response, options);
}

export function created(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 201, fallbackMessage: "Recurso criado" },
    data
  );
  return doResponse(response, options);
}

export function noContent(
  data?: LoaderOrActionReturnData,
  options?: HttpResponseOptions
) {
  const response = formatResponse(
    { status: 204, fallbackMessage: "Nenhum conteúdo" },
    data
  );
  return doResponse(response, options);
}

function doResponse(response: HttpResponse, options: HttpResponseOptions = {}) {
  if (options.throwIt) {
    throw new Error(response.message);
  }

  const headers = new Headers(options.headers);

  if (options.cors) {
    headers.set("Access-Control-Allow-Origin", options.corsOrigin ?? "*");
    headers.set(
      "Access-Control-Allow-Headers",
      (options.corsAllowHeaders ?? ["Content-Type", "x-api-key"]).join(",")
    );
    headers.set(
      "Access-Control-Allow-Methods",
      (options.corsAllowMethods ?? ["GET", "POST", "OPTIONS"]).join(",")
    );
  }

  return json(response, {
    status: response.status,
    headers,
  });
}

function formatResponse(
  defaultResponse: { status: number; fallbackMessage: string },
  data: LoaderOrActionReturnData
): HttpResponse {
  if (typeof data === "string") {
    return {
      status: defaultResponse.status,
      message: data,
    };
  }

  const response: HttpResponse = {
    status: defaultResponse.status,
    message: defaultResponse.fallbackMessage,
  };

  if (data?.message) {
    response.message = data.message;
  }

  if (data?.payload !== undefined) {
    response.payload = data.payload;
  } else if (typeof data === "object") {
    response.payload = { ...data };
    if (data?.message) delete response.payload.message;
  }

  return response;
}

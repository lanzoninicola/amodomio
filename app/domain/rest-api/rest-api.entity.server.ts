import { EnvironmentVariables } from "~/root";
import { badRequest, HttpResponse, ok } from "~/utils/http-response.server";

const memoryStore = new Map<string, { count: number; expires: number }>();

class RestApiEntity {
  authorize(apiKey: string | null | undefined): HttpResponse {
    if (!apiKey) {
      return badRequest("API key is required") as HttpResponse;
    }

    const env = import.meta.env;

    const ENV: EnvironmentVariables = {
      REST_API_SECRET_KEY: env.VITE_REST_API_SECRET_KEY,
    };

    if (!ENV.REST_API_SECRET_KEY || ENV.REST_API_SECRET_KEY === "") {
      return badRequest(
        "Environment variable VITE_REST_API_SECRET_KEY is not set"
      ) as HttpResponse;
    }

    if (apiKey !== ENV.REST_API_SECRET_KEY) {
      return badRequest("Unauthorized") as HttpResponse;
    }

    // If the API key is valid, return nothing (void)
    return ok("API key is valid") as unknown as HttpResponse;
  }

  /**
   * Aplica um controle simples de rate limit baseado em memória local.
   * Limita o número de requisições por chave (IP ou x-api-key) dentro de uma janela de tempo.
   *
   * @param request - Objeto da requisição HTTP (Remix Request)
   * @param limit - Número máximo de requisições permitidas na janela (padrão: 100)
   * @param windowMs - Duração da janela em milissegundos (padrão: 10 minutos)
   * @returns Um objeto indicando se a requisição é permitida ou bloqueada, com tempo restante em caso de bloqueio
   */

  async rateLimitCheck(request: Request, limit = 100, windowMs = 600_000) {
    const key =
      request.headers.get("x-api-key") ||
      request.headers.get("x-forwarded-for") ||
      request.headers.get("cf-connecting-ip") ||
      "anonymous";

    const now = Date.now();
    const entry = memoryStore.get(key);

    if (!entry || entry.expires < now) {
      memoryStore.set(key, {
        count: 1,
        expires: now + windowMs,
      });
      return { success: true };
    }

    if (entry.count < limit) {
      entry.count++;
      return { success: true };
    }

    return {
      success: false,
      retryIn: entry.expires - now,
    };
  }
}

export const restApi = new RestApiEntity();

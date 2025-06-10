import { EnvironmentVariables } from "~/root";
import { badRequest, HttpResponse, ok } from "~/utils/http-response.server";

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
}

export const restApi = new RestApiEntity();

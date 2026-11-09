import { spawn } from "child_process";
import type { ActionFunctionArgs, LoaderFunctionArgs, MetaFunction } from "@remix-run/node";
import { redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import Container from "~/components/layout/container/container";
import SubmitButton from "~/components/primitives/submit-button/submit-button";
import { Badge } from "~/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "~/components/ui/card";
import { authenticator } from "~/domain/auth/google.server";
import prismaClient from "~/lib/prisma/client.server";
import { badRequest, ok, serverError } from "~/utils/http-response.server";

export const meta: MetaFunction = () => {
  return [
    { name: "robots", content: "noindex" },
    { title: "Backup do banco" },
  ];
};

export async function loader({ request }: LoaderFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return redirect("/login");
  }

  const connectionString = resolveDatabaseUrl();
  const databaseDetails = parseConnectionString(connectionString);

  return ok({
    database: {
      name: prismaClient.dbName || databaseDetails?.database || "N/D",
      host: databaseDetails?.host || "N/D",
      port: databaseDetails?.port || "N/D",
      user: databaseDetails?.user || "N/D",
    },
    hasConnectionString: Boolean(connectionString),
  });
}

export async function action({ request }: ActionFunctionArgs) {
  const user = await authenticator.isAuthenticated(request);

  if (!user) {
    return redirect("/login");
  }

  const formData = await request.formData();
  const actionName = formData.get("_action");

  if (actionName !== "download-backup") {
    return badRequest("Ação inválida");
  }

  const connectionString = resolveDatabaseUrl();

  if (!connectionString) {
    return serverError(
      "URL do banco não configurada (PRISMA_DB_URL ou PRISMA_DB_DEV_URL)."
    );
  }

  const databaseName =
    parseConnectionString(connectionString)?.database || "database";
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `${databaseName}-backup-${timestamp}.sql`;

  try {
    const sanitizedUrl = sanitizeConnectionStringForPgDump(connectionString);
    const stream = createPgDumpStream(sanitizedUrl);

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/sql; charset=utf-8",
        "Content-Disposition": `attachment; filename="${fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("Erro ao iniciar pg_dump", error);
    return serverError(
      "Não foi possível iniciar o backup. Verifique se o pg_dump está instalado no servidor."
    );
  }
}

export default function DatabaseBackupPage() {
  const loaderData = useLoaderData<typeof loader>();
  const database = loaderData?.payload?.database;
  const hasConnectionString = loaderData?.payload?.hasConnectionString;

  return (
    <Container className="p-4 space-y-6">
      <div className="bg-muted p-4 rounded-lg border flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">Administração</Badge>
          <Badge variant="outline">PostgreSQL</Badge>
        </div>
        <div>
          <h1 className="text-xl font-semibold">Backup do banco de dados</h1>
          <p className="text-sm text-muted-foreground">
            Gere um dump do banco PostgreSQL atual e baixe o arquivo .sql para
            salvar localmente.
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Base em uso</CardTitle>
          <CardDescription>
            Os dados abaixo são derivados da connection string utilizada pelo
            Prisma. O backup utiliza o utilitário pg_dump instalado no servidor.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <DatabaseField label="Banco" value={database?.name} />
          <DatabaseField label="Host" value={database?.host} />
          <DatabaseField label="Porta" value={database?.port} />
          <DatabaseField label="Usuário" value={database?.user} />
        </CardContent>
        <CardFooter className="flex flex-col items-start gap-3">
          <Form method="post" reloadDocument>
            <SubmitButton
              actionName="download-backup"
              idleText="Baixar backup .sql"
              loadingText="Gerando backup..."
              className="w-full md:w-auto"
              disabled={!hasConnectionString}
            />
          </Form>
          {!hasConnectionString && (
            <p className="text-sm text-destructive">
              Configure PRISMA_DB_URL ou PRISMA_DB_DEV_URL para habilitar o
              backup.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            A ação dispara um POST tradicional (reloadDocument) para que o
            navegador baixe o arquivo diretamente no seu computador.
          </p>
        </CardFooter>
      </Card>
    </Container>
  );
}

function resolveDatabaseUrl() {
  const env = process.env.NODE_ENV || "production";
  if (env === "development" && process.env.PRISMA_DB_DEV_URL) {
    return process.env.PRISMA_DB_DEV_URL;
  }

  return process.env.PRISMA_DB_URL || process.env.PRISMA_DB_DEV_URL;
}

function parseConnectionString(connectionString?: string) {
  if (!connectionString) return null;

  try {
    const url = new URL(connectionString);
    return {
      database: url.pathname.replace("/", ""),
      host: url.hostname,
      port: url.port || "5432",
      user: decodeURIComponent(url.username),
    };
  } catch (error) {
    console.error("Erro ao ler connection string do banco", error);
    return null;
  }
}

function createPgDumpStream(connectionString: string) {
  const args = [
    "--no-owner",
    "--no-privileges",
    `--dbname=${connectionString}`,
  ];

  const dumpProcess = spawn("pg_dump", args);
  let stderr = "";

  dumpProcess.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  return new ReadableStream<Uint8Array>({
    start(controller) {
      dumpProcess.stdout.on("data", (chunk: Buffer) => {
        controller.enqueue(new Uint8Array(chunk));
      });

      dumpProcess.on("error", (error) => controller.error(error));

      dumpProcess.on("close", (code) => {
        if (code === 0) {
          controller.close();
        } else {
          controller.error(
            new Error(stderr || `pg_dump finalizou com código ${code}`)
          );
        }
      });
    },
    cancel() {
      dumpProcess.kill("SIGTERM");
    },
  });
}

function sanitizeConnectionStringForPgDump(connectionString: string) {
  const allowedQueryParams = new Set([
    "sslmode",
    "ssl",
    "connect_timeout",
    "application_name",
    "fallback_application_name",
    "options",
    "target_session_attrs",
  ]);

  try {
    const url = new URL(connectionString);

    for (const key of Array.from(url.searchParams.keys())) {
      if (!allowedQueryParams.has(key)) {
        url.searchParams.delete(key);
      }
    }

    return url.toString();
  } catch (error) {
    console.error("Erro ao sanitizar connection string", error);
    return connectionString;
  }
}

interface DatabaseFieldProps {
  label: string;
  value?: string;
}

function DatabaseField({ label, value }: DatabaseFieldProps) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-right break-all">
        {value || "N/D"}
      </span>
    </div>
  );
}

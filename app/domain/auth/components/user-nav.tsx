
import { Link, useFetcher } from "@remix-run/react";
import { Button } from "~/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/components/ui/dropdown-menu";
import { useEffect, useState } from "react";
import { toast } from "~/components/ui/use-toast";
import type { action } from "~/routes/api.auth.refresh-session";
import type { LoggedUser } from "../types.server";

type UserNavProps = Exclude<LoggedUser, null | false>;

export function UserNav({ name, email, avatarURL }: UserNavProps) {
    const [failedAvatarURL, setFailedAvatarURL] = useState<string | null>(null);
    const fetcher = useFetcher<typeof action>();
    const busy = fetcher.state !== "idle";
    useEffect(() => {
        if (fetcher.state !== "idle" || !fetcher.data) return;
        const result = fetcher.data;
        toast({
            title: "error" in result ? "Falha ao atualizar sessão" : "Sessão atualizada",
            description: "error" in result ? result.error : result.success,
            variant: "error" in result ? "destructive" : "default",
        });
    }, [fetcher.state, fetcher.data]);
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full" aria-label="Menu do usuário">
                    <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-purple-900 text-white">
                        {(name || email || "U").charAt(0)}
                        {avatarURL && avatarURL !== failedAvatarURL && (
                            <img
                                key={avatarURL}
                                src={avatarURL}
                                alt={`Avatar de ${name}`}
                                className="absolute inset-0 h-full w-full object-cover"
                                onError={() => setFailedAvatarURL(avatarURL)}
                            />
                        )}
                    </span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-max" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                    <div className="flex flex-col space-y-1">
                        <p className="text-sm font-medium leading-none">{name}</p>
                        <p className="text-xs leading-none text-muted-foreground">
                            {email}
                        </p>
                    </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                    disabled={busy}
                    onSelect={(event) => {
                        event.preventDefault();
                        fetcher.submit({}, { method: "post", action: "/api/auth/refresh-session" });
                    }}
                >
                    {busy ? "Atualizando sessão..." : "Atualizar sessão"}
                </DropdownMenuItem>
                <Link to="/logout">
                    <DropdownMenuItem>
                        Sair
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

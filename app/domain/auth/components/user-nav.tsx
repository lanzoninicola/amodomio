
import { Link } from "@remix-run/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { LoggedUser } from "../types.server";

type UserNavProps = Extract<LoggedUser, { email: string }>;

export function UserNav({ name, email, avatarURL }: UserNavProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    {avatarURL ? (
                        <img
                            src={avatarURL}
                            alt={`Avatar de ${name}`}
                            className="h-8 w-8 rounded-full object-cover"
                        />
                    ) : (
                        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-purple-900 text-white">
                            {name.charAt(0)}
                        </span>
                    )}
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
                <Link to="/admin/sessions">
                    <DropdownMenuItem>
                        Sessões
                    </DropdownMenuItem>
                </Link>
                <Link to="/logout">
                    <DropdownMenuItem>
                        Sair
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

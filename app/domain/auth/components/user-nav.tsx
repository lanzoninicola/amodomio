
import { Link } from "@remix-run/react";
import { Avatar, AvatarFallback, AvatarImage } from "~/modules/shadcn-ui/components/ui/avatar";
import { Button } from "~/modules/shadcn-ui/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "~/modules/shadcn-ui/components/ui/dropdown-menu";
import { LoggedUser } from "../types.server";

interface UserNavProps extends LoggedUser { }

export function UserNav({ name, email, avatarURL }: UserNavProps) {
    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                    <Avatar className="h-8 w-8 ">
                        <AvatarImage src={avatarURL} alt={`Avatar de ${name}`} />
                        <AvatarFallback className="bg-purple-900 text-white">{name.charAt(0)}</AvatarFallback>
                    </Avatar>
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
                <Link to="/logout">
                    <DropdownMenuItem>
                        Sair
                    </DropdownMenuItem>
                </Link>
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
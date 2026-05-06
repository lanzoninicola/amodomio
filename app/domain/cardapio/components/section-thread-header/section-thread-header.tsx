import { BadgeCheck, Plus } from "lucide-react";
import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle
} from "~/components/ui/dialog";
import { cn } from "~/lib/utils";

export type ThreadSectionProfile = {
    username: string;
    initials: string;
    avatarBg: string;
    avatarImageUrl?: string;
    bio?: string;
    verified?: boolean;
    showPlus?: boolean;
};

export const THREAD_PROFILE_MOCKS: Record<string, ThreadSectionProfile> = {
    "chef.nicola": {
        username: "chef.nicola",
        initials: "C",
        avatarBg: "#111827",
        avatarImageUrl: "https://media.amodomio.com.br/images/avatars/avatar_nicola.png",
        bio: "Chef responsável pelas combinações da casa. Especialista em sabores italianos e harmonizações.",
        verified: true,
        showPlus: true,
    },
    "clientes.amodomio": {
        username: "clientes.amodomio",
        initials: "A",
        avatarBg: "#991b1b",
        avatarImageUrl: "https://api.dicebear.com/7.x/thumbs/svg?seed=ClientesAmodoMio",
        bio: "Perfil da comunidade de clientes da A Modo Mio. Aqui destacamos os sabores mais curtidos.",
        verified: true,
    },
    "equipe.amodomio": {
        username: "equipe.amodomio",
        initials: "R",
        avatarBg: "#1d4ed8",
        avatarImageUrl: "https://api.dicebear.com/7.x/thumbs/svg?seed=ReelsAmodoMio",
        bio: "Equipe de conteúdo da casa. Bastidores, reels e novidades do cardápio.",
        verified: true,
    },
};

type SectionThreadHeaderProps = {
    profile: ThreadSectionProfile;
    title: string;
    subtitle?: string;
    className?: string;
};

function asAvatarSpeech(subtitle?: string) {
    if (!subtitle) return "";
    const cleaned = subtitle.replace(/\s+/g, " ").trim();
    if (!cleaned) return "";
    const normalized = cleaned.charAt(0).toLowerCase() + cleaned.slice(1);
    if (/^(hoje|eu|minha|minhas|meu|meus|aqui)\b/i.test(normalized)) return normalized;
    return normalized;
}

export default function SectionThreadHeader({
    profile,
    title,
    subtitle,
    className,
}: SectionThreadHeaderProps) {
    const [isProfileOpen, setIsProfileOpen] = useState(false);

    return (
        <div className={cn("flex items-start gap-3", className)}>
            <button
                type="button"
                className="relative mt-0.5 shrink-0"
                onClick={() => setIsProfileOpen(true)}
                aria-label={`Abrir bio de ${profile.username}`}
            >
                {profile.avatarImageUrl ? (
                    <img
                        src={profile.avatarImageUrl}
                        alt={`Avatar de ${profile.username}`}
                        className="h-12 w-12 rounded-full border border-zinc-300 object-cover"
                    />
                ) : (
                    <div
                        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-white"
                        style={{ backgroundColor: profile.avatarBg }}
                        aria-hidden="true"
                    >
                        {profile.initials}
                    </div>
                )}
                {profile.showPlus ? (
                    <span className="absolute -bottom-1 -right-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-white bg-black text-white">
                        <Plus className="h-3 w-3" />
                    </span>
                ) : null}
            </button>
            <div className="min-w-0 flex-1 ">
                <div className="flex items-center gap-1.5 min-w-0 mb-2">
                    <span className="font-neue text-[16px] font-semibold leading-none tracking-tight truncate ">
                        {profile.username}
                    </span>
                    {profile.verified ? (
                        <BadgeCheck className="h-4 w-4 shrink-0 text-sky-500" />
                    ) : null}
                </div>
                <h3 className="sr-only">
                    {title}
                </h3>

                <p className="mt-1 font-neue text-sm md:text-md tracking-wide ">
                    <span className="font-semibold">{title}</span>
                    {subtitle ? ` ${asAvatarSpeech(subtitle)}` : ""}
                </p>
            </div>

            <Dialog open={isProfileOpen} onOpenChange={setIsProfileOpen}>
                <DialogContent className="max-w-sm">
                    <DialogHeader>
                        <DialogTitle className="mb-4">
                            <div className="flex items-center gap-x-2">
                                {profile.avatarImageUrl ? (
                                    <img
                                        src={profile.avatarImageUrl}
                                        alt={`Avatar de ${profile.username}`}
                                        className="h-12 w-12 rounded-full border border-zinc-300 object-cover"
                                    />
                                ) : (
                                    <div
                                        className="inline-flex h-12 w-12 items-center justify-center rounded-full border border-zinc-300 text-sm font-semibold text-white"
                                        style={{ backgroundColor: profile.avatarBg }}
                                        aria-hidden="true"
                                    >
                                        {profile.initials}
                                    </div>
                                )}
                                <span className="font-neue text-xl">@{profile.username}</span>
                            </div>
                        </DialogTitle>
                        <DialogDescription className="font-neue text-sm leading-relaxed text-zinc-700 text-left">
                            {profile.bio || "Bio em construção."}
                        </DialogDescription>
                    </DialogHeader>
                </DialogContent>
            </Dialog>
        </div>
    );
}

import {
    THREAD_PROFILE_MOCKS,
    type ThreadSectionProfile,
} from "~/domain/cardapio/components/section-thread-header/section-thread-header";

export const INTEREST_ENDPOINT = "/api/menu-item-interest";

export const SECTION_THREAD_PROFILE_BY_SECTION: Record<"chef" | "likes" | "reels", ThreadSectionProfile> = {
    chef: THREAD_PROFILE_MOCKS["chef.nicola"],
    likes: THREAD_PROFILE_MOCKS["chef.nicola"],
    reels: THREAD_PROFILE_MOCKS["chef.nicola"],
};

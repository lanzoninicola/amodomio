import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import Logo from "../primitives/logo/logo";
import { SwiperImagesCarousel } from "../swiper-carousel/swiper-images-carousel";

interface PostLancamentoProps {
  content: React.ReactNode
  caption: React.ReactNode
}

export default function PostInstagram({ content, caption }: PostLancamentoProps) {
  return (
    <div className="w-[350px] border shadow-xl rounded-xl bg-white">
      <div className="flex flex-col">
        <div className="flex items-center gap-2 py-2 px-2 border-b">
          <Logo color="white" circle={true} className="w-[30px] p-0" />
          <h1 className="text-sm font-mono font-semibold">A Modo Mio</h1>
        </div>
        {content}
        <div className="flex justify-between p-2">
          <div className="flex items-center gap-x-2">
            <Heart />
            <MessageCircle />
            <Share2 />
          </div>
          <Bookmark />
        </div>
        <div className="border px-2 py-3">
          {caption}
        </div>
      </div>

    </div>
  )
}
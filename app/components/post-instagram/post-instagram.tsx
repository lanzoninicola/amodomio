import { Heart, MessageCircle, Share2, Bookmark } from "lucide-react";
import Logo from "../primitives/logo/logo";
import { useState, useRef, useEffect, useState as useReactState } from "react";
import WhatsappExternalLink from "../primitives/whatsapp/whatsapp-external-link";
import WhatsAppIcon from "../primitives/whatsapp/whatsapp-icon";
import { useFetcher } from "@remix-run/react";
import { cn } from "~/lib/utils";

interface PostInstagramProps extends PostInstagramActionBarProps {
  content: React.ReactNode;
  captionPreview: React.ReactNode;
  captionFull: React.ReactNode;
}

export default function PostInstagram({
  postId,
  sharesAmount,
  likesAmount,
  content,
  captionPreview,
  captionFull,
}: PostInstagramProps) {
  const [showFullCaption, setShowFullCaption] = useState(false);
  const [height, setHeight] = useReactState<number | "auto">(0);
  const captionRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (captionRef.current) {
      if (showFullCaption) {
        const scrollHeight = captionRef.current.scrollHeight;
        setHeight(scrollHeight);
        setTimeout(() => setHeight("auto"), 300);
      } else {
        setHeight(captionRef.current.scrollHeight);
        requestAnimationFrame(() => setHeight(0));
      }
    }
  }, [showFullCaption]);

  // 👉 função para expandir legenda e rolar até ela
  const expandAndScrollToCaption = () => {
    setShowFullCaption(true);
    setTimeout(() => {
      captionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  const compressAndScrollToContent = () => {
    setShowFullCaption(false);
    setTimeout(() => {
      headerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 100);
  };

  return (
    <div className="w-[350px] border shadow-xl rounded-xl bg-white">
      <div className="flex flex-col">
        {/* Header */}
        <div
          ref={headerRef}
          className="flex items-center gap-3 py-2 px-2 border-b">
          <Logo color="white" circle className="w-[30px] p-0" />
          <Logo color="black" onlyText className="w-[100px] h-[30px] md:w-[150px] md:h-[50px]" tagline={false} />
        </div>

        {/* Content clicável */}
        <div
          className="cursor-pointer"
          onClick={expandAndScrollToCaption}>
          {content}
        </div>

        {/* Actions */}
        <PostInstagramActionBar
          postId={postId}
          likesAmount={likesAmount}
          sharesAmount={sharesAmount}
        />

        {/* Caption com transição */}
        <div className="border-t px-2 py-3 text-sm">
          {!showFullCaption && (
            <>
              {captionPreview}
              <button
                className="text-blue-500 mt-1"
                onClick={expandAndScrollToCaption}
              >
                Ler mais...
              </button>
            </>
          )}

          <div
            ref={captionRef}
            style={{ height: height === "auto" ? "auto" : `${height}px` }}
            className="transition-all duration-300 ease-in-out overflow-hidden"
          >
            {showFullCaption && (
              <div>
                {captionFull}
                <button
                  className="text-blue-500 ml-1"
                  onClick={compressAndScrollToContent}
                >
                  Fechar...
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

interface PostInstagramActionBarProps {
  postId: string;
  likesAmount: number;
  sharesAmount: number;
}

function PostInstagramActionBar({ postId, likesAmount, sharesAmount }: PostInstagramActionBarProps) {
  const [likeIt, setLikeIt] = useState(false);
  const [currentLikesAmount, setCurrentLikesAmount] = useState(likesAmount || 0);
  const [currentSharesAmount, setCurrentSharesAmount] = useState(sharesAmount || 0);

  const fetcher = useFetcher();

  const likingIt = () => {
    setLikeIt(true);
    setCurrentLikesAmount(currentLikesAmount + 1);

    fetcher.submit(
      {
        action: "post-like-it",
        postId: postId,
        likesAmount: String(1)
      },
      { method: 'post' }
    );
  };

  const shareIt = () => {
    if (!navigator?.share) {
      console.log("Navegador não suporta o compartilhamento");
      return;
    }

    const text = `Olha a novidade da pizzaria A Modo Mio deste inverno`;
    navigator.share({
      title: "Lançamento de inverno no ar no A Modo Mio",
      text,
      url: `https://www.amodomio.com.br/cardapio#post-lancamento`
    }).then(() => {
      fetcher.submit(
        {
          action: "post-share-it",
          postId: postId,
        },
        { method: 'post' }
      );
    }).catch((error) => { });
  };

  return (
    <div className="flex justify-between px-4 py-2 w-full">
      <div className="flex gap-4 items-center">
        <div className="flex flex-col items-center gap-1 cursor-pointer p-1 active:bg-black/50 " onClick={shareIt}>
          <Share2 color="black" />
          <span className="text-xs text-center font-neue tracking-widest font-semibold uppercase text-black">
            {currentSharesAmount}
          </span>
        </div>
        <div className="flex flex-col items-center gap-1 cursor-pointer p-1 active:bg-black/50" onClick={likingIt}>
          <Heart
            className={cn(
              "stroke-black",
              likeIt ? "fill-red-500" : "fill-none",
              likeIt ? "stroke-red-500" : "stroke-black",
              likesAmount && likesAmount > 0 ? "stroke-red-500" : "stroke-black"
            )}
          />
          <span className="text-xs text-center font-neue tracking-widest font-semibold uppercase text-red-500">
            {currentLikesAmount}
          </span>
        </div>
      </div>
      <div className="grid place-items-center">
        <WhatsappExternalLink
          phoneNumber="46991272525"
          ariaLabel="Envia uma mensagem com WhatsApp"
          message={"Olá, gostaria fazer um pedido"}
          className="flex flex-col gap-1 items-center cursor-pointer p-1 active:bg-black/50"
        >
          <WhatsAppIcon color="black" />
        </WhatsappExternalLink>
      </div>
    </div>
  );
}

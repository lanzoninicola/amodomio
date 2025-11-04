<section id="post-lancamento" className="p-4" >
  <SectionTitle>Alerta de novidade</SectionTitle>
  <div className="grid place-items-center ">
    <PostInstagram
      postId={postFeatured?.id || ""}
      likesAmount={postFeatured?._count.PostLike || 0}
      sharesAmount={postFeatured?._count.PostShare || 0}
      content={
        <SwiperImagesCarousel slides={imageUrls || []} />
      }
      captionPreview={
        <div className="flex flex-col gap-4 mb-4">
          <p className="text-sm font-neue"><span className="text-sm font-semibold">@amodomiopb </span>
            Lançamento de inverno no ar! ❄️ Novas criações com sabores que aquecem, direto das montanhas italianas. 🇮🇹🔥

          </p>
          <p className="font-neue">*** Sabores disponíveis somente no cardápio A Modo Mio ou via WhatsApp (46) 99127 2525</p>
        </div>
      }
      captionFull={
        <section className="p-2 space-y-6 font-neue">
          <h2 className="text-lg font-semibold">Lançamento de inverno no ar! ❄️</h2>
          <p>Novas criações com sabores que aquecem, direto das montanhas italianas. 🇮🇹🔥</p>
          <h3 className="block text-md">
            Sabores invernais com inspiração nas Montanhas Italianas
          </h3>

          <article className="space-y-2">
            <h4 className="text-lg font-semibold font-mono">🏔️ TRENTINA</h4>
            <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, gorgonzola, bacon defumado e parmesão.</p>
            <p><span className="font-semibold">Perfil:</span> 👉 Intensa, cremosa e crocante.</p>
            <p><span className="font-semibold">Inspiração:</span> Homenagem direta ao Trentino, terra de montanhas, neve, queijos fortes e sabores defumados. Um sabor que transmite o espírito dos refúgios alpinos da região, conforto e tradição.</p>
          </article>

          <article className="space-y-2">
            <h4 className="text-lg font-semibold font-mono">🏔️ ETNA</h4>
            <p><span className="font-semibold fontmo">Ingredientes:</span> Molho de tomate italiano, muçarela, abobrinha assada, provolone defumado, nozes e geleia apimentada.</p>
            <p><span className="font-semibold">Perfil:</span> 👉 Vegetariana, surpreendente e levemente adocicada.</p>
            <p><span className="font-semibold">Inspiração:</span> O vulcão ativo da Sicília inspira uma pizza cheia de energia e calor, com notas defumadas, doces e crocantes. Uma verdadeira explosão de sabores.</p>
          </article>

          <article className="space-y-2">
            <h4 className="text-lg font-semibold font-mono">🏔️ MARMOLADA</h4>
            <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, cogumelos salteados, brie, presunto cru e molho pesto artesanal.</p>
            <p><span className="font-semibold">Perfil:</span> 👉 Sofisticada, aromática e cheia de personalidade.</p>
            <p><span className="font-semibold">Inspiração:</span> A Marmolada é a Rainha das Dolomitas. Seus bosques e trilhas inspiram uma pizza rica em sabores da montanha: cogumelos, queijos e ervas.</p>
          </article>

          <article className="space-y-2">
            <h4 className="text-lg font-semibold font-mono">🏔️ GRAN PARADISO</h4>
            <p><span className="font-semibold">Ingredientes:</span> Molho de tomate italiano, muçarela, bacon defumado, brie, nozes e geleia de damasco.</p>
            <p><span className="font-semibold">Perfil:</span> 👉 Doce, salgada e crocante.</p>
            <p><span className="font-semibold">Inspiração:</span> Uma montanha símbolo de equilíbrio e natureza preservada. Esta pizza traduz esse conceito com uma combinação harmoniosa de doce, salgado e crocância.</p>
          </article>

          <div className="bg-green-700 text-white font-neue px-2 py-1 space-y-2 rounded-md">
            <p>Sabores disponíveis somente no cardápio A Modo Mio ou via WhatsApp (46) 99127 2525</p>
          </div>
        </section>


      }
    />
  </div>

</section>
import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay, EffectCards } from 'swiper/modules'

export function SwiperCarousel({ slides }: { slides: string[] }) {
  return (
    <div className="relative w-full max-w-5xl mx-auto" element-name="swiper-carousel">
      <Swiper
        modules={[Navigation, Pagination, Autoplay, EffectCards]}
        slidesPerView={1.4}
        centeredSlides
        spaceBetween={20}
        loop
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
        className="rounded-xl"
        effect='cards'
      >
        {
          slides.map((src, idx) => (

            <SwiperSlide key={idx}>
              <img
                src={src}
                alt={`Slide ${idx + 1}`}
                className="w-full h-[450px] object-cover rounded-xl transition-transform duration-500 hover:scale-[1.02]"
              />

            </SwiperSlide>
          ))
        }
      </Swiper>
    </div >
  )
}

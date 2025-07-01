import { Swiper, SwiperSlide } from 'swiper/react'
import { Navigation, Pagination, Autoplay, EffectCards } from 'swiper/modules'

export function SwiperImagesCarousel({ slides }: { slides: string[] }) {
  return (
    <div className="relative w-full max-w-5xl mx-auto" element-name="swiper-images-carousel">
      <Swiper
        modules={[Navigation, Pagination, Autoplay]}
        slidesPerView={1}
        centeredSlides
        spaceBetween={2}
        loop
        autoplay={{ delay: 4000, disableOnInteraction: false }}
        pagination={{ clickable: true }}
      >
        {
          slides.map((src, idx) => (

            <SwiperSlide key={idx}>
              <img
                src={src}
                alt={`Slide ${idx + 1}`}
                className="w-full h-full object-cover transition-transform duration-500 hover:scale-[1.02]"
              />

            </SwiperSlide>
          ))
        }
      </Swiper>
    </div >
  )
}

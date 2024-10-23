import Image from "next/image";
import { useEffect, useState } from "react";

type Image = {
  title: string;
  imageUrl: string;
};

type ImageCarouselProps = {
  images: Image[];
};

function ImageCarousel({ images }: ImageCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);

  const handleNextSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide === images.length - 1 ? 0 : prevSlide + 1));
  };

  useEffect(() => {
    const autoForward = setInterval(() => {
      handleNextSlide();
    }, 3000);

    return () => clearInterval(autoForward);
  }, [currentSlide, handleNextSlide]);

  const handlePrevSlide = () => {
    setCurrentSlide((prevSlide) => (prevSlide === 0 ? images.length - 1 : prevSlide - 1));
  };

  return (
    <div className="relative rounded-xl">
      <div className="w-full relative overflow-hidden">
        <div
          className="relative w-full flex transition-transform duration-500 ease-in-out"
          style={{
            transform: `translateX(-${currentSlide * 100}%)`,
          }}
        >
          {images.map((img, index) => (
            <div key={index} className="flex-shrink-0 w-full h-96 relative">
              <img src={img.imageUrl} className="w-full h-full object-cover rounded" alt={img.title} />
              <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white text-sm p-2 rounded">
                {img.title}
              </div>
            </div>
          ))}
        </div>
        <div className="absolute flex justify-between transform -translate-y-1/2 left-5 right-5 top-1/2">
          <button onClick={handlePrevSlide} className="btn btn-circle btn-ghost">
            ❮
          </button>
          <button onClick={handleNextSlide} className="btn btn-circle btn-ghost">
            ❯
          </button>
        </div>
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex space-x-2">
          {images.map((_, index) => (
            <div key={index} className={`h-2 w-2 rounded-full ${index === currentSlide ? "bg-blue-500" : "bg-gray-300"}`}></div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default ImageCarousel;

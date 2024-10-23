import { useAuth } from "@shared/api/hooks/useAuth";
import { useEffect, useRef, useState } from "react";

type HowItWorksProps = {
  onAuthClick: () => void;
};

export const HowItWorks = ({ onAuthClick }: HowItWorksProps) => {
  const { isAuthenticated } = useAuth();

  const steps = [
    {
      persona: "Regular User",
      steps: [
        {
          heading: "1",
          content: (
            <>
              Sign up for an account{" "}
              {!isAuthenticated && (
                <span className="text-blue-500 cursor-pointer underline" onClick={onAuthClick}>
                  here
                </span>
              )}
              .
            </>
          ),
        },
        {
          heading: "2",
          content: "Buy credits using your preferred payment method.",
        },
        {
          heading: "3",
          content: "Donate credits by scanning a panhandler's QR code.",
        },
        { heading: null, content: null }, // Empty slot
        { heading: null, content: null }, // Empty slot
      ],
      offsetClass: "ml-0", // No offset for the first row
    },
    {
      persona: "Panhandler or Waitress",
      steps: [
        { heading: null, content: null }, // Empty slot
        { heading: "1", content: "Receive a QR code to accept donations." },
        {
          heading: "2",
          content: "Choose to spend the credits at a store for full value.",
        },
        {
          heading: "3",
          content: "Alternatively, redeem for cash with a 10% fee going to a charity of your choice.",
        },
        { heading: null, content: null }, // Empty slot
      ],
      offsetClass: "ml-1/5", // Offset for the middle row (1/5 of the grid)
    },
    {
      persona: "Store",
      steps: [
        { heading: null, content: null }, // Empty slot
        { heading: null, content: null }, // Empty slot
        {
          heading: "1",
          content: (
            <>
              Sign up to accept credits at full value{" "}
              {!isAuthenticated && (
                <span className="text-blue-500 cursor-pointer underline" onClick={onAuthClick}>
                  here
                </span>
              )}
              .
            </>
          ),
        },
        {
          heading: "2",
          content: "Allow customers to spend credits in your store.",
        },
        {
          heading: "3",
          content: "Redeem credits for cash with a 3% fee going to a charity of your choice.",
        },
      ],
      offsetClass: "ml-2/5", // Offset for the last row (2/5 of the grid)
    },
  ];

  const [isScrollingDiagonally, setIsScrollingDiagonally] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => {
      const container = containerRef.current;
      if (!container) return;

      const containerHeight = container.scrollHeight;
      const containerWidth = container.scrollWidth;
      const viewportHeight = window.innerHeight;
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

      const startScrollPoint = container.offsetTop;
      const endScrollPoint = container.offsetTop + containerHeight - viewportHeight / 2;

      // Start diagonal scrolling when the top-left corner reaches the viewport's top
      if (!isScrollingDiagonally && scrollTop >= startScrollPoint) {
        setIsScrollingDiagonally(true);
      }

      if (isScrollingDiagonally) {
        const maxScrollTop = endScrollPoint - startScrollPoint;
        const maxScrollLeft = containerWidth - window.innerWidth;

        // Calculate the progress ratio (vertical scrolling) and apply to horizontal scroll
        const verticalProgress = Math.min(scrollTop - startScrollPoint, maxScrollTop);
        const horizontalProgress = (verticalProgress / maxScrollTop) * maxScrollLeft;

        // Move horizontally based on the vertical progress
        container.scrollLeft = horizontalProgress;

        // Stop diagonal scrolling at the end of the horizontal scroll
        if (scrollTop >= endScrollPoint) {
          setIsScrollingDiagonally(false);
        }
      }
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, [isScrollingDiagonally]);

  return (
    <section id="how-it-works" className="py-12 bg-gradient-to-r from-green-400 to-blue-500 overflow-x-auto" ref={containerRef}>
      <div className="w-[150%] max-w-none px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-center mb-8 text-white">How It Works</h2>
        {steps.map((step, index) => (
          <div key={index} className="mb-12">
            <div className={`text-center mb-6 ${step.offsetClass}`}>
              <h3 className="text-2xl font-bold text-white mt-2">{step.persona}</h3>
            </div>
            <div className="grid grid-cols-5 gap-8 text-center">
              {step.steps.map((stepDetail, stepIndex) => (
                <div key={stepIndex} className={`${stepDetail.content ? "bg-white p-6 rounded-lg shadow-lg" : ""}`}>
                  {stepDetail.content && (
                    <>
                      <div className="text-4xl font-bold text-green-500 mb-4">{stepDetail.heading}</div>
                      <p className="text-gray-700">{stepDetail.content}</p>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};

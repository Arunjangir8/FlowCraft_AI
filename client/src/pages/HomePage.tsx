import { MotionConfig } from "framer-motion";
import Nav from "../components/home/Nav";
import Hero from "../components/home/Hero";
import HowItWorks from "../components/home/HowItWorks";
import Features from "../components/home/Features";
import AiSection from "../components/home/AiSection";
import UseCases from "../components/home/UseCases";
import CollabSection from "../components/home/CollabSection";
import Trust from "../components/home/Trust";
import Faq from "../components/home/Faq";
import Closing from "../components/home/Closing";
import ClickSpark from "../components/home/bits/ClickSpark";
import ScrollVelocity from "../components/home/bits/ScrollVelocity";

export default function HomePage() {
  return (
    <MotionConfig reducedMotion="user">
      <ClickSpark>
        <div className="min-h-full scroll-smooth bg-paper text-ink">
          <Nav />
          <main>
            <Hero />
            <HowItWorks />
            <Features />
            <ScrollVelocity
              text="Sketch · Diagram · Describe · Share · "
              className="py-6 font-serif text-[clamp(2.2rem,5vw,3.8rem)] italic text-ink/10 select-none"
            />
            <AiSection />
            <UseCases />
            <CollabSection />
            <Trust />
            <Faq />
          </main>
          <Closing />
        </div>
      </ClickSpark>
    </MotionConfig>
  );
}

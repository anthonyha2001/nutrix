import { LogoMark } from "@/components/logo-mark";

// Opening animation, once per visit (mobile and desktop): the mint square
// settles, the N is revealed, the leaf grows from its stem, the name fades in,
// then the screen dissolves into the page. Pure CSS (globals.css, "splash"),
// rendered with the page so it shows before anything else; an inline script in
// the root layout hides it on later page loads of the same visit and for
// reduced motion.
export function Splash() {
  return (
    <div className="splash" aria-hidden>
      <div className="splash-inner">
        <span className="splash-icon">
          <span className="splash-glow" />
          <LogoMark animated className="relative size-full text-ink" />
        </span>
        <span className="splash-word">Nutrix</span>
      </div>
    </div>
  );
}

// Runs before the first paint: show the splash on the first page load of a
// visit only, never again until the browser tab is closed.
export const SPLASH_SCRIPT = `try{var d=document.documentElement;if(sessionStorage.getItem("nx-splash")||matchMedia("(prefers-reduced-motion: reduce)").matches){d.dataset.splash="off"}else{sessionStorage.setItem("nx-splash","1")}}catch(e){document.documentElement.dataset.splash="off"}`;

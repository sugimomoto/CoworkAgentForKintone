// app.jsx — composes the Cowork Agent landing page.
const { useState: useS, useEffect: useEf } = React;

function ApplyAccent({ accent }) {
  useEf(() => {
    const root = document.documentElement;
    root.style.setProperty('--accent', accent);
    root.style.setProperty('--accent-soft', accent + '1a');
    root.style.setProperty('--accent-line', accent + '33');
  }, [accent]);
  return null;
}

// sticky nav shadow on scroll
function useNavShadow() {
  useEf(() => {
    const nav = document.getElementById('nav');
    if (!nav) return;
    const on = () => nav.classList.toggle('scrolled', window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
}

// reveal-on-scroll
function useReveal() {
  useEf(() => {
    const els = document.querySelectorAll('.reveal');
    const io = new IntersectionObserver((es) => {
      es.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(el => io.observe(el));
    return () => io.disconnect();
  }, []);
}

function Tweaks({ tweaks, setTweak }) {
  return (
    <TweaksPanel title="Tweaks">
      <TweakSection label="ブランド" />
      <TweakColor label="アクセント色" value={tweaks.accent}
        onChange={(v) => setTweak('accent', v)}
        presets={['#0d9488', '#0f766e', '#059669', '#d97706', '#231200']} />
      <TweakRadio label="ロゴ案" value={tweaks.logoVariant}
        options={['A', 'B', 'C']}
        onChange={(v) => setTweak('logoVariant', v)} />
    </TweaksPanel>
  );
}

function App() {
  const defaults = /*EDITMODE-BEGIN*/{
    "accent": "#0d9488",
    "logoVariant": "A"
  }/*EDITMODE-END*/;
  const [tweaks, setTweak] = useTweaks(defaults);
  useNavShadow();
  useReveal();

  return (
    <>
      <ApplyAccent accent={tweaks.accent} />
      <Nav logoVariant={tweaks.logoVariant} accent={tweaks.accent} />
      <Hero />
      <Concept />
      <RoleScenes />
      <OfficeDocs />
      <UseCases />
      <Wedge />
      <Setup />
      <Differentiation />
      <FAQ />
      <CTA />
      <Footer logoVariant={tweaks.logoVariant} accent={tweaks.accent} />
      <Tweaks tweaks={tweaks} setTweak={setTweak} />
    </>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(<App />);

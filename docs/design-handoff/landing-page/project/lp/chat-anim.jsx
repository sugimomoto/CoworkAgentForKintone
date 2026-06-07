// chat-anim.jsx — shared scripted-conversation player for chat mocks.
// A "scene" is an array of steps run in order, then looped:
//   { msgs: [...nodes], hold: 1200 }   set the visible message list, wait `hold` ms
//   { type: '今月の…', cps: 42 }        type text into the composer char-by-char
//   { clear: true }                     clear the composer instantly
// Plays only while in viewport (IntersectionObserver) to stay cheap.

const { useState: _uS, useEffect: _uE, useRef: _uR } = React;

function useChatScene(buildSteps, deps = []) {
  const [msgs, setMsgs] = _uS([]);
  const [compose, setCompose] = _uS('');
  const [typing, setTyping] = _uS(false);
  const ref = _uR(null);
  const live = _uR(false);

  _uE(() => {
    const node = ref.current;
    if (!node) return;
    const io = new IntersectionObserver((es) => { live.current = es[0].isIntersecting; }, { threshold: 0.15 });
    io.observe(node);
    return () => io.disconnect();
  }, []);

  _uE(() => {
    let cancelled = false;
    const timers = [];
    const sleep = (ms) => new Promise((res) => { const t = setTimeout(res, ms); timers.push(t); });
    const waitLive = async () => { while (!live.current && !cancelled) await sleep(180); };

    async function run() {
      const steps = buildSteps();
      // eslint-disable-next-line no-constant-condition
      while (!cancelled) {
        await waitLive();
        for (const s of steps) {
          if (cancelled) return;
          if (s.clear) { setCompose(''); setTyping(false); continue; }
          if (typeof s.type === 'string') {
            setTyping(true);
            const txt = s.type; const cps = s.cps || 42;
            for (let i = 1; i <= txt.length; i++) {
              if (cancelled) return;
              setCompose(txt.slice(0, i));
              await sleep(cps + (txt[i - 1] === '、' || txt[i - 1] === '。' ? 180 : 0));
            }
            await sleep(s.after || 360);
            continue;
          }
          if (s.msgs) { setMsgs(s.msgs); await sleep(s.hold || 900); }
        }
        await sleep(1400); // pause before loop
      }
    }
    run();
    return () => { cancelled = true; timers.forEach(clearTimeout); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { msgs, compose, typing, ref };
}
window.useChatScene = useChatScene;

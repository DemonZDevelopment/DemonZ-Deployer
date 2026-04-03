/**
 * DemonZ Deployer — Pipeline Step Visualizer
 */

const Pipeline = (() => {
  const STEPS = ['auth', 'encode', 'check', 'upload', 'done'];
  const CONNS  = [1, 2, 3, 4];

  function setStep(id, state) {
    const el = document.getElementById(`ps-${id}`);
    if (el) el.className = `pipe-step${state ? ` ${state}` : ''}`;
  }

  function setConn(n, done) {
    const el = document.getElementById(`pc-${n}`);
    if (el) el.className = `pipe-conn${done ? ' done' : ''}`;
  }

  function reset() {
    STEPS.forEach(id => setStep(id, ''));
    CONNS.forEach(n  => setConn(n, false));
  }

  return { setStep, setConn, reset };
})();

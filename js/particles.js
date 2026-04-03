/**
 * DemonZ Deployer — Interactive Ambient Background (v3.0.0)
 *
 * Renders an interactive mesh network on canvas that responds to cursor movement.
 */

const Particles = (() => {
  let canvas, ctx, w, h;
  let particles = [];
  const MOUSE = { x: -1000, y: -1000, radius: 120 };

  function init() {
    canvas = document.getElementById('bgCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d', { alpha: true });
    
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', (e) => {
      MOUSE.x = e.clientX;
      MOUSE.y = e.clientY;
    });
    window.addEventListener('mouseout', () => {
      MOUSE.x = -1000;
      MOUSE.y = -1000;
    });

    resize();
    _create();
    _loop();
  }

  function resize() {
    w = canvas.width = window.innerWidth;
    h = canvas.height = window.innerHeight;
    _create();
  }

  class Particle {
    constructor() {
      this.x = Math.random() * w;
      this.y = Math.random() * h;
      this.baseX = this.x;
      this.baseY = this.y;
      this.size = Math.random() * 1.5 + 0.5;
      this.density = (Math.random() * 30) + 1;
      this.vx = (Math.random() - 0.5) * 0.4;
      this.vy = (Math.random() - 0.5) * 0.4;
    }

    update() {
      // Slow drift
      this.baseX += this.vx;
      this.baseY += this.vy;

      if (this.baseX > w || this.baseX < 0) this.vx *= -1;
      if (this.baseY > h || this.baseY < 0) this.vy *= -1;

      // Mouse interaction (repel)
      const dx = MOUSE.x - this.baseX;
      const dy = MOUSE.y - this.baseY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      if (dist < MOUSE.radius) {
        const force = (MOUSE.radius - dist) / MOUSE.radius;
        const dirX = dx / dist;
        const dirY = dy / dist;
        this.x = this.baseX - dirX * force * this.density;
        this.y = this.baseY - dirY * force * this.density;
      } else {
        // Return to base smoothly
        if (this.x !== this.baseX) this.x -= (this.x - this.baseX) * 0.1;
        if (this.y !== this.baseY) this.y -= (this.y - this.baseY) * 0.1;
      }
    }

    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(192, 97, 255, 0.4)';
      ctx.fill();
    }
  }

  function _create() {
    particles = [];
    const count = Math.min((w * h) / 14000, 150); // Scale with screen, cap at 150
    for (let i = 0; i < count; i++) {
      particles.push(new Particle());
    }
  }

  function _loop() {
    ctx.clearRect(0, 0, w, h);

    for (let i = 0; i < particles.length; i++) {
      particles[i].update();
      particles[i].draw();

      // Connect near particles
      for (let j = i; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);

        if (dist < 110) {
          ctx.beginPath();
          ctx.strokeStyle = `rgba(192, 97, 255, ${0.15 - dist/800})`; // Fade out with distance
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }
    requestAnimationFrame(_loop);
  }

  return { init };
})();

document.addEventListener('DOMContentLoaded', Particles.init);

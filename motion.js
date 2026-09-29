(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const animations = [];
  if (!reduced.matches && window.anime) {
    animations.push(anime.animate('.hero-en,.hero-cn,.hero-description,.hero-actions', { opacity: [0, 1], translateY: [18, 0], delay: anime.stagger(85), duration: 750, ease: 'outExpo' }));
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      if (reduced.matches || !window.anime) return;
      animations.push(anime.animate(entry.target, { opacity: [.4, 1], translateY: [15, 0], duration: 650, ease: 'outExpo' }));
    });
  }, { threshold: .15 });
  document.querySelectorAll('.section-head,.application-grid article').forEach(el => observer.observe(el));
  reduced.addEventListener('change', () => { if (reduced.matches) animations.forEach(a => a.revert()); });
  let sceneAnimation,heroAnimation,captionAnimation;
  const stage=document.querySelector('#lab-stage'),flash=document.createElement('div');flash.className='portal-flash';flash.setAttribute('aria-hidden','true');stage.append(flash);
  document.addEventListener('xr:ready',()=>{
    if(reduced.matches||window.__xrCapture||!window.anime)return;
    sceneAnimation?.revert();
    const canvas=document.querySelector('#lab-canvas canvas');
    sceneAnimation=anime.animate(canvas,{opacity:[.15,1],scale:[1.06,1],translateY:[22,0],duration:680,ease:'outExpo'});
    anime.animate(flash,{opacity:[.8,0],duration:900,ease:'outCubic'});
  });
  document.addEventListener('xr:hero',()=>{
    if(reduced.matches||!window.anime)return;heroAnimation?.revert();captionAnimation?.revert();
    heroAnimation=anime.animate('#hero-scene canvas',{opacity:[.05,1],translateX:[65,0],scale:[1.07,1],duration:1100,ease:'outExpo'});
    captionAnimation=anime.animate('.hero-caption',{translateY:[16,0],opacity:[0,1],duration:650,ease:'outExpo'});
  });
  document.querySelector('#lab-controls').addEventListener('click',e=>{
    const button=e.target.closest('button');if(!button||reduced.matches||!window.anime)return;
    anime.animate(button,{scale:[.94,1],duration:360,ease:'outBack'});
  });
  reduced.addEventListener('change',()=>{if(reduced.matches){sceneAnimation?.revert();heroAnimation?.revert();captionAnimation?.revert();}});
  const video = document.querySelector('#promo');
  document.addEventListener('visibilitychange', () => { if (document.hidden) video.pause(); });
})();

/* frasco3d.js — frasco de verniz em 3D (three.js). Vidro com verniz dentro e tampa preta.
   A cor do verniz segue a variável CSS --acc (muda quando a cliente toca num frasco).
   Arrastar roda o frasco; o scroll dá uma volta lenta. Reduced motion: um frame parado.
   A unha em SVG continua por baixo como fallback; o canvas só aparece depois do primeiro frame. */
export async function montarFrasco(caixa) {
  if (!caixa) return;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  let THREE, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) { return; }
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'frasco3d';
  let renderer;
  try { renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, failIfMajorPerformanceCaveat: true }); }
  catch (e) { return; }
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  const camara = new THREE.PerspectiveCamera(24, 1, 0.1, 100);
  camara.position.set(0, 1.1, 8);

  const v = (x, y) => new THREE.Vector2(x, y);
  // Corpo de vidro (perfil arredondado, ombro e gargalo)
  const corpoPerfil = [v(0, 0), v(0.78, 0), v(0.9, 0.06), v(0.95, 0.2), v(0.95, 1.15), v(0.9, 1.3), v(0.6, 1.42), v(0.3, 1.48), v(0.28, 1.62), v(0, 1.62)];
  const vidro = new THREE.Mesh(new THREE.LatheGeometry(corpoPerfil, 128), new THREE.MeshPhysicalMaterial({
    color: '#ffffff', roughness: 0.02, transmission: 1, thickness: 0.6, ior: 1.5, clearcoat: 1, clearcoatRoughness: 0.03, transparent: true, opacity: 1,
  }));
  // Verniz dentro do vidro
  const liqPerfil = [v(0, 0.1), v(0.78, 0.1), v(0.85, 0.2), v(0.85, 1.08), v(0.78, 1.2), v(0, 1.2)];
  const verniz = new THREE.MeshPhysicalMaterial({ color: '#8E1F3F', roughness: 0.15, clearcoat: 1, clearcoatRoughness: 0.05, sheen: 0.3 });
  const liquido = new THREE.Mesh(new THREE.LatheGeometry(liqPerfil, 128), verniz);
  // Tampa preta alta (com leve ranhura)
  const tampaPerfil = [v(0, 1.58), v(0.36, 1.58), v(0.38, 1.62), v(0.38, 3.05), v(0.34, 3.12), v(0, 3.12)];
  const tampa = new THREE.Mesh(new THREE.LatheGeometry(tampaPerfil, 96), new THREE.MeshPhysicalMaterial({ color: '#141012', roughness: 0.22, clearcoat: 0.8 }));
  const frasco = new THREE.Group();
  frasco.add(liquido, vidro, tampa);
  frasco.position.y = -1.55;
  cena.add(frasco);

  // Sombra de contacto suave
  const sc = document.createElement('canvas'); sc.width = sc.height = 128;
  const sg = sc.getContext('2d'); const grad = sg.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, 'rgba(43,24,34,.45)'); grad.addColorStop(1, 'rgba(43,24,34,0)');
  sg.fillStyle = grad; sg.fillRect(0, 0, 128, 128);
  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 3.2), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(sc), transparent: true, depthWrite: false }));
  sombra.rotation.x = -Math.PI / 2; sombra.position.y = -1.55; cena.add(sombra);

  const key = new THREE.DirectionalLight('#ffffff', 2); key.position.set(-3, 5, 4); cena.add(key);

  function medir() {
    const r = caixa.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false); camara.aspect = w / h;
    const dist = (4.2 / 2) / Math.tan((camara.fov * Math.PI / 180) / 2);
    camara.position.z = Math.max(dist, dist / camara.aspect * 0.75);
    camara.lookAt(0, 0, 0); camara.updateProjectionMatrix();
  }

  let ang = -0.4, alvo = -0.4, pedido = false, visivel = true, corAtual = new THREE.Color('#8E1F3F'), corAlvo = corAtual.clone();
  function desenhar() {
    pedido = false;
    ang += (alvo - ang) * 0.1;
    corAtual.lerp(corAlvo, reduz.matches ? 1 : 0.15);
    verniz.color.copy(corAtual);
    frasco.rotation.y = ang;
    renderer.render(cena, camara);
    const d = Math.abs(corAtual.r - corAlvo.r) + Math.abs(corAtual.g - corAlvo.g) + Math.abs(corAtual.b - corAlvo.b);
    if (d < 0.002) corAtual.copy(corAlvo);
    if (Math.abs(alvo - ang) > 0.0005 || d >= 0.002) pedir();
  }
  function pedir() { if (!pedido && visivel) { pedido = true; requestAnimationFrame(desenhar); } }

  caixa.appendChild(canvas);
  medir(); renderer.render(cena, camara);
  caixa.classList.add('tem-3d');
  new ResizeObserver(() => { medir(); pedir(); }).observe(caixa);
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) pedir(); }).observe(caixa);

  // Cor segue --acc
  const lerCor = () => { const c = getComputedStyle(document.documentElement).getPropertyValue('--acc').trim(); if (c) { corAlvo.set(c); pedir(); } };
  new MutationObserver(lerCor).observe(document.documentElement, { attributes: true, attributeFilter: ['style'] });
  lerCor();

  // Arrastar para rodar (e scroll dá meia volta)
  let arrastando = false, x0 = 0, a0 = 0;
  canvas.addEventListener('pointerdown', (e) => { arrastando = true; x0 = e.clientX; a0 = alvo; canvas.setPointerCapture(e.pointerId); });
  canvas.addEventListener('pointermove', (e) => { if (!arrastando) return; alvo = a0 + (e.clientX - x0) * 0.012; if (reduz.matches) ang = alvo; pedir(); });
  canvas.addEventListener('pointerup', () => { arrastando = false; });
  canvas.style.touchAction = 'pan-y';
  addEventListener('scroll', () => { if (reduz.matches || arrastando) return; alvo = -0.4 + scrollY / 500; pedir(); }, { passive: true });
}

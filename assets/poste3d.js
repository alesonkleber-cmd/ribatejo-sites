/* poste3d.js — poste de barbeiro em 3D (three.js), por cima do SVG que serve de fallback.
   O SVG fica sempre no DOM. O canvas só aparece depois do primeiro frame renderizado.
   Gira com o scroll (assinatura do site) e acompanha o ponteiro ligeiramente.
   Respeita prefers-reduced-motion: um frame parado, sem rotação. */
export async function montarPoste(caixa) {
  if (!caixa) return;
  const reduz = matchMedia('(prefers-reduced-motion: reduce)');
  let THREE, RoomEnvironment;
  try {
    THREE = await import('three');
    ({ RoomEnvironment } = await import('three/addons/environments/RoomEnvironment.js'));
  } catch (e) { return; }

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.className = 'poste3d';
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, failIfMajorPerformanceCaveat: true });
  } catch (e) { return; }
  const dpr = Math.min(devicePixelRatio || 1, matchMedia('(pointer: coarse)').matches ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const camara = new THREE.PerspectiveCamera(22, 1, 0.1, 100);
  camara.position.set(0, 0.2, 9.5);

  // Textura das listras (hélice): desenhada num canvas 2D.
  const tc = document.createElement('canvas'); tc.width = 512; tc.height = 1024;
  const g = tc.getContext('2d');
  g.fillStyle = '#EFE4D0'; g.fillRect(0, 0, 512, 1024);
  const cores = ['#9E2A22', '#EFE4D0', '#23407A', '#EFE4D0'];
  const passo = 128;
  for (let y = -1024; y < 2048; y += passo) {
    cores.forEach((c, i) => {
      g.fillStyle = c;
      g.beginPath();
      const y0 = y + i * (passo / 4);
      g.moveTo(0, y0); g.lineTo(512, y0 - 512); g.lineTo(512, y0 - 512 + passo / 4); g.lineTo(0, y0 + passo / 4); g.closePath(); g.fill();
    });
  }
  const listras = new THREE.CanvasTexture(tc);
  listras.colorSpace = THREE.SRGBColorSpace;
  listras.wrapS = listras.wrapT = THREE.RepeatWrapping;
  listras.anisotropy = 8;

  const poste = new THREE.Group();
  const H = 3.2, R = 0.42;
  // Núcleo listrado
  const nucleo = new THREE.Mesh(
    new THREE.CylinderGeometry(R * 0.92, R * 0.92, H, 96, 1, true),
    new THREE.MeshStandardMaterial({ map: listras, roughness: 0.38, metalness: 0, emissive: '#ffffff', emissiveMap: listras, emissiveIntensity: 0.18 })
  );
  poste.add(nucleo);
  // Tubo de vidro por fora
  const vidro = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, H, 96, 1, true),
    new THREE.MeshPhysicalMaterial({ color: '#ffffff', roughness: 0.05, transmission: 1, thickness: 0.3, ior: 1.45, transparent: true, opacity: 0.16, clearcoat: 1 })
  );
  poste.add(vidro);
  // Tampas metálicas (latão escurecido)
  const metal = new THREE.MeshStandardMaterial({ color: '#8a6a3c', metalness: 1, roughness: 0.28 });
  const perfil = [[0, 0], [0.55, 0], [0.55, 0.08], [0.5, 0.12], [0.5, 0.26], [0.36, 0.34], [0.22, 0.5], [0, 0.56]].map(([x, y]) => new THREE.Vector2(x, y));
  const tampaGeo = new THREE.LatheGeometry(perfil, 96);
  const topo = new THREE.Mesh(tampaGeo, metal); topo.position.y = H / 2; poste.add(topo);
  const base = new THREE.Mesh(tampaGeo, metal); base.position.y = -H / 2; base.rotation.x = Math.PI; poste.add(base);
  const anel = new THREE.Mesh(new THREE.TorusGeometry(R * 1.02, 0.03, 16, 96), metal);
  anel.rotation.x = Math.PI / 2; anel.position.y = H / 2; poste.add(anel.clone());
  anel.position.y = -H / 2; poste.add(anel);
  cena.add(poste);

  const luz = new THREE.DirectionalLight('#fff4e0', 2.2); luz.position.set(-3, 4, 5); cena.add(luz);
  const luzQuente = new THREE.PointLight('#ffb35c', 6, 12); luzQuente.position.set(2.5, 1, 2); cena.add(luzQuente);

  function medir() {
    const r = caixa.getBoundingClientRect();
    const w = Math.max(1, r.width), h = Math.max(1, r.height);
    renderer.setSize(w, h, false);
    camara.aspect = w / h;
    // enquadra o poste inteiro conforme a proporção
    const t = Math.tan((camara.fov * Math.PI / 180) / 2);
    const distH = ((H + 1.25) / 2) / t;
    const distW = (R * 1.7) / (t * camara.aspect);
    camara.position.z = Math.max(distH, distW);
    camara.updateProjectionMatrix();
  }

  let alvoRot = 0, rot = 0, px = 0, alvoPx = 0, visivel = true, pedido = false;
  function desenhar() {
    pedido = false;
    rot += (alvoRot - rot) * 0.12;
    px += (alvoPx - px) * 0.08;
    listras.offset.y = rot;
    poste.rotation.y = px * 0.35;
    poste.rotation.z = -px * 0.05;
    renderer.render(cena, camara);
    if (Math.abs(alvoRot - rot) > 0.0005 || Math.abs(alvoPx - px) > 0.0005) pedir();
  }
  function pedir() { if (!pedido && visivel) { pedido = true; requestAnimationFrame(desenhar); } }

  caixa.appendChild(canvas);
  medir();
  renderer.render(cena, camara);
  caixa.classList.add('tem-3d');

  new ResizeObserver(() => { medir(); pedir(); }).observe(caixa);
  new IntersectionObserver(([e]) => { visivel = e.isIntersecting; if (visivel) pedir(); }).observe(caixa);
  addEventListener('scroll', () => { if (reduz.matches) return; alvoRot = -scrollY / 900; pedir(); }, { passive: true });
  if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
    addEventListener('pointermove', (ev) => { if (reduz.matches) return; alvoPx = (ev.clientX / innerWidth - 0.5) * 2; pedir(); }, { passive: true });
  }
  document.addEventListener('visibilitychange', () => { if (!document.hidden) pedir(); });
}

"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type ModeType   = "assembled" | "cutaway" | "stations" | "order";
type CameraType = "overview"  | "side"    | "top"      | "station" | "flight";

interface Props {
  locked?:  boolean;
  onReady?: (lock: () => void, unlock: () => void) => void;
}

export default function DioramaScene({ locked = false, onReady }: Props) {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = mountRef.current;
    if (!root) return;
    const cleanups: Array<() => void> = [];
    const TAU = Math.PI * 2;

    // ── RENDERER ──────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({
      antialias: true, alpha: true, powerPreference: "high-performance",
    });
    (renderer as any).toneMapping         = THREE.ACESFilmicToneMapping;
    (renderer as any).toneMappingExposure  = 1.6;   // ↑ was 1.1 — lebih terang tanpa blowout
    renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    renderer.setSize(root.clientWidth, root.clientHeight);
    renderer.shadowMap.enabled    = true;
    renderer.shadowMap.type       = THREE.PCFSoftShadowMap;
    renderer.localClippingEnabled = true;
    if ((renderer as any).outputColorSpace !== undefined)
      (renderer as any).outputColorSpace = THREE.SRGBColorSpace;
    root.appendChild(renderer.domElement);

    // ── SCENE & CAMERA ────────────────────────────────────────
    const scene   = new THREE.Scene();
    const camera  = new THREE.PerspectiveCamera(33, root.clientWidth / root.clientHeight, 0.1, 150);
    const viewDir = new THREE.Vector3(10.5, 10.8, 17).normalize();

    // ── FOG ───────────────────────────────────────────────────
    // Fog lebih tipis — cukup untuk depth, tidak menelan objek dekat
    scene.fog = new THREE.FogExp2(0x0d0b08, 0.0028);  // was 0x080604, 0.006

    // ── POST-PROCESSING ───────────────────────────────────────
    let composer:   any = null;
    let bloomPass:  any = null;

    const initPostProcessing = async () => {
      try {
        const [
          { EffectComposer },
          { RenderPass },
          { UnrealBloomPass },
          { ShaderPass },
          { RoomEnvironment },
        ] = await Promise.all([
          import("three/examples/jsm/postprocessing/EffectComposer.js"  as any),
          import("three/examples/jsm/postprocessing/RenderPass.js"      as any),
          import("three/examples/jsm/postprocessing/UnrealBloomPass.js" as any),
          import("three/examples/jsm/postprocessing/ShaderPass.js"      as any),
          import("three/examples/jsm/environments/RoomEnvironment.js"   as any),
        ]);

        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));

        // Bloom — lebih selektif, hanya emissive yang glow
        bloomPass = new UnrealBloomPass(
          new THREE.Vector2(root.clientWidth, root.clientHeight),
          0.45,   // strength  — was 0.6, kurangi agar tidak muddy
          0.28,   // radius    — was 0.35
          0.82,   // threshold — was 0.75, naikkan agar hanya emissive terang yang bloom
        );
        composer.addPass(bloomPass);

        // Color grading — lebih subtle, hindari shadow lift berlebihan
        const colorGradeShader = {
          uniforms: {
            tDiffuse:       { value: null },
            shadowColor:    { value: new THREE.Color(0.06, 0.055, 0.045) }, // was 0.04,0.03,0.02 — sedikit lebih terang
            highlightColor: { value: new THREE.Color(1.02, 0.95, 0.88) },   // was 1.05,0.92,0.75 — amber lebih lembut
            contrast:       { value: 1.03 },   // was 1.08 — hampir flat, biarkan ACES yang kerja
            saturation:     { value: 1.05 },   // was 0.9  — sedikit lebih vivid bukan desaturated
          },
          vertexShader: `
            varying vec2 vUv;
            void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
          `,
          fragmentShader: `
            uniform sampler2D tDiffuse;
            uniform vec3 shadowColor;
            uniform vec3 highlightColor;
            uniform float contrast;
            uniform float saturation;
            varying vec2 vUv;
            vec3 czm_saturation(vec3 rgb, float s) {
              vec3 gray = vec3(dot(rgb, vec3(0.2126,0.7152,0.0722)));
              return mix(gray, rgb, s);
            }
            void main() {
              vec4 c = texture2D(tDiffuse, vUv);
              c.rgb = (c.rgb - 0.5) * contrast + 0.5;
              c.rgb = czm_saturation(c.rgb, saturation);
              float luma = dot(c.rgb, vec3(0.299,0.587,0.114));
              // Shadow lift dikurangi — smoothstep range diperlebar agar transisi lebih halus
              c.rgb = mix(shadowColor, c.rgb, smoothstep(0.0, 0.18, luma));
              // Highlight tint lebih lembut
              c.rgb = mix(c.rgb, c.rgb * highlightColor, smoothstep(0.72, 1.0, luma));
              gl_FragColor = clamp(c, 0.0, 1.0);
            }
          `,
        };
        const gradePass = new ShaderPass(colorGradeShader);
        composer.addPass(gradePass);

        // Environment — naikkan kontribusi IBL secara signifikan
        const pmrem      = new THREE.PMREMGenerator(renderer);
        pmrem.compileEquirectangularShader();
        const envTexture = pmrem.fromScene(new RoomEnvironment()).texture;
        scene.environment          = envTexture;
        scene.environmentIntensity = 0.55;  // was 0.15 — IBL sekarang berkontribusi nyata
        pmrem.dispose();

      } catch (e) {
        console.warn("Post-processing unavailable:", e);
      }
    };
    initPostProcessing();

    // ── LIGHTS ────────────────────────────────────────────────
    // Ambient jauh lebih kuat — ini yang paling penting untuk mencegah shadow total
    scene.add(new THREE.AmbientLight(0x38342e, 4.5));  // was 0x222222, 2.8

    // Key light — sedikit lebih hangat, angle lebih tinggi
    const key = new THREE.DirectionalLight(0xfff8e8, 7.0);  // was 0xfff5e0, 5.5
    key.position.set(-5, 16, 6); key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -14, right: 14, top: 12, bottom: -12, near: 0.5, far: 40 });
    key.shadow.normalBias = 0.03;
    key.shadow.radius     = 2.0;    // shadow lebih soft
    (key.shadow as any).blurSamples = 6;
    scene.add(key);

    // Rim — biru lebih pekat untuk kontur
    const rim  = new THREE.DirectionalLight(0x9ec4f0, 2.8);  // was 0x8ab8e8, 1.8
    rim.position.set(9, 7, -13); scene.add(rim);

    // Fill — ubah dari negatif-ish ke fill yang proper dari bawah
    const fill = new THREE.DirectionalLight(0x443c30, 2.8);  // was 0x2a2a3a, 2.0
    fill.position.set(-2, -3, 8); scene.add(fill);

    // Bounce light dari lantai — simulasi indirect
    const bounce = new THREE.DirectionalLight(0x2a2218, 1.8);
    bounce.position.set(0, -8, 0); scene.add(bounce);

    // Amber glow — sedikit kurangi agar tidak overpower ambient baru
    const amberGlow = new THREE.PointLight(0xe8a020, 10, 16, 2);
    amberGlow.position.set(0, 6, 0); scene.add(amberGlow);

    // ── MATERIALS ─────────────────────────────────────────────
    // Semua base color dinaikkan — metal hitam pekat tidak ada di dunia nyata
    const mat = (color: number, metal = 0.1, rough = 0.4, extra: THREE.MeshStandardMaterialParameters = {}) =>
      new THREE.MeshStandardMaterial({ color, metalness: metal, roughness: rough, ...extra });
    const AMBER = new THREE.Color(0xe8a020);
    const M = {
      base:   mat(0x1a1816, 0.25, 0.85),   // was 0x0a0a0a
      body:   mat(0x222018, 0.72, 0.52),   // was 0x111111
      edge:   mat(0x3a3630, 0.88, 0.32),   // was 0x2a2a2a
      chrome: mat(0x9eb0c8, 0.95, 0.12),   // was 0x8a9ab0 — lebih reflektif
      dark:   mat(0x121008, 0.12, 0.82),   // was 0x060606
      rubber: mat(0x181410, 0.02, 0.92),   // was 0x0c0c0c
      blue:   mat(0xe8a020, 0.42, 0.42),
      copper: mat(0x4a3e28, 0.72, 0.38),   // was 0x3a3020 — sedikit lebih cerah
      light:  mat(0xe8a020, 0.3, 0.5, { emissive: AMBER, emissiveIntensity: 2.2 }),  // was 1.8
      panel:  mat(0x2a2620, 0.82, 0.38),   // was 0x1a1a1a
      paper:  mat(0xd8d4d0, 0.0,  0.88),
    };

    // ── GEO HELPERS ───────────────────────────────────────────
    const geoCache = new Map<string, THREE.BufferGeometry>();
    const boxG = (w: number, h: number, d: number) => { const k=`b${w},${h},${d}`; if(!geoCache.has(k)) geoCache.set(k,new THREE.BoxGeometry(w,h,d)); return geoCache.get(k)!; };
    const cylG = (r: number, h: number, seg=24, r2=r) => { const k=`c${r},${r2},${h},${seg}`; if(!geoCache.has(k)) geoCache.set(k,new THREE.CylinderGeometry(r,r2,h,seg)); return geoCache.get(k)!; };
    const addBox = (p: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, m: THREE.Material=M.body) => { const o=new THREE.Mesh(boxG(w,h,d),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; p.add(o); return o; };
    const addCyl = (p: THREE.Object3D, r: number, h: number, x: number, y: number, z: number, m: THREE.Material=M.chrome, r2=r, seg=24) => { const o=new THREE.Mesh(cylG(r,h,seg,r2),m); o.position.set(x,y,z); o.castShadow=true; o.receiveShadow=true; p.add(o); return o; };
    const addTube = (p: THREE.Object3D, pts: [number,number,number][], r: number, m: THREE.Material=M.chrome) => { const curve=new THREE.CatmullRomCurve3(pts.map(v=>new THREE.Vector3(...v))); const o=new THREE.Mesh(new THREE.TubeGeometry(curve,Math.max(12,pts.length*6),r,8,false),m); o.castShadow=true; p.add(o); return o; };

    // ── CANVAS TEXTURE ────────────────────────────────────────
    const canvasTex = (w: number, h: number, draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void) => {
      const c=document.createElement("canvas"); c.width=w; c.height=h;
      const ctx=c.getContext("2d")!; draw(ctx,w,h);
      return { tex: new THREE.CanvasTexture(c), ctx };
    };
    const print = (ctx: CanvasRenderingContext2D, txt: string, x: number, y: number, size=18, color="#e8ecf0", weight=500) => {
      ctx.fillStyle=color; ctx.font=`${weight} ${size}px system-ui,-apple-system,sans-serif`; ctx.fillText(txt,x,y);
    };
    const addScreen = (p: THREE.Object3D, w: number, h: number, x: number, y: number, z: number, tex: THREE.Texture) => {
      const o=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:tex,toneMapped:false}));
      o.position.set(x,y,z); p.add(o); return o;
    };

    // ── CLIPPING ──────────────────────────────────────────────
    const cutPlane = new THREE.Plane(new THREE.Vector3(0,-1,0),10);
    const shell = <T extends THREE.Material>(m: T): T => { const s=m.clone() as T; s.clippingPlanes=[cutPlane]; s.clipShadows=true; s.side=THREE.DoubleSide; return s; };
    const S = { body: shell(M.body), blue: shell(M.blue), edge: shell(M.edge) };

    // ── MACHINE ───────────────────────────────────────────────
    const machine = new THREE.Group(); scene.add(machine);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80,80), new THREE.ShadowMaterial({opacity:0.22}));
    floor.rotation.x=-Math.PI/2; floor.position.y=-0.44; floor.receiveShadow=true; scene.add(floor);

    addBox(machine,13.2,0.38, 8.6,  0,-0.09,0,M.base);
    addBox(machine,13.0,0.055,8.4,  0, 0.13,0,M.edge);
    addBox(machine,12.9,0.09, 8.25, 0, 0.19,0,M.body);
    addBox(machine,12.95,0.027,8.32,0,-0.19,0,M.dark);

    for (const z of [-2.8,-0.9,0.9,2.8]) addBox(machine,13.0,0.008,0.04,0,0.205,z,M.panel);
    for (const x of [-4.3,-1.4,1.4,4.3]) addBox(machine,0.04,0.008,8.2,x,0.205,0,M.panel);

    addBox(machine,12.3,0.026,0.032,0,-0.17, 4.31,M.light);
    addBox(machine,12.3,0.026,0.032,0,-0.17,-4.31,M.light);
    addBox(machine,0.032,0.026,8.6, 6.6,-0.17,0,M.light);
    addBox(machine,0.032,0.026,8.6,-6.6,-0.17,0,M.light);

    for (const x of [-5.8,5.8]) for (const z of [-3.55,3.55]) {
      addCyl(machine,0.39,0.25,x,-0.31,z,M.rubber);
      addCyl(machine,0.28,0.09,x,-0.41,z,M.dark);
      addCyl(machine,0.055,0.026,x,0.253,z,M.chrome,undefined,12);
      addBox(machine,0.068,0.005,0.009,x,0.267,z,M.dark);
    }

    const engTex = canvasTex(1536,168,(c,w,h)=>{
      c.fillStyle="#0d0b07"; c.fillRect(0,0,w,h);
      c.strokeStyle="#2e2820"; c.lineWidth=2; c.strokeRect(2,2,w-4,h-4);
      c.fillStyle="#e8a020"; c.fillRect(0,0,w,1);
      print(c,"ML PIPELINE",44,75,38,"#c8c0b0",650);
      print(c,"·  ingest  ·  preprocess  ·  train  ·  evaluate  ·  explain  ·  deploy",295,75,30,"#6a6058",450);
      print(c,"DATA MINING FACTORY    /    FROM RAW DATA TO EXPLAINABLE AI",45,128,18,"#3e3830",500);
    });
    const ePlate = addScreen(machine,7.5,0.82,-0.4,0.25,3.64,engTex.tex); ePlate.rotation.x=-Math.PI/2;

    // ── GEARS ─────────────────────────────────────────────────
    const gears: Array<{g:THREE.Group;vertical:boolean}> = [];
    const addGear = (p: THREE.Object3D, x:number, y:number, z:number, r=0.3, vertical=false) => {
      const g=new THREE.Group(); g.position.set(x,y,z); if(vertical) g.rotation.x=Math.PI/2; p.add(g);
      addCyl(g,r,0.09,0,0,0,M.copper); addCyl(g,r*0.65,0.106,0,0,0,M.dark); addCyl(g,r*0.22,0.14,0,0,0,M.chrome);
      for(let i=0;i<12;i++){const a=(i/12)*TAU; const b=addBox(g,r*0.25,0.085,r*0.2,Math.cos(a)*r,0,Math.sin(a)*r,M.copper); b.rotation.y=-a;}
      g.userData.moving=true; gears.push({g,vertical}); return g;
    };

    // ── STATIONS ──────────────────────────────────────────────
    const defs = [
      {id:"ingest",    name:"Data Ingest",   step:1,output:"raw data",     pos:[-4.4,0.29,-0.8]  as [number,number,number],desc:"Collects raw data from CSV, databases, and APIs."},
      {id:"preprocess",name:"Preprocessing", step:2,output:"clean data",   pos:[-1.7,0.29,-2.1]  as [number,number,number],desc:"Cleans, normalizes, and encodes features."},
      {id:"train",     name:"Model Training",step:3,output:"trained model",pos:[ 1.5,0.29,-2.15] as [number,number,number],desc:"Trains XGBoost, ensemble, and deep learning models."},
      {id:"evaluate",  name:"Evaluation",    step:4,output:"metrics",      pos:[ 4.2,0.29, 0.1]  as [number,number,number],desc:"Computes accuracy, F1, AUC-ROC, and confusion matrix."},
      {id:"explain",   name:"Explainability",step:5,output:"SHAP values",  pos:[ 1.0,0.29, 2.0]  as [number,number,number],desc:"Generates SHAP feature importance and LIME explanations."},
      {id:"deploy",    name:"Deployment",    step:6,output:"prediction",   pos:[-3.5,0.29, 2.0]  as [number,number,number],desc:"Serves the model via REST API with drift monitoring."},
    ];

    type StationEntry = typeof defs[0] & {
      group:      THREE.Group;
      base:       THREE.Vector3;
      glowMat:    THREE.MeshStandardMaterial;
      pointLight: THREE.PointLight;
      index:      number;
      anchor:     THREE.Vector3;
    };
    const stations: StationEntry[] = [];

    defs.forEach((d,i)=>{
      const g=new THREE.Group(); g.position.fromArray(d.pos); machine.add(g);
      const glowMat=M.light.clone() as THREE.MeshStandardMaterial; glowMat.emissiveIntensity=1.0;  // was 0.8

      addBox(g,2.1,0.12,1.82,0,0.03,0,M.dark);
      addBox(g,2.02,0.03,1.74,0,0.12,0,glowMat);
      addBox(g,2.08,0.17,1.78,0,0.215,0,M.body);

      addBox(g,2.06,0.006,0.02,0,0.22, 0.6,M.panel);
      addBox(g,2.06,0.006,0.02,0,0.22,-0.6,M.panel);
      addBox(g,0.02,0.006,1.76,0.7,0.22,0,M.panel);
      addBox(g,0.02,0.006,1.76,-0.7,0.22,0,M.panel);

      for(const cx of [-0.9,0.9]) for(const cz of [-0.8,0.8])
        addBox(g,0.04,0.04,0.04,cx,0.22,cz,M.light);

      for(const x of [-0.88,0.88]) for(const z of [-0.72,0.72]){
        addCyl(g,0.055,0.026,x,0.311,z,M.chrome,undefined,12);
        addBox(g,0.068,0.005,0.009,x,0.325,z,M.dark);
      }
      addGear(g,-0.38,0.45,0,0.26); addGear(g,0.23,0.45,0.1,0.2);
      addBox(g,0.62,0.14,0.38,0.5,0.47,-0.35,M.dark);
      for(let j=0;j<5;j++) addBox(g,0.026,0.15,0.38,0.3+j*0.08,0.47,-0.35,M.edge);
      addTube(g,[[-0.72,0.4,-0.42],[-0.56,0.48,0.38],[0.34,0.44,0.62],[0.7,0.57,0.24]],0.022,M.light);

      const plaqueTex=canvasTex(512,112,(c,w,h)=>{
        c.fillStyle="#0d0b07"; c.fillRect(0,0,w,h);
        c.fillStyle="#e8a020"; c.fillRect(0,0,w,2);
        print(c,String(i+1).padStart(2,"0"),22,73,40,"#e8a020",550);
        print(c,d.name.toUpperCase(),108,70,33,"#c8c4b8",550);
      });
      addScreen(g,1.56,0.33,0,0.27,0.895,plaqueTex.tex);

      // Per-station point light lebih kuat — tiap station "breathing" dengan cahayanya sendiri
      const pl=new THREE.PointLight(0xe8a020,0,4,2);  // radius was 3
      pl.position.set(d.pos[0],d.pos[1]+1.5,d.pos[2]);
      machine.add(pl);

      stations.push({...d,group:g,base:new THREE.Vector3(...d.pos),glowMat,pointLight:pl,index:i,anchor:new THREE.Vector3(0,2.5,0)});
    });

    // ── STATION SPECIFIC ──────────────────────────────────────
    const ingest=stations[0].group;
    addBox(ingest,1.8,0.66,1.36,0,0.65,-0.05,S.body);
    for(let v=0;v<4;v++) addBox(ingest,0.08,0.02,0.5,-0.5+v*0.28,0.65,0.6,M.dark);
    for(const[x,col] of [[-0.55,0x2a3a48],[0,0x3a5060],[0.55,0x202e3a]] as [number,number][]){
      addCyl(ingest,0.18,0.45+Math.abs(x)*0.3,x,0.55,-0.22,mat(col,0.7,0.4));
      addCyl(ingest,0.18,0.04,x,0.78+Math.abs(x)*0.15,-0.22,M.chrome);
    }
    const incomingData=new THREE.Group(); incomingData.userData.moving=true; ingest.add(incomingData);
    addBox(incomingData,0.9,0.44,0.044,0,0,0,M.light);
    const inTex=canvasTex(440,212,(c,w,h)=>{
      c.fillStyle="#0d0a04"; c.fillRect(0,0,w,h);
      print(c,"RAW DATA",25,52,28,"#e8a020",600);
      print(c,"INGEST  →",24,105,22,"#6090c0",500);
      c.fillStyle="#3a2a08"; c.fillRect(24,130,392,5);
      c.fillStyle="#e8a020"; c.fillRect(24,130,180,5);
    });
    addScreen(incomingData,0.86,0.41,0,0,0.026,inTex.tex);

    const preproc=stations[1].group;
    addBox(preproc,1.95,0.64,1.38,0,0.67,-0.04,S.body);
    for(let v=0;v<5;v++) addBox(preproc,0.06,0.016,0.45,-0.54+v*0.27,0.67,0.62,M.dark);
    const ppTex=canvasTex(640,340,()=>{});
    const drawPreproc=(t:number)=>{
      const c=ppTex.ctx;
      c.fillStyle="#0a0905"; c.fillRect(0,0,640,340);
      print(c,"PREPROCESSING",25,42,20,"#a09080",550); print(c,"null: 0%",480,42,18,"#e8a020",500);
      ["age","income","class","score","rank"].forEach((l,i)=>{
        const y=66+i*50, barW=((t*0.11+i*0.17)%1)*380;
        c.fillStyle="#1a1508"; c.fillRect(20,y,600,36);
        c.fillStyle="#3a2a10"; c.fillRect(110,y+8,barW,20);
        c.fillStyle="#e8a020"; c.fillRect(110,y+8,Math.min(barW,120),20);
        print(c,l,25,y+23,16,"#806050");
        print(c,`${Math.floor(60+((t*0.08+i*0.3)%1)*40)}%`,490,y+23,16,"#c08040");
      });
      ppTex.tex.needsUpdate=true;
    };
    drawPreproc(0);
    const ppScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.45,0.78),new THREE.MeshBasicMaterial({map:ppTex.tex,toneMapped:false}));
    ppScreen.position.set(0,0.28,0.86); ppScreen.rotation.x=-0.28; preproc.add(ppScreen);

    const train=stations[2].group;
    addBox(train,1.78,0.64,1.36,0,0.67,-0.05,S.body);
    addCyl(train,0.2,0.09,0,0.45,0.38,mat(0xe8a020,0.4,0.25,{emissive:AMBER,emissiveIntensity:2.5}),undefined,32);  // was 2.0
    for(const x of [-0.28,-0.14,0,0.14,0.28]) addBox(train,0.056,0.38,0.036,x,0.43,-0.37,M.edge);
    addBox(train,0.44,0.036,0.08,0,0.72,0,M.light);
    const reels:THREE.Group[]=[];
    for(const[rx,ry] of [[-1.05,1.84],[-0.96,2.82]] as [number,number][]){
      const reel=new THREE.Group(); reel.position.set(rx,ry,-0.5); train.add(reel); reel.userData.moving=true;
      const core=addCyl(reel,0.38,0.22,0,0,0,M.dark); core.rotation.x=Math.PI/2;
      for(const z of [-0.13,0.13]){const disc=addCyl(reel,0.44,0.045,0,0,z,M.chrome); disc.rotation.x=Math.PI/2;}
      addCyl(reel,0.09,0.36,0,0,0,M.blue).rotation.x=Math.PI/2;
      reels.push(reel);
    }
    const trainTex=canvasTex(384,640,()=>{});
    const drawTrain=(t:number)=>{
      const c=trainTex.ctx, ep=Math.min(1,(t%12)/8);
      c.fillStyle="#1a1208"; c.fillRect(0,0,384,640);
      c.fillStyle="#2a1e0a"; c.beginPath(); c.arc(290,180,200,0,TAU); c.fill();
      c.strokeStyle="#e8a020"; c.lineWidth=8;
      for(let i=0;i<3;i++){
        c.globalAlpha=0.4-i*0.1;
        c.beginPath(); c.ellipse(192,270,85-i*20,105,Math.sin(t*0.22)*0.3+0.4,0,TAU); c.stroke();
      }
      c.globalAlpha=1;
      print(c,"XGBoost",28,54,24,"#e8a020",650); print(c,"Training",24,100,40,"#c09050",700);
      c.fillStyle="#100e08"; c.fillRect(24,460,336,130);
      print(c,`Epoch ${Math.floor((t*3)%50)+1}/50`,44,500,23,"#a08040",550);
      print(c,`Loss: ${(0.32-ep*0.28).toFixed(4)}`,44,540,22,"#a08040",500);
      c.fillStyle="#3a2a08"; c.fillRect(27,580,330,6);
      c.fillStyle="#e8a020"; c.fillRect(27,580,Math.max(8,ep*330),6);
      trainTex.tex.needsUpdate=true;
    };
    drawTrain(0);
    const outTrain=new THREE.Group(); outTrain.userData.moving=true; train.add(outTrain);
    addBox(outTrain,0.62,1.06,0.055,0,1.36,0.62,M.dark);
    addScreen(outTrain,0.56,0.98,0,1.36,0.642,trainTex.tex);

    const evalSt=stations[3].group;
    addBox(evalSt,1.9,0.63,1.36,0,0.67,-0.04,S.body);
    const evalTex=canvasTex(640,380,()=>{});

    let flickerTimer = 0;
    let flickerActive = false;
    let flickerTarget = -1;

    const drawEval=(t:number)=>{
      const c=evalTex.ctx;
      c.fillStyle="#080706"; c.fillRect(0,0,640,380);
      print(c,"EVALUATION",24,38,20,"#a09070",550);
      const metrics:[string,string,number][]=[["Accuracy","#e8a020",92],["Precision","#06b6d4",89],["Recall","#10b981",87],["F1-Score","#8b5cf6",90]];
      metrics.forEach(([l,clr,base],i)=>{
        const y=60+i*72, val=base+Math.sin(t*0.4+i)*0.8, bw=(val/100)*420;
        c.fillStyle="#141008"; c.fillRect(20,y,600,50);
        c.fillStyle=clr+"30"; c.fillRect(130,y+8,bw,34);
        c.fillStyle=clr; c.fillRect(130,y+8,Math.min(bw,80),34);
        print(c,l,25,y+31,17,"#706050"); print(c,val.toFixed(1)+"%",555,y+31,17,clr,600);
      });
      evalTex.tex.needsUpdate=true;
    };
    drawEval(0);
    const evalScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.5,0.88),new THREE.MeshBasicMaterial({map:evalTex.tex,toneMapped:false}));
    evalScreen.position.set(0,0.36,0.86); evalScreen.rotation.x=-0.28; evalSt.add(evalScreen);

    const explain=stations[4].group;
    addBox(explain,0.88,0.62,0.09,0,0.56,0,mat(0x0e0c08,0.5,0.6));
    const shapTex=canvasTex(720,440,()=>{});
    const drawShap=(t:number)=>{
      const c=shapTex.ctx;
      c.fillStyle="#080706"; c.fillRect(0,0,720,440);
      print(c,"SHAP FEATURE IMPORTANCE",24,36,19,"#a09070",550);
      const feats:[string,string,number][]=[["dropout_risk","#ef4444",0.82],["gpa_trend","#e8a020",0.71],["attendance","#10b981",0.65],["assignments","#f59e0b",0.58],["social_act","#8b5cf6",0.44]];
      feats.forEach(([l,clr,v],i)=>{
        const y=58+i*70, anim=v*380*Math.min(1,(t%8)/3);
        c.fillStyle="#141008"; c.fillRect(18,y,684,52);
        c.fillStyle=clr+"25"; c.fillRect(180,y+8,anim,36);
        c.fillStyle=clr; c.fillRect(180,y+8,anim*0.22,36);
        print(c,l,22,y+32,16,"#706050"); print(c,v.toFixed(2),590,y+32,17,clr,600);
      });
      shapTex.tex.needsUpdate=true;
    };
    drawShap(0);
    const explainScreen=new THREE.Mesh(new THREE.PlaneGeometry(0.78,0.48),new THREE.MeshBasicMaterial({map:shapTex.tex,toneMapped:false}));
    explainScreen.position.set(0,0.56,0.052); explain.add(explainScreen);
    addCyl(explain,0.12,0.045,0,0.24,0.38,mat(0x06b6d4,0.4,0.25,{emissive:new THREE.Color(0x06b6d4),emissiveIntensity:1.8}),undefined,32);  // was 1.5

    const deploy=stations[5].group;
    addBox(deploy,1.78,0.64,1.36,0,0.67,-0.04,S.body);
    for(let v=0;v<3;v++) addBox(deploy,0.06,0.016,0.5,-0.3+v*0.3,0.67,0.62,M.dark);
    for(const[x,col] of [[-0.35,0x1c1c1c],[0,0x222222],[0.35,0x181818]] as [number,number][]){
      addCyl(deploy,0.16,0.4,x,0.56,-0.22,mat(col,0.8,0.3));
      addCyl(deploy,0.16,0.036,x,0.77,-0.22,M.chrome);
      addBox(deploy,0.1,0.026,0.016,x,0.49,-0.07,M.light);
    }
    const deployTex=canvasTex(512,180,(c,w,h)=>{
      c.fillStyle="#080706"; c.fillRect(0,0,w,h);
      print(c,"API LIVE",22,44,24,"#70c090",500); print(c,"/predict",22,128,60,"#c8c0b0",500);
      c.fillStyle="#0f1a10"; c.fillRect(338,88,156,32); print(c,"200 OK",345,110,18,"#10b981",600);
    });
    const deployScreen=new THREE.Mesh(new THREE.PlaneGeometry(1.52,0.34),new THREE.MeshBasicMaterial({map:deployTex.tex,toneMapped:false}));
    deployScreen.position.set(0,0.27,0.88); deploy.add(deployScreen);

    // ── CONVEYOR BELT ─────────────────────────────────────────
    const beltPath=new THREE.CatmullRomCurve3([
      [-3.9,0.85,0.65],[-3.1,0.85,-0.15],[-1.55,0.85,-0.83],[1.3,0.85,-0.84],
      [3.4,0.85,0.18],[3.5,0.85,1.2],[1.3,0.85,2.75],[-1.35,0.85,2.58],[-3.6,0.85,1.7],
    ].map(p=>new THREE.Vector3(...p)),true,"catmullrom",0.25);
    const beltGroup=new THREE.Group(); machine.add(beltGroup);
    const frameMesh=new THREE.Mesh(new THREE.TubeGeometry(beltPath,160,0.34,8,true),M.dark);
    frameMesh.scale.y=0.3; frameMesh.position.y=0.5; beltGroup.add(frameMesh);
    const beltCount=150;
    const beltSlats=new THREE.InstancedMesh(boxG(0.13,0.065,0.64),M.body,beltCount);
    beltSlats.receiveShadow=true; beltGroup.add(beltSlats);
    beltSlats.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const dummy=new THREE.Object3D(), pVec=new THREE.Vector3(), tVec=new THREE.Vector3();
    const updateBelt=(t:number)=>{
      for(let i=0;i<beltCount;i++){
        const u=(i/beltCount+t*0.011)%1;
        beltPath.getPointAt(u,pVec); beltPath.getTangentAt(u,tVec);
        dummy.position.copy(pVec); dummy.rotation.set(0,-Math.atan2(tVec.z,tVec.x),0);
        dummy.updateMatrix(); beltSlats.setMatrixAt(i,dummy.matrix);
      }
      beltSlats.instanceMatrix.needsUpdate=true;
    };
    updateBelt(0);
    for(const side of [-1,1]){
      const rpts:THREE.Vector3[]=[];
      for(let i=0;i<=160;i++){
        beltPath.getPointAt(i/160,pVec); beltPath.getTangentAt(i/160,tVec);
        rpts.push(pVec.clone().add(new THREE.Vector3(-tVec.z*0.37*side,0.09,tVec.x*0.37*side)));
      }
      beltGroup.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(rpts),160,0.027,6,false),M.chrome));
    }
    for(let i=0;i<16;i++){const p=beltPath.getPointAt(i/16); addCyl(beltGroup,0.044,0.44,p.x,0.52,p.z,M.chrome);}

    // ── SPARK PARTICLES ───────────────────────────────────────
    const SPARK_COUNT = 120;
    const sparkGeo = new THREE.BufferGeometry();
    const sparkPos = new Float32Array(SPARK_COUNT * 3);
    const sparkLife= new Float32Array(SPARK_COUNT);
    const sparkVel = new Float32Array(SPARK_COUNT * 3);
    const sparkStation = new Int32Array(SPARK_COUNT);
    sparkGeo.setAttribute("position", new THREE.BufferAttribute(sparkPos, 3));
    for(let i=0;i<SPARK_COUNT;i++){ sparkLife[i]=0; sparkPos[i*3+1]=999; }
    sparkGeo.attributes.position.needsUpdate=true;
    const sparkMat = new THREE.PointsMaterial({
      color: 0xe8a020, size: 0.07, transparent: true, opacity: 0.95,
      blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
    });
    const sparkMesh = new THREE.Points(sparkGeo, sparkMat);
    scene.add(sparkMesh);

    let sparkTimer = 0;
    const updateSparks = (dt: number, t: number) => {
      sparkTimer += dt;
      const posAttr = sparkGeo.attributes.position as THREE.BufferAttribute;
      if (sparkTimer > 0.08) {
        sparkTimer = 0;
        const activeIdx = stations.findIndex(s => s.id === selected);
        if (activeIdx >= 0) {
          for (let k = 0; k < 4; k++) {
            let slot = -1;
            for (let i = 0; i < SPARK_COUNT; i++) { if (sparkLife[i] <= 0) { slot = i; break; } }
            if (slot < 0) break;
            const s = stations[activeIdx];
            const sp = s.group.position;
            sparkPos[slot*3+0] = sp.x + (Math.random()-0.5)*1.2;
            sparkPos[slot*3+1] = sp.y + 0.4 + Math.random()*0.3;
            sparkPos[slot*3+2] = sp.z + (Math.random()-0.5)*1.2;
            sparkVel[slot*3+0] = (Math.random()-0.5)*0.8;
            sparkVel[slot*3+1] = 0.5 + Math.random()*1.2;
            sparkVel[slot*3+2] = (Math.random()-0.5)*0.8;
            sparkLife[slot]    = 0.6 + Math.random()*0.4;
            sparkStation[slot] = activeIdx;
          }
        }
      }
      for (let i = 0; i < SPARK_COUNT; i++) {
        if (sparkLife[i] <= 0) { sparkPos[i*3+1] = 999; continue; }
        sparkLife[i] -= dt;
        sparkPos[i*3+0] += sparkVel[i*3+0] * dt;
        sparkPos[i*3+1] += sparkVel[i*3+1] * dt;
        sparkPos[i*3+2] += sparkVel[i*3+2] * dt;
        sparkVel[i*3+1] -= 2.5 * dt;
        if (sparkLife[i] <= 0) sparkPos[i*3+1] = 999;
      }
      posAttr.needsUpdate = true;
      sparkMat.opacity = 0.9;
    };

    // ── PACKETS ───────────────────────────────────────────────
    const packetTextures=[inTex.tex,ppTex.tex,trainTex.tex,evalTex.tex,shapTex.tex,deployTex.tex];
    const nearestPort=(x:number,z:number)=>{let best=0,dist=Infinity; for(let i=0;i<300;i++){const p=beltPath.getPointAt(i/300),d=(p.x-x)**2+(p.z-z)**2; if(d<dist){dist=d;best=i/300;}} return best;};
    const adminU=nearestPort(-1.7,-0.8), storeU=nearestPort(1.5,-0.8), cashU=nearestPort(-3.5,2.0);
    const packets:Array<{group:THREE.Group;faces:THREE.Mesh[];halo:THREE.Mesh;stage:number;phase:number}>=[];
    for(let i=0;i<6;i++){
      const g=new THREE.Group(); g.userData.moving=true; machine.add(g);
      addBox(g,0.48,0.72,0.044,0,0,0,M.paper);
      const faces=packetTextures.map(tex=>{const s=new THREE.Mesh(new THREE.PlaneGeometry(0.44,0.67),new THREE.MeshBasicMaterial({map:tex,toneMapped:false,side:THREE.DoubleSide})); s.position.set(0,0,0.025); s.visible=false; g.add(s); return s;});
      const halo=new THREE.Mesh(new THREE.RingGeometry(0.4,0.414,40),new THREE.MeshBasicMaterial({color:0xe8a020,transparent:true,opacity:0.8,side:THREE.DoubleSide,depthWrite:false}));
      halo.rotation.x=-Math.PI/2; halo.position.y=-0.38; g.add(halo); halo.visible=false;
      packets.push({group:g,faces,halo,stage:-1,phase:0});
    }

    // ── UI OVERLAY ────────────────────────────────────────────
    const ui=document.createElement("div");
    ui.style.cssText="position:absolute;inset:0;pointer-events:none;font-family:system-ui,-apple-system,sans-serif;color:#e8ecf0;-webkit-font-smoothing:antialiased;";
    root.appendChild(ui); cleanups.push(()=>ui.remove());

    const vignette=document.createElement("div");
    // Vignette lebih lembut — was rgba(8,6,4,.72) di edge
    vignette.style.cssText="position:absolute;inset:0;background:radial-gradient(ellipse at 50% 46%,transparent 32%,rgba(8,6,4,.10) 65%,rgba(8,6,4,.52) 100%);pointer-events:none;";
    ui.appendChild(vignette);

    const tooltip=document.createElement("div");
    tooltip.style.cssText="position:absolute;pointer-events:none;opacity:0;transition:opacity .15s;padding:10px 13px;border:1px solid #e8a02020;background:rgba(12,10,6,0.92);backdrop-filter:blur(12px);border-radius:7px;max-width:230px;font-size:11px;";
    ui.appendChild(tooltip);
    const tooltipTitle=document.createElement("strong"); tooltipTitle.style.cssText="display:block;font-size:11px;font-weight:550;margin-bottom:5px;";
    const tooltipDesc=document.createElement("p"); tooltipDesc.style.cssText="font-size:10px;color:#9ca3af;line-height:1.5;margin:0;";
    tooltip.appendChild(tooltipTitle); tooltip.appendChild(tooltipDesc);

    const journey=document.createElement("div");
    journey.style.cssText="position:absolute;left:20%;right:20%;top:12px;opacity:0;transition:.35s;display:flex;align-items:center;gap:10px;font-size:11px;";
    const journeyTitle=document.createElement("strong"); journeyTitle.textContent="Collecting data";
    const journeyDetail=document.createElement("small"); journeyDetail.style.cssText="display:block;font-size:9px;color:#6b7280;margin-top:2px;";
    const journeyInfo=document.createElement("div"); journeyInfo.appendChild(journeyTitle); journeyInfo.appendChild(journeyDetail);
    const journeyTrack=document.createElement("div"); journeyTrack.style.cssText="height:2px;background:#1a1408;flex:1;";
    const journeyBar=document.createElement("i"); journeyBar.style.cssText="display:block;height:100%;background:#e8a020;width:0;";
    journeyTrack.appendChild(journeyBar); journey.appendChild(journeyInfo); journey.appendChild(journeyTrack);
    ui.appendChild(journey);

    const labelEls:HTMLDivElement[]=[];
    stations.forEach((s)=>{
      const el=document.createElement("div");
      el.style.cssText="position:absolute;left:0;top:0;opacity:0;transition:opacity .3s;pointer-events:none;min-width:120px;";
      el.innerHTML=`<div style="height:20px;width:1px;background:linear-gradient(#e8a02000,#e8a02060);margin:0 0 0 8px;"></div><div style="background:rgba(12,10,6,0.92);backdrop-filter:blur(10px);border:1px solid #e8a02030;border-radius:6px;padding:8px 11px;"><div style="font-weight:550;font-size:11px;display:flex;gap:8px;align-items:center;white-space:nowrap;"><span style="color:#e8a020;font:9px ui-monospace,monospace;">${String(s.index+1).padStart(2,"0")}</span>${s.name}</div><div style="font-size:9px;color:#6b7280;margin:4px 0 0 20px;white-space:nowrap;">Step ${s.step} · ${s.output}</div></div>`;
      ui.appendChild(el); labelEls.push(el); cleanups.push(()=>el.remove());
    });

    const controls=document.createElement("div");
    controls.style.cssText="position:absolute;bottom:14px;left:0;right:0;display:flex;flex-direction:column;align-items:center;gap:10px;pointer-events:auto;";
    ui.style.pointerEvents="none";

    const modeBar=document.createElement("nav");
    modeBar.style.cssText="display:flex;gap:2px;padding:4px;border:1px solid #e8a02018;border-radius:11px;background:rgba(10,8,4,.92);backdrop-filter:blur(16px);box-shadow:0 6px 24px #0006;";
    const modes:[ModeType,string][]=[["assembled","Assembled"],["cutaway","Cutaway"],["stations","Stations"],["order","One sample"]];
    const modeBtns:Record<string,HTMLButtonElement>={};
    modes.forEach(([id,label])=>{
      const b=document.createElement("button"); b.textContent=label;
      b.style.cssText="border:none;background:none;color:#6b6050;padding:9px 13px;font-size:11px;font-weight:500;border-radius:7px;cursor:pointer;white-space:nowrap;transition:background .18s,color .18s;font-family:inherit;";
      b.addEventListener("mouseenter",()=>{if(mode!==id)b.style.background="#e8a02010";});
      b.addEventListener("mouseleave",()=>{if(mode!==id)b.style.background="none";});
      modeBar.appendChild(b); modeBtns[id]=b;
    });
    controls.appendChild(modeBar);

    const camRow=document.createElement("nav"); camRow.style.cssText="display:flex;align-items:center;gap:3px;";
    const cap=document.createElement("span"); cap.textContent="VIEW"; cap.style.cssText="font-size:9px;letter-spacing:1.3px;color:#3a3028;margin-right:8px;";
    camRow.appendChild(cap);
    const cams:[CameraType,string][]=[["overview","Overview"],["side","Side"],["top","Top"],["station","Station"],["flight","Flight"]];
    const camBtns:Record<string,HTMLButtonElement>={};
    cams.forEach(([id,label])=>{
      const b=document.createElement("button"); b.textContent=label;
      b.style.cssText="border:none;background:none;color:#4a4038;padding:5px 8px;font-size:10px;cursor:pointer;transition:color .18s;font-family:inherit;border-radius:4px;";
      b.addEventListener("mouseenter",()=>{if(cameraMode!==id)b.style.color="#c0a060";});
      b.addEventListener("mouseleave",()=>{if(cameraMode!==id)b.style.color="#4a4038";});
      camRow.appendChild(b); camBtns[id]=b;
    });
    const divider=document.createElement("span"); divider.style.cssText="width:1px;height:12px;background:rgba(232,160,32,.12);margin:0 6px;"; camRow.appendChild(divider);
    const playBtn=document.createElement("button");
    playBtn.style.cssText="border:none;background:none;color:#6b6050;width:24px;height:24px;display:grid;place-items:center;cursor:pointer;font-family:inherit;border-radius:4px;";
    camRow.appendChild(playBtn); controls.appendChild(camRow); ui.appendChild(controls);

    const syncButtons=()=>{
      Object.entries(modeBtns).forEach(([id,b])=>{const active=id===mode; b.style.background=active?"#e8a020":"none"; b.style.color=active?"#0a0804":"#6b6050";});
      Object.entries(camBtns).forEach(([id,b])=>{b.style.color=id===cameraMode?"#e8c070":"#4a4038";});
      journey.style.opacity=mode==="order"?"1":"0";
      playBtn.innerHTML=playing
        ?`<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><rect x="2" y="1" width="2.5" height="10" rx=".5"/><rect x="7.5" y="1" width="2.5" height="10" rx=".5"/></svg>`
        :`<svg width="11" height="11" viewBox="0 0 12 12" fill="currentColor"><path d="M3 1l8 5-8 5z"/></svg>`;
    };

    // ── STATE ─────────────────────────────────────────────────
    let mode:ModeType="stations", cameraMode:CameraType="side";
    let playing=true, spread=0, selected="ingest";
    let hovered:string|null=null, lastInteraction=0, flightTime=0, cameraAnimating=true;
    let sTheta=-0.4, sPhi=1.1, sRadius=28;
    const orbitTarget=new THREE.Vector3(0,1,0);
    const desiredPos=new THREE.Vector3(), desiredTgt=new THREE.Vector3(0,1,0);

    const updateCamera=()=>{
      camera.position.set(
        orbitTarget.x+sRadius*Math.sin(sPhi)*Math.sin(sTheta),
        orbitTarget.y+sRadius*Math.cos(sPhi),
        orbitTarget.z+sRadius*Math.sin(sPhi)*Math.cos(sTheta),
      );
      camera.lookAt(orbitTarget);
    };
    const setCameraGoal=()=>{
      const expand=mode==="stations"?1.2:1;
      if(cameraMode==="station"){
        const s=stations.find(s=>s.id===selected)!;
        desiredTgt.copy(s.group.position).add(new THREE.Vector3(0,1.25,0));
        desiredPos.copy(desiredTgt).addScaledVector(viewDir,12);
      } else {
        desiredTgt.set(0,1,0);
        const d=28*expand;
        if(cameraMode==="side") desiredPos.set(13,5,20).normalize().multiplyScalar(d * 0.5).add(desiredTgt);
        else if(cameraMode==="top") desiredPos.set(0.01,d,0.8).add(desiredTgt);
        else desiredPos.copy(viewDir).multiplyScalar(d).add(desiredTgt);
      }
      const rel=desiredPos.clone().sub(desiredTgt);
      sTheta=Math.atan2(rel.x,rel.z);
      sPhi=Math.acos(Math.max(-1,Math.min(1,rel.y/rel.length())));
      sRadius=rel.length();
    };
    const setMode=(m:ModeType)=>{mode=m;lastInteraction=performance.now();if(mode==="order"){playing=true;cameraMode="overview";}else if(cameraMode==="station")cameraMode="overview"; setCameraGoal();cameraAnimating=true;syncButtons();};
    const focusStation=(id:string)=>{selected=id;if(mode==="order")mode="assembled";cameraMode="station";lastInteraction=performance.now();setCameraGoal();cameraAnimating=true;syncButtons();};
    const setCamera=(c:CameraType)=>{cameraMode=c;if(mode==="order")mode="assembled";lastInteraction=performance.now();flightTime=0;setCameraGoal();cameraAnimating=true;syncButtons();};

    // ── LOCK / UNLOCK ─────────────────────────────────────────
    const lockScene=()=>{cameraMode="station";selected="ingest";setCameraGoal();cameraAnimating=true;controls.style.opacity="0";controls.style.pointerEvents="none";syncButtons();};
    const unlockScene=()=>{cameraMode="overview";setCameraGoal();cameraAnimating=true;controls.style.opacity="1";controls.style.pointerEvents="auto";syncButtons();};
    if(locked) lockScene();
    if(onReady) onReady(lockScene,unlockScene);

    Object.entries(modeBtns).forEach(([id,b])=>b.addEventListener("click",()=>{if(controls.style.pointerEvents==="none")return;setMode(id as ModeType);}));
    Object.entries(camBtns).forEach(([id,b])=>b.addEventListener("click",()=>setCamera(id as CameraType)));
    playBtn.addEventListener("click",()=>{playing=!playing;syncButtons();});
    setCameraGoal(); syncButtons(); updateCamera();

    // ── PICKING ───────────────────────────────────────────────
    stations.forEach(s=>s.group.traverse(o=>(o.userData.station=s.id)));
    const raycaster=new THREE.Raycaster(), pointer=new THREE.Vector2();
    const pickables=stations.map(s=>s.group);
    const hitStation=(ex:number,ey:number)=>{
      const rect=root.getBoundingClientRect();
      pointer.set(((ex-rect.left)/rect.width)*2-1,-((ey-rect.top)/rect.height)*2+1);
      raycaster.setFromCamera(pointer,camera);
      const hits=raycaster.intersectObjects(pickables,true);
      return hits.length?stations.find(s=>s.id===hits[0].object.userData.station)??null:null;
    };

    // ── POINTER HANDLERS ──────────────────────────────────────
    let isDragging=false, lastX=0, lastY=0, downX=0, downY=0, wasDragged=false;
    const onPointerDown=(e:PointerEvent)=>{isDragging=true;lastX=downX=e.clientX;lastY=downY=e.clientY;wasDragged=false;tooltip.style.opacity="0";renderer.domElement.setPointerCapture(e.pointerId);};
    const onPointerUp=(e:PointerEvent)=>{isDragging=false;if(!wasDragged){const s=hitStation(e.clientX,e.clientY);if(s)focusStation(s.id);}};
    const onPointerMove=(e:PointerEvent)=>{
      if(Math.hypot(e.clientX-downX,e.clientY-downY)>5)wasDragged=true;
      if(isDragging){sTheta-=(e.clientX-lastX)*0.006;sPhi=Math.max(0.12,Math.min(Math.PI*0.47,sPhi+(e.clientY-lastY)*0.006));lastX=e.clientX;lastY=e.clientY;cameraAnimating=false;updateCamera();lastInteraction=performance.now();return;}
      const s=hitStation(e.clientX,e.clientY);
      hovered=s?s.id:null; renderer.domElement.style.cursor=s?"pointer":"grab";
      if(s){
        tooltipTitle.innerHTML=`<span style="color:#e8a020;margin-right:6px;font:9px ui-monospace,monospace;">${String(s.index+1).padStart(2,"0")}</span>${s.name}`;
        tooltipDesc.textContent=s.desc;
        const rect=root.getBoundingClientRect();
        tooltip.style.left=Math.min(rect.width-248,Math.max(10,e.clientX-rect.left+16))+"px";
        tooltip.style.top=Math.max(10,Math.min(rect.height-90,e.clientY-rect.top-60))+"px";
        tooltip.style.opacity="1";
      } else tooltip.style.opacity="0";
    };
    const onPointerLeave=()=>{hovered=null;tooltip.style.opacity="0";};
    const onWheel=(e:WheelEvent)=>{sRadius=Math.max(10,Math.min(55,sRadius+e.deltaY*0.04));cameraAnimating=false;updateCamera();e.preventDefault();};
    renderer.domElement.addEventListener("pointerdown",onPointerDown);
    renderer.domElement.addEventListener("pointerup",onPointerUp);
    renderer.domElement.addEventListener("pointermove",onPointerMove);
    renderer.domElement.addEventListener("pointerleave",onPointerLeave);
    renderer.domElement.addEventListener("wheel",onWheel,{passive:false});
    cleanups.push(()=>{
      renderer.domElement.removeEventListener("pointerdown",onPointerDown);
      renderer.domElement.removeEventListener("pointerup",onPointerUp);
      renderer.domElement.removeEventListener("pointermove",onPointerMove);
      renderer.domElement.removeEventListener("pointerleave",onPointerLeave);
      renderer.domElement.removeEventListener("wheel",onWheel);
    });

    // ── RESIZE ────────────────────────────────────────────────
    const ro=new ResizeObserver(()=>{
      const w=root.clientWidth,h=root.clientHeight;
      renderer.setSize(w,h);
      if(composer)composer.setSize(w,h);
      if(bloomPass)bloomPass.resolution.set(w,h);
      camera.aspect=w/h; camera.updateProjectionMatrix();
    });
    ro.observe(root); cleanups.push(()=>ro.disconnect());

    // ── DATA STREAM LINES ─────────────────────────────────────
    const LINE_COUNT = 120;
    const lineGeo = new THREE.BufferGeometry();
    const linePos = new Float32Array(LINE_COUNT * 6); // 2 titik per line
    const lineCol = new Float32Array(LINE_COUNT * 6);

    lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
    lineGeo.setAttribute("color",    new THREE.BufferAttribute(lineCol, 3));

    const lineMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    const streamMesh = new THREE.LineSegments(lineGeo, lineMat);
    scene.add(streamMesh);

    const stageColors = [
      new THREE.Color(0x4488cc),
      new THREE.Color(0x44aacc),
      new THREE.Color(0xe8a020),
      new THREE.Color(0x8b5cf6),
      new THREE.Color(0xef4444),
      new THREE.Color(0x10b981),
    ];

    // State tiap line
    const lineU     = new Float32Array(LINE_COUNT).map(()=> Math.random());
    const lineLen   = new Float32Array(LINE_COUNT).map(()=> 0.04 + Math.random() * 0.12);
    const lineSpeed = new Float32Array(LINE_COUNT).map(()=> 0.008 + Math.random() * 0.016);

    const _lv0 = new THREE.Vector3();
    const _lv1 = new THREE.Vector3();

    const updateStream = (t: number, dt: number) => {
      const stageFromU = (u: number) => Math.min(5, Math.floor(u * 6));

      for (let i = 0; i < LINE_COUNT; i++) {
        lineU[i] = (lineU[i] + lineSpeed[i]) % 1;

        const u0 = lineU[i];
        const u1 = Math.min(u0 + lineLen[i], 0.9999);

        beltPath.getPointAt(u0, _lv0);
        beltPath.getPointAt(u1, _lv1);

        _lv0.x *= 1 + spread * 0.12; _lv0.z *= 1 + spread * 0.15;
        _lv1.x *= 1 + spread * 0.12; _lv1.z *= 1 + spread * 0.15;

        _lv0.y += 0.18;
        _lv1.y += 0.18;

        linePos[i*6+0] = _lv0.x; linePos[i*6+1] = _lv0.y; linePos[i*6+2] = _lv0.z;
        linePos[i*6+3] = _lv1.x; linePos[i*6+4] = _lv1.y; linePos[i*6+5] = _lv1.z;

        const stage = stageFromU(u0);
        const col   = stageColors[stage];
        const bright = 0.4 + Math.sin(t * 4 + i) * 0.3;

        // Titik depan terang, titik belakang redup (efek trail)
        lineCol[i*6+0] = col.r * bright;
        lineCol[i*6+1] = col.g * bright;
        lineCol[i*6+2] = col.b * bright;
        lineCol[i*6+3] = col.r * 0.05;
        lineCol[i*6+4] = col.g * 0.05;
        lineCol[i*6+5] = col.b * 0.05;
      }

      (lineGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
      (lineGeo.attributes.color    as THREE.BufferAttribute).needsUpdate = true;
    };

    updateStream(0, 0.016);

    // ── ANIMATE ───────────────────────────────────────────────
    let simTime=0, lastFrame=performance.now(), lastDraw=-1, rafId=0;
    const scratch=new THREE.Vector3(), anchor2=new THREE.Vector3();
    const journeySteps:[string,string][]=[
      ["Collecting raw data","Station 1 · CSV, API, and DB ingestion"],
      ["Cleaning data","Station 2 · imputation, normalization"],
      ["Training model","Station 3 · XGBoost fitting"],
      ["Evaluating model","Station 4 · accuracy, AUC-ROC, F1"],
      ["Generating SHAP","Station 5 · feature importance"],
      ["Deploying API","Station 6 · REST endpoint live"],
    ];
    let prevJourney=-1;

    const pulseBase=(t:number)=>0.85+Math.sin(t*2.4)*0.10+Math.sin(t*4.8)*0.05;

    let nextFlicker=3+Math.random()*4;

    const animate=(now:number)=>{
      rafId=requestAnimationFrame(animate);
      const dt=Math.max(0,Math.min((now-lastFrame)/1000,0.045));
      lastFrame=now;
      if(playing){simTime+=dt;flightTime+=dt;}
      const t=simTime, tact=(t*TAU)/4, smooth=1-Math.exp(-dt*5);

      spread=THREE.MathUtils.lerp(spread,mode==="stations"?1:0,smooth);
      cutPlane.constant=THREE.MathUtils.lerp(cutPlane.constant,mode==="cutaway"?0.99:10,smooth);

      const pulse=pulseBase(t);
      amberGlow.intensity=THREE.MathUtils.lerp(amberGlow.intensity,pulse*12,smooth*0.3);

      flickerTimer+=dt;
      if(flickerTimer>nextFlicker && playing){
        flickerTimer=0; nextFlicker=4+Math.random()*6;
        flickerTarget=Math.floor(Math.random()*stations.length);
        flickerActive=true;
        setTimeout(()=>{flickerActive=false; flickerTarget=-1;},80+Math.random()*120);
      }

      stations.forEach((s,i)=>{
        s.group.position.copy(s.base);
        s.group.position.x*=1+spread*0.3;
        s.group.position.z*=1+spread*0.38;
        s.group.position.y+=spread*(i%2?0.32:0.56);

        const stationPulse=Math.pow(Math.max(0,Math.sin(tact-i*0.9)),7);
        const isFlickering=flickerActive&&flickerTarget===i;
        const flickerMult=isFlickering?(Math.random()>0.5?2.5:0.1):1;

        const targetIntensity=(hovered===s.id||(cameraMode==="station"&&selected===s.id))
          ?6.0
          :(pulseBase(t+i*0.6)*1.0+stationPulse*1.4)*flickerMult;

        s.glowMat.emissiveIntensity=THREE.MathUtils.lerp(s.glowMat.emissiveIntensity,targetIntensity,smooth);
        s.pointLight.intensity=THREE.MathUtils.lerp(s.pointLight.intensity,targetIntensity*0.9,smooth);
        s.pointLight.position.set(s.group.position.x,s.group.position.y+1.5,s.group.position.z);
      });
      beltGroup.scale.set(1+spread*0.12,1,1+spread*0.15);

      gears.forEach(({g,vertical},i)=>{if(vertical)g.rotation.z=t*(i%2?-1:1)*1.1;else g.rotation.y=t*(i%2?-1:1)*1.1;});
      reels.forEach((r,i)=>(r.rotation.z=-t*(i?0.65:0.85)));
      outTrain.position.y=((t/4)%1)*0.22;

      const inPhase=(t/24)%1, inBeat=Math.min(1,inPhase/0.15);
      incomingData.position.set(Math.sin(inBeat*Math.PI)*0.24,2.9-inBeat*1.9,1.1-inBeat*0.55);
      incomingData.rotation.z=Math.sin(inBeat*Math.PI)*-0.14;
      incomingData.scale.setScalar(Math.min(1,inBeat*8+0.15,(1-inBeat)*7+0.1));

      if(t-lastDraw>1/18||lastDraw<0){drawPreproc(t);drawEval(t);drawShap(t);drawTrain(t);updateBelt(t);lastDraw=t;}

      if(playing) updateSparks(dt,t);

      packets.forEach((packet,i)=>{
        const phase=(t/24+i/6)%1; packet.phase=phase;
        let stage:number;
        if(phase<0.15){
          stage=0; const f=phase/0.15;
          packet.group.position.copy(stations[5].group.position).add(new THREE.Vector3(0,1.6,0.6));
          scratch.copy(stations[0].group.position).add(new THREE.Vector3(0,1.3,0.65));
          packet.group.position.lerp(scratch,f);
          packet.group.position.y+=Math.sin(f*Math.PI)*2;
          packet.group.rotation.set(0,Math.sin(f*Math.PI)*0.28,Math.sin(f*Math.PI)*-0.1);
        } else {
          const u=((phase-0.15)/0.85)*cashU;
          beltPath.getPointAt(u,packet.group.position);
          packet.group.position.x*=1+spread*0.12; packet.group.position.z*=1+spread*0.15;
          packet.group.position.y+=0.44; packet.group.rotation.set(0,0.18,0);
          stage=u<adminU*0.7?1:u<storeU*0.96?2:u<cashU*0.83?3:u<cashU*0.95?4:5;
        }
        if(packet.stage!==stage){packet.faces.forEach((f,j)=>(f.visible=j===stage));packet.stage=stage;}
        packet.group.visible=mode!=="order"||i===0;
        packet.halo.visible=mode==="order"&&i===0;
        packet.group.scale.setScalar(mode==="order"?1.35:1);
        if(phase>0.94)packet.group.scale.multiplyScalar(Math.max(0.05,(1-phase)/0.06));
      });

      if(mode==="order"){
        const packet=packets[0], step=Math.min(packet.stage??0,5);
        if(step!==prevJourney){journeyTitle.textContent=journeySteps[step][0];journeyDetail.textContent=journeySteps[step][1];prevJourney=step;}
        journeyBar.style.width=packets[0].phase*100+"%";
      }

      if(cameraMode==="flight"&&playing&&!isDragging){
        const a=flightTime*0.11, d=28*(mode==="stations"?1.2:1);
        desiredTgt.set(0,1,0);
        desiredPos.set(Math.sin(a+0.55)*d*0.82,d*(0.48+Math.sin(a*0.7)*0.08),Math.cos(a+0.55)*d*0.82).add(desiredTgt);
        const rel=desiredPos.clone().sub(desiredTgt);
        sTheta=THREE.MathUtils.lerp(sTheta,Math.atan2(rel.x,rel.z),smooth);
        sPhi=THREE.MathUtils.lerp(sPhi,Math.acos(Math.max(-1,Math.min(1,rel.y/rel.length()))),smooth);
        sRadius=THREE.MathUtils.lerp(sRadius,rel.length(),smooth);
        orbitTarget.lerp(desiredTgt,smooth); updateCamera();
      } else if(mode==="order"&&playing&&!isDragging&&packets[0]){
        const tgt=packets[0].group.position.clone();
        desiredTgt.lerp(tgt,smooth); desiredPos.copy(desiredTgt).addScaledVector(viewDir,14);
        const rel=desiredPos.clone().sub(orbitTarget);
        sTheta=THREE.MathUtils.lerp(sTheta,Math.atan2(rel.x,rel.z),smooth*0.5);
        sPhi=THREE.MathUtils.lerp(sPhi,Math.acos(Math.max(-1,Math.min(1,rel.y/rel.length()))),smooth*0.5);
        sRadius=THREE.MathUtils.lerp(sRadius,rel.length(),smooth*0.5);
        orbitTarget.lerp(desiredTgt,smooth*0.5); updateCamera();
      } else if(cameraAnimating&&!isDragging){
        const rel=desiredPos.clone().sub(desiredTgt);
        const goalTheta=Math.atan2(rel.x,rel.z);
        const goalPhi=Math.acos(Math.max(-1,Math.min(1,rel.y/rel.length())));
        const goalR=rel.length();
        sTheta=THREE.MathUtils.lerp(sTheta,goalTheta,smooth);
        sPhi=THREE.MathUtils.lerp(sPhi,goalPhi,smooth);
        sRadius=THREE.MathUtils.lerp(sRadius,goalR,smooth);
        orbitTarget.lerp(desiredTgt,smooth); updateCamera();
        if(Math.abs(sTheta-goalTheta)<0.01&&Math.abs(sPhi-goalPhi)<0.01)cameraAnimating=false;
      }

      if(playing&&!isDragging&&!cameraAnimating&&mode!=="order"&&cameraMode==="overview"&&now-lastInteraction>7000)
        {sTheta+=dt*0.06;updateCamera();}

      stations.forEach((s,i)=>{
        const show=mode==="stations"; labelEls[i].style.opacity=show?"1":"0";
        if(!show)return;
        anchor2.copy(s.group.position).add(s.anchor).project(camera);
        const offsets:[number,number][]=[[-50,-14],[-8,-62],[30,-12],[32,20],[-12,40],[-48,24]];
        let lx=(anchor2.x*0.5+0.5)*root.clientWidth-40+(offsets[i]?.[0]??0);
        let ly=(-anchor2.y*0.5+0.5)*root.clientHeight-52+(offsets[i]?.[1]??0);
        lx=Math.max(9,Math.min(root.clientWidth-168,lx));
        ly=Math.max(80,Math.min(root.clientHeight-200,ly));
        labelEls[i].style.transform=`translate(${lx}px,${ly}px)`;
      });

      updateStream(t, dt);
      if(composer)composer.render(); else renderer.render(scene,camera);
    };
    rafId=requestAnimationFrame(animate);

    // ── CLEANUP ───────────────────────────────────────────────
    cleanups.push(()=>{
      cancelAnimationFrame(rafId);
      scene.traverse(o=>{
        const m=o as THREE.Mesh;
        if(m.geometry)m.geometry.dispose();
        const mats=m.material?(Array.isArray(m.material)?m.material:[m.material]):[];
        mats.forEach(mt=>{Object.values(mt as Record<string,unknown>).forEach(v=>{if(v instanceof THREE.Texture)v.dispose();}); (mt as THREE.Material).dispose();});
      });
      geoCache.forEach(g=>g.dispose());
      sparkGeo.dispose(); sparkMat.dispose();
      lineGeo.dispose(); lineMat.dispose();
      renderer.dispose(); renderer.domElement.remove();
    });

    return ()=>cleanups.forEach(fn=>fn());
  },[]);

  return <div ref={mountRef} className="relative h-full w-full overflow-hidden" />;
}
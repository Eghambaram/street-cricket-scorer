/**
 * generate-icons.mjs — Premium CricScore PWA icon
 * Run: node scripts/generate-icons.mjs
 */
import { writeFileSync, mkdirSync } from 'fs';
import { deflateSync } from 'zlib';

// ─── PNG encoder ──────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
function crc32(buf) {
  let v = 0xffffffff;
  for (const b of buf) v = CRC_TABLE[(v ^ b) & 0xff] ^ (v >>> 8);
  return (v ^ 0xffffffff) >>> 0;
}
function mkchunk(type, data) {
  const T = Buffer.from(type,'ascii'), L = Buffer.alloc(4), C = Buffer.alloc(4);
  L.writeUInt32BE(data.length); C.writeUInt32BE(crc32(Buffer.concat([T,data])));
  return Buffer.concat([L,T,data,C]);
}
function encodePNG(W, H, rgba) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W,0); ihdr.writeUInt32BE(H,4); ihdr[8]=8; ihdr[9]=6;
  const stride=W*4, raw=Buffer.alloc(H*(stride+1));
  for (let y=0;y<H;y++) {
    raw[y*(stride+1)]=0;
    for (let x=0;x<W;x++) {
      const s=(y*W+x)*4, d=y*(stride+1)+1+x*4;
      raw[d]=rgba[s];raw[d+1]=rgba[s+1];raw[d+2]=rgba[s+2];raw[d+3]=rgba[s+3];
    }
  }
  return Buffer.concat([
    Buffer.from([137,80,78,71,13,10,26,10]),
    mkchunk('IHDR',ihdr), mkchunk('IDAT',deflateSync(raw,{level:6})), mkchunk('IEND',Buffer.alloc(0)),
  ]);
}

// ─── Pixel helpers ────────────────────────────────────────────────────────────
const lerp = (a,b,t) => a+(b-a)*Math.max(0,Math.min(1,t));
const clamp = v => Math.max(0,Math.min(255,Math.round(v)));

function blit(buf,S,x,y,r,g,b,a) {
  const xi=x|0,yi=y|0;
  if(xi<0||xi>=S||yi<0||yi>=S) return;
  const i=(yi*S+xi)*4;
  if(a>=255){buf[i]=r;buf[i+1]=g;buf[i+2]=b;buf[i+3]=255;return;}
  const fa=a/255,ba=buf[i+3]/255,oa=fa+ba*(1-fa);
  if(oa>0){
    buf[i]  =clamp((r*fa+buf[i]  *ba*(1-fa))/oa);
    buf[i+1]=clamp((g*fa+buf[i+1]*ba*(1-fa))/oa);
    buf[i+2]=clamp((b*fa+buf[i+2]*ba*(1-fa))/oa);
    buf[i+3]=clamp(oa*255);
  }
}
function disc(buf,S,cx,cy,R,r,g,b,a=255) {
  if(R<=0) return;
  const x0=Math.max(0,~~(cx-R-1)),x1=Math.min(S-1,~~(cx+R+1));
  const y0=Math.max(0,~~(cy-R-1)),y1=Math.min(S-1,~~(cy+R+1));
  for(let py=y0;py<=y1;py++)
    for(let px=x0;px<=x1;px++){
      const d=Math.hypot(px-cx,py-cy);
      if(d<R-0.5) blit(buf,S,px,py,r,g,b,a);
      else if(d<R+0.5) blit(buf,S,px,py,r,g,b,Math.round(a*(R+0.5-d)));
    }
}
/** Scanline fill of polygon [{x,y}…] */
function fillPoly(buf,S,verts,r,g,b,a=255) {
  const n=verts.length;
  const minY=Math.max(0,Math.floor(Math.min(...verts.map(v=>v.y))));
  const maxY=Math.min(S-1,Math.ceil(Math.max(...verts.map(v=>v.y))));
  for(let py=minY;py<=maxY;py++){
    const xs=[];
    for(let i=0;i<n;i++){
      const v1=verts[i],v2=verts[(i+1)%n];
      if((v1.y<=py&&v2.y>py)||(v2.y<=py&&v1.y>py))
        xs.push(v1.x+(py-v1.y)/(v2.y-v1.y)*(v2.x-v1.x));
    }
    xs.sort((a,b)=>a-b);
    for(let k=0;k+1<xs.length;k+=2){
      const xl=xs[k],xr=xs[k+1];
      for(let px=Math.max(0,Math.floor(xl));px<=Math.min(S-1,Math.ceil(xr));px++){
        const ed=Math.min(px-xl+0.5,xr-px+0.5);
        blit(buf,S,px,py,r,g,b,Math.round(a*Math.min(1,ed)));
      }
    }
  }
}

// ─── Background ───────────────────────────────────────────────────────────────
function drawBackground(buf,S) {
  for(let y=0;y<S;y++)
    for(let x=0;x<S;x++){
      const dx=(x/S-0.42)*2, dy=(y/S-0.38)*2;
      const t=Math.min(1,Math.hypot(dx,dy)/1.25);
      const i=(y*S+x)*4;
      buf[i]  =clamp(lerp(0x14,0x04,t));
      buf[i+1]=clamp(lerp(0x26,0x08,t));
      buf[i+2]=clamp(lerp(0x16,0x05,t));
      buf[i+3]=255;
    }
}

// ─── Cricket bat ──────────────────────────────────────────────────────────────
// hx,hy = handle tip  |  tx,ty = blade toe
function drawBat(buf,S,hx,hy,tx,ty) {
  const dx=tx-hx, dy=ty-hy, len=Math.hypot(dx,dy);
  const nx=dx/len, ny=dy/len;   // spine direction
  const px=-ny,    py=nx;       // perpendicular (face direction)

  const hdlHW  = len*0.028;
  const bldHW  = len*0.138;
  const T_SHD0 = 0.23;   // shoulder taper start
  const T_SHD1 = 0.37;   // shoulder taper end / blade start

  // hw(t) profile
  function hw(t) {
    if(t<=T_SHD0) return hdlHW;
    if(t>=T_SHD1) return bldHW;
    const s=(t-T_SHD0)/(T_SHD1-T_SHD0);
    return lerp(hdlHW, bldHW, s*s);
  }

  // Build full outline polygon (near side tip→toe, then far side toe→tip)
  const N=80;
  const near=[], far=[];
  for(let i=0;i<=N;i++){
    const t=i/N;
    const cx_=hx+dx*t, cy_=hy+dy*t, h=hw(t);
    near.push({x:cx_+px*h, y:cy_+py*h});
    far.push( {x:cx_-px*h, y:cy_-py*h});
  }
  const poly=[...near, ...[...far].reverse()];

  // ── 1. Full bat shape (gold) ─────────────────────────────────────────────
  fillPoly(buf,S,poly, 0xee,0xb8,0x22);
  // Rounded toe cap
  disc(buf,S,tx,ty, bldHW, 0xee,0xb8,0x22);

  // ── 2. Toe darkening — subtle shade toward toe ────────────────────────────
  for(let k=0;k<8;k++){
    const t=lerp(0.60,1.0,k/7);
    const ex=hx+dx*t, ey=hy+dy*t;
    const fade=lerp(0,0.32,k/7);
    disc(buf,S,ex,ey, bldHW*0.95,
      clamp(0xee*(1-fade)), clamp(0xb8*(1-fade)), clamp(0x22*(1-fade)), Math.round(fade*160));
  }

  // ── 3. Blade ridge — dark center stripe ───────────────────────────────────
  const ridgeHW=hdlHW*0.60;
  const rs=T_SHD1+0.03;
  const rNear=[], rFar=[];
  for(let i=0;i<=N;i++){
    const t=lerp(rs,0.97,i/N);
    const cx_=hx+dx*t, cy_=hy+dy*t;
    rNear.push({x:cx_+px*ridgeHW, y:cy_+py*ridgeHW});
    rFar.push( {x:cx_-px*ridgeHW, y:cy_-py*ridgeHW});
  }
  fillPoly(buf,S,[...rNear,...[...rFar].reverse()], 0xa4,0x68,0x10);

  // ── 4. Lit highlight — bright strip on near face ───────────────────────────
  const hs=T_SHD1+0.07;
  for(let i=0;i<=N;i++){
    const t=lerp(hs,0.94,i/N);
    const cx_=hx+dx*t, cy_=hy+dy*t;
    disc(buf,S, cx_+px*bldHW*0.44, cy_+py*bldHW*0.44, hdlHW*0.50,
      0xff,0xf2,0x88, 100);
  }

  // ── 5. Handle overlay (leather grip + wood) ────────────────────────────────
  const gripEnd=0.065;
  for(let i=0;i<=N;i++){
    const t=(i/N)*T_SHD0;
    const cx_=hx+dx*t, cy_=hy+dy*t;
    let r,g,b;
    if(t<=gripEnd){
      // alternating grip bands
      const band=Math.floor(t/gripEnd*10)%2;
      r=band?0x60:0x48; g=band?0x3a:0x28; b=band?0x14:0x0c;
    } else {
      const st=(t-gripEnd)/(T_SHD0-gripEnd);
      r=clamp(lerp(0x80,0xd8,st)); g=clamp(lerp(0x50,0x92,st)); b=0x16;
    }
    disc(buf,S,cx_,cy_, hdlHW, r,g,b);
  }
}

// ─── Cricket ball ─────────────────────────────────────────────────────────────
function drawBall(buf,S,cx,cy,R) {
  // shadow
  disc(buf,S, cx+R*0.08,cy+R*0.10, R*1.02, 0x02,0x04,0x02, 145);

  // base crimson
  disc(buf,S,cx,cy,R, 0xc0,0x1c,0x28);

  // spherical shading
  for(let k=1;k<=10;k++){
    const t=k/10;
    disc(buf,S, cx+R*0.10*t,cy+R*0.12*t, R*lerp(0.86,0.18,t),
      clamp(lerp(0xc0,0x4e,t)), clamp(lerp(0x1c,0x05,t)), clamp(lerp(0x28,0x08,t)),
      Math.round(lerp(0,50,t)));
  }

  // specular highlight
  disc(buf,S, cx-R*0.27,cy-R*0.29, R*0.34, 0xdc,0x48,0x54, 195);
  disc(buf,S, cx-R*0.37,cy-R*0.39, R*0.11, 0xff,0xcc,0xd0, 150);

  // ── Seam: two opposing curves across the ball face ────────────────────────
  // Strategy: parametric curves, not arc geometry.
  // Seam 1 runs top-left → bottom-right, bulging toward upper-right  (  )
  // Seam 2 runs top-right → bottom-left, bulging toward lower-left   (  )
  // Each seam is a cubic bezier kept strictly inside the ball.
  //
  // We sample the bezier and clip to ball radius.
  const ST   = Math.max(0.7, R*0.028);
  const CLIP = R*0.92;
  const STEPS= Math.ceil(R*24);

  function bezier(p0x,p0y, p1x,p1y, p2x,p2y, p3x,p3y, t){
    const u=1-t;
    return {
      x: u*u*u*p0x + 3*u*u*t*p1x + 3*u*t*t*p2x + t*t*t*p3x,
      y: u*u*u*p0y + 3*u*u*t*p1y + 3*u*t*t*p2y + t*t*t*p3y,
    };
  }

  // Seam 1: left-top → right-top, arching UP  ( ∩ shape — upper seam )
  // Endpoints on the side of ball at ±30° above equator
  const s1p0x=cx-R*0.82, s1p0y=cy-R*0.15;
  const s1p1x=cx-R*0.35, s1p1y=cy-R*0.94;
  const s1p2x=cx+R*0.35, s1p2y=cy-R*0.94;
  const s1p3x=cx+R*0.82, s1p3y=cy-R*0.15;

  // Seam 2: left-bottom → right-bottom, arching DOWN  ( ∪ shape — lower seam )
  // Endpoints on the side of ball at ±30° below equator
  const s2p0x=cx-R*0.82, s2p0y=cy+R*0.15;
  const s2p1x=cx-R*0.35, s2p1y=cy+R*0.94;
  const s2p2x=cx+R*0.35, s2p2y=cy+R*0.94;
  const s2p3x=cx+R*0.82, s2p3y=cy+R*0.15;

  for(let i=0;i<=STEPS;i++){
    const t=i/STEPS;
    const p1=bezier(s1p0x,s1p0y,s1p1x,s1p1y,s1p2x,s1p2y,s1p3x,s1p3y,t);
    if(Math.hypot(p1.x-cx,p1.y-cy)<CLIP)
      disc(buf,S,p1.x,p1.y,ST,255,255,255,215);
    const p2=bezier(s2p0x,s2p0y,s2p1x,s2p1y,s2p2x,s2p2y,s2p3x,s2p3y,t);
    if(Math.hypot(p2.x-cx,p2.y-cy)<CLIP)
      disc(buf,S,p2.x,p2.y,ST,255,255,255,215);
  }

  // Stitch dots — perpendicular pairs along each seam
  const DR=Math.max(0.5,R*0.020);
  const NS=5;
  for(let si=1;si<=NS;si++){
    const t=si/(NS+1), dt=0.01;

    // Seam 1 tangent at t
    const pa=bezier(s1p0x,s1p0y,s1p1x,s1p1y,s1p2x,s1p2y,s1p3x,s1p3y,Math.max(0,t-dt));
    const pb=bezier(s1p0x,s1p0y,s1p1x,s1p1y,s1p2x,s1p2y,s1p3x,s1p3y,Math.min(1,t+dt));
    const p1=bezier(s1p0x,s1p0y,s1p1x,s1p1y,s1p2x,s1p2y,s1p3x,s1p3y,t);
    if(Math.hypot(p1.x-cx,p1.y-cy)<CLIP*0.88){
      const tdx=pb.x-pa.x, tdy=pb.y-pa.y, tl=Math.hypot(tdx,tdy)||1;
      const ux=-tdy/tl, uy=tdx/tl; // perpendicular
      const off=R*0.055;
      disc(buf,S,p1.x+ux*off,p1.y+uy*off,DR,255,255,255,185);
      disc(buf,S,p1.x-ux*off,p1.y-uy*off,DR,255,255,255,185);
    }

    // Seam 2 tangent at t
    const pc=bezier(s2p0x,s2p0y,s2p1x,s2p1y,s2p2x,s2p2y,s2p3x,s2p3y,Math.max(0,t-dt));
    const pd=bezier(s2p0x,s2p0y,s2p1x,s2p1y,s2p2x,s2p2y,s2p3x,s2p3y,Math.min(1,t+dt));
    const p2=bezier(s2p0x,s2p0y,s2p1x,s2p1y,s2p2x,s2p2y,s2p3x,s2p3y,t);
    if(Math.hypot(p2.x-cx,p2.y-cy)<CLIP*0.88){
      const tdx=pd.x-pc.x, tdy=pd.y-pc.y, tl=Math.hypot(tdx,tdy)||1;
      const ux=-tdy/tl, uy=tdx/tl;
      const off=R*0.055;
      disc(buf,S,p2.x+ux*off,p2.y+uy*off,DR,255,255,255,185);
      disc(buf,S,p2.x-ux*off,p2.y-uy*off,DR,255,255,255,185);
    }
  }
}

// ─── Decorative ring ──────────────────────────────────────────────────────────
function drawRing(buf,S,cx,cy,R,thick,r,g,b,a){
  const outer=R+thick/2, inner=R-thick/2;
  const x0=Math.max(0,~~(cx-outer-1)), x1=Math.min(S-1,~~(cx+outer+1));
  const y0=Math.max(0,~~(cy-outer-1)), y1=Math.min(S-1,~~(cy+outer+1));
  for(let py=y0;py<=y1;py++)
    for(let px=x0;px<=x1;px++){
      const d=Math.hypot(px-cx,py-cy);
      if(d>=inner-0.5&&d<=outer+0.5){
        let al=a;
        if(d<inner+0.5) al=Math.round(a*(d-(inner-0.5)));
        else if(d>outer-0.5) al=Math.round(a*(outer+0.5-d));
        blit(buf,S,px,py,r,g,b,al);
      }
    }
}

// ─── Compose ──────────────────────────────────────────────────────────────────
function drawIcon(S) {
  const buf=new Uint8Array(S*S*4);

  drawBackground(buf,S);

  // Ambient glow behind bat
  disc(buf,S, S*0.30,S*0.26, S*0.22, 0xf0,0xbe,0x20, 9);
  disc(buf,S, S*0.30,S*0.26, S*0.10, 0xf0,0xbe,0x20, 7);

  // Subtle luxury ring
  drawRing(buf,S, S*0.50,S*0.50, S*0.43, Math.max(1,S*0.003), 0xf0,0xbe,0x20, 16);

  // Ball — lower-right, drawn first so bat toe overlaps it naturally
  drawBall(buf,S, S*0.715, S*0.730, S*0.205);

  // Bat — handle upper-left to blade toe centre
  drawBat(buf,S, S*0.14,S*0.10, S*0.55,S*0.60);

  return buf;
}

// ─── Generate all sizes ───────────────────────────────────────────────────────
const SIZES=[72,96,128,144,152,192,384,512];
mkdirSync('public/icons',{recursive:true});
for(const size of SIZES){
  process.stdout.write(`Generating ${size}×${size}… `);
  const pixels=drawIcon(size);
  const path=`public/icons/icon-${size}.png`;
  writeFileSync(path,encodePNG(size,size,pixels));
  console.log(`✓  → ${path}`);
}
console.log('\nAll icons generated.');

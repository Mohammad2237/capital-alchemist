import {Shop} from './game.js';
const game=new Shop(), table=document.querySelector('#table'), ink=table.getContext('2d');
const status=document.querySelector('#status'), enter=document.querySelector('#enter');
let buttons=[], dirty=true, repeats=0, hint='', gazeKey=null, gazeSince=0, gazeLatched=false;
const tasks={1:['herb','العشبة الحمراء','🌿'],2:['ground','اطحن بالهاون','⚗'],3:['crystal','البلّورة','💎'],4:['water','إبريق الماء','🏺'],5:['stirred','حرّك المرجل','🥄'],6:['vial','املأ القارورة','🧪'],11:['stirred','حرّك الدفعة','🥄'],12:['vial','سلّم الجرعات','🧪']};
function label(str,x,y,size,color='#ffe8bb'){
 ink.fillStyle=color;ink.font='bold '+size+'px system-ui';ink.fillText(str,x,y,950);
}
function paint(){
 buttons=[];const [title,description,...choices]=game.page;
 const wood=ink.createLinearGradient(0,0,0,576);wood.addColorStop(0,'#112f32');wood.addColorStop(.68,'#25413b');wood.addColorStop(.69,'#624534');wood.addColorStop(1,'#2b201c');
 ink.fillStyle=wood;ink.fillRect(0,0,1024,576);ink.textAlign='center';ink.direction='rtl';
 label(['إرث الخيميائي','الزبون الأول','الطلب الكبير'][game.step<7?0:game.step<9?1:2],512,52,24,'#a7daca');
 label(title,512,125,47);label(description,512,194,26);label('الرصيد  •  '+game.cash,125,50,23);
 function tile(x,y,w,h,text,key,active=true){
 ink.fillStyle=active?'#d4b376':'#85694d';ink.fillRect(x,y,w,h);ink.fillStyle=active?'#214841':'#3c342d';ink.fillRect(x+3,y+3,w-6,h-6);
 label(text,x+w/2,y+h/2+10,27);if(active)buttons.push({x,y,w,h,key});
 }
 if(tasks[game.step]){
 const [key,name,icon]=tasks[game.step];label(icon,512,328,88);
 const stroke=['ground','stirred'].includes(key);
 tile(292,380,440,76,name+(stroke?'  '+repeats+' / 3':''),key);
 }else choices.forEach((str,i)=>tile(145,236+i*82,734,66,str,i,game.step!==14||i===2));
 if(hint)label(hint,512,545,23,'#ffd392');dirty=true;
}
function choose(x,y){
 const btn=buttons.find(b=>x>=b.x&&x<=b.x+b.w&&y>=b.y&&y<=b.y+b.h);if(!btn)return;
 if(['ground','stirred'].includes(btn.key)&&++repeats<3){paint();return}
 repeats=0;hint=game.act(btn.key)?'':'اطرح تكلفة الجرعة من سعر البيع وحاول مجددًا.';paint();
}
table.onpointerup=e=>{const b=table.getBoundingClientRect();choose((e.clientX-b.left)*1024/b.width,(e.clientY-b.top)*576/b.height)};
paint();
// A held select gesture also operates the mortar and spoon by controller motion.
const strokes=new Map();
function work(frame){
 for(const [source,stroke] of strokes){
  const task=tasks[game.step];
  if(stroke.ended||!task||task[0]!==stroke.key)continue
  const pose=frame.getPose(source.gripSpace||source.targetRaySpace,space);
  if(!pose)continue;
  const {x,y,z}=pose.transform.position;
  if(stroke.prev){
   const dy=y-stroke.prev.y;
   if(stroke.key==='ground'){
    stroke.peak=Math.max(stroke.peak,y);
    if(stroke.peak-y>.045){stroke.peak=y;choose(512,415);stroke.used=true}
   }else{
    stroke.distance+=Math.min(.045,Math.hypot(x-stroke.prev.x,z-stroke.prev.z));
    if(stroke.distance>.22){stroke.distance=0;choose(512,415);stroke.used=true}
   }
  }else stroke.peak=y;
  stroke.prev={x,y,z};
 }
}
let gl,program,mesh,texture,flatCount,boardStart,session,space,offsetY,anchor;
// Bake the room, workbench, flasks and lanterns into a single static mesh.
function setup(){
 gl=document.querySelector('#view').getContext('webgl',{alpha:false,antialias:false,xrCompatible:true});
 if(!gl)throw Error('WebGL');
 const shader=(type,source)=>{const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s};
 program=gl.createProgram();
 gl.attachShader(program,shader(gl.VERTEX_SHADER,'attribute vec3 p,c;attribute vec2 t;uniform mat4 projection,eye;uniform vec3 origin;uniform float yaw,point;uniform vec3 cursor;varying vec3 color;varying vec2 uv;void main(){vec3 pos=point>0.5?cursor:p;gl_PointSize=9.;float a=cos(yaw),b=sin(yaw);vec3 v=vec3(a*pos.x+b*pos.z,pos.y,-b*pos.x+a*pos.z);gl_Position=projection*eye*vec4(v+origin,1.);color=point>0.5?vec3(1.,.9,.3):c;uv=t;}'));
 gl.attachShader(program,shader(gl.FRAGMENT_SHADER,'precision mediump float;varying vec3 color;varying vec2 uv;uniform sampler2D paper;void main(){gl_FragColor=uv.x<0.?vec4(color,1.):texture2D(paper,uv);}'));
 gl.linkProgram(program);if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('shader link');gl.useProgram(program);
 const data=[];function quad(a,b,c,d,col,tex=false){for(const i of [0,1,2,0,2,3])data.push(...[a,b,c,d][i],...col,...(tex?[[0,1],[1,1],[1,0],[0,0]][i]:[-1,0]))}
 function box(x,y,z,w,h,d,col){const pts=[];for(let i=0;i<8;i++)pts.push([x+(i&1?w:-w)/2,y+(i&2?h:-h)/2,z+(i&4?d:-d)/2]);for(const [j,face] of [[0,1,3,2],[4,5,7,6],[0,4,6,2],[1,5,7,3],[2,3,7,6],[0,1,5,4]].entries())quad(...face.map(i=>pts[i]),col.map(v=>v*(.68+j*.06)))}
 const timber=[.39,.24,.14];box(0,-1.62,0,9,.12,10,timber);
 for(const x of [-4,4])box(x,.2,0,.2,4,10,[.28,.31,.29]);
 box(0,.2,-4,8,4,.2,[.22,.30,.29]);for(let i=-3;i<=3;i++){box(i,0,-3.85,.12,4,.15,timber);box(i,1.92,0,.15,.18,9,timber)}
 box(0,-.8,-1.65,3.8,.18,1,timber);for(const x of [-1.7,1.7])box(x,-1.22,-1.65,.18,.8,.18,timber);
 for(const side of [-1,1])for(let row=0;row<3;row++){box(side*2.5,row*.52-.65,-3.65,1.7,.09,.42,timber);for(let j=0;j<5;j++){const x=side*2.5+(j-2)*.28,y=row*.52-.45;const col=[[.27,.67,.6],[.72,.42,.2],[.46,.43,.72]][(row+j)%3];box(x,y,-3.58,.15,.23,.16,col);box(x,y+.15,-3.58,.07,.1,.08,col)}}
 flatCount=data.length/8;boardStart=flatCount;
 quad([-1,-.65,-1.7],[1,-.65,-1.7],[1,.475,-1.7],[-1,.475,-1.7],[1,1,1],true);
 mesh=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,mesh);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array(data),gl.STATIC_DRAW);
 for(const [name,size,start] of [['p',3,0],['c',3,12],['t',2,24]]){const loc=gl.getAttribLocation(program,name);gl.enableVertexAttribArray(loc);gl.vertexAttribPointer(loc,size,gl.FLOAT,false,32,start)}
 texture=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,texture);
 for(const p of [gl.TEXTURE_WRAP_S,gl.TEXTURE_WRAP_T])gl.texParameteri(gl.TEXTURE_2D,p,gl.CLAMP_TO_EDGE);
 gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.LINEAR);gl.enable(gl.DEPTH_TEST);dirty=true;
}
const uniforms={};
function rayHit(p){
 if(!p||!anchor)return null;const m=p.transform.matrix,c=Math.cos(anchor.yaw),s=Math.sin(anchor.yaw);
 const dx=m[12]-anchor.x,dz=m[14]-anchor.z,x=c*dx-s*dz,z=s*dx+c*dz;
 const vx=-c*m[8]+s*m[10],vz=-s*m[8]-c*m[10];if(vz>=-.001)return null;
 const t=(-1.7-z)/vz;if(t<=0)return null;return [(x+t*vx+1)*512,(.475-(m[13]-offsetY-t*m[9]))*512];
}
function frame(time,f){
 const active=f.session;active.requestAnimationFrame(frame);const pose=f.getViewerPose(space);if(!pose)return;
 if(!anchor){const m=pose.transform.matrix;anchor={x:m[12],z:m[14],yaw:Math.atan2(m[8],m[10])};offsetY=m[13]}
 work(f);
 const layer=active.renderState.baseLayer;gl.bindFramebuffer(gl.FRAMEBUFFER,layer.framebuffer);gl.clearColor(.12,.18,.18,1);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);
 if(dirty){gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,table);dirty=false}
 gl.uniform3f(uniforms.origin,anchor.x,offsetY,anchor.z);gl.uniform1f(uniforms.yaw,anchor.yaw);
 const hits=[];for(const src of active.inputSources){const hit=rayHit(f.getPose(src.targetRaySpace,space));if(hit&&hit[0]>=0&&hit[0]<=1024&&hit[1]>=0&&hit[1]<=576)hits.push(hit)}
 // Gaze-only sources can dwell on a choice without a physical trigger.
 const gaze=Array.from(active.inputSources).find(input=>input.targetRayMode==='gaze');
 const aim=gaze&&rayHit(f.getPose(gaze.targetRaySpace,space));
 const b=aim&&buttons.find(b=>aim[0]>=b.x&&aim[0]<=b.x+b.w&&aim[1]>=b.y&&aim[1]<=b.y+b.h);
 if(!b){gazeKey=null;gazeLatched=false}
 else if(!gazeLatched){
  if(gazeKey!==b){gazeKey=b;gazeSince=time}
  else if(time-gazeSince>1200){gazeLatched=true;choose(...aim)}
 }
 for(const v of pose.views){const r=layer.getViewport(v);gl.viewport(r.x,r.y,r.width,r.height);gl.uniformMatrix4fv(uniforms.projection,false,v.projectionMatrix);gl.uniformMatrix4fv(uniforms.eye,false,v.transform.inverse.matrix);gl.drawArrays(gl.TRIANGLES,0,flatCount+6);
 for(const hit of hits){gl.uniform3f(uniforms.origin,anchor.x,offsetY,anchor.z);gl.uniform3f(uniforms.cursor,hit[0]/512-1,.475-hit[1]/512,-1.692);gl.uniform1f(uniforms.point,1);gl.drawArrays(gl.POINTS,0,1);gl.uniform1f(uniforms.point,0)}}
}
enter.onclick=async()=>{
 enter.disabled=true;try{
 if(!navigator.xr||!await navigator.xr.isSessionSupported('immersive-vr'))throw Error('unsupported');
 session=await navigator.xr.requestSession('immersive-vr',{optionalFeatures:['local-floor','hand-tracking']});
 session.addEventListener('end',()=>{strokes.clear();session=null;anchor=null;enter.disabled=false;status.textContent='يمكنك متابعة اللعب أو دخول الدكّان مجددًا.'},{once:true});
 if(!gl){setup();for(const k of ['origin','yaw','projection','eye','cursor','point'])uniforms[k]=gl.getUniformLocation(program,k)}
 await gl.makeXRCompatible();session.updateRenderState({baseLayer:new XRWebGLLayer(session,gl,{framebufferScaleFactor:.8,antialias:false})});
 try{space=await session.requestReferenceSpace('local-floor')}catch{space=await session.requestReferenceSpace('local')}
 session.addEventListener('selectstart',e=>{
   const key=tasks[game.step]?.[0];if(key!=='ground'&&key!=='stirred')return;
   const hit=rayHit(e.frame.getPose(e.inputSource.targetRaySpace,space));
   if(hit&&buttons.some(b=>b.key===key&&hit[0]>=b.x&&hit[0]<=b.x+b.w&&hit[1]>=b.y&&hit[1]<=b.y+b.h))
     strokes.set(e.inputSource,{key,prev:null,distance:0,used:false});
 });
 session.addEventListener('selectend',e=>{const stroke=strokes.get(e.inputSource);if(stroke)stroke.ended=true});
 session.addEventListener('select',e=>{const stroke=strokes.get(e.inputSource);strokes.delete(e.inputSource);if(stroke?.used)return;const hit=rayHit(e.frame.getPose(e.inputSource.targetRaySpace,space));if(hit)choose(...hit)});
 anchor=null;session.requestAnimationFrame(frame);
 }catch(e){if(session)await session.end().catch(()=>{});enter.disabled=false;status.textContent='تعذّر دخول الواقع الافتراضي. يمكنك اللعب هنا أو فتح الرابط في متصفح نظارة يدعم WebXR. '+e.message}
};

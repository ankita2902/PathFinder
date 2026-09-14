const ROWS = 20, COLS = 25;
const START = {r:2,c:3}, TARGET = {r:17,c:21};
let grid=[], running=false;

const $=id=>document.getElementById(id);
const key=(r,c)=>`${r},${c}`;

function resetGrid(){
  grid=Array.from({length:ROWS},(_,r)=>Array.from({length:COLS},(_,c)=>({
    r,c,wall:false,weight:false
  })));
  render();
}

function render(){
  const el=$("grid"); el.innerHTML="";
  for(let r=0;r<ROWS;r++) for(let c=0;c<COLS;c++){
    const d=document.createElement("div");
    d.className="cell";
    const n=grid[r][c];
    if(n.wall)d.classList.add("wall");
    if(n.weight && !n.wall)d.classList.add("weight");
    if(r===START.r&&c===START.c)d.classList.add("start");
    if(r===TARGET.r&&c===TARGET.c)d.classList.add("target");
    d.dataset.r=r; d.dataset.c=c;
    d.onmousedown=e=>{
      if(r===START.r&&c===START.c||r===TARGET.r&&c===TARGET.c)return;
      if(e.button===2){e.preventDefault(); n.weight=!n.weight; n.wall=false}
      else n.wall=!n.wall;
      render();
    };
    d.oncontextmenu=e=>e.preventDefault();
    el.appendChild(d);
  }
}

function clearVisuals(){
  document.querySelectorAll(".cell").forEach(x=>x.classList.remove("visited","path"));
}

function neighbors(n){
  const dirs=[[1,0],[-1,0],[0,1],[0,-1]];
  if($("diagonal").checked) dirs.push([1,1],[1,-1],[-1,1],[-1,-1]);
  return dirs.map(([dr,dc])=>({r:n.r+dr,c:n.c+dc}))
    .filter(x=>x.r>=0&&x.r<ROWS&&x.c>=0&&x.c<COLS&&!grid[x.r][x.c].wall);
}
function heuristic(a,b){return Math.abs(a.r-b.r)+Math.abs(a.c-b.c)}
function cost(n){return n.weight&&$("weighted").checked?5:1}

function reconstruct(parent,end){
  const path=[]; let cur=key(end.r,end.c);
  while(cur){const [r,c]=cur.split(",").map(Number);path.push({r,c});cur=parent.get(cur)}
  return path.reverse();
}

function sleep(ms){return new Promise(r=>setTimeout(r,ms))}
function mark(r,c,type){
  const el=document.querySelector(`.cell[data-r="${r}"][data-c="${c}"]`);
  if(el&&!el.classList.contains("start")&&!el.classList.contains("target"))el.classList.add(type);
}

async function search(type,animate=true){
  const start={...START}, end={...TARGET};
  const sk=key(start.r,start.c), ek=key(end.r,end.c);
  const parent=new Map(), dist=new Map([[sk,0]]);
  const visited=new Set(); let order=[];

  if(type==="bfs"||type==="dfs"){
    const q=[start]; const seen=new Set([sk]);
    while(q.length){
      const cur=type==="bfs"?q.shift():q.pop();
      if(key(cur.r,cur.c)===ek)break;
      for(const nx of neighbors(cur)){
        const k=key(nx.r,nx.c);
        if(!seen.has(k)){seen.add(k);parent.set(k,key(cur.r,cur.c));q.push(nx);order.push(nx)}
      }
    }
  } else {
    const open=[{node:start,score:0}];
    const best=new Map([[sk,0]]);
    while(open.length){
      open.sort((a,b)=>a.score-b.score);
      const cur=open.shift().node, ck=key(cur.r,cur.c);
      if(visited.has(ck))continue;
      visited.add(ck); order.push(cur);
      if(ck===ek)break;
      for(const nx of neighbors(cur)){
        const nk=key(nx.r,nx.c), nd=(best.get(ck)??Infinity)+cost(grid[nx.r][nx.c]);
        if(nd<(best.get(nk)??Infinity)){
          best.set(nk,nd);dist.set(nk,nd);parent.set(nk,ck);
          let score=nd;
          if(type==="astar")score=nd+heuristic(nx,end);
          if(type==="greedy")score=heuristic(nx,end);
          open.push({node:nx,score});
        }
      }
    }
  }

  if(!order.some(n=>key(n.r,n.c)===ek)){
    return {order,path:[],cost:0};
  }
  const path=reconstruct(parent,end);
  return {order,path,cost:path.reduce((s,n)=>s+cost(grid[n.r][n.c]),0)};
}

async function run(type=$("algorithm").value, update=true){
  if(running)return null; running=true; clearVisuals();
  const t0=performance.now();
  const result=await search(type);
  const delay=Number($("speed").value);
  if(update) for(const n of result.order){mark(n.r,n.c,"visited");await sleep(delay)}
  if(update) for(const n of result.path){mark(n.r,n.c,"path");await sleep(Math.max(5,delay/2))}
  const time=performance.now()-t0;
  if(update){$("nodes").textContent=result.order.length;$("path").textContent=Math.max(0,result.path.length-1);$("time").textContent=time.toFixed(2);$("cost").textContent=result.cost}
  running=false;
  return {...result,time};
}

async function compare(){
  if(running)return; clearVisuals(); $("comparison").innerHTML="Running...";
  const names=["bfs","dfs","dijkstra","greedy","astar"], labels={bfs:"BFS",dfs:"DFS",dijkstra:"Dijkstra",greedy:"Greedy",astar:"A*"};
  const results=[];
  for(const a of names){const r=await run(a,false);results.push({a,...r})}
  results.sort((x,y)=>x.order.length-y.order.length);
  $("comparison").innerHTML=`<div class="comparison-row"><b>Algorithm</b><b>Visited</b><b>Path</b></div>`+
    results.map((r,i)=>`<div class="comparison-row ${i===0?"best":""}"><span>${labels[r.a]} ${i===0?"🏆":""}</span><span>${r.order.length}</span><span>${Math.max(0,r.path.length-1)}</span></div>`).join("");
  const best=results[0]; $("nodes").textContent=best.order.length;$("path").textContent=Math.max(0,best.path.length-1);$("time").textContent=best.time.toFixed(2);$("cost").textContent=best.cost;
}

function randomMaze(){
  clearVisuals();
  for(const row of grid)for(const n of row)n.wall=false;
  for(const row of grid)for(const n of row){
    if((n.r===START.r&&n.c===START.c)||(n.r===TARGET.r&&n.c===TARGET.c))continue;
    n.wall=Math.random()<.28;
  }
  render();
}
function divisionMaze(){
  for(const row of grid)for(const n of row)n.wall=false;
  for(let r=0;r<ROWS;r++){grid[r][0].wall=true;grid[r][COLS-1].wall=true}
  for(let c=0;c<COLS;c++){grid[0][c].wall=true;grid[ROWS-1][c].wall=true}
  for(let r=2;r<ROWS-1;r+=2)for(let c=1;c<COLS-1;c++)grid[r][c].wall=true;
  for(let r=2;r<ROWS-1;r+=2)grid[r][1+Math.floor(Math.random()*(COLS-2))].wall=false;
  render();
}
function backtrackingMaze(){
  for(const row of grid)for(const n of row)n.wall=true;
  const stack=[{r:1,c:1}]; grid[1][1].wall=false;
  while(stack.length){
    const cur=stack[stack.length-1], choices=[[2,0],[-2,0],[0,2],[0,-2]]
      .map(([dr,dc])=>({r:cur.r+dr,c:cur.c+dc}))
      .filter(n=>n.r>0&&n.r<ROWS-1&&n.c>0&&n.c<COLS-1&&grid[n.r][n.c].wall);
    if(!choices.length){stack.pop();continue}
    const nx=choices[Math.floor(Math.random()*choices.length)];
    grid[(cur.r+nx.r)/2][(cur.c+nx.c)/2].wall=false;grid[nx.r][nx.c].wall=false;stack.push(nx);
  }
  grid[START.r][START.c].wall=false;grid[TARGET.r][TARGET.c].wall=false;render();
}

$("visualize").onclick=()=>run();
$("clear").onclick=()=>{if(!running)resetGrid()};
$("compare").onclick=compare;
$("mazeBtn").onclick=()=>{if(running)return; const m=$("maze").value;m==="random"?randomMaze():m==="division"?divisionMaze():backtrackingMaze()};
$("weighted").onchange=()=>render();
$("algorithm").onchange=()=>{
  const data={
    astar:["A*","Uses g(n)+h(n) to guide the search toward the target while usually exploring fewer nodes."],
    dijkstra:["Dijkstra","Finds the lowest-cost path and works correctly when cells have different movement costs."],
    bfs:["BFS","Explores level by level and finds the shortest path when every move has equal cost."],
    dfs:["DFS","Explores deeply before backtracking. It can find a path but does not guarantee the shortest path."],
    greedy:["Greedy Best-First","Uses only the heuristic distance to the target, often making fast but non-optimal choices."]
  }[$("algorithm").value];
  $("infoTitle").textContent=data[0];$("infoText").textContent=data[1];
};
resetGrid(); $("algorithm").dispatchEvent(new Event("change"));
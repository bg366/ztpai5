function createReservationsRepository(state) {
  const map=r=>{
    if(!r)return null;const room=state.rooms.find(s=>s.id===r.roomId);const b=state.buildings.find(b=>b.id===room.buildingId);
    return {...r,user:{id:r.userId,email:state.users.find(u=>u.id===r.userId).email},room:{id:room.id,name:room.name,building:{id:b.id,name:b.name}}};
  };
  const filter=({roomId,buildingId,userId,status,from,to}={})=>state.reservations.filter(r=>
    (userId===undefined||r.userId===userId)&&(roomId===undefined||r.roomId===roomId)&&(!status||r.status===status)&&
    (buildingId===undefined||state.rooms.find(s=>s.id===r.roomId).buildingId===buildingId)&&
    (!from||r.endTime>new Date(from))&&(!to||r.startTime<new Date(to)));
  return {
    async findAll(filters={}) {return filter(filters).map(map);},
    async findPage({page=1,limit=20,sort='startTime',...filters}={}) {
      const key=sort.replace(/^-/,''),direction=sort.startsWith('-')?-1:1;
      const rows=filter(filters).sort((a,b)=>direction*(a[key]<b[key]?-1:a[key]>b[key]?1:0)||a.id-b.id);
      return {data:rows.slice((page-1)*limit,page*limit).map(map),meta:{page,limit,total:rows.length,totalPages:Math.ceil(rows.length/limit)}};
    },
    async findById(id) {return map(state.reservations.find(r=>r.id===id));},
    async create(data) {const r={...data,id:state.nextReservationId++};state.reservations.push(r);return map(r);},
    async update(id,changes) {const r=state.reservations.find(r=>r.id===id);if(!r)return null;Object.assign(r,changes);return map(r);},
  };
}
module.exports={createReservationsRepository};

const { ConflictError }=require('../../errors/AppError');
function createRoomsRepository(state) {
  const map=r=>r?{...r,building:{id:r.buildingId,name:state.buildings.find(b=>b.id===r.buildingId).name}}:null;
  return {
    async findAll({buildingId}={}) {return state.rooms.filter(r=>buildingId===undefined||r.buildingId===buildingId).map(map);},
    async findById(id) {return map(state.rooms.find(r=>r.id===id));},
    async lockById() { /* W trybie memory serializację zapewnia runInTransaction. */ },
    async update(id,data) {
      const r=state.rooms.find(r=>r.id===id),next={...r,...data};
      if(state.rooms.some(r=>r.id!==id&&r.buildingId===next.buildingId&&r.name===next.name)) throw new ConflictError('DUPLICATE_RESOURCE','Resource with this name already exists');
      Object.assign(r,data);return map(r);
    },
    async remove(id) {
      if(state.reservations.some(r=>r.roomId===id)) throw new ConflictError('REFERENCE_CONFLICT','Related resource is missing or still in use');
      state.rooms=state.rooms.filter(r=>r.id!==id);
    },
    async create(data) {
      if(state.rooms.some(r=>r.buildingId===data.buildingId&&r.name===data.name)) throw new ConflictError('DUPLICATE_RESOURCE','Resource with this name already exists');
      const r={...data,id:state.nextRoomId++};state.rooms.push(r);return map(r);
    },
  };
}
module.exports={createRoomsRepository};

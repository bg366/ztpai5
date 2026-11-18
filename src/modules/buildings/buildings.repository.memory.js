const { ConflictError } = require('../../errors/AppError');
function createBuildingsRepository(state) {
  return {
    async findAll() { return state.buildings.map(b=>({...b,roomsCount:state.rooms.filter(r=>r.buildingId===b.id).length})); },
    async findById(id) { const b=state.buildings.find(b=>b.id===id); return b?{...b}:null; },
    async update(id, data) {
      const b=state.buildings.find(b=>b.id===id);
      if(data.name && state.buildings.some(b=>b.id!==id&&b.name===data.name)) throw new ConflictError('DUPLICATE_RESOURCE','Resource with this name already exists');
      Object.assign(b,data);return {...b};
    },
    async remove(id) {
      if(state.rooms.some(r=>r.buildingId===id)) throw new ConflictError('REFERENCE_CONFLICT','Related resource is missing or still in use');
      state.buildings=state.buildings.filter(b=>b.id!==id);
    },
    async create(data) {
      if(state.buildings.some(b=>b.name===data.name)) throw new ConflictError('DUPLICATE_RESOURCE','Resource with this name already exists');
      const b={...data,id:state.nextBuildingId++};state.buildings.push(b);return {...b};
    },
  };
}
module.exports={createBuildingsRepository};

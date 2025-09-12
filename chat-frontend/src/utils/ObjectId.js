class ObjectId {
  constructor() {
    // ObjectId structure: 4-byte timestamp + 5-byte random + 3-byte counter
    this.increment = Math.floor(Math.random() * 0xFFFFFF);
  }

  static generate() {
    const timestamp = Math.floor(Date.now() / 1000);
    const random = Math.floor(Math.random() * 0xFFFFFFFFFF);
    
    // Increment counter for uniqueness
    ObjectId.prototype.increment = (ObjectId.prototype.increment + 1) % 0xFFFFFF;
    
    const objectId = 
      timestamp.toString(16).padStart(8, '0') +
      random.toString(16).padStart(10, '0') +
      ObjectId.prototype.increment.toString(16).padStart(6, '0');
    
    return objectId;
  }

  static isValid(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
  }
}

ObjectId.prototype.increment = Math.floor(Math.random() * 0xFFFFFF);

export default ObjectId;
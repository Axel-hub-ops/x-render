export default class Store {
  _mapping = {}

  static create() {
    return new Store();
  } 

  getItem = (key) => {
    return this.mapping[key]
  }

  setItem = (key, value) => {
    if(this.get(key)) {
      console.warn(`id ${key} already exists, the new value of id ${key} will replace the old one.`)
    }

    this.mapping[key] = value;
  }

  getAllItems = () => {
    return this.mapping;
  }

  destroy = (key) => {
    this.mapping[key] = null;
  }

  get mapping() {
    return this._mapping;
  }

  set mapping(newVal) {
    this._mapping = newVal;
  }
}
import {Builtin} from "./builtin.js";

export class Deinflector {
    constructor() {
        this.path = 'data/wordforms.json';
        this.wordforms = null;
    }

    async loadData() {
        this.wordforms = await Builtin.loadData(this.path);
    }

    deinflect(term) {
        return this.wordforms[term] ? this.wordforms[term] : null;
    }
}

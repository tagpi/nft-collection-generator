const fs = require('fs-extra');
const path = require('path');
const { get } = require('lodash');

class LayerConfig { 


  static configFilename = 'config.json';

  static get(relativeFolderPath) { 
    const reply = new LayerConfig();
    reply.folder = path.join(process.cwd(), relativeFolderPath);
    return reply;
  }

  get configFilePath() { 
    return path.join(this.folder, LayerConfig.configFilename);
  }

  get folderName() { 
    return path.basename(this.folder);
  }

  get name() { 
    return get(this, '_data.name') || this.folderName;
  }

  get data() { 
    if (!this._data) {
      this._data = fs.existsSync(this.configFilePath)
        ? JSON.parse(fs.readFileSync(this.configFilePath, { encoding: 'utf-8' }))
        : this._data = { name: this.name };
    }
    return this._data;
  }

  save() { 
    fs.writeFileSync(this.configFilePath, JSON.stringify(this.data, null, 2), { encoding: 'utf-8' });
  }

  get totalRarity() {
    let total = 0;
    for (let item of this.data.files) {
      total += item.rarity || 0;
    }
    return total;
  }

  get totalUndefinedRarity() {
    return this.data.files.filter(item => item.rarity === undefined).length;
  }

  applyRarity() {

    // set rarity 
    const remaining = 100-this.totalRarity;
    const split = this.totalUndefinedRarity;
    const value = Math.max(Math.floor(remaining / split), 1);

    this.data.files
      .filter(item => item.rarity === undefined)
      .forEach(item => item.rarity = value);

  }

  update() {
    const dir = fs.readdirSync(this.folder)
      .filter(item => ![LayerConfig.configFilename].includes(item));

    // update files
    const existing = this.data.files || [];
    this.data.files = [];
    for (let filename of dir) { 
      const ref = existing.find(item => item.filename === filename) 
        || { 
          id: filename.split('.')[0],
          filename,
        };
      this.data.files.push(ref);
    }

    // save
    this.save();
  }

  getRandomFile() { 

    if (!this.isRaritySet) {
      this.applyRarity();
      this.isRaritySet = true;
    }

    const rnd = Math.floor(Math.random() * 100) + 1;
    let counter = 0;
    for (let file of this.data.files) { 
      counter += file.rarity;
      if (counter >= rnd) { 
        return file;
      }
    }
    return this.data.files[this.data.files.length - 1];
  }

}

exports.LayerConfig = LayerConfig;


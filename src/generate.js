const fs = require('fs-extra');
const { set, get } = require('lodash');
const path = require('path');
const { LayerConfig } = require('./layer/config');
const sharp = require('sharp');

class Generator {

  static get(relativePath) { 
    const reply = new Generator();
    reply.relativePath = relativePath;
    reply.folder = path.join(process.cwd(), relativePath);
    reply.configPath = path.join(reply.folder, 'config.json');
    return reply;
  }

  get config() {
    if (!this._config) { 
      this._config = JSON.parse(fs.readFileSync(this.configPath, { encoding: 'utf-8' }));
    }
    return this._config;
  }

  get distPath() { 
    return path.join(process.cwd(), this.config.distPath);
  }

  createInstance() { 
    return {
      layers: this.layers.map(layer => ({ ...layer.getRandomFile(), layer: layer.name }))
    };
  }

  calculate() {
    
    this.report = {
      layer: {},
    };

    this.instances = [];
    this.layers = this.config.layers.map(layerName => LayerConfig.get(`${this.relativePath}/${layerName}`));

    // create instances
    for (let i = 0; i < this.config.count; i++) {
      const instance = this.createInstance();
      this.instances.push(instance);
      for (let layer of instance.layers) {
        const ref = get(this.report, `layer.${layer.layer}.${layer.id}`) || {};
        ref.total = ref.total || 0;
        ref.total++;
        ref.percent = Math.floor(ref.total / this.config.count * 100);
        set(this.report, `layer.${layer.layer}.${layer.id}`, ref);
      }
    }

    // dist
    if (!fs.pathExistsSync(this.distPath)){
      fs.mkdirSync(this.distPath);
    }

    // report
    fs.writeFileSync(
      path.join(this.distPath, 'report.json'), 
      JSON.stringify(this.report, null, 2),
      { encoding: 'utf-8' }
    );

    // instance
    fs.writeFileSync(
      path.join(this.distPath, 'instance.json'), 
      JSON.stringify(this.instances, null, 2),
      { encoding: 'utf-8' }
    );

  }

  async render() { 
    
    const instances = JSON.parse(fs.readFileSync(path.join(this.distPath, 'instance.json')), { encoding: 'utf-8' });
    let counter = 0;
    for (let instance of instances) { 
      counter++;
      console.log();
      console.log(counter, '/', this.config.count, `(${Math.floor(counter / this.config.count * 100)}%)`)
      instance.layers.forEach(layer => console.log(layer.layer, layer.filename))

      const filename = `${this.config.instance.filename.replace(new RegExp('{id}', 'g'), counter)}`;
      const input = instance.layers.map(layer => ({ input: this.getImagePath(layer.layer, layer.filename) }));
      input.shift();
      await new Promise(y => {
        sharp(this.getImagePath(instance.layers[0].layer, instance.layers[0].filename))
          .composite(input)
          .toFile(path.join(this.distPath, filename), () => y())
      })

    }

  }

  getImagePath(layer, filename) { 
    return path.join(process.cwd(), this.relativePath, layer, filename);
  }

}

exports.Generator = Generator;

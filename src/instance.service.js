const ConfigService = require('./config.service.js');
const fs = require('fs-extra');
const path = require('path');
const LayerService = require('./layer.service.js');
const { get, set } = require('lodash');
const ImageService = require('./image.service.js');


module.exports = new class InstanceService {

  async generate() {
    const instances = this.createInitialInstances();

    // configure instance props
    const entries = Object.entries(ConfigService.config.prop);
    for (let entry of entries) { 
      this.applyPropFilters(instances, entry[0], entry[1]);
    }
    console.log();

    // configure layers
    // * sort layers based on "select"
    const layers = Object.entries(ConfigService.config.layers);
    layers.sort((a, b) => a[1].select > b[1].select ? 1 : -1);
    for (let layer of layers) {
      const entries = this.configureLayerEntries(instances, layer[0], layer[1]);
      this.applyLayerEntry(instances, layer[0], layer[1], entries);
    }
    console.log();

    fs.writeFileSync(ConfigService.path('instance.json'), JSON.stringify(instances, null, 2), { encoding: 'utf-8' });
  }

  createInitialInstances() { 
    const instances = [];
    const key = Object.keys(ConfigService.config.prop)[0];
    const codes = ConfigService.config.prop[key][0].codes;
    for (let code of codes) {
      for (let i = 0; i < code.limit; i++) { 
        instances.push({
          id: ConfigService.config.filename.format.replace(new RegExp('{id}', 'g'), i + ConfigService.config.filename.start),
          prop: { 
            [key]: code.id
          }
        });
      }
    }
    return instances;
  }

  applyPropFilters(instances, propName, filters) { 
    for (let filter of filters) { 
      this.applyPropFilter(instances, propName, filter);
    }
  }

  applyPropFilter(instances, propName, filter) {

    const list = filter.if 
      ? instances.filter(item => filter.if(item))
      : [...instances];

    // assign percentage if there are multiple codes with no count intruction
    let noCountLines = filter.codes.filter(code => !code.limit && !code.percent);
    if (noCountLines.length > 1) { 

      // count total with instructions
      let totalInstructed = 0; 
      filter.codes.forEach(code => {
        if (code.limit) { totalInstructed += code.limit }
        if (code.percent) { totalInstructed += list.length * code.percent }
      });

      // add limit to non-instructed, except last
      const limit = (list.length - totalInstructed) / noCountLines.length;
      noCountLines.pop();
      for (let code of noCountLines) { 
        code.limit = limit;
      }

    }

    //
    const initialCount = list.length;
    for (let code of filter.codes) {
      this.applyPropCode(list, initialCount, propName, code);
    }

  }

  applyPropCode(list, initialCount, propName, code) {

    let count = 0;
    if (code.limit) { 
      count = code.limit 
    } else if (code.percent) { 
      count = initialCount * code.percent 
    } else { 
      count = list.length;
    }

    if (count > list.length) { 
      console.warn('filter exceeds list', propName, code.id);
    }

    let c = 0;
    for (let i = 0; i < count; i++) { 
      const index = this.getRandomInt(0, list.length - 1);
      if (list.length > index) { 
        const off = list.splice(index, 1)[0];
        off.prop = off.prop || {};
        off.prop[propName] = code.id;
        ++c;
      }
    }

    console.log(`[${propName}] ${code.id}`, c);
  }

  getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  sortRule(a, b) { 

    // check include
    if (a.include && !b.include) { return -1 }
    if (!a.include && b.include) { return 1 }
    if (!a.include && !b.include) { return 0 }

    // prioritize lower include.limit
    if (a.include.limit && !b.include.limit) { return -1 }
    if (!a.include.limit && b.include.limit) { return -1 }
    if (a.include.limit && b.include.limit) { 
      return a.include.limit < b.include.limit ? -1 : 1;
    }
    
    // prioritize lower include.percent
    if (a.include.percent && !b.include.percent) { return -1 }
    if (!a.include.percent && b.include.percent) { return 1 }
    if (a.include.percent && b.include.percent) { 
      return a.include.percent < b.include.percent ? -1 : 1;
    }

  }
  
  configureLayerEntries(instances, layerId, layerConfig) {

    const entries = Object.entries(LayerService.getFileConfig(layerId));
    entries.sort((a, b) => this.sortRule(a[1], b[1]))

    // apply "include-percent" to entries without "include" rules
    let consumed = 0;
    let i;
    for (i = 0; i < entries.length; i++){
      const entry = entries[i];
      if (entry[1].include) { 
        if (entry[1].include.percent) { 
          entry[1].include.limit = entry[1].include.percent * instances.length;
        }
      }
      const count = get(entry[1], 'include.limit');
      if (!count) { break }
      consumed += count;
    }


    // set include.limit to entries without no limit
    const noCountEntries = entries.length - i;
    const remaining = instances.length - consumed;
    const assignCount = Math.floor(remaining / noCountEntries);
    for (i; i < entries.length; i++) {
      if (i === entries.length - 1) { break; }
      const entry = entries[i];
      entry[1].include = entry[1].include || {};
      entry[1].include.limit = assignCount;
    }

    return entries;

  }

  applyLayerEntry(instances, layerId, layerConfig, entries) {
    const list = [...instances];

    // hit required count, assign, then remove from list
    for (let entry of entries) { 
      const limit = entry[1].include && entry[1].include.limit || list.length;

      // filter allowed instances
      const allowedInstances = [...list];
      const appliedInstances = [];

      // assign
      for (let i = 0; i < limit; i++) {
        const index = this.getRandomInt(0, allowedInstances.length - 1);
        if (index < allowedInstances.length) { 

          // remove from allowedInstance
          const instance = allowedInstances.splice(index, 1)[0];

          // check rules
          if (!this.isInstanceValid(instance, entry[1])) {
            i--;
            continue;
          }

          // assign 
          instance.layer = instance.layer || {};
          instance.layer[layerId] = { id: entry[0] };

          // remove from list
          const listIndex = list.indexOf(instance);
          list.splice(listIndex, 1);

          // track
          appliedInstances.push(instance);

        } 
      }

      console.log(`[${layerId}] ${entry[0]}`, limit);
      this.configureFileEntryOptions(appliedInstances, layerId, entry[0], entry[1]);

    }

  }

  isInstanceValid(instance, rules) { 

    // test include rules
    if (rules.include) {
      
      // include.prop
      if (rules.include.prop) { 
        for(let entry of Object.entries(rules.include.prop)) { 
          if (instance.prop[entry[0]] !== entry[1]) {
            return false;
          }
        }
      }

      // include.layer
      if (rules.include.layer) {
        for (let testLayerId of rules.include.layer) {
          if (!instance.layer[testLayerId]) { 
            return false;
          }
        }
      }

      // include.item
      if (rules.include.item) { 
        for (let test of rules.include.item) {
          const [testLayerId, testFileId] = test.split('.');
          if (instance.layer[testLayerId] && instance.layer[testLayerId].id !== testFileId) { 
            return false;
          }
        }
      }

    }

    // test exclude rules
    if (rules.exclude) { 

      // exclude.prop
      if (rules.exclude.prop) { 
        for(let entry of Object.entries(rules.exclude.prop)) { 
          if (instance.prop[entry[0]] === entry[1]) {
            return false;
          }
        }
      }

      // exclude.layer
      if (rules.exclude.layer) {
        for (let testLayerId of rules.exclude.layer) {
          if (instance.layer[testLayerId]) { 
            return false;
          }
        }
      }

      // exclude.item
      if (rules.exclude.item) { 
        for (let test of rules.exclude.item) {
          const [testLayerId, testFileId] = test.split('.');
          if (instance.layer[testLayerId] && instance.layer[testLayerId].id === testFileId) { 
            return false;
          }
        }
      }

    }

    //
    return true;

  }

  configureFileEntryOptions(instances, layerId, layerEntryId, layerEntry) { 
    for (let i = 0; i < layerEntry.files.length; i++) {
      const file = layerEntry.files[i];
      if (!file.prop){ continue }
      for (let prop of Object.entries(file.prop)){
        const configList = this.configureFilePropConfigList(instances, prop[1]);
        this.configureFileEntryProp(instances, layerId, file, i, prop[0], configList);
      }
    }
  }

  configureFilePropConfigList(instances, propConfigList) {

    // calculate prop limits
    propConfigList.sort((a, b) => this.sortRule(a, b))

    // apply "include-percent" to propConfigList without "include" rules
    let consumed = 0;
    let i;
    for (i = 0; i < propConfigList.length; i++){
      const entry = propConfigList[i];
      if (entry.include) { 
        if (entry.include.percent) { 
          entry.include.limit = entry.include.percent * instances.length;
        }
      }
      const count = get(entry, 'include.limit');
      if (!count) { break }
      consumed += count;
    }

    // set include.limit to propConfigList without no limit
    const noCount = propConfigList.length - i;
    const remaining = instances.length - consumed;
    const assignCount = Math.floor(remaining / noCount);
    for (i; i < propConfigList.length; i++) {
      if (i === propConfigList.length - 1) { break; }
      const entry = propConfigList[i];
      entry.include = entry.include || {};
      entry.include.limit = assignCount;
    }

    return propConfigList;

  }
  
  configureFileEntryProp(instances, layerId, file, fileIndex, propId, propConfigList) {

    const list = [...instances];

    // hit required count, assign, then remove from list
    for (let entry of propConfigList) { 
      const limit = entry.include && entry.include.limit || list.length;

      // filter allowed instances
      const allowedInstances = [...list];
      const appliedInstances = [];

      // assign
      let value;
      for (let i = 0; i < limit; i++) {
        const index = this.getRandomInt(0, allowedInstances.length - 1);
        if (index < allowedInstances.length) { 

          // remove from allowedInstance
          const instance = allowedInstances.splice(index, 1)[0];

          // check rules
          if (!this.isInstanceValid(instance, entry)) {
            i--;
            continue;
          }

          // assign
          if (entry.from) {
            value = get(instance, entry.from);
          } else if (entry.value) {
            value = entry.value;
          }
          set(instance, `layer[${layerId}].file[${fileIndex}].${propId}`, value);

          // remove from list
          const listIndex = list.indexOf(instance);
          list.splice(listIndex, 1);

          // track
          appliedInstances.push(instance);

        } 
      }

      console.log(`  [${file.path}]`, propId, value, limit);
      // this.configureFileEntryOptions(instances, layerId, entry[0], entry[1]);

    }
    
  }

  async render(instanceId) { 

    const layers = Object.entries(ConfigService.config.layers);
    layers.sort((a, b) => a[1].level > b[1].level ? -1 : 1);
    
    for (let entry of layers) { 
      entry[2] = LayerService.getFileConfig(entry[0]);
    }
    
    const data = JSON.parse(fs.readFileSync(ConfigService.path('instance.json'), { encoding: 'utf-8' }));

    if (instanceId) { 
      const instance = data.find(item => item.id === instanceId);
      await this.renderInstance(layers, instance)
    } else {
      for (let instance of data) { 
        await this.renderInstance(layers, instance);
      }
    }

  }

  async renderInstance(layers, instance) { 
    const folder = path.join(ConfigService.path(ConfigService.config.distPath));
    if (!fs.existsSync(folder)) {
      fs.mkdirSync(folder);
    }

    const target = path.join(ConfigService.path(ConfigService.config.distPath), `${instance.id}.png`);
    // fs.unlinkSync(target);

    const imageList = [];
    for (let entry of layers) { 
      const img = instance.layer[entry[0]];
      if (img && img.id) { 
        for (let i = 0; i < entry[2][img.id].files.length; i++){

          const file = entry[2][img.id].files[i];
          const color = get(img, `file[${i}].color`);
          const filename = color
            ? 'color/' + file.path.replace('.png', `.${color.substr(1)}.png`)
            : file.path;
    
          const colorFile = path.join(ConfigService.path(entry[0]), filename)
          imageList.push(colorFile);

        }
      }
    }

    // check files
    for (let file of imageList) { 
      if (!fs.existsSync(file)) {
        console.error(instance.id, 'file not found:', file);
        return;
      }
    }

    //
    await ImageService.combine(imageList, target);
    console.log('render', instance.id)

  }

}

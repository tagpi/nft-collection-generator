const fs = require('fs-extra');
const path = require('path');
const ConfigService = require('./config.service.js');
const { get } = require('lodash');
const ImageService = require('./image.service.js');

module.exports = new class LayerService { 

  get config() { 
    return ConfigService.config.layers; 
  }

  getFileConfigPath(layerId) {
    return path.join(ConfigService.path(layerId), 'config.json');
  }

  getFileConfig(layerId) { 
    if (fs.existsSync(this.getFileConfigPath(layerId))) {
      try { 
      return JSON.parse(fs.readFileSync(this.getFileConfigPath(layerId), { encoding: 'utf-8' }));
      } catch (ex) { 
        console.error('layer file error: ', layerId)
      }
    }
  }

  createConfigFiles(layerId) { 
    if (layerId) { 
      this.createConfigFile(layerId);
    } else {
      for (let key of Object.keys(this.config)) {
        this.createConfigFile(key);
      }
    }
  }

  createConfigFile(layerId) { 
    const clone = this.getFileConfig(layerId) || { };
    const fileList = { };

    if (!fs.pathExistsSync(ConfigService.path(layerId))){
      fs.mkdirSync(ConfigService.path(layerId));
    }
    
    const dir = fs.readdirSync(ConfigService.path(layerId))
      .filter(item => {
        if (item.startsWith('.')) { return false }
        if (item.endsWith('.png')){ return true }
      })

    for (let filename of dir) { 

      // shade
      if (filename.endsWith('.shade.png')) {
        const fileId = filename.substr(0, filename.length - 10);
        const exists = fileList[fileId].files.find(item => item.path === filename);
        if (!exists) { 
          fileList[fileId].files.push({ path: filename });
        }

      // image
      } else {
        const fileId = filename.substr(0, filename.length - 4);
        const exists = clone[fileId];
        fileList[fileId] = exists || {
          uid: `${layerId}.${fileId}`,
          files: [{path: filename }]
        }

      }
    }

    fs.writeFileSync(this.getFileConfigPath(layerId), JSON.stringify(fileList, null, 2), { encoding: 'utf-8' });
    // console.log(layerId)
    // console.log(JSON.stringify(fileList, null, 2))
  }

  async createColorFiles(layerId) {
    if (layerId) { 
      await this.createColorFilesForLayer(layerId);
    } else {
      for (let key of Object.keys(this.config)) {
        await this.createColorFilesForLayer(key);
      }
    }
  }

  async createColorFilesForLayer(layerId) { 
    console.log(layerId)
    const cfg = this.getFileConfig(layerId);

    for (let entry of Object.entries(cfg)){
      // console.log('  ', entry[0])
      for (let file of entry[1].files) {
        if (file.prop && file.prop.color) { 
          for (let entry of file.prop.color) { 
            if (entry.value) {
              console.log('  ', file.path, entry.value);
              await this.createFileColor(layerId, file.path, entry.value);
            } else if (entry.from) { 
              const values = [];
              const lead = get(ConfigService.config, entry.from);
              for (let item of lead) { 
                for (let code of item.codes){ 
                  values.push(code.id);
                }
              }
              for (let color of values) {
                console.log('  ', file.path, color);
                await this.createFileColor(layerId, file.path, color);
              }
            }
          }
        }
      }
    }
  }

  async createFileColor(layerId, filename, color) { 
    const src = path.join(ConfigService.path(layerId), filename);
    const folder = path.join(ConfigService.path(layerId), 'color');
    fs.ensureDirSync(folder);

    const target = path.join(folder, filename.replace('.png', `.${color.substr(1)}.png`));
    const dir = path.dirname(target);
    fs.ensureDirSync(dir);

    // if (!fs.existsSync(target)){
      await ImageService.tint(src, target, color);
    // }
  }

}
process.stdout.write('\u001b[3J\u001b[1J');
console.clear();

const ConfigService = require('./src/config.service.js');
const InstanceService = require('./src/instance.service.js');
const LayerService = require('./src/layer.service.js');


const cmd = (process.argv[2] || '').trim() || 'execute-all';
console.log();
console.log('------------------------------');
console.log(`task: ${cmd}`);
console.log('------------------------------');
console.log();


(async () => {

  await ConfigService.init('.');

  switch(cmd) { 
    case 'layer': 
      await LayerService.createConfigFiles(process.argv[3]);
      break;
    case 'color':
      await LayerService.createColorFiles(process.argv[3]);
      break;
    case 'calc':
      await InstanceService.generate();
      break;
    case 'render':
      await InstanceService.render(process.argv[3]);
      break;
    default: 
      await InstanceService.generate();
      await InstanceService.render(process.argv[3]);
      break;
  }

})().then(() => { 
  console.log();
  console.log('------------------------------')
  console.log('ok');
  console.log()
}, err => { 
  console.log('error:', err)
  process.exit(1);
})
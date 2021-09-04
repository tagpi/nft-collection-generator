console.clear();
const { Generator } = require('./src/generate.js');
const { LayerConfig } = require('./src/layer/config.js');

const args = [...process.argv];
args.shift();
args.shift();

const cmd = args.shift();
const options = args;
console.log();
console.log('------------------------------')
console.log(`task: ${cmd}`);
if (options && options.length) { 
  console.log('options:', ...options)
}

(async () => {
  switch(cmd) {
    case 'layer': 
      LayerConfig.get(options[0]).update();
      break;
    case 'calc':
      Generator.get(options[0] || '').calculate();
      break;
    case 'render':
      await Generator.get(options[0] || '').render();
      break;
  } 
})().then(() => { 
  console.log('------------------------------')
  console.log('ok');
  console.log()
}, err => { 
  console.log('error:', err)
  process.exit(1);
})
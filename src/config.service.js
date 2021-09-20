const path = require('path');

module.exports = new class ConfigService { 

  async init(workspaceRelativePath) { 
    this.workspaceRelativePath = workspaceRelativePath;
    const ref = await import(this.path('config.js'));
    this.config = ref.default;
  }

  path(param) { 
    return path.join(process.cwd(), this.workspaceRelativePath, param);
  }

}
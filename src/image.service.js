const sharp = require('sharp');

module.exports = new class ImageService { 

  tint(imageFile, targetFile, color) { 

    const rgb = this.hexToRgb(color);
    const brightness = (rgb.r + rgb.g + rgb.b) / (255 + 255 + 255);

    return new Promise((y, n) => { 
      sharp(imageFile)
        .modulate({
          brightness
        })
        .tint(color)
        .toFile(targetFile, err => {
          if (err) { 
            n(err)
          } else {
            y()
          }
        })
    });

  }

  combine(imageFileList, targetFile) {
    const first = imageFileList.shift();
    return new Promise((y, n) => { 
      const list = imageFileList.map(input => ({ input }));
      sharp(first)
        .composite(list)
        .toFile(targetFile, err => {
          if (err) { 
            n(err)
          } else {
            y()
          }
        })
    });
  }

  hexToRgb(hex) {
    var result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
      r: parseInt(result[1], 16),
      g: parseInt(result[2], 16),
      b: parseInt(result[3], 16)
    } : null;
  }

}

# NFT Collection Generator

1. Create config.json file
```json
{ 
  "count": 10,
  "instance": { 
    "filename": "mix-{id}.png"
  },
  "distPath": "dist",
  "layers": [
    "background",
    "head"
  ]
}
```

2. Create layer folders, create image files, then run to create the config. Add "rarity" to files (0, 100).
```
npx github:tagpi/nft-collection-generator layer
```

3. Calculate
```
npx github:tagpi/nft-collection-generator calc
```

4. Render
```
npx github:tagpi/nft-collection-generator render
```

The default will run bot calc and render
```
npx github:tagpi/nft-collection-generator 
```
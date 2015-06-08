var turf = require('turf');
var cover = require('tile-cover');
var tilebelt = require('tilebelt');

module.exports = function trace(layers, tile, done){
  var z = 19;
  var buildings = layers.streets.building;

  buildingHash = {};
  buildings.features.forEach(function(building){
    var buildingTiles = cover.tiles(building.geometry, {min_zoom: z, max_zoom: z});
    buildingTiles.forEach(function(t){
      buildingHash[tileToID(t)] = true;
    });
  });

  var imageTiles = tilesToZoom([tile], z)

  imageTiles = imageTiles.map(function(t){
    var image = {
      t: tileToID(t)
    }
    if(buildingHash[tileToID(t)]) image.buildings = true
    else image.b = false
    return image
  });

  var result = {
    images: imageTiles
  };

  done(null, result);
}

function tileToID(t){
  return t[0]+'/'+t[1]+'/'+t[2];
}

function tilesToZoom(tiles, zoom) {
  var newTiles = zoomTiles(tiles, zoom);
  return newTiles;

  function zoomTiles(zoomedTiles) {
    if(zoomedTiles[0][2] === zoom){
      return zoomedTiles;
    } else if(zoomedTiles[0][2] < zoom){
      var oneIn = [];
      zoomedTiles.forEach(function(tile){
        oneIn = oneIn.concat(tilebelt.getChildren(tile));
      });
      return zoomTiles(oneIn);
    } else {
      var zoomedTiles = zoomedTiles.map(function(tile){
        var centroid =
          turf.centroid(
            turf.bboxPolygon(
              tilebelt.tileToBBOX(tile)
            )
          );
        return tilebelt.pointToTile(
          centroid.geometry.coordinates[0],
          centroid.geometry.coordinates[1], zoom);
      });
      return zoomedTiles;
    }
  }
}
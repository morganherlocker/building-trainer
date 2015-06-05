var request = require('request')
var rimraf = require('rimraf')
var fs = require('fs')
var tilebelt = require('tilebelt')
var turf = require('turf')
var cover = require('tile-cover')
var TileReduce = require('tile-reduce')
var queue = require('queue-async')

var bbox = [
  -122.53807067871094,
  37.664526811638126,
  -122.35645294189455,
  37.821175249016726
  ]

var tiles = cover.tiles(turf.bboxPolygon(bbox).geometry, {min_zoom: 15, max_zoom: 15})

var opts = {
  zoom: 15,
  maxrate: .5,
  tileLayers: [
      {
        name: 'streets',
        url: 'https://b.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1IjoicmVkdWNlciIsImEiOiJrS3k2czVJIn0.CjwU0V9fO4FAf3ukyV4eqQ',
        layers: ['building']
      }
    ],
  map: __dirname+'/train.js'
};

var q = queue(1)


var tilereduce = TileReduce(tiles, opts);

var buildings = turf.featurecollection([]);
var images = []

tilereduce.on('reduce', function(result){
  buildings.features = buildings.features.concat(result.buildings.features)
  images = images.concat(result.images)
});

tilereduce.on('end', function(error){
  fs.writeFileSync(__dirname+'/buildings.geojson', JSON.stringify(buildings))
  fs.writeFileSync(__dirname+'/images.geojson', JSON.stringify(images))
});

tilereduce.run();
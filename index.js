var request = require('request')
var rimraf = require('rimraf')
var fs = require('fs')
var tilebelt = require('tilebelt')
var turf = require('turf')
var cover = require('tile-cover')
var TileReduce = require('tile-reduce')
var queue = require('queue-async')

var bbox = [
   -122.51017570495604,
    37.721645502787695,
    -122.49017715454102,
    37.733864951500955
  ];

var tiles = cover.tiles(turf.bboxPolygon(bbox).geometry, {min_zoom: 15, max_zoom: 15});
//tiles =[[5233,12670,15]]

var opts = {
  zoom: 15,
  maxrate: 1,
  tileLayers: [
      {
        name: 'streets',
        url: 'https://b.tiles.mapbox.com/v4/mapbox.mapbox-streets-v6/{z}/{x}/{y}.vector.pbf?access_token=pk.eyJ1IjoicmVkdWNlciIsImEiOiJrS3k2czVJIn0.CjwU0V9fO4FAf3ukyV4eqQ',
        layers: ['building']
      }
    ],
  map: __dirname+'/download.js'
};

var tilereduce = TileReduce(tiles, opts);

var images = [];

tilereduce.on('reduce', function(result){
  console.log(images.length)
  images = images.concat(result);
});

tilereduce.on('end', function(error){
  fs.writeFileSync(__dirname+'/images.json', JSON.stringify(images));
});

tilereduce.run();
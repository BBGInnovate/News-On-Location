(function() {
	maphelper= {
	
	
		deg2rad:function(angle){
			return(angle/180)*Math.PI;
		}, //deg2rad
	  
		rad2deg:function(angle){
			return angle*57.29577951308232;
		}, //rad2deg
	
		getPolySingleAxisCoords:function(poly, coord_index){
			//return an array of either the lng or lat coords given a polygon array
			//coord_index param switches the lat/lng order
			//for example geojson is [lng/lat] so we'd use "1" to return the correct Latitude val
			var axisCoords = [];
			for (var i = 0; i < poly.length; i++) {
				var points = poly[i];
				for(var j = 0; j < points.length; j++){
					var point = points[j];
					for(var k = 0; k < point.length; k++){
						var coord = point[k];
						//y/latitude is the second of the pair in geojson
						if(k == coord_index){
							axisCoords.push(coord);
						}
					}
				}
			}
			return axisCoords;
		},//getPolySingleAxisCoords
		
		geoCoordsToPointsArray:function(poly){
			//convert the geometry.coordinates nested array of polygon coordinates returned in the geojson
			//as an array of "point" objects  ie. {"lng":77.999, "lat": 34.245}
			var result = [];
			for (var i = 0; i < poly.length; i++) {
				var points = poly[i];
				for(var j = 0; j < points.length; j++){
					var point = points[j];
					//the new x/y object which will be added to result array
					//CHANGEJOE - chnage point to object 
					//var pointObj = new Point;
					var pointObj = new Object();
					
					for(var k = 0; k < point.length; k++){
						//loop through final coords, round to 6 decimal places
						var coord = point[k];
						if(k == 0){
							pointObj.lng = coord;
						} else if(k == 1){
							pointObj.lat = coord;
						}
					}
					result.push(pointObj);
				}
			}
			return result;
		}, //geoCoordsToPointsArray
	
		isPointInPoly:function(x, y, xp, yp){
			//determine if a given point is within a polygon
			//xp is an array of the Longitude values,
			//yp is an array of the Latitude values,
			//x is the Longitude of the point you are looking for,
			//y is the Latitude of the point you are looking for 
			
			//check if within poly
			var i, j, c = 0, npol = xp.length; 
			
			for (i = 0, j = npol-1; i < npol; j = i++) { 
				if ((((yp[i] <= y) && (y < yp[j])) || 
					((yp[j] <= y) && (y < yp[i]))) && 
					(x < (xp[j] - xp[i]) * (y - yp[i]) / (yp[j] - yp[i]) + xp[i])) { 
					c =!c; 
				} 
			}
			return c;
		
		},//isPointInPoly
		
		
	} //end maphelper object definition
}).call(this);	//ends anonymous function from top of file
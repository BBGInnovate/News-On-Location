(function() {
	feature= {
		nearbyFeaturesContains:function(id){
			//does a given feature object already exist in the nearbyFeatures array?
			for (var i = 0; i < app.nearbyFeatures.length; i++) {
				if(app.nearbyFeatures[i].properties.id == id){
					return true;
				}
			}
			return false;
		},//nearbyFeaturesContains
		
		updateNearbyCount: function(){
			//var numNearbyItems = jQuery("#nearby-list li").length;
			var numNearbyItems = app.nearbyFeatures.length;
			if(numNearbyItems > 0){
				jQuery('footer#nav ul li.list-tab span.ui-li-count').text(numNearbyItems);
				jQuery('footer#nav ul li.list-tab span.ui-li-count').show();
			} else {
				jQuery('footer#nav ul li.list-tab span.ui-li-count').hide();
			}
		}, //updateNearbyCount
	
		getFeatureLists:function(){
			//check if the user's position has been stored locally, and if so, update app.userLocation with those values
			if(localStorage.userLocation){
				var storedUserLoc = JSON.parse(localStorage.userLocation);
				if(!isNaN(storedUserLoc.lat)){
					app.userLocation[1] = storedUserLoc.lat;
				}
				if(!isNaN(storedUserLoc.lat)){
					app.userLocation[0] = storedUserLoc.lng;
				}
			}
			
			//create the list page from json featurecollection
			var featureCollection = app.getGeoJSON(app.featuresUrl);
			//TODO validate json or dialog error message
			var placelist = jQuery("#places-list");
			var markup = [];
			//reset the features arrays
			app.allFeatures = [];
			app.nearbyFeatures = [];
			app.withinFeature = [];
			var listItems, isNearby, isWithin, locationMessage, messageClass, html;
			
			//loop throug the feature collection
			jQuery.each(featureCollection, function(index, value){
				
				if ( value && typeof value === 'object' ) {
				
					jQuery.each(value, function(index, value){
						//we're using the "Polygon" objects for "nearby" information
						if(value.geometry.type == 'Polygon'){
							//the raw geojson array
							var polyCoords = value.geometry.coordinates;
							//coords converted to an array of Point objs
							var polyCoordsAsPoints = maphelper.geoCoordsToPointsArray(polyCoords);
							
							//the arrays of x and y coords used to see if user is within a polygon
							var latCoords = app.getPolySingleAxisCoords(polyCoords, 1);
							var lngCoords = app.getPolySingleAxisCoords(polyCoords, 0);
							
							//create a Contour from poly Points and get the center point
							var con = new Contour(polyCoordsAsPoints);
							center = con.centroid();
							
							//build a new "nearby" polygon X number of meters from the original poly center point
							var returnType = "array";
							topRightPoint = app.getDueCoords(center.lat, center.lng, 45, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
							bottomRightPoint = app.getDueCoords(center.lat, center.lng, 135, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
							bottomLeftPoint = app.getDueCoords(center.lat, center.lng, 225, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
							topLeftPoint = app.getDueCoords(center.lat, center.lng, 315, app.nearbyDistance, app.nearbyUnitOfMeasure, returnType);
							var nearbyPolyCoords = [[topRightPoint, bottomRightPoint, bottomLeftPoint, topLeftPoint]];
							//test if user is near or at this poly
							isNearby = app.isPointInPoly(app.userLocation[1], app.userLocation[0], app.getPolySingleAxisCoords(nearbyPolyCoords, 0), app.getPolySingleAxisCoords(nearbyPolyCoords, 1));
							isWithin = app.isPointInPoly(app.userLocation[1], app.userLocation[0], latCoords, lngCoords);
							//TODO : WHY IS THIS FAILING ON THE PLACES PAGE!!!!
							console.log('is nearby: ' + isNearby + ' user: ' + app.userLocation[1] + ', ' + app.userLocation[0]);
							console.log('is within: ' + isWithin + ' user: ' + app.userLocation[1] + ', ' + app.userLocation[0]);
							
							if(isWithin === true){
								value.properties.locationMessage = app.withinMessage;
								value.properties.messageClass = app.withinClass;
								//add the "secret" value to this item
								value.properties.secret = true;
								app.showFeatureAlert(value);
								app.withinFeature.push(value);
								app.nearbyFeatures.push(value);
							} else if(isNearby === true){
								value.properties.locationMessage = app.nearbyMessage;
								value.properties.messageClass = app.nearbyClass;
								//TODO get the distance the current location is away from the nearby feature, and output to list
								value.properties.secret = false;
								app.nearbyFeatures.push(value);
							} else {
								//set dynamic properties defaults
								value.properties.locationMessage = '';
								value.properties.messageClass = '';
								value.properties.secret = false;
							}
							//all features are add to the array of all items
							app.allFeatures.push(value);
							exists = app.nearbyFeaturesContains(value.properties.id);
						} //end if Polygon
					});  //end inner foreach
				}  //end if object
			}); //end outer foreach
			
			app.outputFeatureList(app.allFeatures, placelist);
		}, //getFeatureLists
		
		outputFeatureList:function(featuresArray, containerElem){
			//given an array of feature(s) and a container element, output list markup to that element
			if(featuresArray.length > 0){
				markup = [];
				//TODO: if secret content is available reorder/move to the top of the list in array.
				jQuery.each(featuresArray, function(index, value){
					var feature = featuresArray[index];
					var secretClass = '';
					if(feature.properties.secret && feature.properties.secret === true){
						secretClass = 'secret';
					} 
					html = '<li id="' + feature.properties.id + '" class="' + secretClass + '">';
					html += '<h3>' + feature.properties.name + '</h3>';
					html += '<p>' + feature.properties.description + '</p>';
					html += '<p class="' + value.properties.messageClass + '">' + value.properties.locationMessage + '</p>'
					html += '</li>';
					markup[index] = html;
				});
				
				//replace container elem's html with new content
				containerElem.html(markup.join(''))
				
				//click handler for list items, display list detail
				containerElem.children('li').bind('click', function(e) {
					e.preventDefault();
					//hide feature dialog
					jQuery('.feature-dialog').hide();
					//get the clicked elem as a string
					li = jQuery(this).get(0).outerHTML;
					var data = app.getFeatureDetail(li);
					if(app.debug){
						console.log("clicked id is : " + data.id);
						console.log("secret?: " + data.secret);
					}
					app.popDetailDialog(data.id, data.secret, "");
				});
				app.updateNearbyCount();
			}
		}, //outputFeatureList
	}
}).call(this);	//ends anonymous function from top of file
(function() {
    var nol = {
        map:{},
	mapType: 'local', //type of map to display local (using geolocation) or static (based on collection location)
        debug: true,
        defaultPosition:{
            coords: {
                latitude: '38.8942',
                longitude: '-77.0365',
            }
        }, //default to the Washington Monument, updated with HTML5 geo location
        collectionPosition:{
            coords: {
                latitude: '',
                longitude: '',
            }
        }, //coords of the current collection
	collectionId: '50292e380f660208b60000cd', //default collection id (DC)
        geoOptions: {
            timeout: 60000,
            maximumAge: 0,
            enableHighAccuracy: true
        },
	infoBoxOptions: {
	    maxWidth: 0,
	    zIndex: 999,
	    disableAutoPan: true
	},
	info: function(){
	    //create new InfoBox object
	    var box = InfoBox(nol.infoBoxOptions);
	    return box;
	},
	SRAuthToken: 'akbvXCscmepqRYF2ukZH',
	prefix: 'nol_',
	collections: [],
	//TODO: add map styles to nol obj
        locationAware: false,
        nearbyDistance: 125, //distance from center point
        nearbyUnitOfMeasure: "meters", //unit of measurement to use with nearbyDistance
        defaultMapZoom: 17,
        mapMarkers: [], //array of placed markers
	storyFeatures: [], //array of stories features
	socialFeatures: [], //array of social media features
        withinFeature: [], //current feature the user is "within"
        visitedFeatures: [],
        markersPlaced:false,
        log:function(str) {
            if( nol.debug ) {
                console.log(str);
            }
        },
	resizeMapContainer:function() {
	    var content, contentHeight, footer, header, viewportHeight;
	    window.scroll(0, 0);
	    header = $("#map-page .header");
	    footer = $("#map-page .footer");
	    content = $("#map-page #map-content");
	    viewportHeight = $(window).height();
	    contentHeight = viewportHeight - header.outerHeight() - footer.outerHeight();
	    //$("article").first().height(contentHeight);
	    return $("#map_canvas").height(contentHeight);
	}, //resizeContentArea

        initMap: function() {
            var mapOptions = {
              zoom: nol.defaultMapZoom,
              mapTypeId: google.maps.MapTypeId.ROADMAP
            };
            nol.map = new google.maps.Map(document.getElementById('map_canvas'),mapOptions);
            var styledMapOptions = {
              name: 'NOL Map'
            };
            var nolMapType = new google.maps.StyledMapType(nolMapStyles, styledMapOptions);
            nol.map.mapTypes.set('nolmap', nolMapType);
            nol.map.setMapTypeId('nolmap');
	    
	    //create the InfoBox
	    infobox = new InfoBox(nol.infoBoxOptions);
	    google.maps.event.trigger(nol.map, 'resize');

		    
            // HTML5 geolocation
            if(navigator.geolocation) {
              var dot = null;
              nol.locationAware = true;
              navigator.geolocation.getCurrentPosition( nol.getPositionSuccess, nol.getPositionError );
            } else {
              // Browser doesn't support Geolocation
              handleNoGeolocation(false);
            }
	    
        }, //initMap
        
        getPositionSuccess: function( position ) {
	    
	    if(nol.mapType == 'local'){
		//set up local map
		//set default to user's postion
		nol.defaultPosition.coords.latitude  = position.coords.latitude;
		nol.defaultPosition.coords.longitude = position.coords.longitude;
		
		//add the user dot
		dot = nol.placeUserMarker( position.coords.latitude, position.coords.longitude );
				
		//place markers on map
		if(!nol.markersPlaced){
		    nol.placeFeatureMarkers();
		    //set search coords and map "twitter" features
		    nol.twitterOptions.search.latitude = position.coords.latitude;
		    nol.twitterOptions.search.longitude = position.coords.longitude;
		    nol.getTweets(nol.twitterOptions);
		}
		// Watch the user's positon for change (similar to javascript setInterval)
		var positionTimer = navigator.geolocation.watchPosition(
		    function( position ){
			// newer position has been found.
			nol.log( "Newer Position Found" );
			// Set the new position of the existing marker.
			nol.updateUserMarker( dot, position.coords.latitude, position.coords.longitude );
		    }
		);
	    } else {
		//set up static map
		nol.getStaticPosition();
	    }
	    
        }, //getPostionSuccess
	
	handleNoGeolocation: function(){
              //TODO: browser doesn't support geolocation so use 'static' map
	},
        getPositionError: function(){
	    //fallback to the static map
	    nol.getStaticPosition();
            //TODO display message to user
            nol.log('Error: Couldn\'t get current position');
        }, //getPositionError
	
	getStaticPosition: function(){
	    var pos = new google.maps.LatLng(nol.collectionPosition.coords.latitude, nol.collectionPosition.coords.longitude);
	    nol.map.setCenter(pos);
	    
	    //place markers on map
	    if(!nol.markersPlaced){
		nol.placeFeatureMarkers();
		//set search coords and map "twitter" features
		nol.twitterOptions.search.latitude = nol.collectionPosition.coords.latitude;
		nol.twitterOptions.search.longitude = nol.collectionPosition.coords.longitude;
		nol.getTweets(nol.twitterOptions);
	    }
	    
	}, //getStaticPosition
	
	getCollections: function(){
	    //get all available storageroom collections
	    var entriesUrl;
            $.ajax({
                url: 'http://api.storageroomapp.com/accounts/50292cbb0f66027a9d0001e6/collections.json',
                data: {
                  auth_token: nol.SRAuthToken,
                  per_page: 50,
		  meta_prefix: nol.prefix //change storageroom's default '@' prefix
                },
                dataType: 'json',
                async: false,
                success: function(data) {
		    //reset collection storage
		    nol.collections = [];
		    //check each collection and compare with user's current location
		    var compare = false;
		    _.each(data.array.resources, function( collection, index ){
			//Convert the collections response into geojson
			var collectionObj = { 'type': 'Feature' };
			entriesUrl = collection.nol_entries_url;
			collectionObj.geometry = { 
			    type: 'Point',
			    coordinates: ['', ''] //lat/lng are updated in the compare function
			};
			collectionObj.properties = {
			    type: "storageroomapp_collection",
			    nol_entries_url: entriesUrl,
			    local: false,
			    id: _.str.strLeftBack( _.str.strRightBack(entriesUrl, '/collections/'), '/entries'), //strip the collection id from nol_entries_url
			    title: collection.name,
			    map: '',
			    html: collection.note,
			    code: '',
			};
			//store the newly built collection
			nol.collections.push( collectionObj );
		    });
		    
		    //compare the collections
		    _.each(nol.collections, function( collection, index){
			compare = nol.compareCollection( collection );
		    });
		    
		    nol.outputList(nol.collections, 'collection', 'collections-list');
		    nol.log('The collections array: ');
		    nol.log(nol.collections);

                },
                error: function() {
                  nol.log("unable to retreive collections data from StorageRoom.");
                }
            });
	        
	}, //getCollections
	
	compareCollection:function( collection ){
	    //given a collection, get one entry from the collection, and check if the user is near that location
	    //need to append '.json' to the storageroom collection entry url for non-async call
	    var entryUrl = collection.properties.nol_entries_url + '.json';
	    //get the first entry from collection and compare to current location
            $.ajax({
                url: entryUrl,
                data: {
                  auth_token: nol.SRAuthToken,
                  per_page: 1,
		  meta_prefix: nol.prefix,
                },
                dataType: 'json',
                async: false,
                success: function(data) {
		    //get the first entry's location as the feature to use for comparison
		    var feature = data.array.resources[0];
		    if (feature.location.lat !== null && feature.location.lng !== null){
			//testCoordinates = [ new google.maps.LatLng(39.16414104768742, -77.4755859375),new google.maps.LatLng(39.18117526158749, -76.5087890625),new google.maps.LatLng(38.71980474264237, -76.5087890625),new google.maps.LatLng(38.548165423046584, -77.58544921875) ];
			//get circular points for a polygon 5 miles from the user's current location
			circleCoords = nol.getCirclePoints(new google.maps.LatLng(nol.defaultPosition.coords.latitude, nol.defaultPosition.coords.longitude), 5);
			polyOptions = { path: circleCoords };
			var comparePoint = new google.maps.LatLng(feature.location.lat, feature.location.lng);
			var comparePolygon = new google.maps.Polygon(polyOptions);
			var isWithinPolygon = comparePolygon.containsLatLng( comparePoint );
			if(isWithinPolygon){
			    //set the local collection location
			    _.each(nol.collections, function( savedCollection, index ){
				if( savedCollection.properties.id === collection.properties.id){
				    savedCollection.properties.local = true;
				    savedCollection.geometry.coordinates[0] = feature.location.lat;
				    savedCollection.geometry.coordinates[1] = feature.location.lng;
				    nol.collectionId = collection.properties.id;
				    nol.log('compareCollection: set the collection id: ' + nol.collectionId);
				}
			    });
			    
			} 
		    }
                },
                error: function(error) {
		    nol.log('unable to retreive entry data for StorageRoom collection: ' + error.statusText);
                }
            });
	    
	}, //compareCollection
	
	
	getCirclePoints: function( center, radius, numPoints ){
	    var circlePoints = Array();
	    var bounds = new google.maps.LatLngBounds();
	    numPoints = numPoints || 32;
	    with (Math) {
		var rLat = (radius/3963.189) * (180/PI); // miles
		var rLng = rLat/cos(center.lat() * (PI/180));
		
		for (var a = 0 ; a < 361 ; a++ ) {
		    var aRad = a*(PI/180);
		    var x = center.lng() + (rLng * cos(aRad));
		    var y = center.lat() + (rLat * sin(aRad));
		    var point = new google.maps.LatLng(parseFloat(y),parseFloat(x),true);
		    circlePoints.push(point);
		}
	    }
	    return circlePoints;
	},

        placeUserMarker: function( latitude, longitude ){
            nol.defaultPosition.coords.latitude  = latitude;
            nol.defaultPosition.coords.longitude = longitude;

            // define the 'you are here' marker image
            var userMarker = new google.maps.Marker({
                map: nol.map,
                position: new google.maps.LatLng( latitude, longitude ),
                clickable: false,
                icon: {
                  path: google.maps.SymbolPath.CIRCLE,
                  fillOpacity: 1.0,
                  fillColor: '#2345A1',
                  strokeWeight: 0,
                  scale: 3
                },
                optimized: false
            });
            // Create the radius circle around user marker
            var circle = new google.maps.Circle({
              map: nol.map,
              radius: 100, //meters
              clickable: false,
              strokeColor: '#2345A1',
              strokeWeight: 1,
              strokeOpacity: 0.5,
              fillColor: '#6386E6',
              fillOpacity: 0.2,
            });
            //bind radius circle to user marker
            circle.bindTo('center', userMarker, 'position');
	    //animate the circle radius
	    var toggle = true;
	    setInterval(function(){
		toggle = (toggle) ? false : true;
		if(toggle){
		    circle.setRadius(circle.radius + 20)
		    circle.setOptions({strokeOpacity: 0.25, fillOpacity: 0.05,});
		}else{
		   circle.setRadius(circle.radius - 20)
		    circle.setOptions({strokeOpacity: 0.5, fillOpacity: 0.2,});
		}
	    }, 1000);
	    //center map on marker
	    nol.map.panTo(userMarker.getPosition());
	    
            nol.log('Placing inital user position');
            // Return the new marker reference.
            return( userMarker );
        }, //placeUserMarker
       

      // I update the marker's position and label.
        updateUserMarker: function( marker, latitude, longitude ){
            // Update the position.
            marker.setPosition(
              new google.maps.LatLng( latitude, longitude )
            );
            nol.log('Checking if updated user position is at any NOL locations');
	    //test if user is in at a location
            nol.youAreHere();

        }, //updateUserMarker

        placeFeatureMarkers: function( geojson ){
            nol.log("Placing feature markers...");
            //set default geojson if param not given
	    geojson = geojson || nol.getGeoJSON();

            //reset
            nol.mapMarkers = [];
            nol.withinFeature = [];

            var listItems, isNearby, isWithin, locationMessage, messageClass, html;
            if(geojson){
		    var features = geojson.features;
                    _.each(features, function(feature, index){
                        //each json feature obj in the collection arrray
                        if (feature.geometry.coordinates[0] !== null && feature.geometry.coordinates[1] !== null){
                                var markerCoords = new google.maps.LatLng(feature.geometry.coordinates[0], feature.geometry.coordinates[1]);
				markerOptions = {
				    map: nol.map,
                                    position: markerCoords,
                                    title: feature.properties.title
				}
                                //change marker options and save feature based on map type value.properties.type = storageroom || twitter
                                if(typeof feature.properties.type != 'undefined' && feature.properties.type === 'twitter'){
				    markerOptions.icon = 'img/twitter-marker.png';
				    nol.socialFeatures.push( feature );
				} else {
				    nol.storyFeatures.push( feature );
				}
				
                                //create the marker, adding the placeholder InfoBox
                                var marker = new google.maps.Marker(markerOptions);
                                //attach json data to marker obj
                                marker.featureInfo = feature;
                                //build the array of markers to be added to the map
                                nol.mapMarkers.push( marker );
				
                                //nol.log("Pushing marker " + index + ": " + feature.properties.title);
                        }
                    });
                    
                    //add event listener to each marker for info window
                    _.each(nol.mapMarkers, function( marker, index ){
                        google.maps.event.addListener( marker, 'click', function(){
			    //center map to selected marker
			    nol.map.panTo(marker.getPosition());
                            // get the info window content from the feature obj
                            var content = nol.getInfoContent( this.featureInfo );
                            infobox.setContent(content);
                            infobox.open(nol.map, this);
                            google.maps.event.addListenerOnce( marker, "visible_changed", function() {
                                infobox.close();
                            });

                        });
                    });
		    
		//create the features list views
		nol.log('nol.storyFeatures: ');
		nol.log(nol.storyFeatures);
		nol.outputList(nol.storyFeatures, 'feature', 'stories-list');
		nol.outputList(nol.socialFeatures, 'feature', 'social-list');
		
            }
            
        }, //placeFeatureMarkers
        
        youAreHere:function(){
            //TRUE if current user location is "within" a feature
            var found = false;
            _.each(nol.storyFeatures, function(feature, index){
                    //build polygon X number of meters around the marker point
                    var returnType = "obj";
                    topRightPoint = nol.getDueCoords(feature.geometry.coordinates[0], feature.geometry.coordinates[1], 45, nol.nearbyDistance, nol.nearbyUnitOfMeasure, returnType);
                    bottomRightPoint = nol.getDueCoords(feature.geometry.coordinates[0], feature.geometry.coordinates[1], 135, nol.nearbyDistance, nol.nearbyUnitOfMeasure, returnType);
                    bottomLeftPoint = nol.getDueCoords(feature.geometry.coordinates[0], feature.geometry.coordinates[1], 225, nol.nearbyDistance, nol.nearbyUnitOfMeasure, returnType);
                    topLeftPoint = nol.getDueCoords(feature.geometry.coordinates[0], feature.geometry.coordinates[1], 315, nol.nearbyDistance, nol.nearbyUnitOfMeasure, returnType);
                    var nearbyPolyCoords = [[topRightPoint, bottomRightPoint, bottomLeftPoint, topLeftPoint]];
                    //get seperate arrays of lat and lng coords for testing "within" condition
                    latCoords = [topLeftPoint.lat, topRightPoint.lat, bottomRightPoint.lat, bottomLeftPoint.lat];
                    lngCoords = [topLeftPoint.lng, topRightPoint.lng, bottomRightPoint.lng, bottomLeftPoint.lng];
                    isWithin = nol.isPointInPoly(nol.defaultPosition.coords.latitude, nol.defaultPosition.coords.longitude, latCoords, lngCoords);
                    //If the user is located at this location, display the popup content
                    if(isWithin === true){
                        if(nol.isNewFeature(feature.properties.id)){
			    //TODO: what did i want to do with withinFeature?
                            nol.withinFeature.push(feature);
                            //Open the infobox of the found featured item
                            var currentMarker = nol.getMarkerById(feature.properties.id);
			    if(currentMarker){
				nol.log('You are at feature ' + currentMarker.featureInfo.properties.id + ': ' + currentMarker.featureInfo.properties.title);
				var contentElement = nol.getInfoContent(currentMarker.featureInfo);
				$(contentElement).prepend('<p class="alert-box success">You are here!</p>');
				infobox.setContent(contentElement);
				infobox.open(nol.map, currentMarker);
			    }
                            found = true;
                        }
                    }
            });
            return found;
	}, //youAreHere
	
	outputList:function( listItemArray, listType, containerElemId ){
	//given an array of items, listType (collections or features) and a container element, output list markup to that element
	  if(listItemArray.length > 0){
	    markup = [];
	    var collectionId, itemClass;
	    if( listType === 'feature' ){
		_.each(listItemArray, function(feature, index){
		    //create a features list
		    html = '<li id="feature-' + feature.properties.id + '">';
		    if(typeof feature.properties.type != 'undefined' && feature.properties.type === 'twitter'){
			html += '<img src="' + feature.properties.profile_image_url + '" />'
			html += '<h3>' + feature.properties.user + '</h3>';
			html += '<p>' + feature.properties.text + '</p>';
		    } else {
			html += '<h3>' + feature.properties.title + '</h3>';
		    }
		    html += '</li>';
		    markup[index] = html;
		});
	    } else if( listType === 'collection' ){
		_.each(listItemArray, function(collection, index){
		    //create a collections list
		    if( collection.local ){
			itemClass = 'local';
		    } else {
			itemClass = '';
		    }
		    html = '<li id="' + collection.properties.id + '" class="' + itemClass + '">';
		    if(typeof collection.properties.type != 'undefined' && collection.properties.type === 'storageroomapp_collection'){
			html += '<h3>' + collection.properties.title + '</h3>';
			html += '<p>' + collection.properties.html + '</p>';
			if( collection.properties.local ){
			    html += '<p class="youarehere">You are here!</p>';
			}
		    } 
		    html += '</li>';
		    markup[index] = html;
		});

	    }
	    
	    var containerElem = $('#' + containerElemId);
	    //replace container elem's html with new content
	    containerElem.html( markup.join('') );
	    
	    //click handler for list items, display list detail for feature or go to map for collection
	    containerElem.children('li').bind('click', function(e) {
		e.preventDefault();
		//get the clicked elem id
		clickedItemId = $(this).attr('id');
		clickedItemId = clickedItemId.replace('feature-','');
		if( listType == 'feature' ){
		    _.each(nol.storyFeatures, function(storyFeature, index){
			//populate the #detail-page with the correct storeageroom feature content
			if(storyFeature.properties.id == clickedItemId && storyFeature.properties.type !== 'twitter'){
			    var detailContent = nol.getInfoContent(storyFeature);
			    //add data to the detail page content container
			    $("#detail-page div:jqmData(role='content')").html(detailContent);
			    $.mobile.changePage( $('#detail-page'), { transition: "slide" });
			    
			}
		    });
		} else if( listType === 'collection' ){
		    nol.collectionId = clickedItemId;
		    //set the collectionPosition of the clicked collection if
		    _.each(nol.collections, function(collection, index){
			if(collection.properties.id == clickedItemId && collection.properties.local){
			    //show the map using the user's geolocation
			    nol.mapType = 'local';
			    $.mobile.changePage( $('#map-page'));
			} else {
			    //show the map using the collection's location
			    nol.collectionPosition.coords.latitude = collection.geometry.coordinates.lat;
			    nol.collectionPosition.coords.latitude = collection.geometry.coordinates.lng;
			    nol.mapType = 'static';
			    $.mobile.changePage( $('#map-page'));
			}
		    });
		    
		    //TODO refresh the map?
		}
	      });

			
	    //init or refresh the listview so JQM styles are applied
	    if (containerElem.hasClass('ui-listview')) {
		containerElem.listview('refresh');
	    } else {
		containerElem.trigger('create');
	    }
	  }
	}, //outputList

	getMarkerById: function( id ){
	    var theMarker = null;
	    _.each(nol.mapMarkers, function( marker, index ){
		if(marker.featureInfo.properties.id == id){
		    theMarker = marker;
		}
	    });
	    return theMarker;
	}, //getMarkerById
	
        isNewFeature:function( id ){
            //check if a secret feature (by "id") has already been viewed
            for (var i = 0; i < nol.visitedFeatures.length; i++) {
                if(nol.visitedFeatures[i] == id){
                    nol.log(id + ' is NOT a new feature.');
                    return false;
                }
            }
            return true;
        }, //isNewFeature
		
        saveViewedFeatures:function(id){
            //add feature to the visited array if it doesn't exist already
            var alreadyVisted = false;
            for (var i = 0; i < nol.visitedFeatures.length; i++) {
                if(nol.visitedFeatures[i] == id) {
                        alreadyVisted = true;
                }
            }
            if(!alreadyVisted){
                nol.visitedFeatures.push(id);
                //save in localStorage for debugging
                //localStorage.viewedFeatures = nol.visitedFeatures.join();
            }
        }, //saveViewedFeatures

        getInfoContent:function(data){
            //given a 'feature' obj build a content element to display in info window
            if ( _.isObject(data) ) {
                    //create an DOM element to hold content
                    var content = document.createElement("DIV");
                    //add featureInfo to content
                    $(content).addClass('info-' + data.properties.type);
                    if(data.properties.type == 'storageroomapp'){
                        $(content).append('<h3>' + data.properties.title + '</h3>');
                        $(content).append(data.properties.code);
                        $(content).append(data.properties.html);
                    } else if(data.properties.type == 'twitter'){
                        $(content).append('<img src="' + data.properties.profile_image_url + '" />');
                        $(content).append(data.properties.time + '<br />' + data.properties.text);
                    }
            }
            return content;
	},//getInfoContent

        getGeoJSON: function(){
            var result = false;
            $.ajax({
                url: 'http://api.storageroomapp.com/accounts/50292cbb0f66027a9d0001e6/collections/' + nol.collectionId + '/entries.json',
                data: {
                  auth_token: nol.SRAuthToken,
                  per_page: 50,
		  meta_prefix: nol.prefix
                },
                dataType: 'json',
                async: false,
                success: function(data) {
                    //Convert storeageroom app data to geojson
                    var points = { 'type': 'FeatureCollection',
                        'features': []
                    };
                    _.each(data.array.resources, function(resource) {
                        points.features.push({
                            type: 'Feature',
                            geometry: { 
                                type: 'Point',
                                coordinates: [resource.location.lat, resource.location.lng] 
                            },
                            properties: {
                                    type: "storageroomapp",
                                    id: _.random(1, 100000), //generate a random num for item id
                                    title: resource.title,
                                    map: resource.map,
                                    html: resource.html,
                                    code: resource.code,
                            }
                        });
                    
                    });
                  nol.log('Storeageroom ajax request... ');
                  result = points;
                },
                error: function() {
                  nol.log("unable to retreive remote data from StorageRoom.");
                }
            });

            return result;
        }, //getGeoJSON
	
	twitterOptions: {
	    params: {
		    rpp: 50, //results per page
		    result_type: 'recent'
	    },
	    tweets: [], //temp container for data from twitter
	    //search: ['38.895112','-77.036366','1mi'],   //default search properties (lat,lng,radius)
	    search: {
		latitude: '38.895112',
		longitude: '-77.036366',
		radius: '1mi'
	    }
	}, //twitterOptions
	
	getTweets: function( options ) {
	    //add search terms
	    //twitterOptions.params.terms = terms;
	    params = options.params;
	    //convert geo array to string
	    params.geocode = _.values(options.search).join();
	    params = '?' + _.map(params, function(num, key) {
		return key + "=" + num;
	    }).join('&');
	    nol.log('final twitter params: ' + params);
	    $.ajax({
		url: 'http://search.twitter.com/search.json' + params,
		dataType: 'jsonp', //adds callback to url
		async: false,
		success: function(data) {
		    console.log('twitter ajax success!');
		    nol.processTweet(data);
		},
		error: function() {
		    console.log('unable to receive data from twitter');
		}
	    });
	    
	},
	
	// Extract relevant data from tweets
	processTweet: function(d) {
		//TODO combine this function with mapTweets, just saving the geojson to tweets array??
	    var lat, lng;
	    _.each(d.results, function(element, index) {
		if (element.geo && element.geo.type === 'Point') {
		    lat = element.geo.coordinates[0]; // Twitter seems to reverse the
		    lng = element.geo.coordinates[1]; // order of geojson coordinates
			
		} else if (element.location && element.location.indexOf(': ') > 0) {
		    var coords = element.location.split(': ')[1],
			$lat = coords.split(',')[0] || 0,
			$lng = coords.split(',')[1] || 0;
	
		    if (!isNaN(parseFloat($lat)) && !isNaN(parseFloat($lng))) {
			lng = parseFloat($lng);
			lat = parseFloat($lat);
		    }
		}
		
		if (lat && lng) {
		    nol.twitterOptions.tweets.push({
			lng: lng,
			lat: lat,
			id: _.random(1, 100000),
			time: nol.formatDate(new Date(element.created_at)),
			text: element.text,
			user: '@' + element.from_user,
			profile_image_url: element.profile_image_url
		    });
		}
	    });
	    
	    if(nol.twitterOptions.tweets.length !== 0){
		nol.mapTweets();
	    }
	}, //processTweets
	
	mapTweets: function() {
	    var points = { 'type': 'FeatureCollection',
		'features': []
	    };
	
	    _.each(nol.twitterOptions.tweets, function(tweet) {
		points.features.push({
		    type: 'Feature',
		    geometry: { 
			type: 'Point',
			coordinates: [tweet.lat, tweet.lng] 
		    },
		    properties: {
			id: tweet.id,
			type: 'twitter',
			time: tweet.time,
			text: tweet.text,
			user: tweet.user,
			profile_image_url: tweet.profile_image_url
		    }
		});
	    
	    });
	    
	    //add markers to map
	    nol.placeFeatureMarkers( points );
	    
	}, //mapTweets
        	
	getDueCoords:function(lat, lng, bearing, distance, unit, returnType) {
            //Return a point used to draw a bounding box around a given center point based a certain distance from the point
            //for example, to get a 1km box around the point (lat/lng) :
            //topLeftCorner = getDueCoords(lat, lng, 315, 1, "km");
            //topRightCorner = getDueCoords(lat, lng, 45, 1, "km");
            //bottomRightCorner = getDueCoords(lat, lng, 135, 1, "km");
            //bottomLeftCorner = getDueCoords(lat, lng, 225, 1, "km");
            //adopted From:
            //http://www.richardpeacock.com/blog/2011/11/draw-box-around-coordinate-google-maps-based-miles-or-kilometers
            //requires rad2deg() and deg2rad() funcs which I've pasted from php.js
            
            //TODO what's going on here?? "meters" are ALWAYS used
            if (distance == "M") {
                    //distance is in miles.
                    radius = 3963.1676;
            } else if(distance == "km") {
                    // distance is in km.
                    radius = 6378.1;
            } else {
                    //distance in meters
                    radius = 6378100
            }
            
            var new_latitude = nol.rad2deg(Math.asin(Math.sin(nol.deg2rad(lat)) * Math.cos(distance / radius) + Math.cos(nol.deg2rad(lat)) * Math.sin(distance / radius) * Math.cos(nol.deg2rad(bearing))));
            var new_longitude = nol.rad2deg(nol.deg2rad(lng) + Math.atan2(Math.sin(nol.deg2rad(bearing)) * Math.sin(distance / radius) * Math.cos(nol.deg2rad(lat)), Math.cos(distance / radius) - Math.sin(nol.deg2rad(lat)) * Math.sin(nol.deg2rad(new_latitude))));
            
            var pointToReturn = nol.Point(new_latitude,new_longitude);
            if(returnType == "array"){
                    pointToReturn= [new_latitude, new_longitude];
            } 
            return pointToReturn;
	}, //getDueCoords

        deg2rad: function(angle){
	    return(angle/180)*Math.PI;
        }, //deg2rad
  
        rad2deg: function(angle){
                return angle*57.29577951308232;
        }, //rad2deg

        getPolySingleAxisCoords: function(poly, coord_index){
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
                                        if(k === 0){
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
        
        formatDate:function(d) {
                var hours = d.getHours();
                var minutes = d.getMinutes();
                var suffix = "AM";
                
                if (hours >= 12) {
                    suffix = "PM";
                    hours = hours - 12;
                }
                if (hours === 0){
		    hours = 12;
		}
                if (minutes < 10){
		    minutes = "0" + minutes;
		}
                
                return hours + ":" + minutes + " " + suffix;
        }, //formatDate
        
	Point: function( lat,lng ){
            var Point = {};
            Point.lat=lat
            Point.lng=lng;
            return Point;
	}, //Point

	Contour: function(points) {
            var Contour = {
		area: function() {
		    var area=0;
                    var pts = this.pts;
                    var nPts = pts.length;
                    var j=nPts-1;
                    var p1;
                    var p2;
                    
                    for (var i=0;i<nPts;j=i++) {
                            p1=pts[i]; p2=pts[j];
                            area+=p1.lat*p2.lng;
                            area-=p1.lng*p2.lat;
                    }
                    area/=2;
                    return area;
		},
		centroid: function() {
			var pts = this.pts;
			var nPts = pts.length;
			var lat=0;
			var lng=0;
			var f;
			var j=nPts-1;
			var p1; var p2;
			
			for (var i=0;i<nPts;j=i++) {
				p1=pts[i];
				p2=pts[j];
				f = (p1.lat * p2.lng) - (p2.lat * p1.lng);
				lat += (p1.lat + p2.lat) * f;
				lng += (p1.lng + p2.lng) * f;
			}
			f=this.area()*6;
			return new Point(lat/f,lng/f);
		},
                pts: points || [], // an array of Point objects defining the contour
            };
	    
            return Contour;
	}, //Contour

        
    } //app
    window.nol = nol;
    
    //
    //JQM init
    //
    $(document).on('pageinit', function(e, data){
	//disable ajax, which potential causes problems with the map
	$.mobile.ajaxEnabled = false;

        //initialize map  
        google.maps.event.addDomListener(window, 'load', nol.initMap);
	
        //center and zoom map on refresh button click
        $(".refresh-btn").on("click", function(event){
            var pos = new google.maps.LatLng(nol.defaultPosition.coords.latitude, nol.defaultPosition.coords.longitude);
            nol.map.panTo(pos);
            nol.map.setZoom(nol.defaultMapZoom);
        });
	
	//resize content on change
	$(window).bind('orientationchange pageshow resize', nol.resizeMapContainer);
	
    });
        
    //
    //JQM: Handle page changes
    //
    $(document).bind('pagebeforechange', function(e, data) {
	if(typeof(data.toPage) !== 'string'){
	    return;
	}
	//get the hashtag target
	var hashParts = $.mobile.path.parseUrl(data.toPage).hash.split('-');
	var index = -1;
	if(hashParts.length === 2){
	    index = parseInt(hashParts[1]);
	}
	var options = data.options;
	
	if(hashParts[0] === "#map"){
	 /*   //manually change to map page to avoid "Map already initialized" errors
	    e.preventDefault();
	    //nol.resizeMapContainer();
	    $.mobile.changePage($("#map-page"), {
		transition: "fade",
		role: "page",
		reverse: false,
		changeHash: true
	    });*/
	    //$("#map-page div:jqmData(role='page')").page('refresh', true)
	    //google.maps.event.trigger(nol.map,'resize');
	} else if(hashParts[0] === "#detail"){
	    e.preventDefault();
	} else {
	    return; // fall back to default behavior
	}
    });
    
    $('#collections-page').live( 'pageinit',function(event){
	nol.getCollections();
    });

   $('#map-page').live('pageshow',function(event, ui){
	//hack to resize the map
	//setTimeout(nol.resizeMapContainer(), 150);
	google.maps.event.trigger(nol.map,'resize');
     });
        
}).call(this);